"""Maintained async policy for admitted reads and ordinary end-user mutations.

Generated types describe responses; this module does not validate full response
schemas. Caller-injected transports/providers must cooperate with task cancellation.
"""
from __future__ import annotations

import asyncio
import inspect
import json
import math
import random
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from email.utils import format_datetime, parsedate_to_datetime
from types import MappingProxyType
from typing import Literal, Protocol, Self, TypeAlias, TypeVar, Generic, TypedDict, NotRequired, cast, override
from urllib.parse import quote, quote_plus, urlsplit

from .generated.models import JsonValue
from .generated.operations import BASE_URL, OPERATIONS, OPERATION_IDS


class UnsetType:
    """Omitted input, distinct from an explicitly supplied JSON null."""

    __slots__ = ()

    @override
    def __repr__(self) -> str:
        return "UNSET"


UNSET = UnsetType()
_T = TypeVar("_T")
_ResultT = TypeVar("_ResultT", covariant=True)


@dataclass(frozen=True, slots=True)
class CredentialContext:
    base_url: str
    cancel_event: asyncio.Event = field(repr=False)
    deadline: float


@dataclass(frozen=True, slots=True)
class Request:
    url: str = field(repr=False)
    headers: Mapping[str, str] = field(repr=False)
    cancel_event: asyncio.Event = field(repr=False)
    deadline: float
    method: str = "GET"
    body: bytes | None = field(default=None, repr=False)


async def _noop() -> None:
    return None


@dataclass(slots=True)
class Response:
    status: int
    headers: Mapping[str, str] = field(repr=False)
    body: AsyncIterator[bytes] | None = field(repr=False)
    url: str = field(default="", repr=False)
    redirected: bool = False
    close: Callable[[], Awaitable[None]] = field(default=_noop, repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            body_close = getattr(self.body, "aclose", None)
            if body_close is not None:
                await body_close()
        finally:
            await self.close()


class Transport(Protocol):
    async def send(self, request: Request) -> Response: ...


CredentialProvider: TypeAlias = Callable[[CredentialContext], str | Awaitable[str]]


class ClientOptions(TypedDict):
    credentials: str | CredentialProvider
    base_url: NotRequired[str]
    allow_loopback_http: NotRequired[bool]
    transport: NotRequired[Transport]
    timeout_ms: NotRequired[int]
    max_response_bytes: NotRequired[int]
    max_retries: NotRequired[int]


class RequestOptions(TypedDict, total=False):
    cancel_event: asyncio.Event
    timeout_ms: int
    max_retries: int


class MutationRequestOptions(TypedDict, total=False):
    cancel_event: asyncio.Event
    timeout_ms: int
    max_retries: Literal[0]


class PageOptions(RequestOptions, total=False):
    max_pages: int
    max_items: int


@dataclass(slots=True)
class _AttemptAdvice:
    retry_after: str | None = None
    retry_blocked: bool = False


@dataclass(frozen=True, slots=True)
class ReadResult(Generic[_ResultT]):
    status: int
    data: _ResultT | None = field(repr=False)
    headers: Mapping[str, str] = field(repr=False)


_MESSAGES = {
    "invalid_input": "Invalid private read-prototype input.",
    "credentials": "A valid explicit API credential is required.",
    "aborted": "The read was cancelled.",
    "deadline": "The read deadline expired.",
    "transport": "The API transport failed.",
    "redirect": "The API response attempted a redirect.",
    "invalid_response": "The API returned an unsupported or invalid response.",
    "response_too_large": "The API response exceeded the configured byte limit.",
    "http": "The API returned an HTTP error.",
    "pagination": "Pagination stopped at an invalid continuation or configured bound.",
}


class BotaApiError(Exception):
    """Fixed diagnostics; response bodies are available only by explicit access."""

    def __init__(self, kind: str, *, status: int | None = None,
                 headers: Mapping[str, str] | None = None, body: JsonValue = None) -> None:
        super().__init__(_MESSAGES[kind])
        self.kind = kind
        self.status = status
        self.headers: Mapping[str, str] = MappingProxyType(dict(headers or {}))
        self._body = body
        error = body.get("error") if isinstance(body, dict) else None
        error = error if isinstance(error, dict) else {}
        code, param = error.get("code"), error.get("param")
        self.code: str | None = code if isinstance(code, str) else None
        self.param: str | None = param if isinstance(param, str) else None
        value = error.get("request_id")
        self.request_id = value if isinstance(value, str) else self.headers.get("x-request-id")
        message = error.get("message")
        self._api_message: str | None = message if isinstance(message, str) else None

    @property
    def body(self) -> JsonValue:
        return self._body

    @property
    def api_message(self) -> str | None:
        return self._api_message

    @override
    def __repr__(self) -> str:
        return f"BotaApiError({str(self)!r})"


class BotaMutationError(BotaApiError):
    """Mutation failure; unknown means submission may have taken effect."""

    def __init__(self, kind: str, *, request_outcome: Literal["not_submitted", "unknown"],
                 status: int | None = None, headers: Mapping[str, str] | None = None,
                 body: JsonValue = None) -> None:
        super().__init__(kind, status=status, headers=headers, body=body)
        if kind in {"invalid_input", "aborted", "deadline"}:
            self.args = ({"invalid_input": "Invalid API mutation input.",
                          "aborted": "The mutation was cancelled.",
                          "deadline": "The mutation deadline expired."}[kind],)
        self.request_outcome = request_outcome

    @override
    def __repr__(self) -> str:
        return f"BotaMutationError({str(self)!r}, request_outcome={self.request_outcome!r})"


class BotaMutationCancelledError(asyncio.CancelledError):
    """Task cancellation retains asyncio semantics and exposes submission uncertainty."""

    kind: Literal["aborted"] = "aborted"

    def __init__(self, *, request_outcome: Literal["not_submitted", "unknown"]) -> None:
        super().__init__("The mutation was cancelled.")
        self.request_outcome = request_outcome

    @override
    def __repr__(self) -> str:
        return f"BotaMutationCancelledError(request_outcome={self.request_outcome!r})"


@dataclass(slots=True)
class _Submission:
    invoked: bool = False


ReadPrototypeError = BotaApiError
_LIST_OPERATIONS = frozenset(("getEndUsers", "getDevices", "getRecordings", "getTranscriptions", "getSummaries"))
_RETRY_OPERATIONS = frozenset(OPERATION_IDS)
_SAFE_INTEGER = 2**53 - 1
_Parameter = TypedDict("_Parameter", {"in": str, "name": str, "required": NotRequired[bool], "schema": Mapping[str, object]})


class _Definition(TypedDict):
    path: str
    parameters: list[_Parameter]


class _MutationDefinition(_Definition):
    method: str
    success_status: int


# Generated metadata has this reviewed container shape, not a second API schema.
_DEFINITIONS = cast(Mapping[str, _Definition], cast(object, OPERATIONS))


def _now() -> float:
    return time.perf_counter_ns() / 1_000_000_000


def _integer(value: object, default: int, maximum: int, minimum: int = 1) -> int:
    if value is UNSET:
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise BotaApiError("invalid_input")
    if not minimum <= value <= maximum or not math.isfinite(value) or value != math.floor(value):
        raise BotaApiError("invalid_input")
    return int(value)


def _checked_options(value: object, page: bool = False) -> Mapping[str, object]:
    if value is UNSET:
        return {}
    names = {"cancel_event", "timeout_ms", "max_retries"}
    if page:
        names.update(("max_pages", "max_items"))
    if not isinstance(value, Mapping) or any(name not in names for name in value):
        raise BotaApiError("invalid_input")
    if "cancel_event" in value and not isinstance(value["cancel_event"], asyncio.Event):
        raise BotaApiError("invalid_input")
    return cast(Mapping[str, object], value)


def _authority(scheme: str, netloc: str) -> str:
    # YARL supplies the same IDNA implementation used by the native adapter.
    # Only the authority is canonicalized here: opaque encoded path/query bytes
    # must not be decoded or requoted by an independent URL library.
    from yarl import URL

    parsed = URL(f"{scheme}://{netloc}")
    host = parsed.raw_host
    if host is None or host == "" or "@" in netloc or "%" in host:
        raise ValueError("invalid_authority")
    if ":" in host:
        import ipaddress
        host = f"[{ipaddress.IPv6Address(host).compressed}]"
    port = parsed.port
    default = 443 if scheme == "https" else 80
    return f"{scheme}://{host}" + (f":{port}" if port is not None and port != default else "")


def _api_root(value: object, loopback: bool) -> str:
    invalid = False
    result = ""
    try:
        if not isinstance(value, str) or any(ord(c) <= 32 or ord(c) == 127 or c == "\\" for c in value):
            raise ValueError("invalid_root")
        parts = urlsplit(value)
        if parts.scheme not in ("https", "http") or not parts.netloc or "?" in value or "#" in value:
            raise ValueError("invalid_root")
        origin = _authority(parts.scheme, parts.netloc)
        host = urlsplit(origin).hostname
        if parts.scheme != "https" and not (loopback and host in ("localhost", "127.0.0.1", "::1")):
            raise ValueError("invalid_root")
        path = parts.path
        if (not path.endswith(("/v1", "/v1/")) or not path.startswith("/") or
                any(ord(c) > 127 for c in path) or re.search(r"%2e|%2f|%5c", path, re.I) or
                any(part in (".", "..") for part in path.split("/"))):
            raise ValueError("invalid_root")
        result = origin + path.removesuffix("/")
    except (ValueError, TypeError, UnicodeError):
        invalid = True
    if invalid:
        raise BotaApiError("invalid_input")
    return result


def _utf16_length(value: str) -> int:
    return len(value.encode("utf-16-le", errors="surrogatepass")) // 2


def _scalar_matches(schema: Mapping[str, object], value: object, depth: int = 0) -> bool:
    if depth > 8 or isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return False
    if isinstance(value, str) and _utf16_length(value) > 16384:
        return False
    kind = schema.get("type", UNSET)
    if kind == "string" and not isinstance(value, str):
        return False
    if kind == "integer" and (not isinstance(value, (int, float)) or abs(value) > _SAFE_INTEGER or not math.isfinite(value) or value != math.floor(value)):
        return False
    if kind is not UNSET and kind not in ("string", "integer"):
        return False
    if "enum" in schema and value not in cast(list[object], schema["enum"]):
        return False
    if "const" in schema and schema["const"] != value:
        return False
    if isinstance(value, str):
        length = _utf16_length(value)
        if length < cast(int, schema.get("minLength", 0)) or length > cast(float, schema.get("maxLength", math.inf)):
            return False
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and not re.search(pattern, value, re.ASCII):
            return False
    else:
        if (abs(value) > _SAFE_INTEGER or not math.isfinite(value) or value != math.floor(value) or
                value < cast(float, schema.get("minimum", -math.inf)) or value > cast(float, schema.get("maximum", math.inf))):
            return False
    all_of = schema.get("allOf")
    any_of = schema.get("anyOf")
    if isinstance(all_of, list) and not all(_scalar_matches(part, value, depth + 1) for part in all_of):
        return False
    if isinstance(any_of, list) and not any(_scalar_matches(part, value, depth + 1) for part in any_of):
        return False
    return True


def _request_url(root: str, operation: object, input: object) -> str:
    return _defined_request_url(root, operation, input, _DEFINITIONS)


def _defined_request_url(root: str, operation: object, input: object,
                         definitions: Mapping[str, _Definition]) -> str:
    if not isinstance(operation, str) or operation not in definitions:
        raise BotaApiError("invalid_input")
    if input is UNSET:
        input = {}
    if not isinstance(input, Mapping) or any(name not in ("path", "query") for name in input):
        raise BotaApiError("invalid_input")
    path = input.get("path", {})
    query = input.get("query", {})
    if not isinstance(path, Mapping) or not isinstance(query, Mapping):
        raise BotaApiError("invalid_input")
    definition = definitions[operation]
    parameters = definition["parameters"]
    for name, values in (("path", path), ("query", query)):
        if any(not any(p["in"] == name and p["name"] == key for p in parameters) for key in values):
            raise BotaApiError("invalid_input")
    route = definition["path"]
    search: list[str] = []
    invalid = False
    try:
        for parameter in parameters:
            values = path if parameter["in"] == "path" else query
            name = parameter["name"]
            if name not in values:
                if parameter.get("required") is True:
                    raise ValueError("required_parameter")
                continue
            value = values[name]
            if not _scalar_matches(parameter["schema"], value):
                raise ValueError("invalid_parameter")
            if isinstance(value, str):
                value.encode("utf-8", errors="strict")
            if parameter["in"] == "path":
                if not isinstance(value, str) or value in ("", ".", ".."):
                    raise ValueError("invalid_path")
                route = route.replace("{" + name + "}", quote(value, safe="~!*'()"))
            else:
                text = value if isinstance(value, str) else str(int(cast(int | float, value)))
                search.append(quote_plus(name, safe="") + "=" + quote_plus(text, safe=""))
    except (ValueError, TypeError, UnicodeError, re.error):
        invalid = True
    if invalid or not route.startswith("/"):
        raise BotaApiError("invalid_input")
    return root + route + ("?" + "&".join(search) if search else "")


def _mutation_body(value: object, scope: _Scope) -> bytes:
    """Bounded strict JSON snapshot, serialized exactly once before credentials."""
    if type(value) is not dict:
        raise BotaApiError("invalid_input")
    active: set[int] = set()
    count = 0
    size = 0

    def budget(extra: int) -> None:
        nonlocal size
        size += extra
        if size > 1024 * 1024:
            raise BotaApiError("invalid_input")

    def string(text: str) -> None:
        # Bound before any UTF-8/JSON copy, then count exact ensure_ascii=False
        # escaping without allocating a second unbounded representation.
        if len(text) > 1024 * 1024:
            raise BotaApiError("invalid_input")
        budget(2)
        for index, character in enumerate(text):
            if index % 256 == 0:
                scope.check()
            code = ord(character)
            if 0xD800 <= code <= 0xDFFF:
                raise BotaApiError("invalid_input")
            if code < 32:
                budget(2 if character in "\b\f\n\r\t" else 6)
            elif character in ('"', "\\"):
                budget(2)
            else:
                budget(1 if code < 128 else 2 if code < 2048 else 3 if code < 65536 else 4)

    def check(part: object, depth: int) -> None:
        nonlocal count
        scope.check()
        count += 1
        if depth > 64 or count > 100000:
            raise BotaApiError("invalid_input")
        kind = type(part)
        if part is None or kind is bool:
            budget(4 if part is None or part is True else 5)
            return
        if kind is str:
            string(cast(str, part))
            return
        if kind is int:
            if abs(cast(int, part)) > _SAFE_INTEGER:
                raise BotaApiError("invalid_input")
            budget(len(str(part)))
            return
        if kind is float:
            number = cast(float, part)
            if not math.isfinite(number) or number.is_integer() and abs(number) > _SAFE_INTEGER:
                raise BotaApiError("invalid_input")
            budget(len(repr(number)))
            return
        if kind not in (dict, list) or id(part) in active:
            raise BotaApiError("invalid_input")
        active.add(id(part))
        try:
            budget(2 + max(0, len(cast(dict[object, object] | list[object], part)) - 1))
            if kind is dict:
                for key, child in cast(dict[object, object], part).items():
                    if type(key) is not str:
                        raise BotaApiError("invalid_input")
                    string(key)
                    budget(1)
                    check(child, depth + 1)
            else:
                for child in cast(list[object], part):
                    check(child, depth + 1)
        finally:
            active.remove(id(part))

    bad = False
    encoded = b""
    try:
        check(value, 0)
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    except (ValueError, TypeError, UnicodeError, OverflowError, RecursionError):
        bad = True
    scope.check()
    if bad or len(encoded) > 1024 * 1024:
        raise BotaApiError("invalid_input")
    return encoded


def _scrub(text: str, keys: set[str]) -> str:
    variants = {variant for key in keys for variant in (key, quote(key, safe="~!*'()"))}
    for variant in sorted(variants, key=len, reverse=True):
        text = text.replace(variant, "[REDACTED]")
    return text


def _scrub_body(body: JsonValue, keys: set[str]) -> JsonValue:
    if isinstance(body, str):
        return _scrub(body, keys)
    if not isinstance(body, (dict, list)):
        return body
    pending = [body]
    while pending:
        current = pending.pop()
        if isinstance(current, dict):
            for name, value in list(current.items()):
                clean = _scrub(name, keys)
                if clean != name:
                    del current[name]
                current[clean] = _scrub(value, keys) if isinstance(value, str) else value
                if isinstance(value, (dict, list)):
                    pending.append(value)
        else:
            for index, value in enumerate(current):
                if isinstance(value, str):
                    current[index] = _scrub(value, keys)
                elif isinstance(value, (dict, list)):
                    pending.append(value)
    return body


def _headers(response: Response, keys: set[str]) -> tuple[dict[str, str], Mapping[str, str]]:
    raw: dict[str, str] = {}
    for name, value in response.headers.items():
        if not isinstance(name, str) or not isinstance(value, str):
            raise BotaApiError("invalid_response", status=response.status)
        name = name.lower()
        raw[name] = raw[name] + ", " + value if name in raw else value
    safe = {_scrub(name, keys): _scrub(value, keys) for name, value in raw.items()}
    return raw, MappingProxyType(safe)


@dataclass(slots=True)
class _TaskValue(Generic[_T]):
    value: _T | None = field(default=None, repr=False)
    error: BaseException | None = field(default=None, repr=False)


class _Scope:
    def __init__(self, timeout: int, event: asyncio.Event | None = None) -> None:
        self.deadline = _now() + timeout / 1000
        self.event = event if event is not None else asyncio.Event()
        self._timed_out = False

    def timed_out(self) -> None:
        # asyncio's timer may fire before a coarse platform monotonic clock has
        # visibly advanced. An expired wait is itself authoritative evidence.
        if not self.event.is_set():
            self._timed_out = True

    def remaining(self) -> float:
        return max(0, self.deadline - _now())

    def check(self) -> None:
        if self._timed_out:
            raise BotaApiError("deadline")
        if self.event.is_set():
            raise BotaApiError("aborted")
        if _now() >= self.deadline:
            raise BotaApiError("deadline")

    async def run(self, work: Callable[[], Awaitable[_T]], late_cleanup: Callable[[_T], Awaitable[None]] | None = None) -> _T:
        self.check()

        async def execute() -> _TaskValue[_T]:
            try:
                self.check()
                return _TaskValue(await work())
            except asyncio.CancelledError:
                raise
            except BaseException as error:
                # Asyncio debug-mode Task repr includes exceptions as well as
                # results. Retain both only inside a repr-hidden envelope.
                return _TaskValue[_T](error=error)

        task = asyncio.create_task(execute())
        cancelled = asyncio.create_task(self.event.wait())
        delivered = False
        try:
            done, _ = await asyncio.wait((task, cancelled), timeout=self.remaining(), return_when=asyncio.FIRST_COMPLETED)
            if not done:
                self.timed_out()
            self.check()
            if not task.done():
                raise BotaApiError("deadline")
            outcome = task.result()
            if outcome.error is not None:
                raise outcome.error
            delivered = True
            return cast(_T, outcome.value)
        finally:
            # Bounded cooperative cancellation also covers user cleanup inside
            # a provider/reader's finally block. Native I/O is joined by these
            # boundaries; cancellation-suppressing injected code is observed.
            await _cancel_cleanup(cancelled)
            await _cancel_cleanup(task)
            if not delivered and late_cleanup is not None and task.done() and not task.cancelled() and task.exception() is None:
                outcome = task.result()
                if outcome.error is None:
                    await late_cleanup(cast(_T, outcome.value))


def _reject_json_constant(_: str) -> None:
    raise ValueError("non_json_constant")


async def _json_body(response: Response, scope: _Scope, maximum: int) -> JsonValue:
    if response.body is None:
        raise BotaApiError("invalid_response")
    parts: list[bytes] = []
    total = 0
    iterator = response.body.__aiter__()
    while True:
        try:
            chunk = await scope.run(lambda: anext(iterator))
        except StopAsyncIteration:
            break
        if not isinstance(chunk, bytes):
            raise BotaApiError("invalid_response")
        total += len(chunk)
        if total > maximum:
            raise BotaApiError("response_too_large")
        parts.append(chunk)
    invalid = False
    result: JsonValue = None
    try:
        # TextDecoder's default BOM behavior removes a single UTF-8 BOM.
        result = cast(JsonValue, cast(object, json.loads(b"".join(parts).decode("utf-8-sig", errors="strict"), parse_constant=_reject_json_constant)))
    except (ValueError, UnicodeError, RecursionError):
        invalid = True
    scope.check()
    if invalid:
        raise BotaApiError("invalid_response")
    return result


_HTTP_DATE = re.compile(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [0-9]{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$", re.ASCII)


def _retry_after(value: str | None) -> tuple[str, float]:
    if value is None:
        return "absent", 0
    if len(value) > 128:
        return "blocked", 0
    if re.fullmatch(r"[0-9]+", value, re.ASCII):
        seconds = value.lstrip("0") or "0"
        return ("blocked", 0) if len(seconds) > 2 or int(seconds) > 10 else ("valid", int(seconds))
    if not _HTTP_DATE.fullmatch(value):
        return "invalid", 0
    try:
        parsed = parsedate_to_datetime(value)
        if format_datetime(parsed, usegmt=True) != value:
            return "invalid", 0
        delay = max(0, parsed.timestamp() - time.time())
    except (ValueError, OverflowError):
        return "invalid", 0
    return ("blocked", 0) if delay > 10 else ("valid", delay)


def _retry_delay(operation: str, error: BotaApiError, after: str | None,
                 attempt: int, retries: int, remaining: float) -> float | None:
    if operation not in _RETRY_OPERATIONS or attempt >= retries or error.kind not in ("http", "transport", "invalid_response"):
        return None
    advice, delay = _retry_after(after)
    transient = error.status in (502, 503, 504)
    limited = error.status == 429 and error.code != "RATE_LIMIT_EXCEEDED" and advice == "valid"
    transport = error.kind == "transport" and error.status in (None, 200)
    if not (transient or limited or transport) or advice == "blocked":
        return None
    base = math.ldexp(0.2, attempt)
    jitter = base / 2 + random.random() * base / 2
    wait = max(jitter, delay if advice == "valid" else 0)
    return wait if wait < remaining else None


_ABANDONED_TASKS: set[asyncio.Task[object]] = set()


def _observe(task: asyncio.Task[_T]) -> None:
    _ABANDONED_TASKS.discard(cast(asyncio.Task[object], cast(object, task)))
    if not task.cancelled():
        task.exception()


async def _cancel_cleanup(task: asyncio.Task[_T]) -> None:
    # A body's finally block may itself await the close callback. Give both
    # cooperative cancellation boundaries a turn, without an unbounded join.
    for _ in range(2):
        if task.done():
            break
        task.cancel()
        await asyncio.wait((task,), timeout=0)
    if task.done():
        if not task.cancelled():
            task.exception()
    else:
        # An injected callback that suppresses cancellation violates Transport's
        # cooperative contract. Observe it if it eventually finishes; never
        # extend an API deadline indefinitely to wait for arbitrary user code.
        # Store only opaque lifecycle operations; Task result types are invariant.
        _ABANDONED_TASKS.add(cast(asyncio.Task[object], cast(object, task)))
        task.add_done_callback(_observe)


async def _close_response(response: Response) -> _TaskValue[None]:
    try:
        await response.aclose()
    except asyncio.CancelledError:
        raise
    except BaseException as error:
        return _TaskValue[None](error=error)
    return _TaskValue(None)


async def _dispose(response: Response | None, scope: _Scope) -> None:
    if not isinstance(response, Response):
        return
    task = asyncio.create_task(_close_response(response))
    cancelled = asyncio.create_task(scope.event.wait())
    try:
        wait = 0 if scope.event.is_set() else scope.remaining()
        done, _ = await asyncio.wait((task, cancelled), timeout=wait, return_when=asyncio.FIRST_COMPLETED)
        if not done:
            scope.timed_out()
    finally:
        cancelled.cancel()
        await asyncio.gather(cancelled, return_exceptions=True)
        await _cancel_cleanup(task)
    if task.done() and not task.cancelled() and task.exception() is None:
        error = task.result().error
        if error is not None and not isinstance(error, Exception):
            raise error


class ReadRuntime:
    """Shared async HTTP policy; public BotaApiClient supplies typed named methods."""

    def __init__(self, options: ClientOptions) -> None:
        names = {"credentials", "base_url", "allow_loopback_http", "transport", "timeout_ms", "max_response_bytes", "max_retries"}
        if not isinstance(options, Mapping) or any(name not in names for name in options):
            raise BotaApiError("invalid_input")
        credentials = options.get("credentials")
        if not isinstance(credentials, str) and not callable(credentials):
            raise BotaApiError("invalid_input")
        self._root = _api_root(options.get("base_url", BASE_URL), options.get("allow_loopback_http") is True)
        self._credentials = credentials
        self._timeout = _integer(options.get("timeout_ms", UNSET), 30000, 120000)
        self._maximum = _integer(options.get("max_response_bytes", UNSET), 8 * 1024 * 1024, 64 * 1024 * 1024)
        self._retries = _integer(options.get("max_retries", UNSET), 2, 2, 0)
        self._owned_transport = "transport" not in options
        if self._owned_transport:
            from .native_transport import AiohttpTransport
            self._transport: Transport = AiohttpTransport()
        else:
            transport = options["transport"]
            if not callable(getattr(transport, "send", None)):
                raise BotaApiError("invalid_input")
            self._transport = transport
        self._closed = False
        self._scopes: set[_Scope] = set()
        self._requests: set[asyncio.Event] = set()

    async def __aenter__(self) -> Self:
        if self._closed:
            raise BotaApiError("invalid_input")
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        for scope in self._scopes:
            scope.event.set()
        # Wait only for SDK requests, never for unrelated caller task work or
        # a page iterator paused at yield. Response cleanup completes first.
        requests = tuple(self._requests)
        if requests:
            await asyncio.gather(*(done.wait() for done in requests))
        failed = False
        if self._owned_transport:
            try:
                await cast(Awaitable[None], getattr(self._transport, "aclose")())
            except Exception:
                failed = True
        if failed:
            raise BotaApiError("transport") from None

    async def _attempt(self, url: str, scope: _Scope, secrets: set[str], advice: _AttemptAdvice,
                       *, method: str = "GET", body_bytes: bytes | None = None,
                       success_status: int = 200, submission: _Submission | None = None) -> ReadResult[JsonValue]:
        response: Response | None = None
        safe_headers: Mapping[str, str] = MappingProxyType[str, str]({})
        failure: BotaApiError | None = None
        result: ReadResult[JsonValue] | None = None
        try:
            provider_failed = False
            key: object = UNSET

            async def credential() -> object:
                if isinstance(self._credentials, str):
                    return self._credentials
                value = self._credentials(CredentialContext(self._root, scope.event, scope.deadline))
                return await value if inspect.isawaitable(value) else value

            try:
                key = await scope.run(credential)
            except Exception:
                provider_failed = True
            if provider_failed:
                scope.check()
                raise BotaApiError("credentials")
            if not isinstance(key, str) or not re.fullmatch(r"[\x21-\x7e]{1,8192}", key, re.ASCII):
                raise BotaApiError("credentials")
            secrets.add(key)
            headers = {"Accept": "application/json", "Authorization": "Bearer " + key}
            if body_bytes is not None:
                headers["Content-Type"] = "application/json"
            request = Request(url, MappingProxyType(headers), scope.event, scope.deadline, method, body_bytes)

            async def send() -> Response:
                scope.check()
                if submission is not None:
                    submission.invoked = True
                return await self._transport.send(request)

            received = await scope.run(send, lambda value: _dispose(value, scope))
            if not isinstance(received, Response):
                raise BotaApiError("invalid_response")
            response = received
            if isinstance(response.status, bool) or not isinstance(response.status, int):
                raise BotaApiError("invalid_response")
            raw_headers, safe_headers = _headers(response, secrets)
            advice.retry_after = raw_headers.get("retry-after")
            scope.check()
            if response.redirected or 300 <= response.status < 400:
                raise BotaApiError("redirect", status=response.status, headers=safe_headers)
            if response.url:
                invalid_url = False
                actual = ""
                try:
                    parts = urlsplit(response.url)
                    actual = _authority(parts.scheme, parts.netloc) + parts.path + ("?" + parts.query if parts.query else "") + ("#" + parts.fragment if "#" in response.url else "")
                except (ValueError, TypeError, UnicodeError):
                    invalid_url = True
                if invalid_url:
                    raise BotaApiError("invalid_response", status=response.status, headers=safe_headers)
                if actual != url:
                    raise BotaApiError("redirect", status=response.status, headers=safe_headers)
            if raw_headers.get("content-encoding", "").strip().lower() not in ("", "identity"):
                advice.retry_blocked = True
                raise BotaApiError("invalid_response", status=response.status, headers=safe_headers)
            if response.status == 204 and method == "GET":
                result = ReadResult[JsonValue](204, None, safe_headers)
            else:
                content_type = raw_headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if content_type != "application/json" and not content_type.endswith("+json"):
                    raise BotaApiError("invalid_response", status=response.status, headers=safe_headers)
                body = await _json_body(response, scope, self._maximum)
                scope.check()
                if not 200 <= response.status < 300:
                    raise BotaApiError("http", status=response.status, headers=safe_headers, body=_scrub_body(body, secrets))
                if response.status != success_status:
                    raise BotaApiError("invalid_response", status=response.status, headers=safe_headers)
                result = ReadResult[JsonValue](success_status, body, safe_headers)
        except BotaApiError as error:
            failure = BotaApiError(error.kind, status=response.status if response else error.status,
                                   headers=safe_headers if response else error.headers, body=error.body)
        except Exception:
            try:
                scope.check()
            except BotaApiError as error:
                failure = BotaApiError(error.kind, status=response.status if response else None, headers=safe_headers)
            else:
                failure = BotaApiError("transport", status=response.status if response else None, headers=safe_headers)
        finally:
            await _dispose(response, scope)
        try:
            scope.check()
        except BotaApiError as reason:
            if failure is None or failure.kind not in ("aborted", "deadline"):
                failure = BotaApiError(reason.kind, status=response.status if response else None, headers=safe_headers)
        # Raise outside raw exception handlers: native/provider error contexts
        # may contain request headers, URLs or untrusted response text.
        if failure is not None:
            raise failure from None
        assert result is not None
        return result

    async def _request(self, operation: str, input: object, options: Mapping[str, object], scope: _Scope,
                       secrets: set[str]) -> ReadResult[JsonValue]:
        done = asyncio.Event()
        self._requests.add(done)
        try:
            return await self._request_loop(operation, input, options, scope, secrets)
        finally:
            self._requests.discard(done)
            done.set()

    async def _request_loop(self, operation: str, input: object, options: Mapping[str, object], scope: _Scope,
                            secrets: set[str]) -> ReadResult[JsonValue]:
        retries = _integer(options.get("max_retries", UNSET), self._retries, 2, 0)
        url = _request_url(self._root, operation, input)
        attempt = 0
        while True:
            scope.check()
            advice = _AttemptAdvice()
            try:
                return await self._attempt(url, scope, secrets, advice)
            except BotaApiError as error:
                if error.kind in ("aborted", "deadline"):
                    raise
                failure = error
            try:
                scope.check()
            except BotaApiError as reason:
                raise BotaApiError(reason.kind, status=failure.status, headers=failure.headers) from None
            wait = None if advice.retry_blocked else _retry_delay(operation, failure, advice.retry_after, attempt, retries, scope.remaining())
            if wait is None:
                raise failure from None
            try:
                await scope.run(lambda: asyncio.sleep(wait))
            except BotaApiError as reason:
                raise BotaApiError(reason.kind, status=failure.status, headers=failure.headers) from None
            attempt += 1

    async def read(self, operation_id: str, input: object = UNSET, options: RequestOptions | UnsetType = UNSET) -> ReadResult[JsonValue]:
        if self._closed:
            raise BotaApiError("invalid_input")
        checked = _checked_options(options)
        _request_url(self._root, operation_id, input)
        scope = _Scope(_integer(checked.get("timeout_ms", UNSET), self._timeout, 120000), cast(asyncio.Event | None, checked.get("cancel_event")))
        self._scopes.add(scope)
        secrets: set[str] = set()
        try:
            return await self._request(operation_id, input, checked, scope, secrets)
        finally:
            self._scopes.discard(scope)
            secrets.clear()

    async def mutate(self, operation_id: str, input: object,
                       options: MutationRequestOptions | UnsetType = UNSET) -> ReadResult[JsonValue]:
        """One admitted ordinary mutation attempt, without replay or reconciliation."""
        from .generated.mutations.operations import MUTATIONS

        mutations = cast(Mapping[str, _MutationDefinition], cast(object, MUTATIONS))
        submission = _Submission()
        scope: _Scope | None = None
        done = asyncio.Event()
        secrets: set[str] = set()
        failure: BotaMutationError | BotaMutationCancelledError | None = None
        result: ReadResult[JsonValue] | None = None
        try:
            if self._closed:
                raise BotaApiError("invalid_input")
            if options is not UNSET:
                if type(options) is not dict or any(type(name) is not str for name in options):
                    raise BotaApiError("invalid_input")
                plain_options = cast(dict[str, object], cast(object, options))
                for name in ("timeout_ms", "max_retries"):
                    if name in plain_options and type(plain_options[name]) not in (int, float):
                        raise BotaApiError("invalid_input")
                if "cancel_event" in plain_options and type(plain_options["cancel_event"]) is not asyncio.Event:
                    raise BotaApiError("invalid_input")
            checked = _checked_options(options)
            # The global read retry default is deliberately irrelevant here.
            _integer(checked.get("max_retries", UNSET), 0, 0, 0)
            scope = _Scope(_integer(checked.get("timeout_ms", UNSET), self._timeout, 120000),
                           cast(asyncio.Event | None, checked.get("cancel_event")))
            self._scopes.add(scope)
            self._requests.add(done)
            scope.check()
            if type(operation_id) is not str or operation_id not in mutations:
                raise BotaApiError("invalid_input")
            if type(input) is not dict or any(type(name) is not str for name in input):
                raise BotaApiError("invalid_input")
            if any(name not in ("path", "body") for name in input) or "body" not in input:
                raise BotaApiError("invalid_input")
            values = cast(dict[str, object], input)
            if "path" in values:
                path = values["path"]
                if type(path) is not dict or any(type(name) is not str for name in path):
                    raise BotaApiError("invalid_input")
                plain_path = cast(dict[str, object], cast(object, path))
                if "id" in plain_path and type(plain_path["id"]) is not str:
                    raise BotaApiError("invalid_input")
            definition = mutations[operation_id]
            url = _defined_request_url(self._root, operation_id,
                {name: value for name, value in values.items() if name != "body"},
                mutations)
            payload = _mutation_body(values["body"], scope)
            scope.check()
            result = await self._attempt(url, scope, secrets, _AttemptAdvice(),
                method=definition["method"], body_bytes=payload,
                success_status=definition["success_status"], submission=submission)
        except asyncio.CancelledError:
            failure = BotaMutationCancelledError(request_outcome="unknown" if submission.invoked else "not_submitted")
        except BotaApiError as error:
            failure = BotaMutationError(error.kind, request_outcome="unknown" if submission.invoked else "not_submitted",
                                        status=error.status, headers=error.headers, body=error.body)
        except Exception:
            failure = BotaMutationError("invalid_input", request_outcome="unknown" if submission.invoked else "not_submitted")
        finally:
            if scope is not None:
                self._scopes.discard(scope)
            self._requests.discard(done)
            done.set()
            secrets.clear()
        if failure is not None:
            raise failure from None
        assert result is not None
        return result

    async def pages(self, operation_id: str, input: object = UNSET, options: PageOptions | UnsetType = UNSET) -> AsyncIterator[JsonValue]:
        if self._closed or not isinstance(operation_id, str) or operation_id not in _LIST_OPERATIONS:
            raise BotaApiError("invalid_input")
        checked = _checked_options(options, True)
        _request_url(self._root, operation_id, input)
        retries = _integer(checked.get("max_retries", UNSET), self._retries, 2, 0)
        maximum_pages = _integer(checked.get("max_pages", UNSET), 100, 10000)
        maximum_items = _integer(checked.get("max_items", UNSET), 10000, 1000000)
        scope = _Scope(_integer(checked.get("timeout_ms", UNSET), self._timeout, 120000), cast(asyncio.Event | None, checked.get("cancel_event")))
        self._scopes.add(scope)
        values = cast(Mapping[str, object], {} if input is UNSET else input)
        query = dict(cast(Mapping[str, object], values.get("query", {})))
        seen = {query["cursor"]} if "cursor" in query else set()
        secrets: set[str] = set()
        items = 0
        try:
            for index in range(maximum_pages):
                scope.check()
                result = await self._request(operation_id, {**values, "query": query}, {"max_retries": retries}, scope, secrets)
                page = result.data
                if result.status != 200 or not isinstance(page, dict):
                    raise BotaApiError("pagination")
                data, more = page.get("data"), page.get("has_more")
                if not isinstance(data, list) or not isinstance(more, bool):
                    raise BotaApiError("pagination")
                items += len(data)
                if items > maximum_items:
                    raise BotaApiError("pagination")
                next_cursor = page.get("next_cursor")
                if more:
                    if not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen:
                        raise BotaApiError("pagination")
                    seen.add(next_cursor)
                # Only a numeric absolute deadline survives the consumer pause;
                # no asyncio timeout/cancellation context spans this yield.
                yield page
                if not more:
                    return
                if index + 1 == maximum_pages or items >= maximum_items:
                    raise BotaApiError("pagination")
                query["cursor"] = next_cursor
        finally:
            self._scopes.discard(scope)
            secrets.clear()
