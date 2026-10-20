import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, mkdtemp, writeFile } from 'node:fs/promises';
import { basename, dirname, delimiter, isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const targets = new Set(['check', 'test', 'build']);
const repository = fileURLToPath(new URL('../', import.meta.url));

export function workspaceEnvironment(node, environment = process.env) {
  const allowed = new Set(['path', 'pathext', 'systemroot', 'systemdrive', 'windir', 'comspec', 'temp', 'tmp', 'os']);
  const result = Object.fromEntries(Object.entries(environment).filter(([key]) => allowed.has(key.toLowerCase())));
  const key = Object.keys(result).find(name => name.toLowerCase() === 'path') ?? 'PATH';
  result[key] = dirname(node) + delimiter + (result[key] ?? '');
  return result;
}

async function refuseConfiguration(path) {
  try { await lstat(path); assert.fail('project_npm_configuration_outside_workspace_command'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function runWorkspaceCommand(target, {
  npmExecPath = process.env.npm_execpath,
  directory = repository,
  environment = process.env,
  stdio = 'inherit',
} = {}) {
  assert.ok(targets.has(target), 'unsupported_workspace_target');
  assert.ok(typeof npmExecPath === 'string' && isAbsolute(npmExecPath) &&
    basename(npmExecPath) === 'npm-cli.js', 'explicit_parent_npm_cli_required');
  assert.ok((await lstat(npmExecPath)).isFile(), 'explicit_parent_npm_cli_required');
  await refuseConfiguration(join(directory, '.npmrc'));
  await refuseConfiguration(join(directory, 'packages/typescript/.npmrc'));
  const config = await mkdtemp(join(tmpdir(), 'bota-sdk-workspace-npm-'));
  const user = join(config, 'user.npmrc');
  const global = join(config, 'global.npmrc');
  await writeFile(user, '');
  await writeFile(global, '');
  const args = [npmExecPath, '--ignore-scripts', '--no-audit', '--no-fund', '--update-notifier=false',
    '--registry=https://registry.npmjs.org', '--userconfig', user, '--globalconfig', global,
    '--cache', join(config, 'cache')];
  const env = workspaceEnvironment(process.execPath, environment);
  const options = { cwd: directory, env, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 };
  const actual = execFileSync(process.execPath, [...args, '--version'], { ...options, timeout: 10000 }).trim();
  assert.equal(actual, '11.17.0', 'parent_npm_version_mismatch');
  // Invoke the verified CLI with the selected Node; never search PATH for npm.
  return execFileSync(process.execPath, [...args, 'run', target, '--workspace=@bota.dev/api-sdk'],
    { ...options, timeout: 120000, stdio });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 3, 'one_workspace_target_required');
    await runWorkspaceCommand(process.argv[2]);
  } catch {
    console.error('workspace-command: refused or failed the qualified workspace command.');
    process.exitCode = 1;
  }
}
