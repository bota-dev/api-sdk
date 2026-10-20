import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitSource, workspaceRoot, workspaceHashes, assertWorkspace, lockUrl } from './workspace.mjs';
import { run, hash } from './package-policy.mjs';
import { assertPublicLock } from './ci.mjs';

test('workspace inputs bind the root lock, MIT license and checked workspace link', async () => {
  await assertWorkspace();
  const bytes = await readFile(lockUrl);
  const hashes = await workspaceHashes();
  assert.equal(hashes['package-lock.json'], hash(bytes));
  const lock = JSON.parse(bytes);
  assertPublicLock(lock);
  const target = 'node_modules/@bota.dev/api-sdk';
  for (const entry of [{ resolved: '../foreign', link: true }, { resolved: 'packages/typescript', link: true, integrity: 'ambiguous' }, { resolved: 'packages/typescript' }]) {
    const changed = structuredClone(lock); changed.packages[target] = entry;
    assert.throws(() => assertPublicLock(changed), /invalid_ci_workspace_link/);
  }
  const unexpected = structuredClone(lock);
  unexpected.packages['node_modules/foreign'] = { resolved: 'packages/typescript', link: true };
  assert.throws(() => assertPublicLock(unexpected), /nonregistry_ci_dependency/);
  const missing = structuredClone(lock); delete missing.packages['packages/typescript'];
  assert.throws(() => assertPublicLock(missing), /missing_ci_workspace/);
});

test('Git source identifies unborn repositories honestly and refuses wrapper fallback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bota-sdk-unborn-'));
  run('git', ['init', '--initial-branch=main'], directory);
  assert.deepEqual(await gitSource(directory), { commit: null, dirty: true, state: 'unborn' });
  const nested = join(directory, 'nested'); await mkdir(nested);
  await assert.rejects(gitSource(nested), /wrong_git_workspace/);
  const source = await gitSource();
  assert.ok(source.state === 'unborn' || source.state === 'committed');
  if (source.state === 'unborn') assert.equal(source.commit, null);
  else assert.match(source.commit, /^[a-f0-9]{40}$/);
  assert.notEqual(source.commit, 'b2541c789f83b8bbc5510244dd803a2284197982');
  assert.ok(workspaceRoot.endsWith('api-sdk/') || workspaceRoot.endsWith('api-sdk\\'));
});
