import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkLicenses, licenseIsAdmitted } from './check-licenses.mjs';

const admitted = [
  'MIT', 'Apache-2.0 AND MIT', 'MIT OR GPL-3.0-only', 'GPL-3.0-only OR MIT',
  '(MIT OR CC0-1.0)', '(MIT OR GPL-3.0) AND Apache-2.0',
  'GPL-3.0 AND UNKNOWN OR MIT', 'MIT OR UNKNOWN', 'BSD-2-Clause AND ISC',
  'Python-2.0', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'BlueOak-1.0.0', 'Mit AND apache-2.0', '  MIT  ',
];
for (const expression of admitted) {
  test('admits reviewed license choice: ' + expression, () => {
    assert.equal(licenseIsAdmitted(expression), true);
  });
}
const refused = [
  'Apache-2.0 AND GPL-3.0-only', 'MIT AND (Apache-2.0 OR GPL-3.0) AND UNKNOWN',
  'UNKNOWN', 'Custom-License', 'UNLICENSED', '', null, undefined, {}, ['MIT'],
  'GPL-3.0 OR UNKNOWN', 'GPL-3.0 AND MIT', 'LGPL-2.1-only', 'AGPL-3.0-only',
  'SSPL-1.0', 'BUSL-1.1', 'MPL-2.0', 'EPL-2.0', 'CC-BY-NC-4.0',
  'MIT WITH Classpath-exception-2.0', 'MIT OR GPL-2.0 WITH Classpath-exception-2.0',
  'MIT XOR Apache-2.0', 'MIT and Apache-2.0', '(MIT', 'MIT)', '()',
  'MIT OR', 'OR MIT', 'MIT AND', 'MIT Apache-2.0', 'MIT OR (GPL-3.0 AND)',
  'MIT OR GPL-3.0++', 'MIT; Apache-2.0', 'MIT OR /unknown/',
  '('.repeat(34) + 'MIT' + ')'.repeat(34), 'MIT OR '.repeat(150) + 'MIT', ' '.repeat(4097),
];
for (const [index, expression] of refused.entries()) {
  test('refuses unapproved or malformed license expression ' + index, () => {
    assert.equal(licenseIsAdmitted(expression), false);
  });
}

async function fixture(license = 'MIT') {
  const root = await mkdtemp(join(tmpdir(), 'bota-sdk-locked-license-'));
  const workspace = join(root, 'packages/typescript');
  const dependency = join(root, 'node_modules/synthetic-dependency');
  await mkdir(workspace, { recursive: true });
  await mkdir(dependency, { recursive: true });
  await mkdir(join(root, 'node_modules/@bota.dev'));
  const manifest = { name: 'synthetic-sdk-workspace', version: '1.0.0', private: true, license: 'MIT',
    workspaces: ['packages/typescript'], devDependencies: { 'synthetic-dependency': '1.0.0' } };
  const packageManifest = { name: '@bota.dev/api-sdk', version: '0.0.0', private: true, license: 'MIT' };
  const installed = { name: 'synthetic-dependency', version: '1.0.0', private: true, license };
  const lock = { lockfileVersion: 3, packages: {
    '': { name: manifest.name, version: manifest.version, license: manifest.license,
      workspaces: manifest.workspaces, devDependencies: manifest.devDependencies },
    'packages/typescript': packageManifest,
    'node_modules/@bota.dev/api-sdk': { resolved: 'packages/typescript', link: true },
    'node_modules/synthetic-dependency': { version: '1.0.0', license,
      resolved: 'https://registry.npmjs.org/synthetic-dependency/-/synthetic-dependency-1.0.0.tgz',
      integrity: 'sha512-' + Buffer.alloc(64).toString('base64') },
  } };
  await writeFile(join(root, 'package.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock));
  await writeFile(join(workspace, 'package.json'), JSON.stringify(packageManifest));
  await writeFile(join(dependency, 'package.json'), JSON.stringify(installed));
  await symlink(workspace, join(root, 'node_modules/@bota.dev/api-sdk'), process.platform === 'win32' ? 'junction' : 'dir');
  return { root, workspace, dependency, lock, installed };
}
async function writeLock(value) {
  await writeFile(join(value.root, 'package-lock.json'), JSON.stringify(value.lock));
}

test('valid locked workspace includes private-package license metadata and both manifests', async () => {
  const value = await fixture('Apache-2.0 AND MIT');
  assert.deepEqual(await checkLicenses(value.root), { packages: 3 });
});

test('private metadata cannot bypass forbidden, unknown or missing license', async () => {
  for (const license of ['Apache-2.0 AND GPL-3.0', 'UNKNOWN', undefined]) {
    const value = await fixture(license);
    if (license === undefined) {
      delete value.installed.license;
      delete value.lock.packages['node_modules/synthetic-dependency'].license;
      await writeFile(join(value.dependency, 'package.json'), JSON.stringify(value.installed));
      await writeLock(value);
    }
    await assert.rejects(checkLicenses(value.root));
  }
});

test('installed version, license and root declaration mismatches all fail', async () => {
  for (const mutation of [
    value => { value.installed.version = '2.0.0'; },
    value => { value.installed.license = 'ISC'; },
    value => { value.lock.packages[''].devDependencies = { changed: '1.0.0' }; },
  ]) {
    const value = await fixture();
    mutation(value);
    await writeFile(join(value.dependency, 'package.json'), JSON.stringify(value.installed));
    await writeLock(value);
    await assert.rejects(checkLicenses(value.root));
  }
});

test('unlocked additions, missing locked packages and malformed metadata fail', async () => {
  const extra = await fixture();
  await mkdir(join(extra.root, 'node_modules/unlocked'));
  await writeFile(join(extra.root, 'node_modules/unlocked/package.json'), '{"name":"unlocked","license":"MIT"}');
  await assert.rejects(checkLicenses(extra.root), /unlocked_installed_package/);
  const missing = await fixture();
  await rm(join(missing.dependency, 'package.json'));
  await assert.rejects(checkLicenses(missing.root));
  const malformed = await fixture();
  await writeFile(join(malformed.dependency, 'package.json'), '{malformed');
  await assert.rejects(checkLicenses(malformed.root));
});

test('nonpublic lock entries and escaping lock paths fail', async () => {
  const privateRegistry = await fixture();
  privateRegistry.lock.packages['node_modules/synthetic-dependency'].resolved = 'https://private.example/dependency.tgz';
  await writeLock(privateRegistry);
  await assert.rejects(checkLicenses(privateRegistry.root), /nonpublic_registry_package/);
  const escaping = await fixture();
  escaping.lock.packages['../unowned'] = { license: 'MIT' };
  await writeLock(escaping);
  await assert.rejects(checkLicenses(escaping.root), /unsafe_lock_path/);
  const integrity = await fixture();
  integrity.lock.packages['node_modules/synthetic-dependency'].integrity = 'sha512-short';
  await writeLock(integrity);
  await assert.rejects(checkLicenses(integrity.root), /unbound_registry_package/);
});

test('missing root graph and absent lock fail closed at the CLI boundary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bota-sdk-no-license-graph-'));
  await assert.rejects(checkLicenses(root));
  const allowed = new Set(['path', 'pathext', 'systemroot', 'systemdrive', 'windir', 'comspec', 'temp', 'tmp', 'os']);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())));
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./check-licenses.mjs', import.meta.url)), '--root', root],
    { env, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /license-gate: failed/);
  assert.equal(child.stdout, '');
});

test('valid lock and workspace metadata cannot substitute for the missing installed graph', async () => {
  const value = await fixture();
  const root = await mkdtemp(join(tmpdir(), 'bota-sdk-missing-installed-'));
  await mkdir(join(root, 'packages/typescript'), { recursive: true });
  for (const name of ['package.json', 'package-lock.json', 'packages/typescript/package.json']) {
    await writeFile(join(root, name), await readFile(join(value.root, name)));
  }
  await assert.rejects(checkLicenses(root), { code: 'ENOENT' });
});

test('root lock and workspace licenses are independently checked', async () => {
  const value = await fixture();
  const manifest = JSON.parse(await readFile(join(value.workspace, 'package.json')));
  manifest.license = 'UNKNOWN';
  value.lock.packages['packages/typescript'].license = 'UNKNOWN';
  await writeFile(join(value.workspace, 'package.json'), JSON.stringify(manifest));
  await writeLock(value);
  await assert.rejects(checkLicenses(value.root), /license_not_admitted/);
});
