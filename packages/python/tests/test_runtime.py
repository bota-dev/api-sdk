"""Core-only edge cases complementing the unchanged neutral corpus."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bota_api_sdk import runtime as rt


async def chunks(value):
    yield value


def response(body=None, status=200, headers=None):
    return rt.Response(status, {"content-type": "application/json", **(headers or {})},
                       chunks(json.dumps(body, ensure_ascii=True).encode()))


class Transport:
    def __init__(self, send):
        self.handler = send
        self.calls = []

    async def send(self, request):
        self.calls.append(request)
        return await self.handler(request)


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_asyncio_debug_task_results_do_not_dump_credentials_or_raw_bodies(self):
        key = "synthetic_debug_secret_canary"

        async def send(_):
            return response({"success_payload": key})

        client = rt.ReadRuntime({"credentials": key, "transport": Transport(send)})
        loop = asyncio.get_running_loop()
        previous = loop.slow_callback_duration
        loop.slow_callback_duration = 0
        try:
            with self.assertLogs("asyncio", level="WARNING") as messages:
                result = await client.read("getAuthIdentity")
            self.assertNotIn(key, "\n".join(messages.output))
            self.assertNotIn(key, repr(result))
            self.assertEqual(result.data, {"success_payload": key})

            def bad_provider(_):
                raise ValueError(key)

            failed = rt.ReadRuntime({"credentials": bad_provider, "transport": Transport(send)})
            with self.assertLogs("asyncio", level="WARNING") as messages:
                with self.assertRaises(rt.BotaApiError):
                    await failed.read("getAuthIdentity")
            self.assertNotIn(key, "\n".join(messages.output))
            await failed.aclose()
            for phase in ("close", "body_close"):
                class Body:
                    def __init__(self):
                        self.sent = False

                    def __aiter__(self):
                        return self

                    async def __anext__(self):
                        if self.sent:
                            raise StopAsyncIteration
                        self.sent = True
                        return b"{}"

                    async def aclose(self):
                        if phase == "body_close":
                            raise RuntimeError(key)

                async def close():
                    if phase == "close":
                        raise RuntimeError(key)

                async def send_close_error(_):
                    return rt.Response(200, {"content-type": "application/json"}, Body(), close=close)

                closing = rt.ReadRuntime({"credentials": key, "transport": Transport(send_close_error)})
                with self.assertLogs("asyncio", level="WARNING") as messages:
                    result = await closing.read("getAuthIdentity")
                self.assertEqual(result.status, 200)
                self.assertNotIn(key, "\n".join(messages.output))
                await closing.aclose()
        finally:
            loop.slow_callback_duration = previous
            await client.aclose()

    async def test_local_admission_rejects_null_bool_huge_and_surrogates_without_credentials(self):
        providers = 0

        def credential(_):
            nonlocal providers
            providers += 1
            return "synthetic_key"

        async def unexpected(_):
            self.fail("unexpected egress")

        client = rt.ReadRuntime({"credentials": credential, "transport": Transport(unexpected)})
        for value in (None, [], "", {"query": None}, {"query": {"limit": True}},
                      {"query": {"limit": 10**1000}}, {"query": {"cursor": "\ud800"}}):
            with self.subTest(value=repr(value)), self.assertRaises(rt.BotaApiError) as error:
                await client.read("getDevices", value)
            self.assertEqual(error.exception.kind, "invalid_input")
        for options in (None, {"timeout_ms": True}, {"max_retries": True}, {"timeout_ms": 10**1000}):
            with self.assertRaises(rt.BotaApiError):
                await client.read("getDevices", options=options)
        self.assertEqual(providers, 0)
        await client.aclose()

    async def test_utf16_filter_bounds_ascii_patterns_and_opaque_url_encoding(self):
        async def send(_):
            return response({})

        transport = Transport(send)
        client = rt.ReadRuntime({"credentials": "synthetic_key", "transport": transport})
        await client.read("getDevices", {"query": {"serial_number": "😀" * 32, "limit": 1.0}})
        self.assertIn("limit=1&", transport.calls[-1].url)
        with self.assertRaises(rt.BotaApiError):
            await client.read("getDevices", {"query": {"serial_number": "😀" * 33}})
        with self.assertRaises(rt.BotaApiError):
            await client.read("getRecordings", {"query": {"start_date": "٢٠٢٦-10-20T00:00:00Z"}})
        await client.read("getDevicesById", {"path": {"id": "opaque/?#+%"}})
        self.assertTrue(transport.calls[-1].url.endswith("/opaque%2F%3F%23%2B%25"))
        self.assertNotIn("synthetic_key", repr(transport.calls[-1]))
        await client.aclose()

    async def test_root_policy_canonicalizes_authority_but_preserves_encoded_path(self):
        async def send(_):
            return response({})

        transport = Transport(send)
        client = rt.ReadRuntime({"credentials": "key", "transport": transport,
                                 "base_url": "https://BÜCHER.example:443/%c3%bc/v1/"})
        await client.read("getAuthIdentity")
        self.assertEqual(transport.calls[0].url, "https://xn--bcher-kva.example/%c3%bc/v1/auth/identity")
        for base in ("http://foreign.example/v1", "https://user:pass@example.test/v1", "https://example.test/v1?",
                     "https://example.test/a/../v1", "https://example.test/%2e/v1", "https://example.test/%2Fv1",
                     "https://example.test/v1#", "https://example.test\\x/v1", "https://example.test/v1\n"):
            with self.subTest(base=base), self.assertRaises(rt.BotaApiError):
                rt.ReadRuntime({"credentials": "key", "transport": transport, "base_url": base})
        await client.aclose()

    async def test_utf8_bom_null_and_empty_204_are_distinct_supported_results(self):
        count = 0
        closed = []

        async def send(_):
            nonlocal count
            count += 1

            async def close():
                closed.append(count)

            return rt.Response(204 if count == 3 else 200, {"content-type": "application/json"},
                               None if count == 3 else chunks(b"\xef\xbb\xbfnull" if count == 1 else b"null"), close=close)

        client = rt.ReadRuntime({"credentials": "key", "transport": Transport(send)})
        self.assertEqual((await client.read("getAuthIdentity")).status, 200)
        self.assertIsNone((await client.read("getAuthIdentity")).data)
        empty = await client.read("getAuthIdentity")
        self.assertEqual(empty.status, 204)
        self.assertIsNone(empty.data)
        self.assertEqual(len(closed), 3)
        await client.aclose()

    async def test_external_task_cancellation_propagates_and_joins_provider_fetch_and_body(self):
        for phase in ("provider", "fetch", "body"):
            with self.subTest(phase=phase):
                started, joined, closed = asyncio.Event(), asyncio.Event(), asyncio.Event()

                async def stall():
                    started.set()
                    try:
                        await asyncio.Future()
                    finally:
                        joined.set()

                async def provider(_):
                    if phase == "provider":
                        await stall()
                    return "synthetic_key"

                async def body():
                    await stall()
                    yield b"{}"

                async def close():
                    closed.set()

                async def send(_):
                    if phase == "fetch":
                        await stall()
                    return rt.Response(200, {"content-type": "application/json"}, body(), close=close)

                client = rt.ReadRuntime({"credentials": provider, "transport": Transport(send)})
                task = asyncio.create_task(client.read("getAuthIdentity"))
                await asyncio.wait_for(started.wait(), 2)
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                self.assertTrue(joined.is_set())
                self.assertEqual(closed.is_set(), phase == "body")
                await client.aclose()

    async def test_explicit_body_cancellation_retains_http_context_and_joins_reader(self):
        started, joined, closed, cancel = (asyncio.Event() for _ in range(4))

        async def body():
            started.set()
            try:
                await asyncio.Future()
                yield b"{}"
            finally:
                joined.set()

        async def close():
            closed.set()

        async def send(_):
            return rt.Response(200, {"content-type": "application/json", "x-request-id": "req_body"}, body(), close=close)

        client = rt.ReadRuntime({"credentials": "key", "transport": Transport(send)})
        task = asyncio.create_task(client.read("getAuthIdentity", options={"cancel_event": cancel}))
        await asyncio.wait_for(started.wait(), 2)
        cancel.set()
        with self.assertRaises(rt.BotaApiError) as error:
            await task
        self.assertEqual((error.exception.kind, error.exception.status, error.exception.request_id), ("aborted", 200, "req_body"))
        self.assertTrue(joined.is_set() and closed.is_set())
        await client.aclose()

    async def test_provider_errors_are_fixed_and_never_become_api_response_envelopes(self):
        async def provider(_):
            raise rt.BotaApiError("http", status=401, body={"error": {"message": "provider_secret_canary"}})

        client = rt.ReadRuntime({"credentials": provider, "transport": Transport(lambda _: None)})
        with self.assertRaises(rt.BotaApiError) as error:
            await client.read("getAuthIdentity")
        self.assertEqual(error.exception.kind, "credentials")
        self.assertIsNone(error.exception.status)
        self.assertIsNone(error.exception.body)
        self.assertIsNone(error.exception.__context__)
        self.assertNotIn("provider_secret_canary", repr(error.exception))
        await client.aclose()

    async def test_deadline_includes_synchronous_body_parse_and_closes_late_response(self):
        for phase in ("late_transport", "body", "parse"):
            clock, closed = [1000.0], asyncio.Event()

            async def close():
                closed.set()

            async def body():
                if phase == "body":
                    clock[0] = 1100.001
                yield b"{}"

            async def send(_):
                if phase == "late_transport":
                    clock[0] = 1100.001
                return rt.Response(200, {"content-type": "application/json", "x-request-id": "req_deadline"}, body(), close=close)

            real_loads = json.loads

            def parse(*args, **kwargs):
                value = real_loads(*args, **kwargs)
                if phase == "parse":
                    clock[0] = 1100.001
                return value

            client = rt.ReadRuntime({"credentials": "key", "transport": Transport(send), "timeout_ms": 100000})
            with patch.object(rt, "_now", side_effect=lambda: clock[0]), patch.object(rt.json, "loads", side_effect=parse):
                with self.subTest(phase=phase), self.assertRaises(rt.BotaApiError) as error:
                    await client.read("getAuthIdentity")
            self.assertEqual(error.exception.kind, "deadline")
            self.assertEqual(error.exception.status, None if phase == "late_transport" else 200)
            self.assertTrue(closed.is_set())
            await client.aclose()

    async def test_retry_limit_fresh_credentials_same_url_and_safe_rotated_history(self):
        keys = ["synthetic_first+/=", "synthetic_second+/=", "synthetic_third+/="]
        providers = 0

        def provider(_):
            nonlocal providers
            value = keys[providers]
            providers += 1
            return value

        async def send(_):
            if len(transport.calls) < 3:
                raise OSError("raw " + keys[len(transport.calls) - 1])
            return response({"error": {"code": "permission_denied", "message": "/".join(keys)}}, 403,
                            {"x-echo": "/".join(keys)})

        transport = Transport(send)
        client = rt.ReadRuntime({"credentials": provider, "transport": transport})
        with self.assertRaises(rt.BotaApiError) as error:
            await client.read("getDevices", {"query": {"serial_number": "same /+="}})
        self.assertEqual(providers, 3)
        self.assertEqual(len({call.url for call in transport.calls}), 1)
        for key in keys:
            self.assertNotIn(key, repr(error.exception) + json.dumps(error.exception.body) + repr(dict(error.exception.headers)))
        self.assertIsNone(error.exception.__context__)
        self.assertEqual(error.exception.status, 403)
        await client.aclose()

    async def test_backoff_cancellation_and_insufficient_budget_retain_last_response(self):
        entered, cancel = asyncio.Event(), asyncio.Event()

        async def send(_):
            return response({"error": {"code": "service_unavailable"}}, 503, {"x-request-id": "req_backoff"})

        async def sleep(_):
            entered.set()
            await asyncio.Future()

        transport = Transport(send)
        client = rt.ReadRuntime({"credentials": "key", "transport": transport})
        with patch.object(rt.asyncio, "sleep", side_effect=sleep):
            task = asyncio.create_task(client.read("getDevices", options={"cancel_event": cancel}))
            await asyncio.wait_for(entered.wait(), 2)
            cancel.set()
            with self.assertRaises(rt.BotaApiError) as error:
                await task
        self.assertEqual((error.exception.kind, error.exception.status, error.exception.request_id), ("aborted", 503, "req_backoff"))
        self.assertEqual(len(transport.calls), 1)
        await client.aclose()
        self.assertIsNone(rt._retry_delay("getDevices", rt.BotaApiError("http", status=503), None, 0, 2, 0.05))

    async def test_retry_after_canonical_grammar_and_caps(self):
        for value in ("11", "9999999999999999999", "0" * 129):
            self.assertEqual(rt._retry_after(value)[0], "blocked")
        for value in ("1.0", "-1", " 1", "1, 2", "Wed, 32 Oct 2026 00:00:00 GMT", "Tue, 20 Oct 2026 00:00:00 UTC"):
            self.assertEqual(rt._retry_after(value)[0], "invalid")
        self.assertEqual(rt._retry_after("00001"), ("valid", 1))
        with patch.object(rt.time, "time", return_value=1792454400):
            self.assertEqual(rt._retry_after("Tue, 20 Oct 2026 00:00:01 GMT"), ("valid", 1))
            self.assertEqual(rt._retry_after("Wed, 20 Oct 2026 00:00:01 GMT")[0], "invalid")

    async def test_iterator_pause_has_absolute_budget_without_cancelling_consumer(self):
        async def send(_):
            return response({"data": [], "has_more": True, "next_cursor": "next"})

        transport = Transport(send)
        client = rt.ReadRuntime({"credentials": "key", "transport": transport})
        clock = [1000.0]
        with patch.object(rt, "_now", side_effect=lambda: clock[0]):
            iterator = client.pages("getDevices", options={"timeout_ms": 100000})
            await anext(iterator)
            clock[0] = 1100.001
            await asyncio.sleep(0)  # Consumer work remains outside any SDK timeout scope.
            with self.assertRaises(rt.BotaApiError) as error:
                await anext(iterator)
        self.assertEqual(error.exception.kind, "deadline")
        self.assertEqual(len(transport.calls), 1)
        await iterator.aclose()
        await client.aclose()

    async def test_hanging_close_is_bounded_by_deadline_and_explicit_cancellation(self):
        for reason in ("deadline", "aborted"):
            entered, joined, cancel = (asyncio.Event() for _ in range(3))

            async def close():
                entered.set()
                if reason == "aborted":
                    cancel.set()
                try:
                    await asyncio.Future()
                finally:
                    joined.set()

            async def send(_):
                return rt.Response(200, {"content-type": "application/json", "x-request-id": "req_close"}, chunks(b"{}"), close=close)

            client = rt.ReadRuntime({"credentials": "key", "transport": Transport(send), "timeout_ms": 1000})
            task = asyncio.create_task(client.read("getAuthIdentity", options={"cancel_event": cancel}))
            await asyncio.wait_for(entered.wait(), 2)
            with self.assertRaises(rt.BotaApiError) as error:
                await asyncio.wait_for(task, 2)
            self.assertEqual((error.exception.kind, error.exception.status, error.exception.request_id), (reason, 200, "req_close"))
            self.assertTrue(joined.is_set())
            await client.aclose()

    async def test_provider_finally_wait_cannot_hold_external_cancellation_forever(self):
        entered, cleanup, joined = (asyncio.Event() for _ in range(3))

        async def provider(_):
            entered.set()
            try:
                await asyncio.Future()
            finally:
                cleanup.set()
                try:
                    await asyncio.Future()
                finally:
                    joined.set()

        client = rt.ReadRuntime({"credentials": provider, "transport": Transport(lambda _: None)})
        task = asyncio.create_task(client.read("getAuthIdentity"))
        await asyncio.wait_for(entered.wait(), 2)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await asyncio.wait_for(task, 2)
        self.assertTrue(cleanup.is_set() and joined.is_set())
        await client.aclose()

    async def test_disposal_timer_expiry_is_authoritative_when_clock_does_not_advance(self):
        entered, joined = asyncio.Event(), asyncio.Event()

        async def close():
            entered.set()
            try:
                await asyncio.Future()
            finally:
                joined.set()

        async def send(_):
            return rt.Response(200, {"content-type": "application/json", "x-request-id": "req_coarse_clock"}, chunks(b"{}"), close=close)

        original_wait = asyncio.wait

        async def expired_wait(tasks, **kwargs):
            tasks = tuple(tasks)
            if any(task.get_coro().__qualname__ == "_close_response" for task in tasks):
                await asyncio.sleep(0)
                return set(), set(tasks)
            return await original_wait(tasks, **kwargs)

        client = rt.ReadRuntime({"credentials": "key", "transport": Transport(send), "timeout_ms": 100000})
        with patch.object(rt, "_now", return_value=1000.0), patch.object(rt.asyncio, "wait", side_effect=expired_wait):
            with self.assertRaises(rt.BotaApiError) as error:
                await client.read("getAuthIdentity")
        self.assertEqual((error.exception.kind, error.exception.status, error.exception.request_id), ("deadline", 200, "req_coarse_clock"))
        self.assertTrue(entered.is_set() and joined.is_set())
        await client.aclose()

    async def test_close_joins_active_request_cleanup_and_does_not_close_injected_transport(self):
        started, cleanup, joined = (asyncio.Event() for _ in range(3))

        async def body():
            started.set()
            await asyncio.Future()
            yield b"{}"

        async def close():
            cleanup.set()
            try:
                await asyncio.Future()
            finally:
                joined.set()

        async def send(_):
            return rt.Response(200, {"content-type": "application/json"}, body(), close=close)

        transport = Transport(send)
        client = rt.ReadRuntime({"credentials": "key", "transport": transport})
        read = asyncio.create_task(client.read("getDevices"))
        await asyncio.wait_for(started.wait(), 2)
        close_task = asyncio.create_task(client.aclose())
        await asyncio.wait_for(cleanup.wait(), 2)
        await asyncio.wait_for(close_task, 2)
        self.assertTrue(joined.is_set())
        with self.assertRaises(rt.BotaApiError) as error:
            await read
        self.assertEqual(error.exception.kind, "aborted")
        with self.assertRaises(rt.BotaApiError):
            await client.read("getDevices")


if __name__ == "__main__":
    unittest.main()
