# Bota API SDK

Clients for the [Bota backend API](https://docs.bota.dev), maintained in
[`bota-dev/api-sdk`](https://github.com/bota-dev/api-sdk).
These clients belong in customer servers and developer tools. Libraries that
communicate with physical Bota devices are the separate Bota App SDK family.

The TypeScript package identity is `@bota.dev/api-sdk`. Its initial scope is
the eleven reviewed GET operations for credential identity and reading end
users, devices, recordings, transcriptions, and summaries. It is a Node-only
candidate; repository qualification does not establish npm publication or a
deployed-service acceptance result.

Python is a required SDK target under the approved PyPI identity
`bota-api-sdk`. It is not implemented here yet. There is no placeholder Python
package and no implied Python parity.

## Repository

| Path | Responsibility |
| --- | --- |
| `packages/typescript/` | Generated contracts, maintained HTTP runtime, build and qualification |
| `scripts/check-licenses.mjs` | Installed dependency license gate |
| `.github/workflows/` | Source and isolated packed-consumer checks; no publication |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Contract ownership, runtime boundaries and required targets |
| [AGENTS.md](AGENTS.md) | Repository maintenance rules |

## Development

Use npm **11.17.0** with Node **22.23.2** or **24.19.0**. From the repository
root, install the reviewed workspace lock and run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run license-check
npm run lint
npm run check
npm test
npm run build
```

A missing or inconsistent lock fails. The repository deliberately refuses the
new-repository skill template's `npm ci || npm install` fallback: qualification
must retain the reviewed dependency graph. Lock updates require an explicit
dependency change and renewed provenance and license checks.

Root workspace commands verify the parent npm executable is version 11.17.0
and invoke that exact CLI with the selected Node runtime, isolated configuration
and cache paths, and a scrubbed environment. They do not fall back to another
npm executable found on `PATH`.

Hosted qualification uses the TypeScript package's explicit-path runner:

```sh
node packages/typescript/ci.mjs \
  --npm-cli /absolute/path/to/npm-11.17.0/bin/npm-cli.js \
  --node22 /absolute/path/to/node-22.23.2 \
  --node24 /absolute/path/to/node-24.19.0
```

The runner owns frozen installation and both runtime lanes. Its packed consumers
use the same verified tarball outside the source checkout. Tests use synthetic
credentials and injected transports or loopback servers; they need no Bota,
cloud, provider, device or private-package credentials.

Flat-config ESLint checks maintained JavaScript. Generated outputs and build
artifacts are excluded; strict TypeScript checks run through the package's
separate check command.

## Dependency license policy

The license gate binds the root lockfile to installed package names, versions
and exact license strings, including the declared workspace. It rejects extra
or missing packages, mismatched metadata, undeclared links and nonpublic
registry entries. Private package metadata does not bypass the gate. There is
no automatic exemption for a missing platform-optional package.

The admitted SPDX atoms are MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause,
0BSD, CC0-1.0, Python-2.0 and BlueOak-1.0.0. The bounded parser supports parentheses, AND and OR,
with AND taking precedence. License identifiers are case-insensitive; operators
are case-sensitive. Every AND branch must be admitted; OR requires an
admitted alternative. Thus `MIT OR GPL-3.0` and `MIT OR UNKNOWN` select MIT,
while `Apache-2.0 AND GPL-3.0` fails. Unknown atoms grant no permission.
Missing metadata, malformed expressions, WITH and unsupported operators fail.
The parser is limited to 4,096 characters, 256 tokens and 32 nested parentheses;
it does not implement the full SPDX grammar or substitute for legal review.

The [Blue Oak Model License](https://blueoakcouncil.org/license/1.0.0) requires
redistributed copies to include its license text or a link to it. Admitting a
dependency under this policy does not remove its notice obligations or replace
its license with the SDK's MIT license.

Run `npm run test:licenses` for the policy and synthetic locked-workspace
fixtures. Root `npm test` includes these checks before the TypeScript tests.

## Authentication and releases

Supply an API key or caller-managed credential provider to the SDK. Keep
server credentials out of browser bundles. The SDK does not read CLI profiles,
launch Platform login, manage OAuth grants, or provision devices.

The approved source license is [MIT](LICENSE). Package names and source licensing
do not authorize registry publication. This repository has no publish, deploy,
OIDC or credential-request workflow; registry delivery requires a separately
qualified release.
