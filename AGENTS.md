# Agent instructions

## Package Manager

- Use npm 11.17.0 workspaces with Node 22.23.2 or 24.19.0.
- Python uses normal CPython 3.12–3.15, explicit virtual environments and its own frozen public wheel locks; see the package README for exact CI versions and platform limits.
- Install from the root: `npm ci --ignore-scripts --no-audit --no-fund`.
- Run `npm run license-check`, `npm run lint`, `npm run check`, `npm test`, and `npm run build`.
- Keep installs frozen; never replace failed `npm ci` with `npm install`.

## Key Conventions

- Read [ARCHITECTURE.md](ARCHITECTURE.md) and the affected package instructions before changing behavior.
- Preserve the pinned public-contract input, generated provenance and exact wire values; regenerate instead of hand-editing outputs.
- Keep HTTP policy in the maintained runtime and authorization on the backend.
- Keep credentials explicit; no CLI-store reads, browser login, private-package credentials or committed `.npmrc`.
- TypeScript lives in `packages/typescript`; async Python lives in `packages/python`. Declare supported cohorts and verify shared plus native cases before claiming parity.
- Use Python's explicit hash-locked wheel installer, generator checks, unit tests, ty and packed-consumer runner. Keep canonical package production separate from same-artifact runtime qualification.
- Source is MIT; npm `@bota.dev/api-sdk` and PyPI `bota-api-sdk` naming approval does not qualify publication.
- Preserve the installed dependency license gate; review dependency and lock changes together.
- Use root flat-config ESLint for maintained JavaScript and strict package checks for TypeScript; exclude generated outputs from lint.
- Update documentation affected by a change; keep task history and receipts out of entry guides.
- Keep source, CI, package publication, deployment and physical acceptance claims separate.
- Follow the owner's verified integration-branch delivery preference; do not force-push or create a PR unless requested.

## Local Skills

- No repository-local skills are bundled.
- Use installed `bota-skills:compound-engineering` for design comparison and completion review.
- Use installed `bota-skills:bota-cicd` for workflows and `bota-skills:new-repo-generator` for repository/package setup.
- Use installed `bota-skills:agents-md` when maintaining these instructions.

## Commit Attribution

- Include the actual AI author's co-author trailer on AI-authored commits.
- Codex example: `Co-Authored-By: Codex <noreply@openai.com>`.
