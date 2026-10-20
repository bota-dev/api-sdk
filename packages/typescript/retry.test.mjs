import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { inspect } from 'node:util';
import test from 'node:test';
import index from './generated/operations.json' with { type: 'json' };
import { createReadPrototype, ReadPrototypeError } from './runtime.ts';

const key = 'synthetic_retry_KEY+canary=';
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const apiError = (status, headers = {}, code = 'temporary_fixture') => json({ error: { code, message: 'Synthetic failure' } }, status, headers);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function failure(work, kind, status) {
  await assert.rejects(work, error => {
    assert.ok(error instanceof ReadPrototypeError);
    assert.equal(error.kind, kind);
    if (status !== undefined) assert.equal(error.status, status);
    for (const rendered of [error.message, error.stack, inspect(error), JSON.stringify(error), JSON.stringify(error.body)]) {
      assert.ok(!rendered?.includes(key));
    }
    return true;
  });
}
function scripted(handlers, options = {}) {
  const calls = [];
  let providers = 0;
  const client = createReadPrototype({ credentials: () => { providers++; return key; }, ...options,
    fetch: async (url, init) => {
      calls.push({ url: url.href, init, at: performance.now() });
      const handler = handlers[calls.length - 1];
      assert.ok(handler, 'No extra attempt is permitted');
      return handler(url, init);
    } });
  return { client, calls, get providers() { return providers; } };
}
function controlledClock(t) {
  let now = 0;
  const timers = [];
  const originals = { timeout: globalThis.setTimeout, now: performance.now, random: Math.random };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const schedule = globalThis.setTimeout;
  t.mock.method(performance, 'now', () => now);
  t.mock.method(Math, 'random', () => 0);
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds, ...args) => {
    const timer = { milliseconds, fired: false };
    timers.push(timer);
    return schedule(() => { timer.fired = true; callback(...args); }, milliseconds);
  });
  t.after(() => {
    // Reset the tracker once: restoring methods separately would leave the timer
    // wrapper registered for automatic cleanup to restore a second time.
    t.mock.reset();
    assert.equal(globalThis.setTimeout, originals.timeout);
    assert.equal(performance.now, originals.now);
    assert.equal(Math.random, originals.random);
  });
  return {
    timers, now: () => now,
    tick(milliseconds) { now += milliseconds; t.mock.timers.tick(milliseconds); },
    // Simulate a synchronous callback that exhausts monotonic time before the
    // event loop can dispatch its deadline timer, without a host-speed busy loop.
    starve(milliseconds) { now += milliseconds; },
  };
}
async function phase(predicate) {
  for (let n = 0; n < 1000; n++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('controlled asynchronous phase was not reached');
}

test('each explicitly eligible read retries a transient response to the exact same URL', async () => {
  for (const definition of index) {
    const f = scripted([() => apiError(503), () => json({ fixture: definition.operationId })]);
    const input = definition.path.includes('{id}') ? { path: { id: 'opaque/a?b#c' } } : undefined;
    const result = await f.client.read(definition.operationId, input);
    assert.equal(result.status, 200);
    assert.equal(result.data.fixture, definition.operationId);
    assert.equal(f.calls.length, 2); assert.equal(f.providers, 2);
    assert.equal(f.calls[0].url, f.calls[1].url);
    for (const { init } of f.calls) {
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
      assert.equal(init.credentials, 'omit');
    }
  }
});

test('defaults stop after three attempts and retain the final envelope/headers', async () => {
  const f = scripted([() => apiError(502), () => apiError(503), () => apiError(504, { 'X-Request-Id': 'last_request' })]);
  await assert.rejects(() => f.client.read('getDevices'), error => {
    assert.equal(error.kind, 'http'); assert.equal(error.status, 504);
    assert.equal(error.code, 'temporary_fixture'); assert.equal(error.requestId, 'last_request');
    assert.equal(error.headers['x-request-id'], 'last_request'); return true;
  });
  assert.equal(f.calls.length, 3); assert.equal(f.providers, 3);
  const firstDelay = f.calls[1].at - f.calls[0].at, secondDelay = f.calls[2].at - f.calls[1].at;
  assert.ok(firstDelay >= 90 && firstDelay < 2000, `first delay ${firstDelay}`);
  assert.ok(secondDelay >= 190 && secondDelay < 2000, `second delay ${secondDelay}`);
});

test('constructor/request overrides disable or bound retries; malformed options never resolve credentials', async () => {
  for (const options of [{ maxRetries: 0 }, { maxRetries: 1 }]) {
    const f = scripted(Array.from({ length: options.maxRetries + 1 }, () => () => apiError(503)), options);
    await failure(() => f.client.read('getDevices'), 'http', 503);
    assert.equal(f.calls.length, options.maxRetries + 1);
  }
  const f = scripted([() => apiError(503)]);
  await failure(() => f.client.read('getDevices', undefined, { maxRetries: 0 }), 'http', 503);
  assert.equal(f.calls.length, 1);
  const refused = scripted([]);
  for (const maxRetries of [-1, 3, 0.5, NaN, Infinity, '1', null, true, {}]) {
    assert.throws(() => createReadPrototype({ credentials: key, maxRetries }), { kind: 'invalid_input' });
    await failure(() => refused.client.read('getDevices', undefined, { maxRetries }), 'invalid_input');
    await failure(() => refused.client.pages('getDevices', undefined, { maxRetries }).next(), 'invalid_input');
  }
  assert.equal(refused.providers, 0); assert.equal(refused.calls.length, 0);
});

test('auth, quarantine, deterministic failures and billing/auth-failure 429 never retry', async () => {
  for (const status of [400, 401, 403, 404, 409, 423, 500, 501]) {
    const f = scripted([() => apiError(status, { 'Retry-After': '0' })]);
    await failure(() => f.client.read('getRecordings'), 'http', status);
    assert.equal(f.calls.length, 1);
  }
  for (const response of [apiError(429), apiError(429, { 'Retry-After': '0' }, 'RATE_LIMIT_EXCEEDED')]) {
    const f = scripted([() => response]);
    await failure(() => f.client.read('getDevices'), 'http', 429);
    assert.equal(f.calls.length, 1);
  }
});

test('429 retries only with usable bounded delta or canonical HTTP-date guidance', async () => {
  for (const header of ['0', '0000', 'Wed, 21 Oct 2015 07:28:00 GMT']) {
    const f = scripted([() => apiError(429, { 'Retry-After': header }), () => json({ recovered: true })]);
    assert.equal((await f.client.read('getDevices')).data.recovered, true);
    assert.equal(f.calls.length, 2);
  }
  const future = new Date(Date.now() + 1800).toUTCString();
  const before = Date.parse(future);
  const f = scripted([() => apiError(429, { 'Retry-After': future }), () => json({ recovered: true })]);
  await f.client.read('getDevices');
  assert.ok(Date.now() >= before - 10, 'retry does not precede the admitted server time');
});

test('malformed, huge, unsupported-date and over-budget Retry-After preserve the original 429', async () => {
  for (const header of ['-1', '+1', '0.1', '1e1', 'NaN', 'Infinity', 'tomorrow', '11', '999999999999999999999999999999999',
    'Tue, 30 Feb 2027 00:00:00 GMT', 'Sunday, 06-Nov-94 08:49:37 GMT', new Date(Date.now() + 60000).toUTCString()]) {
    const f = scripted([() => apiError(429, { 'Retry-After': header })]);
    await failure(() => f.client.read('getDevices'), 'http', 429);
    assert.equal(f.calls.length, 1);
  }
  const f = scripted([() => apiError(429, { 'Retry-After': '1' })], { timeoutMs: 50 });
  await failure(() => f.client.read('getDevices'), 'http', 429);
  assert.equal(f.calls.length, 1);
});

test('gateway HTML may retry by status, but malformed success, redirects and byte caps cannot', async () => {
  for (const status of [502, 503, 504]) {
    const f = scripted([() => new Response('<html>temporary gateway</html>', { status }), () => json({ ok: true })]);
    assert.equal((await f.client.read('getDevices')).data.ok, true);
  }
  for (const response of [new Response('{', { headers: { 'content-type': 'application/json' } }),
    json({}, 201), new Response(null, { status: 302, headers: { location: 'https://foreign.invalid' } })]) {
    const f = scripted([() => response]);
    await failure(() => f.client.read('getDevices'), response.status === 302 ? 'redirect' : 'invalid_response', response.status);
    assert.equal(f.calls.length, 1);
  }
  const capped = scripted([() => apiError(503)], { maxResponseBytes: 4 });
  await failure(() => capped.client.read('getDevices'), 'response_too_large', 503);
  assert.equal(capped.calls.length, 1);
});

test('fetch loss and success-body transport loss retry without exposing a partial result', async () => {
  for (const first of [() => { throw new Error(key); }, () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{')); controller.error(new Error(key)); },
  }), { headers: { 'content-type': 'application/json' } })]) {
    const f = scripted([first, () => json({ complete: true })]);
    const result = await f.client.read('getDevices');
    assert.equal(result.data.complete, true); assert.equal(f.calls.length, 2);
  }
});

test('fresh credentials and immutable URL snapshot survive retries; final errors scrub every attempted key', async () => {
  const credentials = [key, `${key}longer`, 'synthetic_third_key='];
  let count = 0;
  const urls = [], headers = [];
  const input = { query: { end_user_id: 'opaque-one', limit: 1, cursor: 'opaque_cursor' } };
  const client = createReadPrototype({ credentials: () => credentials[count], fetch: async (url, init) => {
    urls.push(url.href); headers.push(init.headers.Authorization);
    input.query.end_user_id = 'changed_by_caller';
    count++;
    return json({ error: { code: 'temporary', message: credentials.join(' '), param: credentials[0], request_id: credentials[1] },
      [credentials[2]]: credentials.map(encodeURIComponent) }, 503, { 'X-Request-Id': credentials.join(' ') });
  } });
  await assert.rejects(() => client.read('getDevices', input), error => {
    const text = [inspect(error), JSON.stringify(error), JSON.stringify(error.body), error.apiMessage].join(' ');
    for (const credential of credentials) {
      assert.ok(!text.includes(credential)); assert.ok(!text.includes(encodeURIComponent(credential)));
    }
    assert.equal(error.status, 503); return true;
  });
  assert.deepEqual(headers, credentials.map(value => `Bearer ${value}`));
  assert.equal(new Set(urls).size, 1); assert.match(urls[0], /end_user_id=opaque-one/);
});

test('provider failure on a later attempt stops without credential refresh endpoints or leaked causes', async () => {
  let providers = 0, calls = 0;
  const client = createReadPrototype({ credentials: () => {
    if (++providers > 1) throw new ReadPrototypeError('http', { body: { error: { message: key } } });
    return key;
  }, fetch: async () => { calls++; return apiError(503); } });
  await failure(() => client.read('getDevices'), 'credentials');
  assert.equal(providers, 2); assert.equal(calls, 1);
});

test('cancellation during backoff prevents a subsequent provider or fetch', async () => {
  const controller = new AbortController();
  const f = scripted([() => { setTimeout(() => controller.abort(new Error(key)), 25); return apiError(503); }]);
  await failure(() => f.client.read('getDevices', undefined, { signal: controller.signal }), 'aborted', 503);
  await sleep(230);
  assert.equal(f.providers, 1); assert.equal(f.calls.length, 1);
});

test('one deadline spans first credentials, backoff and a stalled second credential lookup', async t => {
  const clock = controlledClock(t);
  let releaseFirst;
  const first = new Promise(resolve => { releaseFirst = resolve; });
  let providers = 0, calls = 0, finalSignal;
  const client = createReadPrototype({ timeoutMs: 280, credentials: async ({ signal }) => {
    providers++; finalSignal = signal;
    if (providers === 1) { await first; return key; }
    return new Promise(() => {});
  }, fetch: async () => { calls++; return apiError(503); } });
  const started = performance.now();
  const pending = failure(() => client.read('getDevices'), 'deadline');
  await phase(() => providers === 1);
  clock.tick(40); releaseFirst();
  await phase(() => clock.timers.some(timer => timer.milliseconds === 100));
  assert.equal(calls, 1); assert.equal(providers, 1);
  clock.tick(100);
  await phase(() => providers === 2);
  assert.equal(finalSignal.aborted, false);
  clock.tick(139);
  assert.equal(finalSignal.aborted, false, 'first credentials and backoff leave only one millisecond');
  clock.tick(1);
  await pending;
  assert.equal(performance.now() - started, 280);
  assert.equal(providers, 2); assert.equal(calls, 1); assert.equal(finalSignal.aborted, true);
});

test('expired monotonic budgets refuse late synchronous responses and completed JSON parsing', async t => {
  const clock = controlledClock(t);
  for (const status of [200, 204]) {
    const f = scripted([() => { clock.starve(40); return status === 204 ? new Response(null, { status }) : json({ late: true }); }], { timeoutMs: 20 });
    await failure(() => f.client.read('getDevices'), 'deadline', status);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].init.signal.aborted, true);
  }
  const parse = JSON.parse;
  t.mock.method(JSON, 'parse', (text, ...args) => { if (text === '{"slow":true}') clock.starve(40); return parse(text, ...args); });
  const f = scripted([() => json({ slow: true })], { timeoutMs: 20 });
  await failure(() => f.client.read('getDevices'), 'deadline', 200);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].init.signal.aborted, true);
  assert.equal(clock.timers.some(timer => timer.fired), false, 'deadline checks do not rely on a dispatched timer');
});

test('iterator retries a page without changing filters/cursor and scrubs credentials from prior pages', async () => {
  const keys = ['synthetic_page_one_key', 'synthetic_page_two_key', key];
  let count = 0;
  const urls = [];
  const client = createReadPrototype({ credentials: () => keys[count], fetch: async url => {
    urls.push(new URL(url)); count++;
    if (count === 1) return json({ data: [{ id: 'first' }], has_more: true, next_cursor: 'next_opaque' });
    return json({ error: { code: 'temporary', message: keys.join(' ') } }, 503);
  } });
  const iterator = client.pages('getDevices', { query: { end_user_id: 'wearer', limit: 1 } }, { maxRetries: 1 });
  assert.equal((await iterator.next()).value.data[0].id, 'first');
  await assert.rejects(() => iterator.next(), error => {
    for (const credential of keys) assert.ok(!error.apiMessage.includes(credential));
    return error.kind === 'http' && error.status === 503;
  });
  assert.equal(urls.length, 3); assert.equal(urls[1].href, urls[2].href);
  for (const url of urls) { assert.equal(url.searchParams.get('end_user_id'), 'wearer'); assert.equal(url.searchParams.get('limit'), '1'); }
  assert.equal(urls[1].searchParams.get('cursor'), 'next_opaque');
});

test('iterator consumer pauses consume the shared retry budget', async t => {
  const clock = controlledClock(t);
  let calls = 0;
  const client = createReadPrototype({ timeoutMs: 240, credentials: key, fetch: async () => {
    calls++;
    return calls === 1 ? json({ data: [], has_more: true, next_cursor: 'next' }) : apiError(503);
  } });
  const iterator = client.pages('getDevices');
  await iterator.next(); clock.tick(190);
  await failure(() => iterator.next(), 'http', 503);
  assert.equal(calls, 2, 'no remaining budget for the minimum retry wait');
  assert.equal(clock.now(), 190);
  assert.equal(clock.timers.some(timer => timer.milliseconds === 100), false, 'remaining 50ms cannot admit a 100ms retry wait');
  assert.equal(clock.timers.some(timer => timer.fired), false, 'consumer pause has not reached the outer deadline');
});

test('native loopback retry releases a failed body and never leaves its explicit origin', { timeout: 5000 }, async t => {
  let calls = 0, refusedClosed = false;
  const server = createServer((req, res) => {
    calls++;
    assert.equal(req.headers.authorization, `Bearer ${key}`);
    assert.equal(req.url, '/v1/devices?limit=1');
    if (calls === 1) {
      res.writeHead(503, { 'content-type': 'text/html', 'Retry-After': '0' });
      res.write('<html>'); res.on('close', () => { refusedClosed = true; });
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [], has_more: false }));
    }
  });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = createReadPrototype({ credentials: key, baseUrl: `http://127.0.0.1:${server.address().port}/v1`, allowLoopbackHttp: true });
  const result = await client.read('getDevices', { query: { limit: 1 } });
  assert.deepEqual(result.data, { data: [], has_more: false });
  assert.equal(calls, 2); assert.equal(refusedClosed, true);
});
