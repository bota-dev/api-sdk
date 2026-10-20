import { workspaceHashes } from './workspace.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { cohort, digest, json } from './project.mjs';

const files = ['runtime.ts', 'runtime.test.mjs', 'retry.test.mjs', 'runtime-consumer.ts', 'runtime-provenance.mjs',
  'index.ts', 'generated/client.ts', 'generated/client-methods.json', 'generated/client-provenance.json',
  'generate-client.mjs', 'client-generation.mjs', 'client.test.mjs', 'client-consumer.ts',
  'conformance/corpus.schema.json', 'conformance/corpus.json', 'conformance/policy.json',
  'conformance/validate.mjs', 'conformance/runner.test.mjs', 'conformance/provenance.mjs', 'conformance/provenance.json',
  'tsconfig.json', 'package.json', 'workspace.mjs', 'workspace.test.mjs', 'lineage.json', 'migration-provenance.mjs', 'generated/migration-provenance.json', 'LICENSE', 'cohort.json', 'input.json',
  'generated/schema.d.ts', 'generated/operations.json', 'generated/provenance.json'];
const hashes = {};
for (const file of files) hashes[file] = digest(await readFile(new URL(`./${file}`, import.meta.url)));
const provenance = json({
  version: 1,
  status: 'beta-read-sdk-experimental',
  source: cohort.source,
  operationCount: 11,
  typescript: cohort.typescript,
  supportedNode: ['22.23.2', '24.19.0'],
  files: hashes,
  workspaceFiles: await workspaceHashes(),
});
const target = new URL('./generated/runtime-provenance.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== provenance) throw Error('runtime_provenance_drift');
} else await writeFile(target, provenance);
console.log(`Verified private read-prototype identity; ${digest(provenance)}`);
