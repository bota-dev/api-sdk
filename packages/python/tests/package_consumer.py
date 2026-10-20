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
from bota_api_sdk import BotaApiClient, ReadResult, Request, Response, UNSET, models


class FixtureTransport:
    def __init__(self) -> None:
        self.calls = 0
        self.responses_closed = 0
        self.transport_closed = 0

    async def send(self, request: Request) -> Response:
        self.calls += 1
        assert request.method == "GET" and request.url == "https://api.bota.dev/v1/auth/identity"
        assert request.headers["Authorization"] == "Bearer sk_synthetic_package_consumer"

        async def body() -> AsyncIterator[bytes]:
            yield b'{"project_id":"proj_fixture","organization_id":"org_fixture","key_id":"key_fixture","key_type":"restricted","is_test_mode":true,"scope_mode":"restricted","scopes":[],"legacy_extra":"9007199254740993"}'

        async def close() -> None:
            self.responses_closed += 1

        return Response(200, {"content-type": "application/json", "x-request-id": "package-fixture"}, body(), request.url, close=close)

    async def aclose(self) -> None:
        self.transport_closed += 1


async def typed_read(client: BotaApiClient) -> ReadResult[models.GetAuthIdentityResponse]:
    identity = await client.get_auth_identity(UNSET)
    if identity.data is not None:
        project: str = identity.data["project_id"]
        scopes: list[str] | None = identity.data["scopes"]
        assert project == "proj_fixture" and scopes == []
    return identity


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
    async with BotaApiClient({"credentials": "sk_synthetic_package_consumer", "transport": transport}) as client:
        identity = await typed_read(client)
    assert identity.status == 200 and identity.data is not None
    assert cast(dict[str, object], identity.data)["legacy_extra"] == "9007199254740993"
    assert identity.headers["x-request-id"] == "package-fixture"
    assert transport.calls == transport.responses_closed == 1 and transport.transport_closed == 0
    methods = json.loads(files("bota_api_sdk").joinpath("generated/methods.json").read_text())
    assert len(methods) == 11 and all(callable(getattr(BotaApiClient, method["name"])) for method in methods)
    print(json.dumps({"passed": True, "python": sys.version.split()[0], "installed": str(installed),
                      "synthetic_requests": transport.calls, "response_closed": True,
                      "injected_transport_caller_owned": True, "named_methods": len(methods),
                      "runtime_only_dependencies": runtime_only}))


if __name__ == "__main__":
    asyncio.run(main())
