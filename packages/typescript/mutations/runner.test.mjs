import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createReadPrototype, BotaMutationError } from '../runtime.ts';
import { validateCorpus } from './validate.mjs';

const corpus = JSON.parse(await readFile(new URL('./corpus.json', import.meta.url)));
const policy = JSON.parse(await readFile(new URL('./policy.json', import.meta.url)));
validateCorpus(corpus, policy);
const key = 'synthetic_shared_mutation_key';
for (const item of corpus.cases) test(`shared mutation: ${item.id}`, async () => {
  const calls = []; let credentials = 0;
  const client = createReadPrototype({ maxRetries: 2, credentials: () => { credentials++; return key; },
    fetch: async (url, init) => {
      calls.push({ url: new URL(url), init });
      if (item.transportFailure) throw Error('synthetic_transport_loss');
      const { status, body, headers = {} } = item.response;
      return new Response(status === 204 ? null : item.invalidJson ? '{broken' : JSON.stringify(body), {
        status, headers: { 'content-type': 'application/json', ...headers },
      });
    },
  });
  let actual;
  try { const result = await client.mutate(item.operation, item.input, item.options); actual = { status: result.status, data: result.data }; }
  catch (error) {
    assert.ok(error instanceof BotaMutationError);
    actual = { kind: error.kind, requestOutcome: error.requestOutcome, ...(error.status === undefined ? {} : { status: error.status }) };
    assert.ok(!JSON.stringify(error).includes(key));
  }
  assert.deepEqual(actual, item.expected.result);
  assert.equal(calls.length, item.expected.dispatches);
  assert.equal(credentials, item.expected.credentials);
  for (const { url, init } of calls) {
    assert.equal(init.method, item.operation === 'postEndUsers' ? 'POST' : 'PATCH');
    assert.equal(url.origin, 'https://api.bota.dev');
    assert.equal(url.pathname, `/v1/end-users${item.operation === 'patchEndUsersById' ? `/${encodeURIComponent(item.input.path.id)}` : ''}`);
    assert.deepEqual(JSON.parse(init.body), item.input.body);
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.headers.Authorization, `Bearer ${key}`);
    assert.ok(!Object.keys(init.headers).some(name => name.toLowerCase() === 'idempotency-key'));
  }
});
test('mutation corpus refuses duplicate cases, hidden retries and weakened terminal coverage', () => {
  for (const change of [{ attempts: 2 }, { automaticReconciliation: true }, { automaticIdempotencyHeader: true },
    { body: { ...policy.body, maxDepth: 999 } }, { outcomes: ['certain'] }, { responseValidation: 'off' }])
    assert.throws(() => validateCorpus(corpus, { ...policy, ...change }));
  const duplicate = structuredClone(corpus); duplicate.cases[1] = duplicate.cases[0];
  assert.throws(() => validateCorpus(duplicate, policy));
  const weakened = structuredClone(corpus); weakened.cases.find(item => item.id === 'http-503-one-attempt').expected.dispatches = 2;
  assert.throws(() => validateCorpus(weakened, policy));
});
