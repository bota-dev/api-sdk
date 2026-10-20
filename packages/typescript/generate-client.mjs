import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { cohort, digest, json, project } from './project.mjs';
import { renderReadClient } from './client-generation.mjs';
import { verifyMutationProjection } from './mutation-project.mjs';

const check = process.argv.includes('--check');
const read = file => readFile(new URL(`./${file}`, import.meta.url));
const inputBytes = await read('input.json');
assert.equal(digest(inputBytes), cohort.projectionSha256, 'named_client_projection_digest');
const source = gunzipSync(await read('source-openapi.json.gz'), { maxOutputLength: 5 * 1024 * 1024 });
assert.equal(json(project(source)), inputBytes.toString('utf8'), 'named_client_source_projection');
const input = JSON.parse(inputBytes);
const schemaBytes = await read('generated/schema.d.ts');
const operationBytes = await read('generated/operations.json');
const schemaProvenance = JSON.parse(await read('generated/provenance.json'));
assert.equal(schemaProvenance.schemaSha256, digest(schemaBytes), 'named_client_schema_digest');
assert.equal(schemaProvenance.projectionSha256, digest(inputBytes), 'named_client_schema_projection');
assert.deepEqual(schemaProvenance.source, cohort.source, 'named_client_schema_source');
const mutations = await verifyMutationProjection();
const { client, entry, methods } = renderReadClient(input, cohort.paths, mutations.cohort.operations);
assert.deepEqual(JSON.parse(operationBytes).map(operation => ({ operationId: operation.operationId, method: operation.method, path: operation.path })),
  methods.map(method => ({ operationId: method.operationId, method: method.httpMethod, path: method.path })), 'named_client_operation_index');
const methodBytes = json(methods);
const provenance = {
  version: 2, status: 'beta-generated-read-and-end-user-write-client-experimental', source: cohort.source,
  projectionSha256: digest(inputBytes), schemaSha256: digest(schemaBytes), operationsSha256: digest(operationBytes),
  schemaProvenanceSha256: digest(await read('generated/provenance.json')),
  generatorScriptSha256: digest(await read('generate-client.mjs')),
  rendererScriptSha256: digest(await read('client-generation.mjs')),
  clientSourceSha256: digest(client), entrySourceSha256: digest(entry), methodsSha256: digest(methodBytes),
  operationCount: methods.length, typescript: cohort.typescript,
  mutationSource: mutations.cohort.source, mutationProjectionSha256: digest(mutations.bytes),
  mutationSchemaSha256: digest(await read('generated/mutations-schema.d.ts')),
  mutationSchemaProvenanceSha256: digest(await read('generated/mutations-provenance.json')),
  mutationOperationCount: mutations.cohort.operations.length,
};
for (const [name, content] of [['generated/client.ts', client], ['index.ts', entry],
  ['generated/client-methods.json', methodBytes], ['generated/client-provenance.json', json(provenance)]]) {
  const target = new URL(`./${name}`, import.meta.url);
  if (check) assert.equal(await readFile(target, 'utf8'), content, `named_client_drift:${name}`);
  else await writeFile(target, content);
}
console.log(`${check ? 'Verified' : 'Generated'} ${methods.length} named BotaApiClient reads; ${digest(client)}`);
