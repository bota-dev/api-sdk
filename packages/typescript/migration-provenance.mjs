import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { hash, json } from './package-policy.mjs';
import { verifyEvolution } from './migration-policy.mjs';

// Historical import identities remain immutable. Subsequent reviewed behavior
// changes have an explicit evolution record; never rewrite the old lineage.
const unchanged = ['runtime.ts', 'retry.test.mjs', 'runtime-consumer.ts', 'index.ts', 'generated/client.ts',
  'client-generation.mjs', 'cohort.json', 'input.json', 'source-openapi.json.gz', 'project.mjs',
  'header-references.mjs', 'generated/schema.d.ts', 'generated/operations.json', 'generated/client-methods.json',
  'conformance/corpus.json', 'conformance/corpus.schema.json', 'conformance/policy.json',
  'conformance/runner.test.mjs', 'conformance/validate.mjs'];
const lineageBytes = await readFile(new URL('./lineage.json', import.meta.url));
const lineage = JSON.parse(lineageBytes);
const evolutionBytes = await readFile(new URL('./source-evolution.json', import.meta.url));
const evolution = JSON.parse(evolutionBytes);
assert.equal(evolution.lineageSha256, hash(lineageBytes), 'evolution_lineage_digest');
const files = {};
for (const name of unchanged) {
  files[name] = hash(await readFile(new URL(`./${name}`, import.meta.url)));
}
const reviewed = verifyEvolution(lineage, evolution, files);
const result = json({ version: 2, status: 'reviewed-source-migration-and-evolution-not-publication', source: lineage.source,
  lineageSha256: hash(lineageBytes), evolutionSha256: hash(evolutionBytes),
  scriptSha256: hash(await readFile(new URL('./migration-provenance.mjs', import.meta.url))),
  policySha256: hash(await readFile(new URL('./migration-policy.mjs', import.meta.url))), ...reviewed });
const target = new URL('./generated/migration-provenance.json', import.meta.url);
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), result, 'migration_provenance_drift');
else await writeFile(target, result);
console.log(`Verified reviewed source migration; ${hash(result)}`);
