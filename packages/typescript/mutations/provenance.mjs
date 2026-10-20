import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { digest, json } from '../project.mjs';
import { validateCorpus } from './validate.mjs';

const read = name => readFile(new URL(`../${name}`, import.meta.url));
const corpus = JSON.parse(await read('mutations/corpus.json'));
const policy = JSON.parse(await read('mutations/policy.json'));
validateCorpus(corpus, policy);
const files = {};
for (const name of ['mutations/corpus.json', 'mutations/policy.json', 'mutations/validate.mjs', 'mutations/runner.test.mjs',
  'mutations/provenance.mjs', 'mutation-contract.ts', 'mutation-project.mjs', 'mutation-cohort.json', 'mutation-input.json',
  'mutation-source-openapi.json.gz', 'generate-mutations.mjs', 'generated/mutations-schema.d.ts', 'generated/mutations-provenance.json',
  'runtime.ts', 'mutation-runtime.test.mjs']) files[name] = digest(await read(name));
const output = json({ version: 1, status: 'language-neutral-mutation-fixtures-not-backend-acceptance',
  cohort: policy.cohort, operationCount: 2, fixtureCount: corpus.cases.length, files });
const target = new URL('./provenance.json', import.meta.url);
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), output, 'mutation_conformance_drift');
else await writeFile(target, output);
console.log(`Verified ${corpus.cases.length} shared mutation cases; ${digest(output)}`);
