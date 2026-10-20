"""Ordinary mutation uncertainty, strict inputs and real loopback submission."""
from __future__ import annotations

import asyncio
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bota_api_sdk import BotaApiClient, BotaMutationError, BotaMutationCancelledError
from bota_api_sdk import runtime as rt
from test_native import server, request, reply

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT.parent / "typescript" / "mutations"
CORPUS = json.loads((SHARED / "corpus.json").read_bytes())


async def chunks(value):
    yield value


def response(body=None, status=201, headers=None):
    return rt.Response(status, {"content-type": "application/json", **(headers or {})},
                       chunks(json.dumps(body).encode()))


class Transport:
    def __init__(self, handler):
        self.handler, self.calls = handler, []

    async def send(self, value):
        self.calls.append(value)
        return await self.handler(value)


class MutationCorpusTests(unittest.IsolatedAsyncioTestCase):
    async def run_case(self, fixture):
        calls, credentials = [], []

        def credential(_):
            credentials.append(True)
            return "synthetic_mutation_key"

        class Fixture:
            async def send(self, value):
                calls.append(value)
                if fixture.get("transportFailure"):
                    raise RuntimeError("synthetic_raw_failure")
                step = fixture["response"]
                raw = b"{" if fixture.get("invalidJson") else json.dumps(step["body"]).encode()
                return rt.Response(step["status"], {"content-type": "application/json", **step.get("headers", {})}, chunks(raw))

        async with BotaApiClient({"credentials": credential, "transport": Fixture(), "max_retries": 2}) as client:
            try:
                result = await client.mutate(fixture["operation"], fixture["input"],
                    {"max_retries": fixture["options"]["maxRetries"]} if "options" in fixture else rt.UNSET)
                observed = {"status": result.status, "data": result.data}
            except BotaMutationError as error:
                observed = {"kind": error.kind, "requestOutcome": error.request_outcome}
                if error.status is not None:
                    observed["status"] = error.status
                self.assertIsNone(error.__cause__)
                self.assertIsNone(error.__context__)
        self.assertEqual(observed, fixture["expected"]["result"])
        self.assertEqual(len(calls), fixture["expected"]["dispatches"])
        self.assertEqual(len(credentials), fixture["expected"]["credentials"])
        for sent in calls:
            self.assertEqual(sent.method, "POST" if fixture["operation"] == "postEndUsers" else "PATCH")
            expected = "https://api.bota.dev/v1/end-users"
            if sent.method == "PATCH":
                expected += "/" + quote(fixture["input"]["path"]["id"], safe="~!*'()")
            self.assertEqual(sent.url, expected)
            self.assertEqual(json.loads(sent.body), fixture["input"]["body"])
            self.assertEqual(sent.headers["Content-Type"], "application/json")
            self.assertFalse(any("idempotency" in name.lower() for name in sent.headers))


def case_method(fixture):
    async def case(self):
        await self.run_case(fixture)
    return case


assert CORPUS["version"] == 1 and CORPUS["policy"] == "ordinary-end-user-writes-v1"
assert len(CORPUS["cases"]) == 36 and len({case["id"] for case in CORPUS["cases"]}) == 36
for _fixture in CORPUS["cases"]:
    setattr(MutationCorpusTests, "test_" + _fixture["id"].replace("-", "_"), case_method(_fixture))


class MutationRuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_strict_json_hazards_refuse_before_credentials_or_transport(self):
        cycle = {}
        cycle["cycle"] = cycle
        deep = root = {}
        for _ in range(65):
            deep["child"] = {}
            deep = deep["child"]
        for body in (cycle, root, {1: "key"}, {"bad": float("nan")}, {"bad": float("inf")},
                     {"bad": 2**53}, {"bad": 1e50}, {"bad": b"bytes"}, {"bad": (1, 2)},
                     {"bad": {1, 2}}, {"bad": object()}, {"bad": "\ud800"}, {"\udfff": 1},
                     {"x": "a" * 1048569}, {"a": [None] * 99999}):
            with self.subTest(kind=type(body)):
                def credentials(_):
                    self.fail("credential accessed")
                async def send(_):
                    self.fail("transport accessed")
                async with BotaApiClient({"credentials": credentials, "transport": Transport(send)}) as client:
                    with self.assertRaises(BotaMutationError) as failure:
                        await client.mutate("postEndUsers", {"body": body})
                self.assertEqual((failure.exception.kind, failure.exception.request_outcome), ("invalid_input", "not_submitted"))

    async def test_exact_json_bounds_shared_values_and_unicode_roundtrip(self):
        shared = {"ok": True}
        deep = root = {}
        for _ in range(64):
            deep["child"] = {}
            deep = deep["child"]
        bodies = [root, {"a": [None] * 99998}, {"x": "a" * 1048568},
                  {"a": shared, "b": shared, "unicode": "😀你好", "toJSON": "data", "__proto__": {"safe": True},
                   "numbers": [2**53-1, -(2**53-1), 2.5, -0.0]}]
        for body in bodies:
            async def send(value):
                self.assertEqual(json.loads(value.body), body)
                return response({})
            async with BotaApiClient({"credentials": "synthetic_bounds", "transport": Transport(send)}) as client:
                await client.mutate("postEndUsers", {"body": body})

    async def test_serialization_is_once_and_snapshot_precedes_credentials(self):
        body = {"external_id": "original", "metadata": {"unknown": True}}
        def credentials(_):
            body["external_id"] = "changed"
            body["metadata"]["unknown"] = False
            return "synthetic_snapshot"
        async def send(value):
            self.assertEqual(json.loads(value.body), {"external_id": "original", "metadata": {"unknown": True}})
            self.assertNotIn("synthetic_snapshot", repr(value))
            return response({})
        original = json.dumps
        counts = []
        def dumps(value, *args, **kwargs):
            counts.append(value)
            return original(value, *args, **kwargs)
        async with BotaApiClient({"credentials": credentials, "transport": Transport(send)}) as client:
            with patch.object(rt.json, "dumps", side_effect=dumps):
                await client.mutate("postEndUsers", {"body": body})
        self.assertEqual(sum(value is body for value in counts), 1)

    async def test_deadline_covers_serialization_before_credentials(self):
        ticks = [0.0]
        def now():
            ticks[0] += 0.010
            return ticks[0]
        def credential(_):
            self.fail("credential after serialization deadline")
        async def send(_):
            self.fail("transport after serialization deadline")
        async with BotaApiClient({"credentials": credential, "transport": Transport(send)}) as client:
            with patch.object(rt, "_now", side_effect=now):
                with self.assertRaises(BotaMutationError) as failure:
                    await client.mutate("postEndUsers", {"body": {"x": [1] * 100}}, {"timeout_ms": 50})
        self.assertEqual((failure.exception.kind, failure.exception.request_outcome), ("deadline", "not_submitted"))

    async def test_provider_failure_bad_key_and_pre_cancel_never_submit(self):
        for mode in ("raises", "empty", "cancel", "slow"):
            event = asyncio.Event()
            if mode == "cancel":
                event.set()
            async def credentials(_):
                if mode == "raises":
                    raise RuntimeError("synthetic_provider_canary")
                if mode == "slow":
                    await asyncio.sleep(1)
                return "" if mode == "empty" else "synthetic_ok"
            async def send(_):
                self.fail("transport called")
            async with BotaApiClient({"credentials": credentials, "transport": Transport(send)}) as client:
                with self.assertRaises(BotaMutationError) as failure:
                    await client.mutate("postEndUsers", {"body": {}}, {"cancel_event": event, "timeout_ms": 20})
            self.assertEqual(failure.exception.request_outcome, "not_submitted")
            self.assertNotIn("canary", repr(failure.exception))
            self.assertIsNone(failure.exception.__context__)

    async def test_cancel_event_deadline_and_task_cancel_after_send_are_unknown(self):
        for mode in ("event", "deadline", "task"):
            sent, event, closed = asyncio.Event(), asyncio.Event(), asyncio.Event()
            async def send(_):
                sent.set()
                try:
                    await asyncio.sleep(1)
                finally:
                    closed.set()
                return response({})
            transport = Transport(send)
            async with BotaApiClient({"credentials": "synthetic_cancellation", "transport": transport}) as client:
                task = asyncio.create_task(client.mutate("postEndUsers", {"body": {}}, {"cancel_event": event, "timeout_ms": 30 if mode == "deadline" else 2000}))
                await sent.wait()
                if mode == "event":
                    event.set()
                if mode == "task":
                    task.cancel()
                with self.assertRaises(BotaMutationCancelledError if mode == "task" else BotaMutationError) as failure:
                    await task
                if mode == "task":
                    self.assertTrue(task.cancelled())
                    self.assertNotIsInstance(failure.exception, Exception)
                await asyncio.wait_for(closed.wait(), 1)
            self.assertEqual(failure.exception.request_outcome, "unknown")
            self.assertEqual(failure.exception.kind, "deadline" if mode == "deadline" else "aborted")
            self.assertEqual(len(transport.calls), 1)

    async def test_cancelled_provider_preserves_task_cancellation_without_dispatch(self):
        started = asyncio.Event()
        async def credential(_):
            started.set()
            await asyncio.sleep(10)
            return "synthetic_never_returned"
        async def send(_):
            self.fail("transport after cancelled provider")
        async with BotaApiClient({"credentials": credential, "transport": Transport(send)}) as client:
            task = asyncio.create_task(client.post_end_users({"body": {}}))
            await started.wait()
            task.cancel()
            with self.assertRaises(BotaMutationCancelledError) as failure:
                await task
        self.assertTrue(task.cancelled())
        self.assertEqual(failure.exception.request_outcome, "not_submitted")

    async def test_custom_input_path_and_id_hooks_are_refused_without_execution(self):
        hooks = []
        class Hostile(dict):
            def __iter__(self):
                self.fail_hook()
            def __getitem__(self, _):
                self.fail_hook()
            def get(self, *_):
                self.fail_hook()
            def fail_hook(self):
                hooks.append(True)
                raise AssertionError("custom mapping hook executed")
        class String(str):
            def __hash__(self):
                hooks.append(True)
                return super().__hash__()
            def __eq__(self, other):
                hooks.append(True)
                return super().__eq__(other)
            def encode(self, *_args, **_kwargs):
                hooks.append(True)
                raise AssertionError("custom string hook executed")
        class Number(int):
            def __le__(self, other):
                hooks.append(True)
                return super().__le__(other)
        async def send(_):
            self.fail("transport after invalid path")
        def credential(_):
            self.fail("credential after invalid path")
        async with BotaApiClient({"credentials": credential, "transport": Transport(send)}) as client:
            for value in (Hostile(body={}), {"path": Hostile(id="eu"), "body": {}},
                          {"path": {"id": String("eu")}, "body": {}}):
                with self.assertRaises(BotaMutationError) as failure:
                    await client.mutate("patchEndUsersById", value)
                self.assertEqual(failure.exception.request_outcome, "not_submitted")
            for options in (Hostile(), {"max_retries": Number(0)}):
                with self.assertRaises(BotaMutationError):
                    await client.post_end_users({"body": {}}, options)
            with self.assertRaises(BotaMutationError):
                await client.mutate(String("postEndUsers"), {"body": {}})
            self.assertEqual(hooks, [])
            value = {String("body"): {}}
            hooks.clear()  # Construction necessarily hashes the caller's key.
            with self.assertRaises(BotaMutationError):
                await client.mutate("postEndUsers", value)
        self.assertEqual(hooks, [])

    async def test_json_byte_budget_refuses_before_encoding_or_aggregate_dump(self):
        for body in ({"x": "x" * (1024 * 1024 + 1)}, {"x": ["😀" * 100000] * 4},
                     {"x": ["\x00" * 100000] * 2}):
            async def send(_):
                self.fail("transport on oversized body")
            def credential(_):
                self.fail("credential on oversized body")
            with patch.object(rt.json, "dumps", side_effect=AssertionError("unbounded encoding attempted")):
                async with BotaApiClient({"credentials": credential, "transport": Transport(send)}) as client:
                    with self.assertRaises(BotaMutationError) as failure:
                        await client.mutate("postEndUsers", {"body": body})
            self.assertEqual((failure.exception.kind, failure.exception.request_outcome), ("invalid_input", "not_submitted"))

    async def test_response_limits_redirect_partial_body_and_error_redaction(self):
        key = "synthetic_error_canary"
        for mode in ("redirect", "oversized", "broken", "http"):
            closed = []
            async def body():
                if mode == "broken":
                    yield b'{"partial":'
                    raise RuntimeError(key)
                yield json.dumps({"error": {"message": key, "request_id": "req_fixed"}}).encode()
            async def close():
                closed.append(True)
            async def send(_):
                return rt.Response(302 if mode == "redirect" else 400 if mode == "http" else 201,
                    {"content-type": "application/json", "x-echo": key}, body(), close=close)
            async with BotaApiClient({"credentials": key, "transport": Transport(send), "max_response_bytes": 1 if mode == "oversized" else 4096}) as client:
                with self.assertRaises(BotaMutationError) as failure:
                    await client.mutate("postEndUsers", {"body": {}})
            self.assertEqual(failure.exception.request_outcome, "unknown")
            self.assertEqual(closed, [True])
            self.assertNotIn(key, repr(failure.exception) + str(failure.exception) + repr(dict(failure.exception.headers)) + repr(failure.exception.body))
            self.assertIsNone(failure.exception.__context__)

    async def test_named_methods_use_same_maintained_attempt(self):
        async def send(value):
            return response({"unknown": "9007199254740993"}, 201 if value.method == "POST" else 200)
        transport = Transport(send)
        async with BotaApiClient({"credentials": "synthetic_named", "transport": transport}) as client:
            first = await client.post_end_users({"body": {}})
            second = await client.patch_end_users_by_id({"path": {"id": "opaque/?"}, "body": {}})
        self.assertEqual((first.status, second.status), (201, 200))
        self.assertEqual([value.method for value in transport.calls], ["POST", "PATCH"])

    async def test_native_post_response_loss_is_exactly_one_submission(self):
        observed = []
        async def api(reader, writer):
            first, headers = await request(reader)
            body = await reader.readexactly(int(headers["content-length"]))
            observed.append((first, headers, body))
            # Closing after consuming the entire POST models lost acknowledgment.
        async with server(api) as origin:
            async with BotaApiClient({"credentials": "synthetic_lost_response", "base_url": origin + "/v1",
                                      "allow_loopback_http": True, "max_retries": 2}) as client:
                with self.assertRaises(BotaMutationError) as failure:
                    await client.post_end_users({"body": {"external_id": "stable-correlation"}})
        self.assertEqual(len(observed), 1)
        self.assertEqual(observed[0][0], "POST /v1/end-users HTTP/1.1")
        self.assertEqual(json.loads(observed[0][2]), {"external_id": "stable-correlation"})
        self.assertFalse(any("idempotency" in name for name in observed[0][1]))
        self.assertEqual((failure.exception.kind, failure.exception.request_outcome), ("transport", "unknown"))

    async def test_native_patch_transmits_json_and_encoded_path_once(self):
        observed = []
        async def api(reader, writer):
            first, headers = await request(reader)
            observed.append((first, await reader.readexactly(int(headers["content-length"]))))
            await reply(writer, b'{"id":"eu_native","metadata":{"raw":true}}', close=True)
        async with server(api) as origin:
            async with BotaApiClient({"credentials": "synthetic_patch", "base_url": origin + "/v1", "allow_loopback_http": True}) as client:
                result = await client.patch_end_users_by_id({"path": {"id": "opaque/?#+"}, "body": {"metadata": {"x": None}}})
        self.assertEqual(observed, [("PATCH /v1/end-users/opaque%2F%3F%23%2B HTTP/1.1", b'{"metadata":{"x":null}}')])
        self.assertEqual(result.status, 200)


class MutationGenerationTests(unittest.TestCase):
    def test_projection_models_and_regeneration_are_independently_bounded(self):
        spec = importlib.util.spec_from_file_location("mutation_generation", ROOT / "tools/generate_mutations.py")
        generation = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generation)
        document, cohort, inputs = generation.load_inputs()
        generation.generate(check=True)
        first = generation.render(document, cohort)
        self.assertEqual(first, generation.render(document, cohort))
        for name, value in first.items():
            if name.endswith(".py"):
                compile(value, name, "exec", dont_inherit=True)
        for mutate in (lambda value: value["paths"]["/end-users"].update(delete={}),
                       lambda value: value["paths"]["/end-users"]["post"].update(operationId="postDevices"),
                       lambda value: value["paths"]["/end-users"]["post"]["requestBody"]["content"].update(text={}),
                       lambda value: value["paths"]["/end-users"]["post"]["requestBody"].update(required=False),
                       lambda value: value["paths"]["/end-users"]["post"].update(parameters=[{"in": "header", "name": "X-New", "required": True, "schema": {"type": "string"}}]),
                       lambda value: value["paths"]["/end-users"]["post"]["responses"].update({"202": {}}),
                       lambda value: value["paths"]["/end-users"]["post"]["x-bota-write-contract"].update(automatic_retry=True),
                       lambda value: value["paths"]["/end-users"]["post"]["x-bota-write-contract"].update(automatic_idempotency_key=True),
                       lambda value: value["paths"]["/end-users"]["post"]["x-bota-write-contract"].update(automatic_reconciliation=True)):
            changed = copy.deepcopy(document)
            mutate(changed)
            with self.assertRaises(ValueError):
                generation.render(changed, cohort)

    def test_generated_mutation_descriptors_cannot_expand_the_runtime_cohort(self):
        from bota_api_sdk.generated.mutations.operations import MUTATIONS
        for action in (lambda: MUTATIONS.__setitem__("postDevices", {}),
                       lambda: MUTATIONS["postEndUsers"].__setitem__("path", "/devices"),
                       lambda: MUTATIONS["patchEndUsersById"]["parameters"][0]["schema"].__setitem__("type", "integer")):
            with self.assertRaises((TypeError, AttributeError)):
                action()


if __name__ == "__main__":
    unittest.main()
