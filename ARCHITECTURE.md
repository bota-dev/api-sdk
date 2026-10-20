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
| `packages/typescript/` | npm `@bota.dev/api-sdk` | Node-only initial eleven-read cohort |
| Python target; not implemented | PyPI `bota-api-sdk` | Required future runtime and language parity |

The root npm workspace is private. It owns the dependency lock, governance and
qualification entry points. The TypeScript package owns generation, maintained
runtime code, consumer declarations, package inventory and provenance checks.
Its build uses the pinned TypeScript compiler; React and bundlers are not
dependencies of this architecture.

Python requires its own implementation, frozen dependency and build inputs,
strict wire-value handling, behavioral parity cases and distribution checks.
The approved registry name does not establish any of those gates.

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

Mutations, Ask/SSE recovery, recording transfer and device control are outside
the initial cohort. An idempotency header alone is not an approved replay
contract, and loss of a response is not evidence that a remote action stopped.

## Qualification and delivery

CI uses exact Node 22.23.2 and 24.19.0 with npm 11.17.0, a frozen public dependency
lock, dependency scripts disabled, and no Bota or provider credentials.
Generation, provenance, maintained JavaScript lint, types, license policy, source tests and isolated
packed-consumer checks must all pass for the candidate under review.

Checks bind the candidate's source, generated outputs, declarations and packed
bytes. Qualification artifacts are evidence for that candidate, not registry
publication, deployed backend compatibility or physical-device acceptance.
Publication and any future Python or broader API cohort require separate gates.
