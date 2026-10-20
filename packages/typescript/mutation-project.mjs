import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { digest, json } from './project.mjs';

export const admittedMutations = [
  { operationId: 'postEndUsers', method: 'POST', path: '/end-users', successStatus: 201 },
  { operationId: 'patchEndUsersById', method: 'PATCH', path: '/end-users/{id}', successStatus: 200 },
];
export function selectMutations(source) {
  assert.equal(source.openapi, '3.1.0');
  assert.equal(source.servers[0].url, 'https://api.bota.dev/v1');
  const result = { openapi: source.openapi, info: source.info, servers: source.servers,
    paths: {}, components: {}, security: source.security };
  for (const operation of admittedMutations) {
    const item = source.paths[operation.path];
    const definition = item?.[operation.method.toLowerCase()];
    assert.equal(definition?.operationId, operation.operationId, 'mutation_identity');
    assert.ok(!item.servers && !definition.servers && definition.requestBody?.content?.['application/json'], 'mutation_shape');
    assert.ok(definition.responses[operation.successStatus], 'mutation_success_status');
    assert.equal(definition.requestBody.required, true, 'mutation_required_body');
    assert.deepEqual(Object.keys(definition.requestBody.content), ['application/json'], 'mutation_request_media');
    assert.equal(definition.requestBody.content['application/json'].schema?.type, 'object', 'mutation_object_body');
    const parameters = [...(item.parameters ?? []), ...(definition.parameters ?? [])];
    assert.deepEqual(parameters.map(p => ({ in: p.in, name: p.name, required: p.required, schema: p.schema })),
      operation.method === 'POST' ? [] : [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], 'mutation_parameters');
    assert.deepEqual(Object.keys(definition.responses).filter(status => /^2/.test(status)), [String(operation.successStatus)], 'mutation_success_cohort');
    assert.equal(definition['x-bota-write-contract']?.automatic_retry, false, 'mutation_replay_contract');
    assert.equal(definition['x-bota-write-contract']?.automatic_idempotency_key, false, 'mutation_header_contract');
    assert.equal(definition['x-bota-write-contract']?.automatic_reconciliation, false, 'mutation_recovery_contract');
    result.paths[operation.path] = { ...(item.parameters ? { parameters: item.parameters } : {}),
      [operation.method.toLowerCase()]: definition };
  }
  const seen = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') add(value.$ref);
    if (value.discriminator?.mapping) for (const ref of Object.values(value.discriminator.mapping)) add(ref);
    for (const [key, child] of Object.entries(value)) {
      if (key === 'security' && Array.isArray(child)) for (const requirement of child)
        for (const scheme of Object.keys(requirement)) add(`#/components/securitySchemes/${scheme}`);
      walk(child);
    }
  }
  function add(ref) {
    assert.match(ref, /^#\/components\/(schemas|responses|headers|parameters|securitySchemes)\/[^/]+$/);
    if (seen.has(ref)) return;
    seen.add(ref);
    const [, , kind, token] = ref.split('/');
    assert.doesNotMatch(token, /~(?![01])/);
    const name = token.replaceAll('~1', '/').replaceAll('~0', '~');
    const value = source.components?.[kind]?.[name];
    assert.ok(value, 'mutation_reference');
    (result.components[kind] ??= {})[name] = value;
    walk(value);
  }
  walk(result);
  return result;
}
export async function verifyMutationProjection() {
  const cohort = JSON.parse(await readFile(new URL('./mutation-cohort.json', import.meta.url)));
  const bytes = await readFile(new URL('./mutation-input.json', import.meta.url));
  assert.deepEqual(cohort.operations, admittedMutations);
  assert.equal(digest(bytes), cohort.projectionSha256);
  assert.deepEqual(JSON.parse(bytes), selectMutations(JSON.parse(bytes)), 'mutation_projection_shape');
  return { cohort, bytes, input: JSON.parse(bytes) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv.length, 4, 'usage: node mutation-project.mjs PUBLIC_SPEC DOCS_COMMIT');
  const bytes = await readFile(process.argv[2]);
  assert.match(process.argv[3], /^[a-f0-9]{40}$/);
  const input = json(selectMutations(JSON.parse(bytes)));
  await writeFile(new URL('./mutation-input.json', import.meta.url), input);
  await writeFile(new URL('./mutation-source-openapi.json.gz', import.meta.url), gzipSync(bytes, { level: 9, mtime: 0 }));
  await writeFile(new URL('./mutation-cohort.json', import.meta.url), json({ version: 1,
    source: { repository: 'bota-dev/docs', commit: process.argv[3], path: 'api-reference/openapi.json', sha256: digest(bytes) },
    generator: { name: 'openapi-typescript', version: '7.13.0' }, typescript: '5.9.3',
    baseUrl: 'https://api.bota.dev/v1', operations: admittedMutations, projectionSha256: digest(input) }));
}
