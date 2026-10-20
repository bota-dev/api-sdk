# Bota API SDK for Python

Experimental `bota-api-sdk` candidate `0.1.0b0`, licensed under MIT. This package
implements an async-only `BotaApiClient` for CPython 3.12–3.15. Source and local
package checks do not establish PyPI publication, hosted qualification or live
backend compatibility. A synchronous client is outside this first cohort.

The generated surface covers credential identity and list/get for end users,
devices, recordings, transcriptions and summaries. Models come from the pinned
public OpenAPI projection; they describe supported fields without validating,
normalizing or removing arbitrary JSON returned by a server. Integer/decimal
wire strings, quoted `"NaN"`, null and additional fields retain their wire shape.

An independently pinned ordinary-write cohort adds `post_end_users({"body": {}})`
and `patch_end_users_by_id({"path": {"id": "..."}, "body": {}})`. These require an
explicit JSON object body, including for an empty update. Unknown JSON fields are
transmitted; backend validation controls field acceptance and permissions. PATCH
replaces supplied metadata according to the backend contract. Response models
live in `mutation_models`; original read models remain pinned independently.

```python
import asyncio
import os

from bota_api_sdk import BotaApiClient


async def main() -> None:
    async with BotaApiClient({"credentials": os.environ["BOTA_API_KEY"]}) as client:
        identity = await client.get_auth_identity()
        if identity.data is not None:
            print(identity.data["project_id"])


asyncio.run(main())
```

Pass credentials explicitly or supply the runtime's credential provider. The
SDK does not read CLI profiles, obtain a Platform login, issue tokens or grant
backend permissions. Keep project secrets on trusted servers. Caller-injected
transports are trusted code and remain caller-owned; close the client to join
its owned transport and active operations. Omitting a parameter uses `UNSET`;
`None` remains distinct and is accepted only where the contract permits null.

The maintained runtime owns origin binding, strict JSON parsing, bounded
response reads, total deadlines, cancellation, eligible read retries and
pagination. Retries apply only to the eleven reviewed GET operations. They do
not establish a snapshot, mutation replay contract or remote cancellation.
Ask/streaming, other writes, uploads and physical device control are outside this
package's admitted cohorts. `is_test_mode` in identity does not certify test/live
data or billing isolation.

Ordinary writes make exactly one transport attempt. The global read retry setting
does not apply; mutation request `max_retries` accepts only `0`. The SDK adds no
idempotency header and performs no follow-up read or automatic reconciliation.
`BotaMutationError` extends `BotaApiError` with `request_outcome`: `not_submitted`
means transport invocation never began; `unknown` means it began, including HTTP
errors, response loss, malformed replies, explicit cancellation or deadline expiry.
This does not assert that the backend committed a change. External task
cancellation propagates `BotaMutationCancelledError`, an `asyncio.CancelledError`
subclass with fixed `kind="aborted"` and the same `request_outcome` metadata;
ordinary `except Exception` does not intercept it. Explicit `cancel_event` uses
`BotaMutationError`. Read task cancellation remains unchanged. Reconcile using an explicitly selected read and correlation
data; never repeat creation merely because a response was lost.

Mutation JSON is serialized once before credential resolution under the request
deadline. Objects/lists, strings containing valid Unicode, finite numbers,
booleans and null are supported. Integral numbers must fit JavaScript's safe
integer range; cycles, non-JSON Python objects, depth over 64, more than 100,000
value nodes or serialized UTF-8 over 1 MiB refuse before credential access.

Default native HTTP uses pinned `aiohttp` without optional extras. Environment
proxy/netrc credentials, ambient cookies and redirects are not implicit
authority. The native adapter's qualified behavior and supported interpreter
receipts must be checked alongside source tests before promoting a candidate.
Native requests send `Accept-Encoding: identity` and refuse unsolicited
compressed responses. This response-coding cohort is narrower than TypeScript's
fetch decoding; full native transport parity remains partial.

## Build and inspect a candidate

Root tooling owns the reviewed hash lock, wheel downloads, dependency licenses,
interpreter matrix and CI. Do not replace a failed frozen install with an
unlocked install. With a reviewed environment already prepared:

```sh
python -I tools/generate.py --check
python -I tools/generate_mutations.py --check
python -I tools/build_package.py --output-dir /absolute/new/output
python -I tools/verify_package.py --python /absolute/python --wheelhouse /absolute/wheelhouse --lock /absolute/hash-lock --typechecker /absolute/ty --output-dir /absolute/new/qualification
```

The build proof currently admits normal GIL-enabled, non-debug CPython on
Linux/Windows x64. CPython 3.12.14 on Windows is a local development instrument;
it does not qualify the separate hosted interpreter matrix. Other platforms,
free-threaded builds and debug interpreters require their own acceptance.

The builder uses `flit_core.buildapi` directly from an allowlisted temporary
stage. It records source identity and input/tool hashes, never rewrites tracked
source to make a build pass, and refuses incomplete generation. The verifier
checks deterministic wheel/sdist bytes and archive inventories, then installs
both into fresh outside-checkout virtual environments using offline hashed
dependencies. Qualification receipts distinguish dirty development source from
a clean commit. Wheel consumers have only runtime dependencies; sdist consumers
also have pinned build/type tools for their offline source build. No script
publishes a package.

To test a canonical candidate on another supported interpreter, add
`--candidate-dir /absolute/candidate --candidate-receipt /absolute/candidate/qualification-receipt.json`.
This mode performs zero builds. The input directory must contain exactly the
wheel, sdist, producer qualification receipt and `ci-receipt.json`. Package
checks validate producer evidence, current source/input/payload identities and
the exact archive hashes; root CI additionally validates the incoming CI receipt
chain. The same archives are then installed in fresh outside-checkout consumers.
The verifier writes the two archive files and `qualification-receipt.json` at
its output root. Cross-runtime acceptance requires the actual matrix receipts.
