import { lockUrl, workspaceRoot, assertWorkspace, gitSource, workspaceHashes } from './workspace.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, readdir, lstat, copyFile } from 'node:fs/promises';
import { dirname, delimiter, resolve, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { childEnvironment, ownedPath, hash, json } from './package-policy.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const versions = { node22: 'v22.23.2', node24: 'v24.19.0' };

export function argumentsForCi(args) {
  const options = Object.create(null);
  for (let n = 0; n < args.length; n += 2) {
    const name = args[n];
    const value = args[n + 1];
    assert.ok(['--npm-cli', '--node22', '--node24'].includes(name) && value &&
      isAbsolute(value) && !options[name], 'explicit_absolute_ci_tool_paths_required');
    options[name] = resolve(value);
  }
  assert.equal(Object.keys(options).length, 3, 'explicit_absolute_ci_tool_paths_required');
  return options;
}

// npm run resolves bare "node" from PATH. Merely invoking npm-cli.js with an
// absolute Node 22 executable would otherwise run scripts under ambient Node 24.
export function environmentForNode(node) {
  assert.ok(isAbsolute(node), 'explicit_absolute_ci_tool_paths_required');
  const env = childEnvironment();
  const pathKey = Object.keys(env).find(name => name.toLowerCase() === 'path') ?? 'PATH';
  env[pathKey] = dirname(node) + delimiter + (env[pathKey] ?? '');
  return env;
}

export function assertPublicLock(lock) {
  assert.equal(lock.lockfileVersion, 3, 'unsupported_ci_lock');
  assert.ok(lock.packages && typeof lock.packages === 'object' &&
    !Array.isArray(lock.packages), 'invalid_ci_lock');
  assert.ok(lock.packages['packages/typescript'] && lock.packages['node_modules/@bota.dev/api-sdk'], 'missing_ci_workspace');
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (name === '') continue;
    if (name === 'packages/typescript') {
      assert.equal(entry.name, '@bota.dev/api-sdk', 'invalid_ci_workspace');
      assert.equal(entry.version, '0.1.0-beta.0', 'invalid_ci_workspace');
      assert.equal(entry.license, 'MIT', 'invalid_ci_workspace');
      continue;
    }
    if (name === 'node_modules/@bota.dev/api-sdk') {
      assert.deepEqual(entry, { resolved: 'packages/typescript', link: true }, 'invalid_ci_workspace_link');
      continue;
    }
    assert.ok(entry && typeof entry === 'object' && !entry.link, 'nonregistry_ci_dependency');
    assert.equal(typeof entry.resolved, 'string', 'nonregistry_ci_dependency');
    const url = new URL(entry.resolved);
    assert.ok(url.protocol === 'https:' && url.hostname === 'registry.npmjs.org' &&
      !url.port && !url.username && !url.password && !url.search && !url.hash &&
      url.pathname.endsWith('.tgz'), 'nonpublic_ci_dependency');
    assert.match(entry.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/, 'unpinned_ci_dependency');
  }
}

export async function assertNoProjectNpmConfig(directory) {
  try { await lstat(join(directory, '.npmrc')); assert.fail('project_npm_configuration_outside_ci_qualification'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function execute(node, args, cwd = root) {
  try {
    return execFileSync(node, args, { cwd, env: environmentForNode(node), encoding: 'utf8',
      windowsHide: true, timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    // Preserve the actual failing TAP/check output. Error inspection truncates
    // captured stdout and can otherwise hide the only failed case in CI logs.
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw Error('ci_child_check_failed', { cause: error });
  }
}

async function artifactDirectories(directory) {
  return new Set((await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.name.startsWith('qualification-') && entry.isDirectory() && !entry.isSymbolicLink())
    .map(entry => entry.name));
}

// Publish only the three fixed, already-qualified files from this invocation.
// Never upload checkout files, environment/configuration, or temporary consumers.
export async function stageQualificationArtifacts(source, destination) {
  const files = {
    'receipt.json': 'qualification-receipt.json',
    'consumer-package-lock.json': 'consumer-package-lock.json',
    'pack-0/bota.dev-api-sdk-0.1.0-beta.0.tgz': 'candidate.tgz',
  };
  for (const name of Object.keys(files)) {
    // Refuse links at every segment, including the verifier output directory.
    let current = source;
    assert.ok((await lstat(current)).isDirectory() && !(await lstat(current)).isSymbolicLink(), 'unsafe_ci_artifact');
    const parts = name.split('/');
    for (const [n, part] of parts.entries()) {
      current = join(current, part);
      const stat = await lstat(current);
      assert.ok(!stat.isSymbolicLink() && (n === parts.length - 1 ? stat.isFile() : stat.isDirectory()), 'unsafe_ci_artifact');
    }
  }
  const receipt = JSON.parse(await readFile(ownedPath(source, 'receipt.json')));
  assert.equal(receipt.status, 'beta-packed-consumers-not-publication');
  const archive = await readFile(ownedPath(source, 'pack-0/bota.dev-api-sdk-0.1.0-beta.0.tgz'));
  const lock = await readFile(ownedPath(source, 'consumer-package-lock.json'));
  assert.equal(hash(archive), receipt.tarball.sha256, 'ci_tarball_receipt_mismatch');
  assert.equal(hash(lock), receipt.consumerLockSha256, 'ci_consumer_lock_receipt_mismatch');
  const staged = {};
  for (const [name, target] of Object.entries(files)) {
    await copyFile(ownedPath(source, name), ownedPath(destination, target));
    staged[target] = hash(await readFile(ownedPath(destination, target)));
  }
  return staged;
}

async function main(args) {
  const tools = argumentsForCi(args);
  await assertWorkspace();
  await assertNoProjectNpmConfig(root);
  await assertNoProjectNpmConfig(workspaceRoot);
  const lockPath = lockUrl;
  const lockBytes = await readFile(lockPath);
  assertPublicLock(JSON.parse(lockBytes));
  const artifacts = ownedPath(root, '.package-artifacts');
  await mkdir(artifacts, { recursive: true });
  const artifactStat = await lstat(artifacts);
  assert.ok(artifactStat.isDirectory() && !artifactStat.isSymbolicLink(), 'unsafe_ci_artifact_root');
  const before = await artifactDirectories(artifacts);
  const config = await mkdtemp(join(tmpdir(), 'bota-sdk-ci-config-'));
  const user = join(config, 'user.npmrc');
  const global = join(config, 'global.npmrc');
  await writeFile(user, '');
  await writeFile(global, '');
  const npmFlags = ['--ignore-scripts', '--no-audit', '--no-fund', '--update-notifier=false',
    '--registry=https://registry.npmjs.org', '--userconfig', user, '--globalconfig', global,
    '--cache', join(config, 'cache')];
  const npm = (node, args, cwd = workspaceRoot) => execute(node, [tools['--npm-cli'], ...npmFlags, ...args], cwd);
  for (const [label, expected] of Object.entries(versions)) {
    const node = tools['--' + label];
    assert.equal(execute(node, ['--version']).trim(), expected, 'ci_node_version_mismatch');
    assert.equal(npm(node, ['--version']).trim(), '11.17.0', 'ci_npm_version_mismatch');
  }
  console.log(npm(tools['--node24'], ['ci']));
  assert.deepEqual(await readFile(lockPath), lockBytes, 'frozen_ci_lock_changed');
  for (const label of Object.keys(versions)) {
    const node = tools['--' + label];
    console.log('Qualifying beta source with ' + versions[label]);
    console.log(execute(node, ['--test', 'ci.test.mjs']));
    for (const script of ['check', 'test', 'build']) console.log(npm(node, ['run', script]));
  }
  console.log(npm(tools['--node24'], ['run', 'verify:package', '--workspace=@bota.dev/api-sdk', '--',
    '--npm-cli', tools['--npm-cli'], '--node22', tools['--node22'], '--node24', tools['--node24']]));
  assert.deepEqual(await readFile(lockPath), lockBytes, 'frozen_ci_lock_changed');
  const created = [...await artifactDirectories(artifacts)].filter(name => !before.has(name));
  assert.equal(created.length, 1, 'expected_one_fresh_qualification');
  const output = await mkdtemp(join(artifacts, 'ci-'));
  const staged = await stageQualificationArtifacts(ownedPath(root, '.package-artifacts/' + created[0]), output);
  const ciInputs = ['ci.mjs', 'ci.test.mjs', '../../.github/workflows/ci.yml'];
  const inputHashes = {};
  for (const file of ciInputs) inputHashes[file] = hash(await readFile(new URL(file, import.meta.url)));
  const receipt = { version: 1, status: 'beta-ci-qualification-not-publication',
    source: await gitSource(), workspaceFiles: await workspaceHashes(),
    nodes: Object.values(versions), npm: '11.17.0', npmCliSha256: hash(await readFile(tools['--npm-cli'])),
    dependencyScripts: false, dependencyRegistry: 'https://registry.npmjs.org',
    checksPerRuntime: ['ci-policy', 'check', 'test', 'build'], packedConsumers: true,
    ciInputs: inputHashes, artifacts: staged };
  await writeFile(ownedPath(output, 'ci-receipt.json'), json(receipt));
  console.log(json(receipt));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
