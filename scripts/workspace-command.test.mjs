import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runWorkspaceCommand, workspaceEnvironment } from './workspace-command.mjs';

async function fixture(version = '11.17.0') {
  const root = await mkdtemp(join(tmpdir(), 'bota-sdk-workspace-fixture-'));
  const tools = join(root, 'tools');
  await mkdir(tools);
  const npmExecPath = join(tools, 'npm-cli.js');
  await writeFile(npmExecPath, [
    "const fs = require('node:fs');",
    "const args = process.argv.slice(2);",
    "if (args.includes('--version')) { console.log(" + JSON.stringify(version) + "); }",
    "else {",
    "  const option = name => args[args.indexOf(name) + 1];",
    "  const marker = { args, cwd: process.cwd(), node: process.execPath,",
    "    env: Object.keys(process.env), user: fs.readFileSync(option('--userconfig'), 'utf8'),",
    "    global: fs.readFileSync(option('--globalconfig'), 'utf8'), cache: option('--cache') };",
    "  fs.writeFileSync('invocation.json', JSON.stringify(marker));",
    "  console.log(JSON.stringify(marker));",
    "}",
  ].join('\n'));
  return { directory: root, npmExecPath, stdio: 'pipe' };
}

test('workspace wrapper invokes its explicit parent CLI with the selected Node and scrubbed configuration', async () => {
  const options = await fixture();
  const environment = { ...process.env, SDK_WORKSPACE_CREDENTIAL_CANARY: 'synthetic',
    NODE_OPTIONS: '--inspect=0', NODE_AUTH_TOKEN: 'synthetic', npm_config_registry: 'https://private.invalid',
    HTTPS_PROXY: 'https://private.invalid' };
  for (const target of ['check', 'test', 'build']) {
    const result = JSON.parse(await runWorkspaceCommand(target, { ...options, environment }));
    assert.deepEqual(result.args.slice(-3), ['run', target, '--workspace=@bota.dev/api-sdk']);
    assert.equal(result.node, process.execPath);
    assert.equal(result.cwd, options.directory);
    assert.equal(result.user, ''); assert.equal(result.global, '');
    assert.ok(result.args.includes('--ignore-scripts'));
    assert.ok(result.args.includes('--registry=https://registry.npmjs.org'));
    assert.ok(!result.env.some(name => /canary|node_options|auth_token|npm_config_registry|https_proxy/i.test(name)));
    assert.ok(result.cache.includes('bota-sdk-workspace-npm-'));
  }
});

test('missing, relative and wrong-version parent npm never dispatch a workspace script', async () => {
  const options = await fixture('10.9.8');
  for (const npmExecPath of ['', 'npm', './npm-cli.js', options.npmExecPath]) {
    await assert.rejects(runWorkspaceCommand('check', { ...options, npmExecPath }));
  }
  assert.ok(!(await readdir(options.directory)).includes('invocation.json'));
  const missing = spawnSync(process.execPath, [fileURLToPath(new URL('./workspace-command.mjs', import.meta.url)), 'check'],
    { env: workspaceEnvironment(process.execPath), encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(missing.status, 1);
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /workspace-command: refused or failed/);
});

test('unsupported targets cannot reach even a valid parent CLI', async () => {
  const options = await fixture();
  for (const target of ['install', 'publish', 'test:licenses', 'check --evil', undefined]) {
    await assert.rejects(runWorkspaceCommand(target, options), /unsupported_workspace_target/);
  }
  assert.ok(!(await readdir(options.directory)).includes('invocation.json'));
});

test('root and package npm configuration refuse before dispatch', async () => {
  for (const name of ['.npmrc', 'packages/typescript/.npmrc']) {
    const options = await fixture();
    await mkdir(join(options.directory, 'packages/typescript'), { recursive: true });
    await writeFile(join(options.directory, name), 'synthetic-never-loaded');
    await assert.rejects(runWorkspaceCommand('check', options), /project_npm_configuration_outside_workspace_command/);
    assert.ok(!(await readdir(options.directory)).includes('invocation.json'));
  }
});

test('each invocation owns separate empty npm configuration and cache paths', async () => {
  const options = await fixture();
  await runWorkspaceCommand('check', options);
  const first = JSON.parse(await readFile(join(options.directory, 'invocation.json')));
  await runWorkspaceCommand('check', options);
  const second = JSON.parse(await readFile(join(options.directory, 'invocation.json')));
  assert.notEqual(first.cache, second.cache);
  const env = workspaceEnvironment(process.execPath, { PATH: '', SDK_WORKSPACE_CREDENTIAL_CANARY: 'synthetic' });
  assert.equal(env.SDK_WORKSPACE_CREDENTIAL_CANARY, undefined);
});
