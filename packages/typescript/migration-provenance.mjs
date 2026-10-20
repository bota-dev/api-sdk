import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { hash, json } from './package-policy.mjs';

// Retain the reviewed executable behavior, contract and neutral fixtures exactly.
// Package/tooling adaptations have their own target hashes in the build proof.
const unchanged = ['runtime.ts', 'retry.test.mjs', 'runtime-consumer.ts', 'index.ts', 'generated/client.ts',
  'client-generation.mjs', 'cohort.json', 'input.json', 'source-openapi.json.gz', 'project.mjs',
  'header-references.mjs', 'generated/schema.d.ts', 'generated/operations.json', 'generated/client-methods.json',
  'conformance/corpus.json', 'conformance/corpus.schema.json', 'conformance/policy.json',
  'conformance/runner.test.mjs', 'conformance/validate.mjs'];
const lineageBytes = await readFile(new URL('./lineage.json', import.meta.url));
const lineage = JSON.parse(lineageBytes);
assert.equal(lineage.source.commit, 'b2541c789f83b8bbc5510244dd803a2284197982');
const files = {};
for (const name of unchanged) {
  files[name] = hash(await readFile(new URL(`./${name}`, import.meta.url)));
  assert.equal(files[name], lineage.files[name], `reviewed_source_drift:${name}`);
}
const result = json({ version: 1, status: 'reviewed-source-migration-not-publication', source: lineage.source,
  lineageSha256: hash(lineageBytes), scriptSha256: hash(await readFile(new URL('./migration-provenance.mjs', import.meta.url))), unchanged: files });
const target = new URL('./generated/migration-provenance.json', import.meta.url);
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), result, 'migration_provenance_drift');
else await writeFile(target, result);
console.log(`Verified reviewed source migration; ${hash(result)}`);
