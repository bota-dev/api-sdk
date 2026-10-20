"""Execute the exact 94 language-neutral cases against the Python read runtime."""
from __future__ import annotations

import asyncio
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from bota_api_sdk.runtime import BotaApiError, ReadRuntime, Response  # noqa: E402
from corpus_support import assert_corpus, encoded_secret, json_body, load_shared, renamed_options, semantic_url  # noqa: E402


SHARED = ROOT.parent / "typescript" / "conformance"
SCHEMA, CORPUS = load_shared(SHARED)


class SharedConformance(unittest.IsolatedAsyncioTestCase):
    async def run_fixture(self, fixture):
        event = asyncio.Event()
        calls, providers, pages = [], [], []
        credentials = fixture.get("credentials", ["synthetic_fixture_key"])
        step_index = 0

        class ScriptedTransport:
            async def send(inner, request):
                nonlocal step_index
                self.assertEqual(request.method, "GET")
                headers = {key.lower(): value for key, value in request.headers.items()}
                self.assertEqual(set(headers), {"accept", "authorization"})
                self.assertEqual(headers["accept"], "application/json")
                calls.append({"url": request.url, "credential": headers["authorization"][len("Bearer "):]})
                self.assertEqual(headers["authorization"], "Bearer " + credentials[len(calls) - 1])
                self.assertLess(step_index, len(fixture["script"]), "unexpected extra send")
                step = fixture["script"][step_index]
                step_index += 1
                if step["type"] == "transport":
                    raise OSError(step.get("message", "synthetic transport fault"))
                if step["type"] == "cancel_fetch":
                    request.cancel_event.set()
                    await asyncio.Future()
                if "body" in step:
                    content = json_body(step["body"])
                elif "bodyText" in step:
                    content = step["bodyText"].encode("utf-8")
                elif "bodyBytes" in step:
                    content = bytes(step["bodyBytes"])
                else:
                    content = None

                async def chunks():
                    if content is not None:
                        yield content
                    elif step.get("bodyFault") == "cancel":
                        request.cancel_event.set()
                        await asyncio.Future()
                    else:
                        raise OSError("synthetic body transport fault")

                return Response(status=step["status"], headers=step.get("headers", {"content-type": "application/json"}),
                                body=None if step["status"] == 204 else chunks(),
                                url=step.get("url", ""), redirected=step.get("redirected", False))

        async def credential(context):
            providers.append(context)
            self.assertIsInstance(context.cancel_event, asyncio.Event)
            self.assertFalse(context.cancel_event.is_set())
            self.assertLessEqual(len(providers), len(credentials), "unexpected credential request")
            return credentials[len(providers) - 1]

        invoke = fixture["invoke"]
        options = renamed_options(invoke.get("client", {}))
        options.update(credentials=credential, transport=ScriptedTransport())
        failure, result, client = None, None, None
        try:
            client = ReadRuntime(options)
            if invoke.get("cancelAt") == "pre_request":
                event.set()
            request_options = renamed_options(invoke["options"]) if "options" in invoke else {}
            if isinstance(request_options, dict):
                request_options = {**request_options, "cancel_event": event}
            # Keep the distinction between absent input and explicit JSON null.
            args = (invoke["input"], request_options) if "input" in invoke else ()
            kwargs = {} if args else {"options": request_options}
            if invoke["mode"] == "read":
                result = await client.read(invoke["operationId"], *args, **kwargs)
            else:
                iterator = client.pages(invoke["operationId"], *args, **kwargs)
                try:
                    async for page in iterator:
                        pages.append(page)
                        if len(pages) == invoke.get("stopAfterPages"):
                            break
                finally:
                    await iterator.aclose()
        except asyncio.CancelledError:
            # Explicit event cancellation normally returns BotaApiError; native
            # caller Task cancellation remains idiomatic CancelledError.
            failure = {"kind": "aborted", "headers": {}}
        except BotaApiError as error:
            failure = {name: getattr(error, name) for name in ("kind", "status", "body", "code", "param")
                       if getattr(error, name, None) is not None}
            for name, key in (("request_id", "requestId"), ("api_message", "apiMessage")):
                if getattr(error, name, None) is not None:
                    failure[key] = getattr(error, name)
            failure["headers"] = dict(error.headers)
            self.assertIsNone(error.__cause__)
            for secret in fixture["expect"].get("absentSecrets", []):
                rendered = json.dumps({"message": str(error), "error": failure}, ensure_ascii=False)
                self.assertNotIn(secret, rendered)
                self.assertNotIn(encoded_secret(secret), rendered)
        finally:
            if client is not None:
                await client.aclose()
        expected = fixture["expect"]
        normalize = lambda entry: {"url": semantic_url(entry["url"]), "credential": entry["credential"]}
        self.assertEqual([normalize(call) for call in calls], [normalize(call) for call in expected["calls"]])
        targets = {}
        for call in calls:
            target = json.dumps(semantic_url(call["url"]), sort_keys=True)
            self.assertEqual(targets.setdefault(target, call["url"]), call["url"])
        self.assertEqual(len(providers), expected["credentialCalls"])
        self.assertEqual(step_index, len(fixture["script"]), "unused scripted response")
        if "pages" in expected:
            self.assertEqual(pages, expected["pages"])
        self.assertEqual(failure, expected.get("error"))
        if "result" in expected:
            normalized = {"status": result.status, "headers": dict(result.headers)}
            if result.status != 204:
                normalized["data"] = result.data
            self.assertEqual(normalized, expected["result"])


def fixture_test(fixture):
    async def run(self):
        await self.run_fixture(copy.deepcopy(fixture))
    return run


for fixture in CORPUS["cases"]:
    setattr(SharedConformance, "test_" + fixture["id"].replace("-", "_"), fixture_test(fixture))


class CorpusBoundaryTests(unittest.TestCase):
    def test_all_94_original_cases_are_present(self):
        self.assertEqual(len(CORPUS["cases"]), 94)

    def test_shared_fixture_bytes_cannot_be_replaced_by_different_passing_expectations(self):
        with tempfile.TemporaryDirectory(prefix="bota-python-corpus-") as directory:
            target = Path(directory)
            for name in ("corpus.json", "corpus.schema.json", "policy.json"):
                (target / name).write_bytes((SHARED / name).read_bytes())
            self.assertEqual(len(load_shared(target)[1]["cases"]), 94)
            changed = copy.deepcopy(CORPUS)
            changed["cases"][0]["purpose"] = "altered source identity"
            (target / "corpus.json").write_text(json.dumps(changed), "utf-8")
            with self.assertRaisesRegex(ValueError, "shared_fixture_digest_mismatch"):
                load_shared(target)

    def test_url_comparison_retains_duplicates_encoded_path_and_query_values(self):
        self.assertEqual(semantic_url("https://fixture.invalid/v1/devices?x=%2B&x=~&name=hello%20world"),
                         semantic_url("https://fixture.invalid/v1/devices?name=hello+world&x=%7E&x=%2B"))
        self.assertNotEqual(semantic_url("https://fixture.invalid/v1/devices?x=1&x=1"), semantic_url("https://fixture.invalid/v1/devices?x=1"))
        self.assertNotEqual(semantic_url("https://fixture.invalid/v1/devices/a%2Fb"), semantic_url("https://fixture.invalid/v1/devices/a/b"))
        for url in ("https://user@fixture.invalid/v1/devices", "https://@fixture.invalid/v1/devices", "https://fixture.invalid/v1/devices#"):
            with self.assertRaises(ValueError):
                semantic_url(url)

    def test_schema_adapter_rejects_unknown_schema_and_ambiguous_or_mutated_cases(self):
        for mutate in [lambda c: c.update(extra=True), lambda c: c["cases"].append(c["cases"][0]),
                       lambda c: c["cases"][0]["script"][0].update(bodyText="{}"),
                       lambda c: c["cases"][0]["expect"].update(error={"kind": "http", "headers": {}}),
                       lambda c: c["cases"][0]["invoke"].update(mode="unknown"),
                       lambda c: c.update(version=True)]:
            corpus = copy.deepcopy(CORPUS)
            mutate(corpus)
            with self.assertRaises(ValueError):
                assert_corpus(SCHEMA, corpus)
        with self.assertRaises(ValueError):
            assert_corpus({**SCHEMA, "unknownKeyword": True}, CORPUS)


if __name__ == "__main__":
    unittest.main()
