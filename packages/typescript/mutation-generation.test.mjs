import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { selectMutations, verifyMutationProjection } from './mutation-project.mjs';
import { mutationOperation } from './mutation-contract.ts';

const input = JSON.parse(await readFile(new URL('./mutation-input.json', import.meta.url)));
test('write projection rejects unsupported input obligations and success/replay drift', async () => {
  await verifyMutationProjection();
  for (const alter of [
    op => { op.requestBody.required = false; },
    op => { op.requestBody.content['application/json'].schema.type = 'array'; },
    op => { op.parameters = [{ in: 'query', name: 'required_new', required: true, schema: { type: 'string' } }]; },
    op => { op.parameters = [{ in: 'header', name: 'Required-Header', required: true, schema: { type: 'string' } }]; },
    op => { op.responses[202] = op.responses[201]; },
    op => { op.servers = [{ url: 'https://foreign.example/v1' }]; },
    op => { op['x-bota-write-contract'].automatic_retry = true; },
  ]) {
    const changed = structuredClone(input); alter(changed.paths['/end-users'].post);
    assert.throws(() => selectMutations(changed));
  }
  const changed = structuredClone(input); changed.paths['/end-users/{id}'].patch.parameters[0].required = false;
  assert.throws(() => selectMutations(changed), /mutation_parameters/);
});
test('operation descriptors are immutable and unsupported names gain no route', () => {
  const descriptor = mutationOperation('postEndUsers');
  assert.ok(Object.isFrozen(descriptor));
  assert.throws(() => { descriptor.path = '/foreign'; });
  assert.equal(mutationOperation('postEndUsers').path, '/end-users');
  assert.equal(mutationOperation('postDevices'), undefined);
});
