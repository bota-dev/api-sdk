# Bota API SDK for TypeScript

Experimental Node.js package candidate `@bota.dev/api-sdk@0.1.0-beta.0`, licensed
under MIT. This repository prepares and tests local tarballs; it does not publish
them. Node.js 22.23.2 and 24.19.0 are the qualified runtimes. Browser, React Native
and Python support remain unqualified.

```ts
import { BotaApiClient } from '@bota.dev/api-sdk';

const client = new BotaApiClient({
  credentials: async () => getServerSideApiKey(),
});
const identity = await client.getAuthIdentity();
const devices = await client.getDevices({ query: { limit: 20 } });
if (identity.status === 200 && devices.status === 200) {
  console.log(identity.data.project_id, devices.data.data);
}
```

Supply credentials explicitly, either as a string or a provider called for each
attempt. The client does not read environment variables, CLI profiles or browser
sessions. Keep project credentials on the server. The default API is
`https://api.bota.dev/v1`; custom HTTPS deployment URLs must end in `/v1`.
Unencrypted loopback HTTP requires the explicit `allowLoopbackHttp` development
option. Redirects are refused.

The generated `BotaApiClient` exposes eleven GET methods: `getAuthIdentity`,
`getEndUsers`, `getEndUsersById`, `getDevices`, `getDevicesById`, `getRecordings`,
`getRecordingsById`, `getTranscriptions`, `getTranscriptionsById`, `getSummaries`,
and `getSummariesById`. Detail methods take `{ path: { id } }`. List methods accept
the filters declared by the pinned contract. No write or streaming methods are
included. The compatibility factory `createReadPrototype` offers the same reads
through `read(operationId, input, options)`.

Responses expose `data`, HTTP `status` and raw string `headers`. Wire strings,
nullable fields and unknown JSON fields are preserved: numeric PostgreSQL fields
may be numbers or strings, including the confidence string `NaN`. TypeScript
types cannot enforce JSON Schema regular expressions. The runtime checks the
bounded request inputs and JSON syntax; it does not validate complete response
schemas.

Each request has one total deadline, including credential retrieval, retries and
body reading (30 seconds by default, at most 120 seconds). Pass `signal` to cancel
or `maxRetries: 0` to request a single attempt. Eligible reads retry at most twice
for transport failures, interrupted successful bodies, 502/503/504, and nonbilling
429 with a valid bounded `Retry-After`. Other status codes and billing 429 are
terminal. Cancellation does not imply that a server operation was rolled back.

`ReadPrototypeError` provides fixed diagnostics with status, code, parameter,
request ID and headers when available. Parsed API error bodies are accessible
through the nonenumerable `body` property, with attempted credentials redacted.
Avoid logging provider or customer data from responses.

```ts
for await (const page of client.pages('getDevices', { query: { limit: 20 } }, {
  maxPages: 5, maxItems: 100, timeoutMs: 30_000,
})) {
  for (const device of page.data) console.log(device.id);
}
```

The five list operations support explicit bounded page iteration. Iteration has
one deadline across requests and consumer pauses, preserves filters, performs no
prefetch, and refuses missing or repeated cursors. Default limits are 100 pages
and 10,000 items.

Development uses the repository root lock and npm 11.17.0 with dependency scripts
disabled. Root `npm run check`, `npm test`, `npm run build`, `npm run lint` and
`npm run license-check` qualify source. The package's `ci.mjs` requires explicit
`--npm-cli`, `--node22` and `--node24` absolute tool paths; it also qualifies one
identical tarball in fresh offline consumers with strict types and emitted ESM
JavaScript, without native TypeScript imports or generator dependencies.

The contract is pinned to public docs source `0eaaa8a516deb9c56054ecaf78ddf95803d016b7`.
Generation uses openapi-typescript 7.13.0 and TypeScript 5.9.3. A maintained,
provenance-bound header-reference adapter corrects that generator's handling of
optional referenced response headers. The source projection remains unchanged.
Separate schema, named-client, runtime, migration, conformance and build proofs
bind their inputs. Historical private policy identifiers in the neutral fixture
corpus retain their original identity; synthetic checks establish neither live
backend acceptance nor Python parity.

The package exports only its root ESM entry and declarations. It has no runtime
dependencies, lifecycle hooks or automatic publication. A release requires
reviewed source, exact clean-source hosted and packed-consumer receipts, and a
separately approved publication workflow, registry ownership and release approval.
