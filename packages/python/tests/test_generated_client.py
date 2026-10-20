"""Named generated methods share exactly the maintained read transport boundary."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from bota_api_sdk.generated.client import BotaApiClient  # noqa: E402
from bota_api_sdk.runtime import UNSET, ReadResult, ReadRuntime  # noqa: E402


class GeneratedClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_eleven_named_methods_delegate_exact_operation_and_raw_inputs(self):
        class NoNetwork:
            async def send(self, request):
                raise AssertionError("generated methods must delegate to read")

        client = BotaApiClient({"credentials": "synthetic_named_only", "transport": NoNetwork()})
        methods = json.loads((ROOT / "src/bota_api_sdk/generated/methods.json").read_bytes())
        payload = {"file_size_bytes": "9223372036854775807", "confidence": "NaN", "audio_url": None, "unknown": {"preserved": True}}
        result = ReadResult(status=200, data=payload, headers={})
        read = AsyncMock(return_value=result)
        try:
            with patch.object(ReadRuntime, "read", read):
                for method in methods:
                    input = {"path": {"id": "opaque/a?b#c"}} if method["input_required"] else {"query": {"limit": 1}}
                    options = {"max_retries": 0}
                    self.assertIs(await getattr(client, method["name"])(input, options), result)
                    read.assert_awaited_with(method["operation_id"], input, options)
                self.assertEqual(read.await_count, 11)
        finally:
            await client.aclose()

    async def test_optional_omission_and_explicit_none_are_not_conflated(self):
        client = BotaApiClient({"credentials": "synthetic_omission_only"})
        read = AsyncMock(return_value=ReadResult(status=204, data=None, headers={}))
        try:
            with patch.object(ReadRuntime, "read", read):
                await client.get_auth_identity()
                read.assert_awaited_with("getAuthIdentity", UNSET, UNSET)
                await client.get_auth_identity(None, None)
                read.assert_awaited_with("getAuthIdentity", None, None)
                with self.assertRaises(TypeError):
                    await client.get_devices_by_id()
                self.assertEqual(read.await_count, 2)
        finally:
            await client.aclose()


if __name__ == "__main__":
    unittest.main()
