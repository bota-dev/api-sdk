# Bota API SDK architecture

## Responsibilities

The backend defines API behavior. The versioned public OpenAPI contract is the
generation input; each SDK candidate records its exact source digest and
generates endpoint methods and request/response types from that input.
Generated files are not a second independently maintained API specification.

The maintained runtime handles credential injection, URL and query
serialization, HTTP errors, response bounds, cancellation, total deadlines,
pagination and the explicitly admitted read-retry policy. Business
authorization remains on the backend. SDK types describe the contract and do
not by themselves validate arbitrary server response bodies.

## Package boundaries

| Package | Registry identity | Scope |
| --- | --- | --- |
| `packages/typescript/` | npm `@bota.dev/api-sdk` | Node-only eleven reads and ordinary end-user creation/update |
| `packages/python/` | PyPI `bota-api-sdk` | Async eleven reads and the same two writes; independent qualification |

The root npm workspace is private. It owns the dependency lock, governance and
qualification entry points. The TypeScript package owns generation, maintained
runtime code, consumer declarations, package inventory and provenance checks.
Its build uses the pinned TypeScript compiler; React and bundlers are not
dependencies of this architecture.

Python maintains asyncio HTTP policy and uses a bounded standard-library
generator for methods/TypedDict models over the same pinned public projection.
Raw response JSON is not coerced or stripped by these annotations. The same
94 language-neutral cases are supplemented by native transport, timing,
cancellation, generated surface and distribution checks. Python task
cancellation propagates `CancelledError`; explicit cancellation events use the
SDK error contract. Its native transport requests identity encoding and refuses
unexpected compression; TypeScript's fetch decoding remains a separate policy.

The Python source/build graph uses exact public wheel hashes and installed
license/declaration checks. A canonical wheel/sdist producer and downstream
fresh offline consumers bind package bytes across the declared runtime matrix.
Source, generated proofs and an executable workflow are not their successful
execution or registry delivery; each keeps a source-bound receipt.

## Authority and recovery

Credentials are explicit caller input. A credential provider can supply fresh
credentials within the request budget; the SDK has no browser login, CLI-store
access or authority to issue credentials. Origin binding and redirect refusal
keep credentials on the configured API destination.

Only the eleven reviewed GET operations are eligible for automatic retry.
Retries share a bounded total deadline with cancellation and server wait
handling. Each attempt repeats current backend admission and may consume rate
capacity and request accounting. Retried reads and pages can observe changed
state; they do not provide a snapshot or a deduplication guarantee.

The separate ordinary end-user write cohort admits only POST creation (201)
and PATCH update (200). Both languages use their maintained HTTP attempt and
response parser, serialize an explicit JSON object before credential retrieval,
and make one attempt. Writes do not inherit read retries, send an automatic
idempotency header or perform hidden reconciliation. A mutation error reports
`not_submitted` before transport invocation and conservatively `unknown`
afterward, including HTTP errors, cancellation and lost responses. This is
client-observed submission uncertainty, not backend transaction status.
Python external task cancellation remains an `asyncio.CancelledError` subclass
with the same outcome metadata; explicit cancellation events use the SDK error.

Persist a nonempty external ID before creation and the returned Bota ID when
known. Callers can explicitly look up current state before deciding what to do
next; a missing row does not prove a timed-out create cannot still finish.
PATCH metadata replaces the stored object, and a repeated PATCH can overwrite
a concurrent update. End-user deletion, token issuance, processing, Ask/SSE
recovery, recording transfer and device control retain separate policies.

The original eleven-read projection and 94 fixtures retain their byte identity.
New write schemas have a separate pinned public source and projection rather
than rewriting that historical input. Generated provenance binds both. The
immutable private-import lineage records the original migration; an explicit
post-migration evolution record identifies the four changed runtime/client
files. Read fixtures remain regression evidence, not proof of unchanged
runtime source after adding writes.

## Qualification and delivery

CI uses exact Node 22.23.2 and 24.19.0 with npm 11.17.0, a frozen public dependency
lock, dependency scripts disabled, and no Bota or provider credentials.
Generation, provenance, maintained JavaScript lint, types, license policy, source tests and isolated
packed-consumer checks must all pass for the candidate under review.

Checks bind the candidate's source, generated outputs, declarations and packed
bytes. Qualification artifacts are evidence for that candidate, not registry
publication, deployed backend compatibility or physical-device acceptance.
Publication and broader Python or API cohorts require separate gates.
