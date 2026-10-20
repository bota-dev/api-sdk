import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { assertCorpus } from './validate.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const corpus = assertCorpus(await load('./corpus.schema.json'), await load('./corpus.json'));
const policy = await load('./policy.json');
const cohort = await load('../cohort.json');
const operations = await load('../generated/operations.json');
if (corpus.policyId !== policy.id || corpus.version !== 1 || policy.version !== 1 ||
  JSON.stringify(policy.operationIds) !== JSON.stringify(operations.map(item => item.operationId)) ||
  operations.some(item => item.method !== 'GET') ||
  operations.some(item => !corpus.cases.some(fixture => fixture.invoke.mode === 'read' &&
    fixture.invoke.operationId === item.operationId && fixture.expect.result?.status === 200))) {
  throw Error('conformance_scope_drift');
}
const files = {};
for (const name of ['conformance/corpus.schema.json', 'conformance/corpus.json', 'conformance/policy.json',
  'conformance/validate.mjs', 'conformance/runner.test.mjs', 'conformance/provenance.mjs',
  'cohort.json', 'input.json', 'generated/operations.json', 'generated/schema.d.ts',
  'generated/provenance.json', 'runtime.ts']) {
  files[name] = digest(await readFile(new URL(`../${name}`, import.meta.url)));
}
if (files['input.json'] !== cohort.projectionSha256) throw Error('conformance_projection_drift');
const serialized = `${JSON.stringify({
  version: 1,
  status: 'beta-language-neutral-synthetic-subset',
  source: cohort.source,
  policyId: policy.id,
  fixtureCount: corpus.cases.length,
  operationCount: policy.operationIds.length,
  supportedRunners: ['typescript-node22', 'typescript-node24'],
  qualification: 'Digests bind fixture inputs and implementation; they do not establish a test pass, Python parity, backend acceptance or publication.',
  files,
}, null, 2)}\n`;
const target = new URL('./provenance.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== serialized) throw Error('conformance_provenance_drift');
} else await writeFile(target, serialized);
console.log(`Verified ${corpus.cases.length} neutral synthetic fixtures; ${digest(serialized)}`);
