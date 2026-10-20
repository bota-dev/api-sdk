"""Copied into an external consumer; imports only its installed distribution."""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
import importlib.metadata
from importlib.resources import files
import json
from pathlib import Path
import sys
from typing import cast

import bota_api_sdk
from bota_api_sdk import BotaApiClient, BotaMutationError, BotaMutationCancelledError, ReadResult, Request, Response, UNSET, models, mutation_models


class FixtureTransport:
    def __init__(self) -> None:
        self.calls = 0
        self.responses_closed = 0
        self.transport_closed = 0

    async def send(self, request: Request) -> Response:
        self.calls += 1
        assert request.headers["Authorization"] == "Bearer sk_synthetic_package_consumer"
        if request.method != "GET":
            assert request.method in {"POST", "PATCH"}
            assert request.headers["Content-Type"] == "application/json"
            assert not any("idempotency" in name.lower() for name in request.headers)
            assert request.body is not None
            value = json.loads(request.body)
            if value.get("external_id") == "lost-acknowledgment":
                raise RuntimeError("synthetic_lost_response")
            assert value == {}
            assert request.url == "https://api.bota.dev/v1/end-users" + ("/eu_fixture" if request.method == "PATCH" else "")
        else:
            assert request.url == "https://api.bota.dev/v1/auth/identity" and request.body is None

        async def body() -> AsyncIterator[bytes]:
            if request.method == "GET":
                yield b'{"project_id":"proj_fixture","organization_id":"org_fixture","key_id":"key_fixture","key_type":"restricted","is_test_mode":true,"scope_mode":"restricted","scopes":[],"legacy_extra":"9007199254740993"}'
            else:
                yield b'{"id":"eu_fixture","unknown":"9007199254740993"}'

        async def close() -> None:
            self.responses_closed += 1

        return Response(201 if request.method == "POST" else 200, {"content-type": "application/json", "x-request-id": "package-fixture"}, body(), request.url, close=close)

    async def aclose(self) -> None:
        self.transport_closed += 1


async def typed_read(client: BotaApiClient) -> ReadResult[models.GetAuthIdentityResponse]:
    identity = await client.get_auth_identity(UNSET)
    if identity.data is not None:
        project: str = identity.data["project_id"]
        scopes: list[str] | None = identity.data["scopes"]
        assert project == "proj_fixture" and scopes == []
    return identity


async def typed_mutations(client: BotaApiClient) -> None:
    created: ReadResult[mutation_models.PostEndUsersResponse] = await client.post_end_users({"body": {}}, {"max_retries": 0})
    updated: ReadResult[mutation_models.PatchEndUsersByIdResponse] = await client.patch_end_users_by_id({"path": {"id": "eu_fixture"}, "body": {}})
    assert created.status == 201 and updated.status == 200
    assert created.data is not None and created.data["id"] == "eu_fixture"
    assert cast(dict[str, object], created.data)["unknown"] == "9007199254740993"
    try:
        await client.post_end_users({"body": {"external_id": "lost-acknowledgment"}})
    except BotaMutationError as error:
        assert error.kind == "transport" and error.request_outcome == "unknown"
    else:
        raise AssertionError("mutation_loss_was_not_reported")


async def task_cancellation() -> None:
    started = asyncio.Event()

    class Pending:
        async def send(self, request: Request) -> Response:
            started.set()
            await asyncio.Event().wait()
            raise AssertionError("cancelled_transport_returned")

    async with BotaApiClient({"credentials": "synthetic_task_cancellation", "transport": Pending()}) as client:
        task = asyncio.create_task(client.post_end_users({"body": {}}))
        await started.wait()
        task.cancel()
        try:
            await task
        except BotaMutationCancelledError as error:
            assert error.kind == "aborted" and error.request_outcome == "unknown"
            assert not isinstance(error, Exception) and task.cancelled()
        else:
            raise AssertionError("task_cancellation_was_swallowed")


async def main() -> None:
    installed = Path(bota_api_sdk.__file__).resolve()
    assert installed.is_relative_to(Path(sys.prefix).resolve()), "source_checkout_import"
    assert bota_api_sdk.__version__ == importlib.metadata.version("bota-api-sdk") == "0.1.0b0"
    assert importlib.metadata.version("aiohttp") == "3.14.5"
    assert importlib.metadata.version("yarl") == "1.25.1"
    runtime_only = "--runtime-only" in sys.argv
    if runtime_only:
        installed_names = {item.metadata["Name"].lower().replace("_", "-") for item in importlib.metadata.distributions()}
        assert not installed_names.intersection({"flit-core", "ty"}), "build_tools_in_runtime_consumer"
    assert files("bota_api_sdk").joinpath("py.typed").read_bytes() == b""
    transport = FixtureTransport()
    await task_cancellation()
    async with BotaApiClient({"credentials": "sk_synthetic_package_consumer", "transport": transport}) as client:
        identity = await typed_read(client)
        await typed_mutations(client)
    assert identity.status == 200 and identity.data is not None
    assert cast(dict[str, object], identity.data)["legacy_extra"] == "9007199254740993"
    assert identity.headers["x-request-id"] == "package-fixture"
    assert transport.calls == 4 and transport.responses_closed == 3 and transport.transport_closed == 0
    methods = json.loads(files("bota_api_sdk").joinpath("generated/methods.json").read_text())
    assert len(methods) == 11 and all(callable(getattr(BotaApiClient, method["name"])) for method in methods)
    mutations = json.loads(files("bota_api_sdk").joinpath("generated/mutations/methods.json").read_text())
    assert len(mutations) == 2 and all(callable(getattr(BotaApiClient, method["name"])) for method in mutations)
    print(json.dumps({"passed": True, "python": sys.version.split()[0], "installed": str(installed),
                      "synthetic_requests": transport.calls, "response_closed": True,
                      "injected_transport_caller_owned": True, "named_methods": len(methods), "named_mutations": len(mutations),
                      "single_attempt_unknown_mutation": True,
                      "task_cancellation_preserved": True,
                      "runtime_only_dependencies": runtime_only}))


if __name__ == "__main__":
    asyncio.run(main())
