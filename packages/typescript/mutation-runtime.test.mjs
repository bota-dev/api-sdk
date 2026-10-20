import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { inspect } from 'node:util';
import test from 'node:test';
import { createReadPrototype, ReadPrototypeError, BotaMutationError } from './runtime.ts';

const key = 'synthetic_mutation_KEY+canary=';
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const json = (body, status = 201, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
function fixture(handler = () => json({ id: 'eu_created' }), options = {}) {
  const calls = [];
  let providers = 0;
  const client = createReadPrototype({ ...options, credentials: () => { providers++; return key; },
    fetch: async (url, init) => { calls.push({ url: new URL(url), init }); return handler(url, init, calls.length); },
  });
  return { client, calls, get providers() { return providers; } };
}
async function failure(work, kind, requestOutcome, status) {
  try { await work(); assert.fail('expected mutation failure'); }
  catch (error) {
    assert.ok(error instanceof BotaMutationError);
    assert.ok(error instanceof ReadPrototypeError);
    assert.equal(error.kind, kind);
    assert.equal(error.requestOutcome, requestOutcome);
    if (status !== undefined) assert.equal(error.status, status);
    for (const rendered of [error.message, error.stack, inspect(error), JSON.stringify(error), JSON.stringify(error.body), error.apiMessage]) {
      assert.ok(!rendered?.includes(key), 'credential must not appear in diagnostics');
    }
    return error;
  }
}
const create = (client, body = {}, options) => client.mutate('postEndUsers', { body }, options);
const patch = (client, body = {}, options) => client.mutate('patchEndUsersById', { path: { id: 'eu_opaque' }, body }, options);

test('create and patch use the shared authenticated transport with exact 201/200 success', async () => {
  const f = fixture((_url, init) => json({ id: 'eu_opaque', unknown: null, generation: '9007199254740993' }, init.method === 'POST' ? 201 : 200));
  const result = await create(f.client, { external_id: 'customer 001', name: '你好', metadata: { null: null } });
  assert.equal(result.status, 201); assert.equal(result.data.generation, '9007199254740993');
  assert.equal(result.data.unknown, null);
  assert.equal((await patch(f.client, { metadata: {} }, { maxRetries: 0 })).status, 200);
  assert.equal(f.calls.length, 2); assert.equal(f.providers, 2);
  for (const [index, { url, init }] of f.calls.entries()) {
    assert.equal(url.href, `https://api.bota.dev/v1/end-users${index ? '/eu_opaque' : ''}`);
    assert.equal(init.method, index ? 'PATCH' : 'POST');
    assert.equal(init.headers.Authorization, `Bearer ${key}`);
    assert.equal(init.headers.Accept, 'application/json'); assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store');
    assert.ok(!Object.keys(init.headers).some(name => name.toLowerCase() === 'idempotency-key'));
  }
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { external_id: 'customer 001', name: '你好', metadata: { null: null } });
  assert.equal(f.calls[1].init.body, '{"metadata":{}}');
});

test('mutations never inherit the read retry default and reject per-call positive retries before credentials', async () => {
  const f = fixture(() => { throw new Error(key); }, { maxRetries: 2 });
  await failure(() => create(f.client), 'transport', 'unknown');
  assert.equal(f.calls.length, 1); assert.equal(f.providers, 1);
  for (const maxRetries of [1, 2, -1, 0.5, NaN, Infinity, '0', null]) {
    await failure(() => create(f.client, {}, { maxRetries }), 'invalid_input', 'not_submitted');
  }
  assert.equal(f.calls.length, 1); assert.equal(f.providers, 1);
});

test('every HTTP error is terminal after one mutation dispatch regardless of server retry advice', async () => {
  for (const status of [400, 401, 403, 404, 409, 423, 425, 429, 500, 502, 503, 504]) {
    for (const retryAfter of ['0', '1']) {
      const f = fixture(() => json({ error: { code: 'fixture_error', message: `message ${key}`, param: 'metadata', request_id: 'req_fixture' } }, status,
        { 'Retry-After': retryAfter, 'X-Request-Id': 'req_header', 'X-Secret-Fixture': key }));
      const error = await failure(() => create(f.client), 'http', 'unknown', status);
      assert.equal(error.code, 'fixture_error'); assert.equal(error.param, 'metadata');
      assert.equal(error.requestId, 'req_fixture'); assert.equal(error.headers['retry-after'], retryAfter);
      assert.equal(f.calls.length, 1); assert.equal(f.providers, 1);
    }
  }
});

test('redirects and changed final response origins are never followed or resent', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const f = fixture(() => new Response(null, { status, headers: { Location: `https://foreign.example/${key}` } }));
    await failure(() => create(f.client), 'redirect', 'unknown', status);
    assert.equal(f.calls.length, 1); assert.equal(f.providers, 1);
  }
  for (const override of [{ redirected: true }, { url: 'https://foreign.example/v1/end-users' }, { type: 'opaqueredirect', status: 0 }]) {
    const f = fixture(() => {
      const response = json({});
      for (const [name, value] of Object.entries(override)) Object.defineProperty(response, name, { value });
      return response;
    });
    await failure(() => create(f.client), 'redirect', 'unknown');
    assert.equal(f.calls.length, 1);
  }
});

test('only operation-declared success statuses are accepted; queued or empty variants are not invented', async () => {
  for (const [operation, goodStatus, input] of [
    ['postEndUsers', 201, { body: {} }], ['patchEndUsersById', 200, { path: { id: 'eu_opaque' }, body: {} }],
  ]) {
    for (const status of [200, 201, 202, 204]) {
      if (status === goodStatus) continue;
      const f = fixture(() => status === 204 ? new Response(null, { status }) : json({}, status));
      await failure(() => f.client.mutate(operation, input), 'invalid_response', 'unknown', status);
      assert.equal(f.calls.length, 1);
    }
  }
});

test('malformed, interrupted and oversized mutation responses preserve unknown outcome without retry', async () => {
  for (const [handler, kind] of [
    [() => new Response('{invalid', { status: 201, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req_fixture' } }), 'invalid_response'],
    [() => new Response('secret fixture', { status: 201, headers: { 'Content-Type': 'text/plain', 'X-Request-Id': 'req_fixture' } }), 'invalid_response'],
    [() => new Response(new Uint8Array([0xff]), { status: 201, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req_fixture' } }), 'invalid_response'],
    [() => new Response(new ReadableStream({ start(controller) { controller.error(new Error(key)); } }),
      { status: 201, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req_fixture' } }), 'transport'],
    [() => json({ value: 'x'.repeat(128) }, 201, { 'X-Request-Id': 'req_fixture' }), 'response_too_large'],
  ]) {
    const f = fixture(handler, { maxResponseBytes: 32 });
    const error = await failure(() => create(f.client), kind, 'unknown', 201);
    assert.equal(error.requestId, 'req_fixture'); assert.equal(f.calls.length, 1); assert.equal(f.providers, 1);
  }
});

test('unknown JSON fields and metadata values are transmitted without business coercion or stripping', async () => {
  const f = fixture();
  const shared = { repeated: 'reference' };
  const body = Object.assign(Object.create(null), {
    external_id: '', name: '', email: 'backend-validates-this', unknown: [null, true, false, 0, -0, 0.25, '你好😀'],
    metadata: { left: shared, right: shared, toJSON: 'ordinary nested JSON data' },
    toJSON: 'ordinary root JSON data',
  });
  Object.defineProperty(body, '__proto__', { value: { safe: true }, enumerable: true });
  await create(f.client, body);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), JSON.parse(JSON.stringify(body)));
  assert.equal(Object.prototype.safe, undefined);
});

test('bodies are snapshotted once before credentials and cannot change during provider resolution', async () => {
  const body = { name: 'before', metadata: { value: ['original'] } };
  let observed;
  const client = createReadPrototype({ credentials: () => {
    body.name = 'after'; body.metadata.value.push('later'); return key;
  }, fetch: async (_url, init) => { observed = init.body; return json({}); } });
  await create(client, body);
  assert.deepEqual(JSON.parse(observed), { name: 'before', metadata: { value: ['original'] } });
});

test('unsupported operations, parameters, paths and options refuse before credentials', async () => {
  const f = fixture();
  for (const [operation, input] of [
    ['getEndUsers', { body: {} }], ['deleteEndUsersById', { path: { id: 'eu' }, body: {} }],
    ['postEndUsers', undefined], ['postEndUsers', {}], ['postEndUsers', { body: {}, query: {} }],
    ['postEndUsers', { body: {}, baseUrl: 'https://foreign.example/v1' }], ['postEndUsers', { path: { id: 'eu' }, body: {} }],
    ['patchEndUsersById', { body: {} }], ['patchEndUsersById', { path: { id: '..' }, body: {} }],
    ['patchEndUsersById', { path: { id: '.' }, body: {} }], ['patchEndUsersById', { path: { id: '' }, body: {} }],
    ['patchEndUsersById', { path: { id: '\ud800' }, body: {} }], ['patchEndUsersById', { path: { id: 'eu', extra: 'x' }, body: {} }],
  ]) await failure(() => f.client.mutate(operation, input), 'invalid_input', 'not_submitted');
  for (const options of [null, [], { unknown: true }, { signal: null }, { timeoutMs: 0 }, { headers: { 'Idempotency-Key': 'arbitrary' } }]) {
    await failure(() => create(f.client, {}, options), 'invalid_input', 'not_submitted');
  }
  assert.equal(f.providers, 0); assert.equal(f.calls.length, 0);
});

test('opaque path values remain on the configured origin and root', async () => {
  const f = fixture(() => json({}, 200), { baseUrl: 'https://deployment.example/api/v1/' });
  for (const id of ['a/b?c#d', '%2e%2e', 'https://foreign.example', '你好😀']) {
    await f.client.mutate('patchEndUsersById', { path: { id }, body: {} });
    assert.equal(f.calls.at(-1).url.href, `https://deployment.example/api/v1/end-users/${encodeURIComponent(id)}`);
  }
});

test('strict JSON refuses unsupported values and malformed Unicode without credential access', async () => {
  const f = fixture();
  const cyclic = {}; cyclic.self = cyclic;
  const sparse = []; sparse[1] = 'hole';
  const extra = []; extra.unexpected = true;
  const nonenumerable = {}; Object.defineProperty(nonenumerable, 'hidden', { value: true });
  const symbol = { [Symbol('hidden')]: true };
  for (const body of [undefined, null, [], false, 1, 'string', { value: undefined }, { value: NaN }, { value: Infinity },
    { value: -Infinity }, { value: 9007199254740992 }, { value: 1n }, { value() {} }, { value: Symbol('bad') },
    { value: new Date(0) }, { value: new Map() }, cyclic, { value: sparse }, { value: extra }, nonenumerable, symbol,
    { value: '\ud800' }, { value: '\udc00' }, { '\ud800': 'key' },
  ]) await failure(() => f.client.mutate('postEndUsers', { body }), 'invalid_input', 'not_submitted');
  assert.equal(f.providers, 0); assert.equal(f.calls.length, 0);
});

test('accessors, proxies and custom prototypes are refused without invoking their hooks', async () => {
  const f = fixture();
  let hooks = 0;
  const accessor = {}; Object.defineProperty(accessor, 'value', { enumerable: true, get() { hooks++; throw new Error(key); } });
  const arrayAccessor = [0]; Object.defineProperty(arrayAccessor, '0', { enumerable: true, get() { hooks++; throw new Error(key); } });
  const proxy = new Proxy({}, { ownKeys() { hooks++; throw new Error(key); }, get() { hooks++; throw new Error(key); },
    getPrototypeOf() { hooks++; throw new Error(key); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  class Custom { value = 'value'; toJSON() { hooks++; return {}; } }
  for (const body of [accessor, { nested: accessor }, { value: arrayAccessor }, proxy, { value: proxy }, revoked.proxy,
    new Custom(), Object.create({ inherited: true }), { toJSON() { hooks++; return {}; } },
  ]) await failure(() => create(f.client, body), 'invalid_input', 'not_submitted');
  await failure(() => f.client.mutate('postEndUsers', accessor), 'invalid_input', 'not_submitted');
  await failure(() => create(f.client, {}, accessor), 'invalid_input', 'not_submitted');
  await failure(() => create(f.client, {}, { signal: proxy }), 'invalid_input', 'not_submitted');
  assert.equal(hooks, 0); assert.equal(f.providers, 0); assert.equal(f.calls.length, 0);
});

test('strict JSON enforces depth and node bounds before credentials', async () => {
  const f = fixture();
  let deep = null;
  for (let index = 0; index < 66; index++) deep = { child: deep };
  await failure(() => create(f.client, deep), 'invalid_input', 'not_submitted');
  await failure(() => create(f.client, { values: Array(100000).fill(null) }), 'invalid_input', 'not_submitted');
  assert.equal(f.providers, 0); assert.equal(f.calls.length, 0);
});

test('strict JSON bounds serialized UTF-8 bytes, including escaping, at exactly one MiB', async () => {
  const f = fixture();
  const maximum = 1024 * 1024;
  const overhead = Buffer.byteLength(JSON.stringify({ payload: '' }));
  await create(f.client, { payload: 'a'.repeat(maximum - overhead) });
  assert.equal(Buffer.byteLength(f.calls[0].init.body), maximum);
  for (const payload of ['a'.repeat(maximum - overhead + 1), '😀'.repeat(maximum / 4), '\u0000'.repeat(maximum / 6)]) {
    await failure(() => create(f.client, { payload }), 'invalid_input', 'not_submitted');
  }
  assert.equal(f.providers, 1); assert.equal(f.calls.length, 1);
});

test('serialization shares the total monotonic request budget', async t => {
  let now = 0;
  t.mock.method(performance, 'now', () => now++);
  const f = fixture();
  await failure(() => create(f.client, { values: Array(100).fill('value') }, { timeoutMs: 20 }), 'deadline', 'not_submitted');
  assert.equal(f.providers, 0); assert.equal(f.calls.length, 0);
});

test('provider errors and pre-dispatch cancellation retain a certain not-submitted outcome', async () => {
  for (const credentials of ['', () => { throw new Error(key); }, async () => { await sleep(25); return key; }]) {
    const client = createReadPrototype({ credentials, timeoutMs: 10, fetch: async () => assert.fail('unexpected dispatch') });
    await failure(() => create(client), typeof credentials === 'function' && credentials.constructor.name === 'AsyncFunction' ? 'deadline' : 'credentials', 'not_submitted');
  }
  const abort = new AbortController(); abort.abort();
  const f = fixture();
  await failure(() => create(f.client, {}, { signal: abort.signal }), 'aborted', 'not_submitted');
  assert.equal(f.providers, 0); assert.equal(f.calls.length, 0);
});

test('cancellation after dispatch never implies remote rollback or a second request', async () => {
  const abort = new AbortController();
  const f = fixture(() => {
    abort.abort();
    return json({ id: 'eu_may_exist' });
  });
  await failure(() => create(f.client, {}, { signal: abort.signal }), 'aborted', 'unknown');
  assert.equal(f.calls.length, 1); assert.equal(f.providers, 1);
});

test('cancelled response reads retain status and request ID and join local stream cancellation', async () => {
  const abort = new AbortController();
  let cancelled = 0;
  const f = fixture(() => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"id":')); setImmediate(() => abort.abort()); },
    cancel() { cancelled++; },
  }), { status: 201, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req_body_cancel' } }));
  const error = await failure(() => create(f.client, {}, { signal: abort.signal }), 'aborted', 'unknown', 201);
  assert.equal(error.requestId, 'req_body_cancel'); assert.equal(cancelled, 1); assert.equal(f.calls.length, 1);
});

test('native loopback POST and PATCH observed before lost responses each dispatch exactly once', async t => {
  let submitted = 0;
  const received = [];
  const server = createServer((request, response) => {
    submitted++;
    let body = '';
    request.setEncoding('utf8'); request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      received.push({ method: request.method, path: request.url, authorization: request.headers.authorization,
        idempotency: request.headers['idempotency-key'], body });
      response.destroy();
    });
  });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = createReadPrototype({ credentials: key, maxRetries: 2, timeoutMs: 1000,
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`, allowLoopbackHttp: true });
  await failure(() => create(client, { external_id: 'caller-stable-id' }), 'transport', 'unknown');
  await failure(() => patch(client, { name: 'caller-change' }), 'transport', 'unknown');
  await sleep(150);
  assert.equal(submitted, 2);
  assert.deepEqual(received, [{ method: 'POST', path: '/v1/end-users', authorization: `Bearer ${key}`,
    idempotency: undefined, body: '{"external_id":"caller-stable-id"}' },
  { method: 'PATCH', path: '/v1/end-users/eu_opaque', authorization: `Bearer ${key}`,
    idempotency: undefined, body: '{"name":"caller-change"}' }]);
});

test('reconciliation is an explicit caller read and never a hidden mutation retry', async () => {
  const calls = [];
  const client = createReadPrototype({ credentials: key, fetch: async (url, init) => {
    calls.push({ method: init.method, url: url.href });
    if (init.method === 'POST') throw new Error('response lost');
    return json({ data: [{ id: 'eu_reconciled', external_id: 'stable' }], has_more: false }, 200);
  } });
  await failure(() => create(client, { external_id: 'stable' }), 'transport', 'unknown');
  assert.deepEqual(calls.map(call => call.method), ['POST']);
  const result = await client.read('getEndUsers', { query: { external_id: 'stable' } });
  assert.equal(result.data.data[0].id, 'eu_reconciled');
  assert.deepEqual(calls.map(call => call.method), ['POST', 'GET']);
});
