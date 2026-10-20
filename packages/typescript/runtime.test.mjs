import { workspaceHashes } from './workspace.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { inspect } from 'node:util';
import { readFile } from 'node:fs/promises';
import { digest } from './project.mjs';
import test from 'node:test';
import index from './generated/operations.json' with { type: 'json' };
import { createReadPrototype, ReadPrototypeError } from './runtime.ts';

const key = 'synthetic_PRIVATE_key+canary=';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = (body, options = {}) => new Response(JSON.stringify(body), {
  ...options, headers: { 'content-type': 'application/json', ...options.headers },
});
function fixture(handler = () => json({})) {
  const calls = [];
  const client = createReadPrototype({ credentials: key, maxRetries: 0, fetch: async (url, init) => {
    calls.push({ url: new URL(url), init });
    return handler(url, init, calls.length);
  } });
  return { client, calls };
}
async function failure(work, kind, status) {
  try { await work(); assert.fail('expected failure'); } catch (error) {
    assert.ok(error instanceof ReadPrototypeError);
    assert.equal(error.kind, kind);
    if (status !== undefined) assert.equal(error.status, status);
    for (const rendering of [error.message, error.stack, JSON.stringify(error), inspect(error), JSON.stringify(error.body)]) {
      assert.ok(!rendering?.includes(key), 'request credential must not appear in errors');
    }
    return error;
  }
}
async function eventually(predicate, milliseconds = 2000) {
  const end = Date.now() + milliseconds;
  while (!predicate()) {
    if (Date.now() >= end) assert.fail('bounded condition did not complete');
    await delay(10);
  }
}

test('all eleven operations send exactly one GET to the versioned root', async () => {
  const { client, calls } = fixture();
  for (const operation of index) {
    await client.read(operation.operationId, operation.path.includes('{id}') ? { path: { id: 'opaque_id' } } : undefined);
    const call = calls.at(-1);
    assert.equal(call.url.href, `https://api.bota.dev/v1${operation.path.replace('{id}', 'opaque_id')}`);
    assert.equal(call.init.method, 'GET');
    assert.equal(call.init.redirect, 'manual');
    assert.equal(call.init.credentials, 'omit');
    assert.equal(call.init.headers.Authorization, `Bearer ${key}`);
    assert.equal(call.init.headers.Accept, 'application/json');
    assert.equal(call.url.href.includes(key), false);
  }
  assert.equal(calls.length, 11);
});

test('custom immutable roots join once and path/query values stay opaque data', async () => {
  const urls = [];
  const options = { credentials: key, baseUrl: 'https://deployment.example/api/v1/',
    fetch: async url => { urls.push(new URL(url)); return json({}); } };
  const client = createReadPrototype(options);
  options.baseUrl = 'https://untrusted.example/v1';
  options.credentials = 'replacement';
  for (const id of ['a/b?x#y', '%2f', '%2e%2e', '你好', 'https://foreign.example', '..suffix']) {
    await client.read('getDevicesById', { path: { id } });
    const url = urls.at(-1);
    assert.equal(url.origin, 'https://deployment.example');
    assert.equal(url.pathname, `/api/v1/devices/${encodeURIComponent(id)}`);
    assert.equal(url.search, '');
  }
  await client.read('getEndUsers', { query: { external_id: 'a&cursor=foreign/#你好', email: '' } });
  assert.equal(urls.at(-1).searchParams.get('external_id'), 'a&cursor=foreign/#你好');
  assert.equal(urls.at(-1).searchParams.get('email'), '');
});

test('invalid roots, operations and input fail before credential resolution or egress', async () => {
  for (const baseUrl of ['http://api.example/v1', 'https://u:p@api.example/v1', 'https://api.example/v1?x=1',
    'https://api.example/v1#x', 'https://api.example', 'https://api.example/api/../v1',
    'https://api.example/%76%31', 'https://api.example/v1\\x', 'https://api.example/v1\n']) {
    assert.throws(() => createReadPrototype({ credentials: key, baseUrl }), { kind: 'invalid_input' });
  }
  assert.throws(() => createReadPrototype({ credentials: key, baseUrl: 'http://127.0.0.1/v1' }), { kind: 'invalid_input' });
  assert.throws(() => createReadPrototype({ credentials: key, baseUrl: 'http://foreign.example/v1', allowLoopbackHttp: true }), { kind: 'invalid_input' });
  let providers = 0;
  const client = createReadPrototype({ credentials: () => { providers++; return key; }, fetch: async () => assert.fail('unexpected network') });
  for (const [op, input] of [
    ['createRecording', undefined], ['getDevicesById', undefined], ['getDevicesById', { path: { id: '..' } }],
    ['getDevicesById', { path: { id: '.' } }], ['getDevicesById', { path: { id: '' } }],
    ['getDevices', { query: { limit: '10' } }], ['getDevices', { query: { limit: 0 } }],
    ['getDevices', { query: { limit: 101 } }], ['getDevices', { query: { limit: NaN } }],
    ['getRecordings', { query: { status: 'none' } }], ['getDevices', { query: { unknown: 'x' } }],
    ['getAuthIdentity', { path: { id: 'x' } }], ['getAuthIdentity', { baseUrl: 'https://foreign.example/v1' }],
  ]) await failure(() => client.read(op, input), 'invalid_input');
  assert.equal(providers, 0);
  for (const invalid of [null, [], '', { query: null }, { path: null }, { query: { cursor: '\ud800' } }]) {
    await failure(() => client.read('getDevices', invalid), 'invalid_input');
    await failure(async () => { for await (const _ of client.pages('getDevices', invalid)) { void _; } }, 'invalid_input');
  }
  for (const invalid of [null, [], '', { signal: null }, { signal: {} }, { unexpected: true }]) {
    await failure(() => client.read('getDevices', undefined, invalid), 'invalid_input');
    await failure(async () => { for await (const _ of client.pages('getDevices', undefined, invalid)) { void _; } }, 'invalid_input');
  }
  assert.equal(providers, 0);
});

test('all five list filters preserve scalar string values without normalizing', async () => {
  const { client, calls } = fixture(() => json({ data: [], has_more: false }));
  for (const [operation, query] of [
    ['getEndUsers', { external_id: 'same exact external id', email: 'person@example.test' }],
    ['getDevices', { end_user_id: 'eu_opaque', serial_number: 'serial 001' }],
    ['getRecordings', { device_id: 'dev_opaque', end_user_id: 'eu_opaque', status: 'completed', start_date: '2026-10-19T10:00:00.123456+15:59' }],
    ['getTranscriptions', { recording_id: 'rec_opaque', end_date: '2026-10-19t10:00:00z' }],
    ['getSummaries', { transcription_id: 'tr_opaque' }],
  ]) {
    await client.read(operation, { query });
    assert.deepEqual(Object.fromEntries(calls.at(-1).url.searchParams), query);
  }
  for (const [operation, name] of [['getEndUsers', 'external_id'], ['getDevices', 'serial_number'],
    ['getRecordings', 'device_id'], ['getTranscriptions', 'recording_id'], ['getSummaries', 'transcription_id']]) {
    const before = calls.length;
    await failure(() => client.read(operation, { query: { [name]: 'has\0nul' } }), 'invalid_input');
    assert.equal(calls.length, before);
  }
  const before = calls.length;
  await failure(() => client.read('getDevices', { query: { serial_number: 'x'.repeat(65) } }), 'invalid_input');
  await failure(() => client.read('getSummaries', { query: { transcription_id: '' } }), 'invalid_input');
  assert.equal(calls.length, before);
});

test('credentials resolve fresh per request and invalid credentials never leave the process', async () => {
  let generation = 0;
  const received = [];
  const client = createReadPrototype({ credentials: ({ baseUrl, signal }) => {
    assert.equal(baseUrl, 'https://api.bota.dev/v1'); assert.equal(signal.aborted, false);
    return `fresh_${++generation}`;
  }, fetch: async (_url, init) => { received.push(init.headers.Authorization); return json({}); } });
  await client.read('getAuthIdentity'); await client.read('getAuthIdentity');
  assert.deepEqual(received, ['Bearer fresh_1', 'Bearer fresh_2']);
  for (const credentials of ['', 'x\nAuthorization: stolen', 'x'.repeat(8193), () => { throw new Error(key); },
    () => { throw new ReadPrototypeError('http', { body: { error: { message: key } } }); }, () => undefined]) {
    await failure(() => createReadPrototype({ credentials, fetch: async () => assert.fail('unexpected network') }).read('getAuthIdentity'), 'credentials');
  }
});

test('redirect statuses, redirected final URLs and opaque redirects never retry or follow', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const { client, calls } = fixture(() => new Response(null, { status, headers: { location: `https://foreign.example/${key}` } }));
    const error = await failure(() => client.read('getAuthIdentity'), 'redirect', status);
    assert.ok(!error.headers.location.includes(key));
    assert.equal(calls.length, 1);
  }
  for (const override of [{ redirected: true }, { url: 'https://foreign.example/v1/auth/identity' }, { type: 'opaqueredirect', status: 0 }]) {
    const { client, calls } = fixture(() => {
      const response = json({});
      for (const [name, value] of Object.entries(override)) Object.defineProperty(response, name, { value });
      return response;
    });
    await failure(() => client.read('getAuthIdentity'), 'redirect');
    assert.equal(calls.length, 1);
  }
});

test('JSON wire values, additional fields and raw optional string headers survive', async () => {
  const body = { file_size_bytes: '9223372036854775807', confidence: 'NaN', nullable: null,
    another: '0.123', number: 17, extra: { unknown: true }, transcription_status: null, audio_url: null };
  const headers = { 'RateLimit-Reset': '1', 'X-RateLimit-Reset': '1792440000', 'X-Request-Id': 'req_opaque', 'Cache-Control': 'no-store' };
  const { client } = fixture(() => json(body, { headers }));
  const result = await client.read('getRecordingsById', { path: { id: 'rec_opaque' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, body);
  assert.equal(result.headers['ratelimit-reset'], '1');
  assert.equal(result.headers['x-ratelimit-reset'], '1792440000');
  assert.equal(result.headers['x-request-id'], 'req_opaque');
  assert.equal(result.headers['retry-after'], undefined);
  assert.equal(Object.isFrozen(result.headers), true);
});

test('generic and billing HTTP errors retain distinct envelopes and conditional headers', async () => {
  const generic = { error: { code: 'invalid_request_error', message: 'Safe server diagnostic', param: 'limit', request_id: 'body_request', extra: true } };
  const { client } = fixture(() => json(generic, { status: 400, headers: { 'X-Request-Id': 'header_request' } }));
  const error = await failure(() => client.read('getDevices'), 'http', 400);
  assert.deepEqual(error.body, generic); assert.equal(error.code, generic.error.code);
  assert.equal(error.param, 'limit'); assert.equal(error.apiMessage, 'Safe server diagnostic');
  assert.equal(error.requestId, 'body_request'); assert.equal(error.headers['x-request-id'], 'header_request');
  for (const billing of [false, true]) {
    const body = billing ? { error: { type: 'rate_limit_exceeded', code: 'RATE_LIMIT_EXCEEDED', message: 'Billing limit', details: { limit: 1, current: 2, reset_at: '2026-10-19T00:00:00Z', tier: 'custom' } } }
      : { error: { code: 'rate_limit_exceeded', message: 'Standard limit', request_id: 'req_standard' } };
    const headers = billing ? { 'X-RateLimit-Reset': '1792440000', 'X-Request-Id': 'req_billing' } : { 'Retry-After': '1', 'RateLimit-Reset': '1' };
    const f = fixture(() => json(body, { status: 429, headers }));
    const e = await failure(() => f.client.read('getDevices'), 'http', 429);
    assert.deepEqual(e.body, body); assert.equal(f.calls.length, 1);
    assert.equal(e.headers['retry-after'], billing ? undefined : '1');
    assert.equal(e.body.error.request_id, billing ? undefined : 'req_standard');
    assert.equal(e.requestId, billing ? 'req_billing' : 'req_standard');
  }
});

test('auth/quarantine/service envelopes keep status, code, body and headers without retry', async () => {
  for (const [status, code] of [[401, 'invalid_api_key'], [403, 'permission_denied'], [423, 'organization_quarantined'], [500, 'internal_error']]) {
    const body = { error: { code, message: 'Server-owned diagnostic' } };
    const f = fixture(() => json(body, { status, headers: { 'x-request-id': `req_${status}`, ...(status === 423 ? { 'cache-control': 'no-store' } : {}) } }));
    const error = await failure(() => f.client.read('getAuthIdentity'), 'http', status);
    assert.equal(error.code, code); assert.deepEqual(error.body, body); assert.equal(error.requestId, `req_${status}`);
    assert.equal(error.body.error.request_id, undefined); assert.equal(f.calls.length, 1);
    assert.equal(error.headers['cache-control'], status === 423 ? 'no-store' : undefined);
  }
});

test('HTTP error credential echoes are redacted in body keys/values, headers and diagnostics', async () => {
  const body = { error: { code: key, param: key, request_id: key, message: `${key} ${encodeURIComponent(key)}` }, [key]: [{ nested: key }] };
  const { client } = fixture(() => json(body, { status: 403, headers: { 'X-Request-Id': key, location: `https://x.example/${encodeURIComponent(key)}` } }));
  const error = await failure(() => client.read('getAuthIdentity'), 'http', 403);
  assert.equal(error.code, '[REDACTED]'); assert.equal(error.param, '[REDACTED]');
  assert.equal(error.requestId, '[REDACTED]');
  assert.deepEqual(error.body['[REDACTED]'], [{ nested: '[REDACTED]' }]);
  assert.equal(error.apiMessage, '[REDACTED] [REDACTED]');
  assert.equal(JSON.stringify(error).includes(encodeURIComponent(key)), false);
  assert.equal(inspect(error).includes('nested'), false);
});

test('malformed, non-JSON, oversized and unexpected success responses keep safe status diagnostics', async () => {
  for (const response of [new Response(`<html>${key}</html>`, { status: 502 }),
    new Response(`{${key}`, { status: 401, headers: { 'content-type': 'application/json' } }),
    json({}, { status: 201 })]) {
    const f = fixture(() => response);
    await failure(() => f.client.read('getAuthIdentity'), 'invalid_response', response.status);
    assert.equal(f.calls.length, 1);
  }
  let cancelled = false;
  const client = createReadPrototype({ credentials: key, maxResponseBytes: 4, fetch: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('12345')); }, cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'application/json' } }) });
  await failure(() => client.read('getAuthIdentity'), 'response_too_large', 200);
  assert.equal(cancelled, true);
  const empty = fixture(() => new Response(null, { status: 204, headers: { 'X-Request-Id': 'req_empty' } }));
  assert.deepEqual(await empty.client.read('getAuthIdentity'), { status: 204, data: undefined, headers: Object.assign(Object.create(null), { 'x-request-id': 'req_empty' }) });
});

test('provider, fetch and streamed body deadlines share one budget and never retry', async t => {
  let calls = 0;
  let providerAborted = false;
  const provider = createReadPrototype({ timeoutMs: 80, credentials: ({ signal }) => {
    signal.addEventListener('abort', () => { providerAborted = true; });
    return new Promise(resolve => setTimeout(() => resolve(key), 120));
  }, fetch: async () => { calls++; return json({}); } });
  await failure(() => provider.read('getAuthIdentity'), 'deadline');
  await delay(80); assert.equal(calls, 0); assert.equal(providerAborted, true);
  const lost = fixture(() => { throw new Error(`socket lost ${key}`); });
  await failure(() => lost.client.read('getAuthIdentity'), 'transport'); assert.equal(lost.calls.length, 1);
  const spoofed = fixture(() => { throw new ReadPrototypeError('http', { body: { error: { message: key } } }); });
  await failure(() => spoofed.client.read('getAuthIdentity'), 'transport');
  let bodyCancelled = false;
  let signal; let credentialSignal; let totalTimers = 0;
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (...args) => { if (Math.ceil(args[1]) === 180) totalTimers++; return schedule(...args); });
  const total = createReadPrototype({ timeoutMs: 180, credentials: async ({ signal }) => { credentialSignal = signal; await delay(70); return key; },
    fetch: async (_url, init) => {
      signal = init.signal; await delay(70);
      return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{')); }, cancel() { bodyCancelled = true; } }), { headers: { 'content-type': 'application/json' } });
    } });
  await failure(() => total.read('getAuthIdentity'), 'deadline', 200);
  assert.equal(totalTimers, 1); assert.equal(signal, credentialSignal);
  assert.equal(signal.aborted, true); assert.equal(bodyCancelled, true);
});

test('caller cancellation and pre-aborted signals stop credentials/fetch/body without leaking reasons', async () => {
  const pre = new AbortController(); pre.abort(key);
  let providers = 0;
  const client = createReadPrototype({ credentials: () => { providers++; return key; }, fetch: async () => assert.fail('unexpected network') });
  await failure(() => client.read('getAuthIdentity', undefined, { signal: pre.signal }), 'aborted');
  assert.equal(providers, 0);
  const hostile = new AbortController();
  hostile.abort(new ReadPrototypeError('http', { body: { error: { message: key } }, headers: { key } }));
  await failure(() => client.read('getAuthIdentity', undefined, { signal: hostile.signal }), 'aborted');
  const controller = new AbortController();
  let cancelled = false;
  const streaming = createReadPrototype({ credentials: key, fetch: async () => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'application/json' } }) });
  const pending = streaming.read('getAuthIdentity', undefined, { signal: controller.signal });
  await delay(10); controller.abort(new Error(key));
  await failure(() => pending, 'aborted', 200); assert.equal(cancelled, true);
});

test('late injected fetch responses are disposed without replay after deadline', async () => {
  let cancelled = false; let calls = 0;
  const client = createReadPrototype({ credentials: key, timeoutMs: 30, fetch: async () => {
    calls++; await delay(70);
    return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); }, cancel() { cancelled = true; } }));
  } });
  await failure(() => client.read('getAuthIdentity'), 'deadline');
  await eventually(() => cancelled);
  assert.equal(calls, 1);
});

test('bounded iterator preserves filters/limits/opaque cursors and does not prefetch', async () => {
  const { client, calls } = fixture((_url, _init, n) => json({ data: n === 3 ? [] : [{ id: `item_${n}` }],
    total: 2, has_more: n < 3, ...(n < 3 ? { next_cursor: `opaque/+==${n}` } : {}) }));
  const filters = { device_id: 'dev_1', start_date: '2026-10-19T00:00:00Z', limit: 1, cursor: 'start/+==' };
  const pages = [];
  for await (const page of client.pages('getRecordings', { query: filters })) pages.push(page);
  assert.equal(pages.length, 3); assert.equal(calls.length, 3); assert.equal(pages[2].data.length, 0);
  for (const [i, call] of calls.entries()) {
    assert.equal(call.url.searchParams.get('device_id'), filters.device_id);
    assert.equal(call.url.searchParams.get('start_date'), filters.start_date);
    assert.equal(call.url.searchParams.get('limit'), '1');
    assert.equal(call.url.searchParams.get('cursor'), i === 0 ? filters.cursor : `opaque/+==${i}`);
  }
  assert.equal(filters.cursor, 'start/+==');
  const f = fixture(() => json({ data: [], has_more: true, next_cursor: 'next' }));
  for await (const _ of f.client.pages('getDevices')) { void _; break; }
  await delay(10); assert.equal(f.calls.length, 1);
});

test('iterator refuses malformed continuation, cycles and page/item caps explicitly', async () => {
  for (const body of [{ data: [], has_more: true }, { data: [], has_more: true, next_cursor: '' }, { data: {}, has_more: false }, { data: [], has_more: 'false' }]) {
    const f = fixture(() => json(body));
    await failure(async () => { for await (const _ of f.client.pages('getDevices')) { void _; } }, 'pagination');
    assert.equal(f.calls.length, 1);
  }
  const cycle = fixture(() => json({ data: [], has_more: true, next_cursor: 'same' }));
  await failure(async () => { for await (const _ of cycle.client.pages('getDevices', { query: { cursor: 'same' } })) { void _; } }, 'pagination');
  assert.equal(cycle.calls.length, 1);
  for (const options of [{ maxPages: 1 }, { maxItems: 1 }]) {
    const f = fixture((_u, _i, n) => json({ data: [{ id: 'one' }], has_more: true, next_cursor: String(n) }));
    let yielded = 0;
    await failure(async () => { for await (const _ of f.client.pages('getDevices', undefined, options)) { void _; yielded++; } }, 'pagination');
    assert.equal(yielded, 1); assert.equal(f.calls.length, 1);
  }
  const oversized = fixture(() => json({ data: [{}, {}], has_more: false }));
  await failure(async () => { for await (const _ of oversized.client.pages('getDevices', undefined, { maxItems: 1 })) { void _; } }, 'pagination');
});

test('iterator deadline includes downstream waits and consumer pauses', async () => {
  const f = fixture(() => json({ data: [], has_more: true, next_cursor: 'next' }));
  const iterator = f.client.pages('getDevices', undefined, { timeoutMs: 60 });
  await iterator.next(); await delay(90);
  await failure(() => iterator.next(), 'deadline'); assert.equal(f.calls.length, 1);
  const stalled = createReadPrototype({ credentials: key, fetch: async () => new Promise(() => {}) });
  const pending = stalled.pages('getDevices', undefined, { timeoutMs: 60 });
  await failure(() => pending.next(), 'deadline');
});

test('mutating yielded pages cannot change the snapshotted continuation decision', async () => {
  const f = fixture((_url, _init, n) => json({ data: [], has_more: n === 1, ...(n === 1 ? { next_cursor: 'original' } : {}) }));
  const iterator = f.client.pages('getDevices');
  const first = await iterator.next();
  first.value.has_more = false; first.value.next_cursor = 'changed';
  const second = await iterator.next();
  second.value.has_more = true;
  assert.equal((await iterator.next()).done, true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].url.searchParams.get('cursor'), 'original');
});

test('native loopback fetch: exact headers, manual redirect refusal and body abort close the socket', { timeout: 10000 }, async t => {
  let foreignCalls = 0;
  const foreign = createServer((_req, res) => { foreignCalls++; res.end('{}'); });
  foreign.listen(0, '127.0.0.1'); await once(foreign, 'listening');
  const observed = []; let stalledClosed = false;
  const server = createServer((req, res) => {
    observed.push({ url: req.url, authorization: req.headers.authorization, method: req.method });
    if (req.url === '/v1/devices') {
      res.writeHead(302, { location: `http://127.0.0.1:${foreign.address().port}/steal` }); res.end();
    } else if (req.url === '/v1/summaries') {
      res.writeHead(200, { 'content-type': 'application/json', 'X-Request-Id': 'native_stall' });
      res.write('{'); res.on('close', () => { stalledClosed = true; });
    } else {
      res.writeHead(200, { 'content-type': 'application/json', 'RateLimit-Reset': '1', 'X-RateLimit-Reset': '1792440000', 'X-Request-Id': 'native_identity' });
      res.end(JSON.stringify({ project_id: 'proj_native', test_only: true }));
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    for (const s of [server, foreign]) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); }
  });
  const client = createReadPrototype({ credentials: key, baseUrl: `http://127.0.0.1:${server.address().port}/v1`, allowLoopbackHttp: true });
  const result = await client.read('getAuthIdentity');
  assert.equal(result.data.project_id, 'proj_native'); assert.equal(result.headers['x-request-id'], 'native_identity');
  assert.equal(result.headers['ratelimit-reset'], '1'); assert.equal(result.headers['x-ratelimit-reset'], '1792440000');
  await failure(() => client.read('getDevices'), 'redirect', 302);
  await failure(() => client.read('getSummaries', undefined, { timeoutMs: 100 }), 'deadline', 200);
  await eventually(() => stalledClosed);
  assert.equal(foreignCalls, 0); assert.equal(observed.length, 3);
  for (const request of observed) { assert.equal(request.method, 'GET'); assert.equal(request.authorization, `Bearer ${key}`); }
});

test('private runtime identity binds maintained source, fixtures, consumer and exact generation provenance', async () => {
  const provenance = JSON.parse(await readFile(new URL('./generated/runtime-provenance.json', import.meta.url)));
  assert.equal(provenance.status, 'beta-read-and-end-user-write-sdk-experimental');
  assert.equal(provenance.operationCount, 11);
  assert.deepEqual(provenance.workspaceFiles, await workspaceHashes());
  for (const [file, hash] of Object.entries(provenance.files)) {
    assert.equal(digest(await readFile(new URL(`./${file}`, import.meta.url))), hash, file);
  }
  const generated = JSON.parse(await readFile(new URL('./generated/provenance.json', import.meta.url)));
  assert.deepEqual(provenance.source, generated.source);
});
