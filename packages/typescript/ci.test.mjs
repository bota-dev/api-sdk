import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';
import { argumentsForCi, environmentForNode, assertPublicLock, assertNoProjectNpmConfig, stageQualificationArtifacts } from './ci.mjs';
import { hash, json } from './package-policy.mjs';

test('CI requires three explicit absolute tool paths and rejects duplicate/unknown arguments', () => {
  const path = process.execPath;
  assert.equal(argumentsForCi(['--node22', path, '--node24', path, '--npm-cli', path])['--node22'], path);
  for (const args of [[], ['--node22', path], ['--node22', 'relative'],
    ['--node22', path, '--node22', path, '--node24', path, '--npm-cli', path],
    ['--node22', path, '--node24', path, '--npm-cli', path, '--token', 'synthetic']]) {
    assert.throws(() => argumentsForCi(args));
  }
});

test('selected runtime wins PATH while credentials, proxies and Node injection are excluded', () => {
  const original = process.env.SDK_CI_CREDENTIAL_CANARY;
  process.env.SDK_CI_CREDENTIAL_CANARY = 'synthetic-do-not-forward';
  try {
    const env = environmentForNode(process.execPath);
    const pathKey = Object.keys(env).find(name => name.toLowerCase() === 'path');
    assert.equal(env[pathKey].split(delimiter)[0], dirname(process.execPath));
    assert.equal(env.SDK_CI_CREDENTIAL_CANARY, undefined);
    assert.ok(Object.keys(env).every(name => ['path', 'pathext', 'systemroot', 'systemdrive',
      'windir', 'comspec', 'temp', 'tmp', 'os'].includes(name.toLowerCase())));
    assert.equal(execFileSync('node', ['-p', 'process.env.SDK_CI_CREDENTIAL_CANARY ?? process.version'],
      { env, encoding: 'utf8', windowsHide: true }).trim(), process.version);
  } finally {
    if (original === undefined) delete process.env.SDK_CI_CREDENTIAL_CANARY;
    else process.env.SDK_CI_CREDENTIAL_CANARY = original;
  }
});

test('frozen CI dependencies require public HTTPS registry archives with integrity', () => {
  const dependency = { resolved: 'https://registry.npmjs.org/tool/-/tool-1.0.0.tgz', integrity: 'sha512-c3ludGhldGlj' };
  const lock = entry => ({ lockfileVersion: 3, packages: { '': {}, 'packages/typescript': { name: '@bota.dev/api-sdk', version: '0.1.0-beta.0', license: 'MIT' }, 'node_modules/@bota.dev/api-sdk': { resolved: 'packages/typescript', link: true }, 'node_modules/tool': entry } });
  assertPublicLock(lock(dependency));
  for (const resolved of ['file:../tool', 'git+https://github.com/example/tool.git',
    'https://private.example/tool.tgz', 'http://registry.npmjs.org/tool.tgz',
    'https://token@registry.npmjs.org/tool.tgz', 'https://registry.npmjs.org/tool.tgz?token=x',
    'https://registry.npmjs.org/tool.tgz#fragment']) {
    assert.throws(() => assertPublicLock(lock({ ...dependency, resolved })));
  }
  for (const entry of [{ ...dependency, link: true }, { ...dependency, integrity: '' },
    { ...dependency, resolved: undefined }]) assert.throws(() => assertPublicLock(lock(entry)));
});

test('project npm configuration is refused before dependency installation', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'bota-sdk-ci-config-policy-'));
  await assertNoProjectNpmConfig(temporary);
  await writeFile(join(temporary, '.npmrc'), 'synthetic-never-read');
  await assert.rejects(assertNoProjectNpmConfig(temporary), /project_npm_configuration_outside_ci_qualification/);
});

test('CI artifacts stage only fixed verifier outputs with matching tarball and lock digests', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'bota-sdk-ci-policy-'));
  const source = join(temporary, 'qualification');
  const destination = join(temporary, 'upload');
  await mkdir(join(source, 'pack-0'), { recursive: true });
  await mkdir(destination);
  const archive = Buffer.from('synthetic archive already qualified by verifier');
  const lock = Buffer.from('synthetic frozen lock');
  const receipt = { status: 'beta-packed-consumers-not-publication',
    tarball: { sha256: hash(archive) }, consumerLockSha256: hash(lock) };
  await writeFile(join(source, 'receipt.json'), json(receipt));
  await writeFile(join(source, 'consumer-package-lock.json'), lock);
  await writeFile(join(source, 'pack-0/bota.dev-api-sdk-0.1.0-beta.0.tgz'), archive);
  await writeFile(join(source, 'unrelated-secret.txt'), 'synthetic never-upload');
  const staged = await stageQualificationArtifacts(source, destination);
  assert.deepEqual((await readdir(destination)).sort(), ['candidate.tgz', 'consumer-package-lock.json', 'qualification-receipt.json']);
  assert.equal(staged['candidate.tgz'], hash(archive));
  assert.deepEqual(await readFile(join(destination, 'candidate.tgz')), archive);
  await writeFile(join(source, 'pack-0/bota.dev-api-sdk-0.1.0-beta.0.tgz'), 'tampered');
  await assert.rejects(stageQualificationArtifacts(source, destination), /ci_tarball_receipt_mismatch/);
  await writeFile(join(source, 'pack-0/bota.dev-api-sdk-0.1.0-beta.0.tgz'), archive);
  await writeFile(join(source, 'consumer-package-lock.json'), 'tampered');
  await assert.rejects(stageQualificationArtifacts(source, destination), /ci_consumer_lock_receipt_mismatch/);
});

test('artifact staging refuses a linked archive directory before copying anything', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'bota-sdk-ci-links-'));
  const source = join(temporary, 'qualification');
  const destination = join(temporary, 'upload');
  const actual = join(temporary, 'actual-pack');
  await mkdir(source);
  await mkdir(destination);
  await mkdir(actual);
  await writeFile(join(source, 'receipt.json'), '{}');
  await writeFile(join(source, 'consumer-package-lock.json'), '{}');
  await writeFile(join(actual, 'bota.dev-api-sdk-0.1.0-beta.0.tgz'), 'synthetic-linked');
  await symlink(actual, join(source, 'pack-0'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(stageQualificationArtifacts(source, destination), /unsafe_ci_artifact/);
  assert.deepEqual(await readdir(destination), []);
});
