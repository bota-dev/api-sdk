import assert from 'node:assert/strict';

export function validateCorpus(corpus, policy) {
  assert.equal(corpus.version, 1);
  assert.equal(corpus.policy, 'ordinary-end-user-writes-v1');
  assert.equal(policy.cohort, corpus.policy);
  assert.equal(policy.attempts, 1);
  assert.equal(policy.automaticIdempotencyHeader, false);
  assert.equal(policy.automaticReconciliation, false);
  assert.deepEqual(policy.operations, ['postEndUsers', 'patchEndUsersById']);
  assert.deepEqual(policy.outcomes, ['not_submitted', 'unknown']);
  assert.deepEqual(policy.body, { root: 'object', maxDepth: 64, maxNodes: 100000, maxUtf8Bytes: 1048576,
    safeIntegralNumbers: true, wellFormedUnicode: true });
  assert.deepEqual(policy.successStatuses, { postEndUsers: 201, patchEndUsersById: 200 });
  assert.equal(policy.responseValidation, 'bounded-json-only');
  assert.equal(policy.reconciliation, 'caller-owned-explicit-read');
  assert.equal(corpus.cases.length, 36);
  assert.equal(new Set(corpus.cases.map(item => item.id)).size, corpus.cases.length);
  for (const item of corpus.cases) {
    assert.ok(item.id && item.input && item.expected);
    assert.ok(item.expected.dispatches === 0 || item.expected.dispatches === 1);
    assert.equal(item.expected.credentials, item.expected.dispatches);
    if (item.expected.result.kind) {
      assert.equal(item.expected.result.requestOutcome, item.expected.dispatches ? 'unknown' : 'not_submitted');
    } else {
      assert.equal(item.expected.dispatches, 1);
      assert.equal(item.expected.result.status, policy.successStatuses[item.operation]);
    }
  }
  for (const status of [400, 401, 403, 404, 409, 423, 425, 429, 500, 502, 503, 504])
    assert.ok(corpus.cases.some(item => item.response?.status === status && item.response.headers?.['Retry-After'] === '0' &&
      item.expected.result.kind === 'http' && item.expected.dispatches === 1), 'terminal_http_coverage');
  return corpus;
}
