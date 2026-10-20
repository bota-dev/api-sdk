import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import test from 'node:test';
import { renderReadClient } from './client-generation.mjs';
import { cohort, digest, json } from './project.mjs';

const originalFetch = globalThis.fetch;
let ambientCalls = 0;
globalThis.fetch = async () => { ambientCalls++; assert.fail('unexpected import-time network'); };
const entry = await import('./index.ts');
const runtime = await import('./runtime.ts');
globalThis.fetch = originalFetch;
const { BotaApiClient } = entry;
const input = JSON.parse(await readFile(new URL('./input.json', import.meta.url)));
const methods = JSON.parse(await readFile(new URL('./generated/client-methods.json', import.meta.url)));
const mutations = JSON.parse(await readFile(new URL('./mutation-cohort.json', import.meta.url)));
const key = 'synthetic_named_client_key';
const jsonResponse = (body, options = {}) => new Response(JSON.stringify(body), { ...options,
  headers: { 'content-type': 'application/json', ...options.headers } });

test('root adds BotaApiClient while preserving every factory/runtime export without import or construction effects', () => {
  assert.equal(ambientCalls, 0);
  assert.deepEqual(Object.keys(entry).filter(name => !(name in runtime)), ['BotaApiClient']);
  for (const name of Object.keys(runtime)) assert.equal(entry[name], runtime[name], name);
  let resolved = 0;
  const client = new BotaApiClient({ credentials: () => { resolved++; return key; }, fetch: async () => assert.fail('unexpected transport') });
  assert.equal(resolved, 0);
  assert.deepEqual(Object.keys(client), []);
  assert.equal(JSON.stringify(client), '{}');
  assert.ok(!inspect(client).includes(key));
  assert.deepEqual(Object.getOwnPropertyNames(BotaApiClient.prototype).sort(), ['constructor', 'pages', 'mutate', ...methods.map(m => m.method), ...mutations.operations.map(m => m.operationId)].sort());
});

test('all eleven generated methods delegate their exact operation, inputs, response fields and headers', async () => {
  const calls = []; let providers = 0;
  const body = { exact: '9223372036854775807', confidence: 'NaN', nullable: null, extra: { retained: true } };
  const client = new BotaApiClient({ baseUrl: 'https://custom.example/api/v1', credentials: () => `named_${++providers}`,
    fetch: async (url, init) => { calls.push({ url: new URL(url), init }); return jsonResponse(body, { headers: { 'x-request-id': 'req_named', 'ratelimit-reset': '1' } }); } });
  for (const method of methods) {
    const supplied = method.inputRequired ? { path: { id: 'opaque/?#value' } } :
      method.path === '/auth/identity' ? undefined : { query: { limit: 1, cursor: 'opaque/+==' } };
    const result = await client[method.method](supplied, { maxRetries: 0 });
    const call = calls.at(-1);
    assert.equal(call.url.origin, 'https://custom.example');
    assert.equal(call.url.pathname, `/api/v1${method.path.replace('{id}', encodeURIComponent('opaque/?#value'))}`);
    assert.equal(call.init.method, 'GET'); assert.equal(call.init.redirect, 'manual');
    assert.equal(call.init.headers.Authorization, `Bearer named_${calls.length}`);
    if (!method.inputRequired && supplied) {
      assert.equal(call.url.searchParams.get('limit'), '1'); assert.equal(call.url.searchParams.get('cursor'), 'opaque/+==');
    }
    assert.deepEqual(result.data, body); assert.equal(result.headers['x-request-id'], 'req_named');
    assert.equal(result.headers['ratelimit-reset'], '1');
  }
  assert.equal(calls.length, 11); assert.equal(providers, 11);
});

test('named errors, empty results and explicit retry/cancellation options retain runtime behavior', async () => {
  let count = 0;
  const client = new BotaApiClient({ credentials: key, fetch: async () => {
    count++; return jsonResponse({ error: { code: 'provider_unavailable', message: key, request_id: 'req_body' } },
      { status: 503, headers: { 'x-request-id': 'req_header' } });
  } });
  await assert.rejects(client.getAuthIdentity(undefined, { maxRetries: 0 }), error => {
    assert.ok(error instanceof runtime.ReadPrototypeError); assert.equal(error.kind, 'http'); assert.equal(error.status, 503);
    assert.equal(error.code, 'provider_unavailable'); assert.equal(error.requestId, 'req_body');
    assert.equal(error.headers['x-request-id'], 'req_header'); assert.equal(error.body.error.message, '[REDACTED]');
    assert.ok(!JSON.stringify(error).includes(key)); return true;
  });
  assert.equal(count, 1);
  const cancel = new AbortController(); cancel.abort(key);
  await assert.rejects(client.getDevices(undefined, { signal: cancel.signal }), { kind: 'aborted' });
  assert.equal(count, 1);
  const empty = new BotaApiClient({ credentials: key, fetch: async () => new Response(null, { status: 204 }) });
  const result = await empty.getEndUsersById({ path: { id: 'eu_opaque' } });
  assert.equal(result.status, 204); assert.equal(result.data, undefined);
});

test('class pages delegates bounded traversal and compatibility factory still exposes generic reads', async () => {
  const calls = [];
  const client = new BotaApiClient({ credentials: key, fetch: async url => {
    calls.push(new URL(url)); return jsonResponse({ data: [], has_more: calls.length === 1,
      ...(calls.length === 1 ? { next_cursor: 'opaque/+==' } : {}) });
  } });
  let pages = 0;
  for await (const _page of client.pages('getDevices', { query: { serial_number: 'serial exact', limit: 1 } }, { maxPages: 2 })) { void _page; pages++; }
  assert.equal(pages, 2); assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get('cursor'), 'opaque/+==');
  for (const call of calls) { assert.equal(call.searchParams.get('serial_number'), 'serial exact'); assert.equal(call.searchParams.get('limit'), '1'); }
  const legacy = entry.createReadPrototype({ credentials: key, fetch: async () => jsonResponse({ old: true }) });
  assert.deepEqual((await legacy.read('getAuthIdentity')).data, { old: true });
});

test('generator derives required inputs from contract parameters and refuses identifiers, collisions, refs and non-GET expansion', () => {
  const rendered = renderReadClient(input, cohort.paths);
  assert.equal(rendered.methods.length, 11);
  assert.equal(rendered.methods.filter(m => m.inputRequired).length, 5);
  const requiredQuery = structuredClone(input);
  requiredQuery.paths['/devices'].get.parameters.find(p => p.name === 'limit').required = true;
  assert.equal(renderReadClient(requiredQuery, cohort.paths).methods.find(m => m.method === 'getDevices').inputRequired, true);
  for (const name of ['constructor', 'pages', 'then', 'toJSON', '__proto__', 'prototype', 'bad-id', 'x\nattack', 'getDevices']) {
    const changed = structuredClone(input); changed.paths['/auth/identity'].get.operationId = name;
    assert.throws(() => renderReadClient(changed, cohort.paths));
  }
  const write = structuredClone(input); write.paths['/devices'].post = {};
  assert.throws(() => renderReadClient(write, cohort.paths), /named_client_get_only/);
  const ref = structuredClone(input); ref.paths['/devices'].get.parameters[0] = { $ref: '#/components/parameters/Unknown' };
  assert.throws(() => renderReadClient(ref, cohort.paths), /named_client_parameter_shape/);
  const optionalPath = structuredClone(input); optionalPath.paths['/devices/{id}'].get.parameters[0].required = false;
  assert.throws(() => renderReadClient(optionalPath, cohort.paths), /named_client_path_required/);
  const reordered = structuredClone(input); delete reordered.paths['/devices'];
  assert.throws(() => renderReadClient(reordered, cohort.paths), /named_client_cohort_paths/);
});

test('named-client generation and separate provenance bind exact source, schema, renderer, entry and method inventory', async () => {
  const rendered = renderReadClient(input, cohort.paths, mutations.operations);
  const read = name => readFile(new URL(`./${name}`, import.meta.url));
  assert.equal((await read('generated/client.ts')).toString(), rendered.client);
  assert.equal((await read('index.ts')).toString(), rendered.entry);
  assert.deepEqual(methods, rendered.methods);
  const provenance = JSON.parse(await read('generated/client-provenance.json'));
  assert.equal(provenance.status, 'beta-generated-read-and-end-user-write-client-experimental');
  assert.equal(provenance.operationCount, 11); assert.deepEqual(provenance.source, cohort.source);
  for (const [property, file] of Object.entries({ projectionSha256: 'input.json', schemaSha256: 'generated/schema.d.ts',
    operationsSha256: 'generated/operations.json', schemaProvenanceSha256: 'generated/provenance.json',
    generatorScriptSha256: 'generate-client.mjs', rendererScriptSha256: 'client-generation.mjs',
    clientSourceSha256: 'generated/client.ts', entrySourceSha256: 'index.ts' })) assert.equal(provenance[property], digest(await read(file)), property);
  assert.equal(provenance.methodsSha256, digest(json(methods)));
  assert.equal(provenance.mutationOperationCount, 2);
  assert.deepEqual(provenance.mutationSource, mutations.source);
  for (const [property, file] of Object.entries({ mutationProjectionSha256: 'mutation-input.json',
    mutationSchemaSha256: 'generated/mutations-schema.d.ts', mutationSchemaProvenanceSha256: 'generated/mutations-provenance.json' }))
    assert.equal(provenance[property], digest(await read(file)), property);
});

test('generated write methods use the existing client runtime and preserve single attempt outcomes', async () => {
  const calls = [];
  const client = new BotaApiClient({ maxRetries: 2, credentials: key, fetch: async (url, init) => {
    calls.push({ url: new URL(url), init });
    return jsonResponse({ id: 'eu_opaque', unknown: null }, { status: init.method === 'POST' ? 201 : 200 });
  } });
  assert.equal((await client.postEndUsers({ body: {} })).status, 201);
  assert.equal((await client.patchEndUsersById({ path: { id: 'eu_opaque' }, body: { metadata: {} } })).status, 200);
  assert.equal((await client.mutate('postEndUsers', { body: {} })).status, 201);
  assert.deepEqual(calls.map(call => [call.init.method, call.url.pathname]), [['POST', '/v1/end-users'], ['PATCH', '/v1/end-users/eu_opaque'], ['POST', '/v1/end-users']]);
  const lost = new BotaApiClient({ credentials: key, maxRetries: 2, fetch: async () => { throw Error('synthetic loss'); } });
  await assert.rejects(lost.postEndUsers({ body: {} }), { name: 'BotaMutationError', requestOutcome: 'unknown' });
  for (const change of [{ operationId: 'deleteEndUsersById' }, { method: 'DELETE' }, { path: '/devices' }, { successStatus: 202 }]) {
    const wrong = structuredClone(mutations.operations); Object.assign(wrong[0], change);
    assert.throws(() => renderReadClient(input, cohort.paths, wrong), /named_client_mutation_cohort/);
  }
});
