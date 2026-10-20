"""Real loopback aiohttp policy and lifecycle qualification; no remote API calls."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import gzip
import json
import os
import ssl
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.parse import quote

import aiohttp

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bota_api_sdk.native_transport import AiohttpTransport
from bota_api_sdk.runtime import BotaApiError, ReadRuntime


@asynccontextmanager
async def server(handler, ssl_context=None):
    writers, tasks = set(), set()

    async def connection(reader, writer):
        task = asyncio.current_task()
        writers.add(writer)
        tasks.add(task)
        try:
            await handler(reader, writer)
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            writers.discard(writer)
            tasks.discard(task)
            writer.close()
            try:
                await writer.wait_closed()
            except ConnectionError:
                pass

    listener = await asyncio.start_server(connection, "127.0.0.1", 0, ssl=ssl_context)
    try:
        scheme = "https" if ssl_context is not None else "http"
        yield f"{scheme}://127.0.0.1:{listener.sockets[0].getsockname()[1]}"
    finally:
        listener.close()
        await listener.wait_closed()
        for writer in tuple(writers):
            writer.close()
        for task in tuple(tasks):
            task.cancel()
        if tasks:
            await asyncio.wait_for(asyncio.gather(*tuple(tasks), return_exceptions=True), 3)


async def request(reader):
    raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 3)
    rows = raw.decode("ascii").split("\r\n")
    headers = {}
    for line in rows[1:]:
        if line:
            name, value = line.split(":", 1)
            headers[name.lower()] = value.strip()
    return rows[0], headers


async def reply(writer, body=b"{}", status=200, extra=b"", close=False):
    writer.write(f"HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n".encode() +
                 extra + (b"Connection: close\r\n" if close else b"") + b"\r\n" + body)
    await writer.drain()


class NativeTests(unittest.IsolatedAsyncioTestCase):
    async def test_default_tls_refuses_untrusted_certificate_before_http_or_bearer(self):
        fixture = Path(__file__).resolve().parent / "fixtures" / "synthetic-localhost-tls"
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.load_cert_chain(fixture / "certificate.pem", fixture / "private-key.pem")
        http_calls = []

        async def api(reader, writer):
            http_calls.append(await request(reader))
            await reply(writer, close=True)

        loop = asyncio.get_running_loop()
        previous = loop.get_exception_handler()
        # Rejected peer handshakes can emit a server transport-creation diagnostic
        # in asyncio debug mode. Retain it for the test instead of console noise.
        handshake_diagnostics = []
        loop.set_exception_handler(lambda _, context: handshake_diagnostics.append(context))
        try:
            async with server(api, tls) as api_url:
                async with aiohttp.ClientSession(trust_env=False, timeout=aiohttp.ClientTimeout(total=2)) as control:
                    with self.assertRaises(aiohttp.ClientConnectorCertificateError):
                        await control.get(api_url + "/v1/auth/identity", allow_redirects=False)
                key = "synthetic_tls_secret_canary"
                client = ReadRuntime({"credentials": key, "base_url": api_url + "/v1", "max_retries": 0})
                with self.assertRaises(BotaApiError) as error:
                    await asyncio.wait_for(client.read("getAuthIdentity"), 3)
                await asyncio.wait_for(client.aclose(), 2)
            self.assertEqual(http_calls, [])
            self.assertEqual(error.exception.kind, "transport")
            self.assertIsNone(error.exception.status)
            self.assertIsNone(error.exception.body)
            self.assertIsNone(error.exception.__context__)
            self.assertIsNone(error.exception.__cause__)
            self.assertNotIn(key, str(error.exception) + repr(error.exception) + repr(dict(error.exception.headers)))
        finally:
            loop.set_exception_handler(previous)

    async def test_native_proxy_cookie_header_and_encoded_target_policy(self):
        observed, proxies, session_options = [], [], []

        async def proxy(reader, writer):
            proxies.append(await request(reader))
            await reply(writer, close=True)

        async def api(reader, writer):
            for _ in range(2):
                observed.append(await request(reader))
                await reply(writer, extra=b"Set-Cookie: private_cookie=synthetic_cookie; Path=/\r\nX-Opaque: one\r\nX-Opaque: two\r\nRateLimit-Reset: 1\r\nX-RateLimit-Reset: 1792440000\r\n")

        real_session = aiohttp.ClientSession

        def session(*args, **kwargs):
            session_options.append(kwargs)
            return real_session(*args, **kwargs)

        async with server(proxy) as proxy_url, server(api) as api_url:
            environment = {name: proxy_url for name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")}
            environment.update({"NO_PROXY": "", "no_proxy": ""})
            with patch.dict(os.environ, environment), patch.object(aiohttp, "ClientSession", side_effect=session):
                async with ReadRuntime({"credentials": "synthetic_native_key", "base_url": api_url + "/v1", "allow_loopback_http": True}) as client:
                    await client.read("getDevicesById", {"path": {"id": "opaque/?#+%"}})
                    result = await client.read("getDevices", {"query": {"cursor": "opaque/+=", "limit": 1}})
        self.assertEqual(proxies, [])
        self.assertEqual(len(session_options), 1)
        self.assertIs(session_options[0]["trust_env"], False)
        self.assertIs(session_options[0]["auto_decompress"], False)
        self.assertIsInstance(session_options[0]["cookie_jar"], aiohttp.DummyCookieJar)
        self.assertEqual(observed[0][0], "GET /v1/devices/opaque%2F%3F%23%2B%25 HTTP/1.1")
        self.assertIn("cursor=opaque%2F%2B%3D", observed[1][0])
        for _, headers in observed:
            self.assertEqual(headers["authorization"], "Bearer synthetic_native_key")
            self.assertEqual(headers["accept"], "application/json")
            self.assertEqual(headers["accept-encoding"], "identity")
            self.assertNotIn("cookie", headers)
            self.assertNotIn("proxy-authorization", headers)
        self.assertEqual(result.headers["x-opaque"], "one, two")
        self.assertEqual(result.headers["ratelimit-reset"], "1")
        self.assertEqual(result.headers["x-ratelimit-reset"], "1792440000")

    async def test_native_redirect_refusal_has_no_foreign_request_and_safe_errors(self):
        foreign_calls, calls = [], []
        key = "synthetic_redirect+/="

        async def foreign(reader, writer):
            foreign_calls.append(await request(reader))
            await reply(writer, close=True)

        async with server(foreign) as foreign_url:
            async def api(reader, writer):
                calls.append(await request(reader))
                location = f"Location: {foreign_url}/v1?key={quote(key, safe='')}\r\n".encode()
                await reply(writer, status=302, extra=location, close=True)

            async with server(api) as api_url:
                async with ReadRuntime({"credentials": key, "base_url": api_url + "/v1", "allow_loopback_http": True}) as client:
                    with self.assertRaises(BotaApiError) as error:
                        await client.read("getAuthIdentity")
        self.assertEqual((error.exception.kind, error.exception.status), ("redirect", 302))
        self.assertIsNone(error.exception.__context__)
        self.assertNotIn(key, repr(error.exception) + repr(dict(error.exception.headers)))
        self.assertNotIn(quote(key, safe=""), repr(dict(error.exception.headers)))
        self.assertEqual(len(calls), 1)
        self.assertEqual(foreign_calls, [])

    async def test_public_middleware_refuses_aiohttp_hidden_get_reconnect(self):
        # A public stock-client control proves that this pinned native failure
        # really retries GET internally. The SDK adapter must send only once.
        for guarded, expected in ((False, 2), (True, 1)):
            observed = []

            async def api(reader, writer):
                while True:
                    line, _ = await request(reader)
                    observed.append(line)
                    if "/auth/identity " in line:
                        await reply(writer)
                    else:
                        return  # Disconnect an already-submitted GET without a response.

            async with server(api) as api_url:
                if guarded:
                    async with ReadRuntime({"credentials": "synthetic_key", "base_url": api_url + "/v1", "allow_loopback_http": True, "max_retries": 0}) as client:
                        await client.read("getAuthIdentity")
                        with self.assertRaises(BotaApiError) as error:
                            await client.read("getDevices")
                    self.assertEqual(error.exception.kind, "transport")
                else:
                    async with aiohttp.ClientSession(trust_env=False, cookie_jar=aiohttp.DummyCookieJar()) as client:
                        async with client.get(api_url + "/v1/auth/identity", allow_redirects=False) as first:
                            await first.read()
                        with self.assertRaises(aiohttp.ClientError):
                            await client.get(api_url + "/v1/devices", allow_redirects=False)
            self.assertEqual(sum("/devices " in line for line in observed), expected)
            self.assertEqual(sum("/auth/identity " in line for line in observed), 1)

    async def test_native_attempt_count_matches_sdk_retries_with_fresh_credentials(self):
        observed, credentials = [], []

        async def api(reader, writer):
            line, headers = await request(reader)
            observed.append((line, headers["authorization"]))

        def credential(_):
            value = f"synthetic_attempt_{len(credentials)}"
            credentials.append(value)
            return value

        async with server(api) as api_url:
            async with ReadRuntime({"credentials": credential, "base_url": api_url + "/v1", "allow_loopback_http": True}) as client:
                with self.assertRaises(BotaApiError) as error:
                    await client.read("getDevices")
        self.assertEqual(error.exception.kind, "transport")
        self.assertEqual(len(observed), 3)
        self.assertEqual(len(credentials), 3)
        for index, (line, auth) in enumerate(observed):
            self.assertEqual(line, "GET /v1/devices HTTP/1.1")
            self.assertEqual(auth, "Bearer " + credentials[index])

    async def test_unsolicited_gzip_is_not_inflated_and_never_retried(self):
        calls = []
        compressed = gzip.compress(b" " * (2 * 1024 * 1024))

        async def api(reader, writer):
            calls.append(await request(reader))
            await reply(writer, compressed, status=503, extra=b"Content-Encoding: gzip\r\nRetry-After: 0\r\n", close=True)

        async with server(api) as api_url:
            async with ReadRuntime({"credentials": "key", "base_url": api_url + "/v1", "allow_loopback_http": True, "max_response_bytes": 512}) as client:
                with self.assertRaises(BotaApiError) as error:
                    await client.read("getDevices")
        self.assertEqual((error.exception.kind, error.exception.status), ("invalid_response", 503))
        self.assertIsNone(error.exception.body)
        self.assertEqual(error.exception.headers["content-encoding"], "gzip")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1]["accept-encoding"], "identity")

    async def test_native_body_disconnect_retains_status_and_sanitized_headers(self):
        key = "synthetic_body+/="

        async def api(reader, writer):
            await request(reader)
            writer.write(b"HTTP/1.1 200 Fixture\r\nContent-Type: application/json\r\nContent-Length: 999\r\nX-Request-Id: req_partial\r\nX-Echo: " + key.encode() + b"\r\n\r\n{\"partial\":")
            await writer.drain()

        async with server(api) as api_url:
            async with ReadRuntime({"credentials": key, "base_url": api_url + "/v1", "allow_loopback_http": True, "max_retries": 0}) as client:
                with self.assertRaises(BotaApiError) as error:
                    await client.read("getDevices")
        self.assertEqual((error.exception.kind, error.exception.status, error.exception.request_id), ("transport", 200, "req_partial"))
        self.assertEqual(error.exception.headers["x-echo"], "[REDACTED]")
        self.assertIsNone(error.exception.__context__)
        self.assertNotIn(key, str(error.exception) + repr(error.exception))

    async def test_native_body_cancellation_closes_socket_and_joins_reader(self):
        started, closed, cancel = (asyncio.Event() for _ in range(3))

        async def api(reader, writer):
            await request(reader)
            writer.write(b"HTTP/1.1 200 Fixture\r\nContent-Type: application/json\r\nContent-Length: 999\r\nX-Request-Id: req_stalled\r\n\r\n")
            await writer.drain()
            started.set()
            await reader.read()
            closed.set()

        async with server(api) as api_url:
            async with ReadRuntime({"credentials": "key", "base_url": api_url + "/v1", "allow_loopback_http": True}) as client:
                task = asyncio.create_task(client.read("getDevices", options={"cancel_event": cancel}))
                await asyncio.wait_for(started.wait(), 2)
                cancel.set()
                with self.assertRaises(BotaApiError) as error:
                    await asyncio.wait_for(task, 2)
                await asyncio.wait_for(closed.wait(), 2)
        self.assertEqual(error.exception.kind, "aborted")

    async def test_native_owned_client_close_joins_pending_response_and_session(self):
        started, closed = asyncio.Event(), asyncio.Event()

        async def api(reader, writer):
            await request(reader)
            writer.write(b"HTTP/1.1 200 Fixture\r\nContent-Type: application/json\r\nContent-Length: 999\r\n\r\n")
            await writer.drain()
            started.set()
            await reader.read()
            closed.set()

        async with server(api) as api_url:
            client = ReadRuntime({"credentials": "key", "base_url": api_url + "/v1", "allow_loopback_http": True})
            task = asyncio.create_task(client.read("getDevices"))
            await asyncio.wait_for(started.wait(), 2)
            await asyncio.wait_for(client.aclose(), 2)
            with self.assertRaises(BotaApiError):
                await task
            await asyncio.wait_for(closed.wait(), 2)
            with self.assertRaises(BotaApiError):
                await client.read("getDevices")


if __name__ == "__main__":
    unittest.main()
