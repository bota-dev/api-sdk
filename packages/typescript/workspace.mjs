import assert from 'node:assert/strict';
import { readFile, realpath, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const packageRoot = fileURLToPath(new URL('./', import.meta.url));
export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
export const lockUrl = new URL('../../package-lock.json', import.meta.url);
export const compilerPath = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
export const workspaceInputs = ['package.json', 'package-lock.json', 'LICENSE', 'scripts/check-licenses.mjs', 'scripts/check-licenses.test.mjs',
  'scripts/workspace-command.mjs', 'scripts/workspace-command.test.mjs', 'eslint.config.js'];
export async function workspaceHashes() {
  const values = {};
  assert.ok((await lstat(workspaceRoot)).isDirectory() && !(await lstat(workspaceRoot)).isSymbolicLink(), 'unsafe_workspace_root');
  for (const file of workspaceInputs) {
    const parts = file.split('/');
    let current = workspaceRoot;
    for (const [n, part] of parts.entries()) {
      current = resolve(current, part);
      const stat = await lstat(current);
      assert.ok(!stat.isSymbolicLink() && (n === parts.length - 1 ? stat.isFile() : stat.isDirectory()), 'unsafe_workspace_input');
    }
    values[file] = createHash('sha256').update(await readFile(current)).digest('hex');
  }
  return values;
}
export async function assertWorkspace() {
  const root = JSON.parse(await readFile(new URL('../../package.json', import.meta.url)));
  assert.equal(root.name, 'bota-api-sdk-workspace');
  assert.equal(root.private, true);
  assert.deepEqual(root.workspaces, ['packages/typescript']);
  assert.equal(root.license, 'MIT');
  assert.equal(root.packageManager, 'npm@11.17.0');
  assert.deepEqual(await readFile(new URL('./LICENSE', import.meta.url)), await readFile(new URL('../../LICENSE', import.meta.url)), 'workspace_license_mismatch');
}
export async function gitSource(directory = workspaceRoot) {
  const allowed = new Set(['path', 'pathext', 'systemroot', 'systemdrive', 'windir', 'comspec', 'temp', 'tmp', 'os']);
  const options = { cwd: directory, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase()))), encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], options).trim();
  assert.equal(await realpath(resolve(top)), await realpath(resolve(directory)), 'wrong_git_workspace');
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], options).trim().length !== 0;
  let commit;
  try { commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], options).trim(); }
  catch (error) {
    const ref = execFileSync('git', ['symbolic-ref', '-q', 'HEAD'], options).trim();
    assert.match(ref, /^refs\/heads\/[A-Za-z0-9/_-]+$/);
    try { execFileSync('git', ['show-ref', '--verify', '--quiet', ref], options); }
    catch (missing) {
      if (missing.status === 1 && error.status === 128) return { commit: null, dirty: true, state: 'unborn' };
      throw error;
    }
    throw error;
  }
  assert.match(commit, /^[a-f0-9]{40}$/);
  return { commit, dirty, state: 'committed' };
}
