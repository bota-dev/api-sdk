"""Native aiohttp adapter, isolated from retry/admission policy."""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable, Awaitable
from typing import TYPE_CHECKING

from .runtime import Request, Response

if TYPE_CHECKING:
    import aiohttp


class NativeTransportError(Exception):
    def __init__(self) -> None:
        super().__init__("The API transport failed.")


class AiohttpTransport:
    """Lazy session; callers close it within its owning asyncio event loop."""

    def __init__(self) -> None:
        self._session: aiohttp.ClientSession | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._closed = False

    async def send(self, request: Request) -> Response:
        import aiohttp
        from yarl import URL

        failed = False
        result: Response | None = None
        try:
            loop = asyncio.get_running_loop()
            if request.method not in {"GET", "POST", "PATCH"} or self._closed or self._loop is not None and self._loop is not loop:
                raise NativeTransportError()
            if self._session is None:
                self._loop = loop
                self._session = aiohttp.ClientSession(
                    trust_env=False,
                    auto_decompress=False,
                    headers={"Accept-Encoding": "identity"},
                    cookie_jar=aiohttp.DummyCookieJar(),
                    timeout=aiohttp.ClientTimeout(total=None),
                )
            invocations = 0

            async def one_handler(req: aiohttp.ClientRequest, handler: Callable[[aiohttp.ClientRequest], Awaitable[aiohttp.ClientResponse]]) -> aiohttp.ClientResponse:
                nonlocal invocations
                if invocations:
                    # aiohttp may reconnect idempotent requests internally. Its
                    # public per-request middleware runs again before the next
                    # handler invocation: refuse that implicit second send.
                    raise NativeTransportError()
                invocations += 1
                return await handler(req)

            received = await self._session.request(
                request.method, URL(request.url, encoded=True), headers=request.headers, data=request.body,
                allow_redirects=False, middlewares=(one_handler,),
                timeout=aiohttp.ClientTimeout(total=None), ssl=True, proxy=None, auto_decompress=False,
            )
            headers: dict[str, str] = {}
            for name, value in received.headers.items():
                name = name.lower()
                headers[name] = headers[name] + ", " + value if name in headers else value

            async def body() -> AsyncIterator[bytes]:
                bad_body = False
                try:
                    async for chunk in received.content.iter_chunked(64 * 1024):
                        yield chunk
                except Exception:
                    bad_body = True
                if bad_body:
                    raise NativeTransportError() from None

            async def close() -> None:
                received.close()

            result = Response(received.status, headers, body(), str(received.url), bool(received.history), close)
        except Exception:
            failed = True
        if failed or result is None:
            raise NativeTransportError() from None
        return result

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._session is not None:
            await self._session.close()
