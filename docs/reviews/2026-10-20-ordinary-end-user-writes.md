# Ordinary end-user SDK writes

The Developer Toolchain Design sections 3, 4.1 and 7 and implementation-plan
T02/T12/T13/T16 own this increment. Both SDK languages add only creation and
update of ordinary end users; the original eleven-read contract input,
generated read schemas, method inventory and 94 shared fixtures keep their
identities. Source candidates remain version 0.1.0-beta.0 and unpublished.

## Contract and implementation

Backend [694405e2](https://github.com/bota-dev/bota/commit/694405e2f1cf6158b0f930ab3a28efc0def89d27)
certifies two existing operations without changing their runtime behavior.
The separately pinned public input is docs
[18f48a77](https://github.com/bota-dev/docs/commit/18f48a771b5948677f2d8a4d34d43f68d0d636dd),
OpenAPI SHA-256 `cdce8566679e4e843b9cb8ee164b76a1a55c333016b8b66d1cd81b8897b1ccd2`.
The older read input stays pinned to its original compatible source; separate
projection and generated proofs describe the two source identities honestly.

TypeScript generates named `postEndUsers` and `patchEndUsersById` methods plus
the bounded generic `mutate`. Python's public client inherits unchanged
generated read methods and adds typed `post_end_users` and
`patch_end_users_by_id` over `mutate`. Each language extends its maintained
HTTP attempt/parser; neither adds a second transport policy stack.

Writes serialize an explicit object once before credentials, use exact 201/200
success statuses, and make one attempt. They ignore the global read retry
default, refuse positive per-call retries, add no automatic idempotency header
and perform no hidden reconciliation. Error outcome is `not_submitted` before
transport invocation and conservatively `unknown` afterward, including HTTP
errors. Python task cancellation preserves asyncio cancellation through an
outcome-bearing `CancelledError` subclass; explicit events use SDK errors.
Cancellation does not assert rollback.

Bodies use the documented interoperable bounded JSON subset. Unknown JSON
properties, including ordinary `toJSON` data, are transmitted without hooks;
backend validators strip unknown root fields. PATCH metadata replaces rather
than merges. Callers explicitly reconcile using a persisted nonempty external
ID or known Bota ID; no missing row proves an in-flight create has stopped.
No safe automatic replay or optimistic concurrency contract is claimed.

## Review and local evidence

| Requirement | Evidence | Conformance |
| --- | --- | --- |
| Backend remains authoritative; separate write selection | Required-body/parameter/success/replay drift negatives, source digest and component closure; backend 243 tests on each Node 22/24 | Matched within declared source/synthetic cohort. Live PostgreSQL races and deployment remain unverified. |
| Preserve the eleven-read input | Immutable original input/schema/corpus and fifteen retained migration identities; explicit four-file runtime/client evolution record | Matched. Historical lineage is unchanged; runtime source is intentionally evolved. |
| One mutation attempt and uncertainty | 36 shared mutation cases, native POST/PATCH lost-response tests, credential/deadline/error redaction/cancellation and JSON bounds checks | Matched locally; no live Bota writes performed. |
| Async cancellation remains cancellation | Native Python task/TaskGroup check: one dispatch, cancelled task, unknown outcome, joined cleanup and no raw cancellation reason | Matched. Explicit event cancellation retains its separate SDK-error contract. |
| Typed supported surface and normal packages | Strict TS/ty, generated identities, fixed archive inventories and fresh offline emitted-JS/wheel/sdist positive/negative consumers | Matched for recorded local candidates; clean-source hosted and published distributions need their own receipts. |
| Preserve auth/device boundaries | Explicit credentials, no profile/store/login reads, scope ownership in backend, no device/upload/control operations | Matched in source and synthetic fixtures. Full developer login and physical acceptance remain separate. |

Local source checks pass on actual Node 22.23.2 and 24.19.0: 66 governance tests,
215 TypeScript package tests, strict types, deterministic generation, lint,
dependency licenses and package build on each. Python passes 225 tests (174
existing, 36 shared writes, 15 native/runtime/generation checks), strict source
and installed type checks. Its precommit offline wheel/sdist qualification
passes on development Windows CPython 3.12.14, with repeated byte-identical
builds and fresh consumers; that dirty-source receipt is not a clean hosted
runtime matrix result. Exact candidate hashes and subsequent clean-source
hosted/readback evidence are retained in the
[immutable historical qualification ledger](https://github.com/bota-dev/internal-docs/blob/e70c282e796a771cbf2dec8dc77d614a319dc796/plans/2026-10-18-developer-toolchain-implementation.md#164-exact-source-hosted-and-artifact-receipts).

Independent review caught and repaired mutable operation descriptors,
unsupported required-parameter admission, policy weakening, plain `toJSON`
data rejection, aggregate JSON budgeting and Python task-cancellation semantics.
Original read behavior is covered by unchanged fixtures and adjacent tests,
not by an assertion that the combined runtime source remained unchanged.

The SDK source license remains MIT. No dependency/lock, CLI source license,
registry publication, production promotion, credential, device, retained upload
or journal changes form part of this increment.
