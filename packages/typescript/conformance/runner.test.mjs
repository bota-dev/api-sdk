import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createReadPrototype, ReadPrototypeError } from '../runtime.ts';
import { assertCorpus } from './validate.mjs';

const load = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const schema = await load('./corpus.schema.json');
const corpus = assertCorpus(schema, await load('./corpus.json'));

// Query serialization is language-specific: compare decoded UTF-8 pairs as a multiset.
// Opaque encoded paths remain exact, including escaped separators; do not decode them.
const semanticUrl = value => {
  const authority = value.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/)?.[1];
  assert.ok(authority !== undefined && !authority.includes('@'), 'userinfo_syntax_forbidden');
  assert.equal(value.includes('#'), false, 'fragment_syntax_forbidden');
  const url = new URL(value);
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.equal(url.hash, '');
  const compare = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  const query = [...url.searchParams].sort((a, b) => compare(a[0], b[0]) || compare(a[1], b[1]));
  return { origin: url.origin, pathname: url.pathname, query };
};

// The adapter has no native transport: every fetch must consume one explicit JSON script step.
// JSON fixture expectations are authoritative; generated operation metadata is not used as an oracle.
for (const fixture of corpus.cases) test(`neutral corpus: ${fixture.id}`, { timeout: 5000 }, async () => {
  const controller = new AbortController();
  const calls = [];
  const providers = [];
  let stepIndex = 0;
  const pages = [];
  let result;
  let failure;
  const credentials = fixture.credentials ?? ['synthetic_fixture_key'];
  const transport = async (url, options) => {
    const headers = Object.fromEntries(new Headers(options.headers));
    calls.push({ url: url.href, credential: headers.authorization?.slice('Bearer '.length) });
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(headers.accept, 'application/json');
    assert.equal(headers.authorization, `Bearer ${credentials[calls.length - 1]}`);
    assert.deepEqual(Object.keys(headers).sort(), ['accept', 'authorization']);
    assert.ok(options.signal instanceof AbortSignal);
    const step = fixture.script[stepIndex++];
    assert.ok(step, 'unexpected extra fetch');
    if (step.type === 'transport') throw Error(step.message ?? 'synthetic transport fault');
    if (step.type === 'cancel_fetch') {
      controller.abort('synthetic cancellation');
      return await new Promise(() => {});
    }
    let body;
    if (Object.hasOwn(step, 'body')) body = step.status === 204 ? null : JSON.stringify(step.body);
    else if (Object.hasOwn(step, 'bodyText')) body = step.bodyText;
    else if (Object.hasOwn(step, 'bodyBytes')) body = new Uint8Array(step.bodyBytes);
    else body = new ReadableStream({ pull() {
      if (step.bodyFault === 'cancel') { controller.abort('synthetic body cancellation'); return; }
      throw Error('synthetic body transport fault');
    } }, { highWaterMark: 0 });
    const response = new Response(body, { status: step.status, headers: step.headers ?? { 'content-type': 'application/json' } });
    if (step.url !== undefined) Object.defineProperty(response, 'url', { value: step.url });
    if (step.redirected !== undefined) Object.defineProperty(response, 'redirected', { value: step.redirected });
    return response;
  };
  try {
    const client = createReadPrototype({
      ...fixture.invoke.client,
      credentials: context => {
        providers.push({ baseUrl: context.baseUrl, signal: context.signal });
        assert.ok(context.signal instanceof AbortSignal);
        assert.equal(context.signal.aborted, false);
        assert.ok(providers.length <= credentials.length, 'unexpected extra credential request');
        return credentials[providers.length - 1];
      },
      fetch: transport,
    });
    if (fixture.invoke.cancelAt === 'pre_request') controller.abort('synthetic cancellation');
    const options = fixture.invoke.options === undefined ? { signal: controller.signal } :
      fixture.invoke.options === null || typeof fixture.invoke.options !== 'object' || Array.isArray(fixture.invoke.options)
        ? fixture.invoke.options : { ...fixture.invoke.options, signal: controller.signal };
    if (fixture.invoke.mode === 'read') result = await client.read(fixture.invoke.operationId, fixture.invoke.input, options);
    else {
      for await (const page of client.pages(fixture.invoke.operationId, fixture.invoke.input, options)) {
        pages.push(page);
        if (fixture.invoke.stopAfterPages === pages.length) break;
      }
    }
  } catch (error) { failure = error; }
  const normalizedCall = entry => ({ url: semanticUrl(entry.url), credential: entry.credential });
  assert.deepEqual(calls.map(normalizedCall), fixture.expect.calls.map(normalizedCall));
  // Within one runtime, retrying the same semantic target must keep the exact URL bytes.
  const attempts = new Map();
  for (const entry of calls) {
    const target = JSON.stringify(semanticUrl(entry.url));
    if (attempts.has(target)) assert.equal(entry.url, attempts.get(target));
    else attempts.set(target, entry.url);
  }
  assert.equal(providers.length, fixture.expect.credentialCalls);
  assert.equal(stepIndex, fixture.script.length, 'unused scripted response');
  if (Object.hasOwn(fixture.expect, 'pages')) assert.deepEqual(pages, fixture.expect.pages);
  if (fixture.expect.error) {
    assert.ok(failure instanceof ReadPrototypeError, failure?.stack);
    const normalized = {};
    for (const key of ['kind', 'status', 'body', 'code', 'param', 'requestId', 'apiMessage']) {
      if (failure[key] !== undefined) normalized[key] = failure[key];
    }
    normalized.headers = { ...failure.headers };
    assert.deepEqual(normalized, fixture.expect.error);
    assert.equal(Object.getOwnPropertyDescriptor(failure, 'body').enumerable, false);
    assert.equal(Object.getOwnPropertyDescriptor(failure, 'apiMessage').enumerable, false);
    assert.equal(Object.hasOwn(failure, 'cause'), false);
    assert.ok(Object.isFrozen(failure.headers));
    for (const secret of fixture.expect.absentSecrets ?? []) {
      const visible = JSON.stringify({ message: failure.message, ...normalized });
      assert.equal(visible.includes(secret), false, 'error retained synthetic secret');
      assert.equal(visible.includes(encodeURIComponent(secret)), false, 'error retained encoded synthetic secret');
    }
  } else {
    assert.equal(failure, undefined, failure?.stack);
    if (fixture.expect.result) {
      const normalized = { status: result.status, headers: { ...result.headers } };
      if (result.data !== undefined) normalized.data = result.data;
      assert.deepEqual(normalized, fixture.expect.result);
      assert.ok(Object.isFrozen(result.headers));
    }
  }
});

test('neutral URL comparison allows query serialization differences without losing values or duplicates', () => {
  assert.deepEqual(semanticUrl('https://fixture.test/v1/devices?name=hello+world&x=%7E&x=%2B'),
    semanticUrl('https://fixture.test/v1/devices?x=%2B&x=~&name=hello%20world'));
  assert.notDeepEqual(semanticUrl('https://fixture.test/v1/devices?x=1&x=1'),
    semanticUrl('https://fixture.test/v1/devices?x=1'));
  assert.notDeepEqual(semanticUrl('https://fixture.test/v1/devices?x=%2B'),
    semanticUrl('https://fixture.test/v1/devices?x=+'));
  assert.notDeepEqual(semanticUrl('https://fixture.test/v1/devices/a%2Fb'),
    semanticUrl('https://fixture.test/v1/devices/a/b'));
  assert.throws(() => semanticUrl('https://user@fixture.test/v1/devices'));
  assert.throws(() => semanticUrl('https://@fixture.test/v1/devices'));
  assert.throws(() => semanticUrl('https://fixture.test/v1/devices#fragment'));
  assert.throws(() => semanticUrl('https://fixture.test/v1/devices#'));
});

test('neutral corpus validator refuses drift and ambiguous fixtures', () => {
  const invalid = mutate => { const copy = structuredClone(corpus); mutate(copy); assert.throws(() => assertCorpus(schema, copy)); };
  invalid(copy => { copy.extra = true; });
  invalid(copy => { copy.cases.push(copy.cases[0]); });
  invalid(copy => { copy.cases[0].script[0].typo = true; });
  invalid(copy => { copy.cases[0].script[0].bodyText = '{}'; });
  invalid(copy => { copy.cases[0].expect.error = { kind: 'http', headers: {} }; });
  invalid(copy => { copy.cases[0].invoke.mode = 'unknown'; });
  invalid(copy => { copy.cases[0].expect.calls[0].unexpected = true; });
  invalid(copy => { copy.cases[0].expect.calls.push(copy.cases[0].expect.calls[0]); });
  assert.throws(() => assertCorpus({ ...schema, unexpectedKeyword: true }, corpus));
});
