import assert from 'node:assert/strict';
import { readFile, lstat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Import itself must not authenticate, contact the network or evaluate TS source.
let ambientCalls = 0;
globalThis.fetch = async () => { ambientCalls++; assert.fail('unexpected ambient network'); };
const { BotaApiClient, createReadPrototype, ReadPrototypeError, BotaMutationError } = await import('@bota.dev/api-sdk');
assert.equal(ambientCalls, 0);
const mutationCalls = [];
const writes = new BotaApiClient({ credentials: 'synthetic_packed_write', maxRetries: 2, fetch: async (url, init) => {
  mutationCalls.push({ url: new URL(url), init });
  return new Response(JSON.stringify({ id: 'eu_packed', unknown: null }), { status: init.method === 'POST' ? 201 : 200,
    headers: { 'content-type': 'application/json' } });
} });
assert.equal((await writes.postEndUsers({ body: { external_id: 'packed-001' } })).status, 201);
assert.equal((await writes.patchEndUsersById({ path: { id: 'eu_packed' }, body: { metadata: {} } })).status, 200);
assert.deepEqual(mutationCalls.map(call => [call.init.method, call.url.pathname]), [['POST', '/v1/end-users'], ['PATCH', '/v1/end-users/eu_packed']]);
for (const call of mutationCalls) assert.equal(Object.keys(call.init.headers).some(name => name.toLowerCase() === 'idempotency-key'), false);
let mutationLossCalls = 0;
const lostWrite = new BotaApiClient({ credentials: 'synthetic_loss', maxRetries: 2, fetch: async () => { mutationLossCalls++; throw Error('synthetic lost response'); } });
await assert.rejects(lostWrite.postEndUsers({ body: {} }), error => error instanceof BotaMutationError && error.kind === 'transport' && error.requestOutcome === 'unknown');
assert.equal(mutationLossCalls, 1);
await assert.rejects(lostWrite.mutate('patchEndUsersById', { path: { id: 'eu_packed' }, body: {} }), { requestOutcome: 'unknown' });
assert.equal(mutationLossCalls, 2);
const moduleUrl = import.meta.resolve('@bota.dev/api-sdk');
const expected = resolve('node_modules/@bota.dev/api-sdk/dist/index.js');
assert.equal(fileURLToPath(moduleUrl), expected);
assert.equal((await lstat(new URL('../', moduleUrl))).isSymbolicLink(), false);
const manifest = JSON.parse(await readFile(new URL('../package.json', moduleUrl)));
assert.equal(manifest.private, false); assert.equal(manifest.license, 'MIT');
assert.equal(manifest.version, '0.1.0-beta.0');
assert.deepEqual(manifest.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org' });
assert.equal(manifest.dependencies, undefined);
await assert.rejects(import('@bota.dev/api-sdk/runtime.ts'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
const installedNames = (await readdir('node_modules')).filter(name => name !== '.package-lock.json');
assert.deepEqual(installedNames, ['@bota.dev']);
assert.deepEqual(await readdir('node_modules/@bota.dev'), ['api-sdk']);

const mappings = [
  ['getAuthIdentity', '/auth/identity'], ['getEndUsers', '/end-users'], ['getEndUsersById', '/end-users/id%2Fopaque'],
  ['getDevices', '/devices'], ['getDevicesById', '/devices/id%2Fopaque'], ['getRecordings', '/recordings'],
  ['getRecordingsById', '/recordings/id%2Fopaque'], ['getTranscriptions', '/transcriptions'],
  ['getTranscriptionsById', '/transcriptions/id%2Fopaque'], ['getSummaries', '/summaries'], ['getSummariesById', '/summaries/id%2Fopaque'],
];
const calls = []; let credentials = 0;
const payload = { project_id: 'proj_synthetic', file_size_bytes: '9223372036854775807', confidence: 'NaN', audio_url: null, extra: { preserved: true } };
const client = createReadPrototype({ credentials: () => `synthetic_packed_${++credentials}`, fetch: async (url, init) => {
  calls.push({ url: new URL(url), init });
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', 'x-request-id': 'req_packed', 'ratelimit-reset': '1', 'x-ratelimit-reset': '1792440000' } });
} });
for (const [operation, path] of mappings) {
  const result = await client.read(operation, operation.endsWith('ById') ? { path: { id: 'id/opaque' } } : undefined);
  assert.equal(result.status, 200); assert.deepEqual(result.data, payload);
  const call = calls.at(-1);
  assert.equal(call.url.href, `https://api.bota.dev/v1${path}`);
  assert.equal(call.init.method, 'GET'); assert.equal(call.init.redirect, 'manual');
  assert.equal(call.init.headers.Authorization, `Bearer synthetic_packed_${calls.length}`);
  assert.equal(result.headers['x-request-id'], 'req_packed');
  assert.equal(result.headers['ratelimit-reset'], '1'); assert.equal(result.headers['x-ratelimit-reset'], '1792440000');
}
assert.equal(calls.length, 11); assert.equal(credentials, 11);
const namedCalls = [];
const named = new BotaApiClient({ credentials: 'synthetic_packed_named', fetch: async (url, init) => {
  namedCalls.push({ url: new URL(url), init }); return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', 'x-request-id': 'req_named' } });
} });
assert.equal(namedCalls.length, 0);
for (const [operation, path] of mappings) {
  const result = await named[operation](operation.endsWith('ById') ? { path: { id: 'id/opaque' } } : undefined);
  assert.equal(result.status, 200); assert.deepEqual(result.data, payload);
  assert.equal(namedCalls.at(-1).url.href, `https://api.bota.dev/v1${path}`);
  assert.equal(namedCalls.at(-1).init.headers.Authorization, 'Bearer synthetic_packed_named');
  assert.equal(result.headers['x-request-id'], 'req_named');
}
assert.equal(namedCalls.length, 11);
assert.equal(JSON.stringify(named), '{}');
const errorKey = 'synthetic_packed_error_key'; let deniedCalls = 0;
const denied = createReadPrototype({ credentials: errorKey, fetch: async () => {
  deniedCalls++;
  return new Response(JSON.stringify({ error: { code: 'permission_denied', message: errorKey, param: 'id', request_id: 'req_denied' } }),
    { status: 403, headers: { 'content-type': 'application/json', 'x-request-id': 'req_header' } });
} });
await assert.rejects(denied.read('getAuthIdentity'), error => {
  assert.ok(error instanceof ReadPrototypeError); assert.equal(error.status, 403);
  assert.equal(error.code, 'permission_denied'); assert.equal(error.param, 'id'); assert.equal(error.requestId, 'req_denied');
  assert.equal(error.body.error.message, '[REDACTED]'); assert.equal(error.headers['x-request-id'], 'req_header');
  assert.equal(JSON.stringify(error).includes(errorKey), false); return true;
});
assert.equal(deniedCalls, 1);
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(client.read('getAuthIdentity', undefined, { signal: cancelled.signal }), { kind: 'aborted' });
assert.equal(calls.length, 11); assert.equal(credentials, 11);
const pageCalls = [];
const pages = createReadPrototype({ credentials: 'synthetic_packed_page', fetch: async url => {
  pageCalls.push(new URL(url));
  return new Response(JSON.stringify({ data: [{ id: 'dev_opaque' }], has_more: pageCalls.length === 1,
    ...(pageCalls.length === 1 ? { next_cursor: 'opaque/+=cursor' } : {}) }), { headers: { 'content-type': 'application/json' } });
} });
let count = 0;
for await (const page of pages.pages('getDevices', { query: { serial_number: 'serial exact', limit: 1 } }, { maxPages: 2, maxItems: 2 })) count += page.data.length;
assert.equal(count, 2); assert.equal(pageCalls.length, 2);
assert.equal(pageCalls[1].searchParams.get('cursor'), 'opaque/+=cursor');
for (const call of pageCalls) { assert.equal(call.searchParams.get('serial_number'), 'serial exact'); assert.equal(call.searchParams.get('limit'), '1'); }
assert.equal(ambientCalls, 0);
console.log(JSON.stringify({ node: process.version, imported: 'dist/index.js', nativeTypeScript: false, operationCalls: 11, namedOperationCalls: 11,
  mutationOperationCalls: mutationCalls.length, mutationLossCalls, deniedCalls, pageCalls: 2, ambientCalls, passed: true }));
