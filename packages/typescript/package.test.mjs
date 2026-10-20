import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveFiles, ownedPath, assertManifest, assertExternalDirectory, childEnvironment, packedFiles, emittedFiles, verifyArchive, hash } from './package-policy.mjs';

test('consumer qualification refuses checkout descendants and symlinked temporary roots', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'bota-sdk-consumer-boundary-'));
  const workspace = join(temp, 'workspace');
  const nested = join(workspace, 'packages', 'consumer');
  const misleading = join(workspace, '..looks-outside');
  const external = join(temp, 'consumer');
  for (const directory of [nested, misleading, external]) await mkdir(directory, { recursive: true });
  await assertExternalDirectory(workspace, external);
  await assert.rejects(assertExternalDirectory(workspace, workspace), /consumer_must_be_outside_checkout/);
  await assert.rejects(assertExternalDirectory(workspace, nested), /consumer_must_be_outside_checkout/);
  await assert.rejects(assertExternalDirectory(workspace, misleading), /consumer_must_be_outside_checkout/);
  const linked = join(temp, 'linked');
  await symlink(nested, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assertExternalDirectory(workspace, linked), /consumer_must_be_outside_checkout/);
});

function tar(entries) {
  const chunks = [];
  for (const { name, content = 'fixture', type = '0', target = '' } of entries) {
    const body = Buffer.from(content); const header = Buffer.alloc(512);
    header.write(name, 0, 100); header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124); header.write('00000000000\0', 136);
    header.fill(32, 148, 156); header.write(type, 156); header.write(target, 157, 100); header.write('ustar\0', 257);
    const checksum = header.reduce((sum, value) => sum + value, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
    chunks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}

test('archive inspection preserves bytes and refuses links, escaping paths, duplicates and extension records', () => {
  assert.equal(archiveFiles(gzipSync(tar([{ name: 'package/dist/runtime.js', content: 'export const fixture = true;' }]))).get('dist/runtime.js').toString(), 'export const fixture = true;');
  for (const entry of [
    { name: 'package/../escape' }, { name: 'package/./escape' }, { name: 'package//escape' },
    { name: '/package/escape' }, { name: 'package/C:/escape' }, { name: 'package/dist\\escape' },
    { name: 'package/dist/link', type: '2', target: '../../outside' }, { name: 'package/hard', type: '1' },
    { name: 'package/pax', type: 'x' }, { name: 'package/directory', type: '5' },
  ]) assert.throws(() => archiveFiles(gzipSync(tar([entry]))));
  assert.throws(() => archiveFiles(gzipSync(tar([{ name: 'package/a' }, { name: 'package/a' }]))), /duplicate_tar_path/);
});

test('archive inspection rejects corrupted, truncated and excessive input before extraction', () => {
  const bytes = tar([{ name: 'package/dist/runtime.js' }]); bytes[0] = 0;
  assert.throws(() => archiveFiles(gzipSync(bytes)), /tar_checksum/);
  assert.throws(() => archiveFiles(gzipSync(Buffer.alloc(512))), /missing_tar_terminator/);
  assert.throws(() => archiveFiles(Buffer.alloc(4 * 1024 * 1024 + 1)), /archive_byte_limit/);
  assert.throws(() => archiveFiles(gzipSync(Buffer.alloc(16 * 1024 * 1024 + 1))));
});

test('beta manifest and child environment refuse package drift, broad exports and inherited credentials', () => {
  const valid = { name: '@bota.dev/api-sdk', version: '0.1.0-beta.0', private: false, license: 'MIT', type: 'module',
    publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' },
    main: './dist/index.js', types: './dist/index.d.ts', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } }, files: ['dist/', 'README.md', 'LICENSE'] };
  assertManifest(valid);
  for (const changed of [{ private: true }, { license: 'UNLICENSED' }, { name: 'unapproved' }, { version: '1.0.0' },
    { exports: { './*': './*' } }, { files: ['.'] }, { dependencies: { surprise: '1.0.0' } }, { scripts: { prepare: 'arbitrary' } }]) {
    assert.throws(() => assertManifest({ ...valid, ...changed }));
  }
  for (const publishConfig of [undefined, {}, { access: 'restricted', registry: 'https://registry.npmjs.org' },
    { access: 'public', registry: 'https://private.example' },
    { access: 'public', registry: 'https://token@registry.npmjs.org' },
    { access: 'public', registry: 'https://registry.npmjs.org', tag: 'latest' }]) {
    assert.throws(() => assertManifest({ ...valid, publishConfig }), /publication_destination_drift/);
  }
  for (const name of ['../escape', '/absolute', 'C:/absolute', 'a\\b', 'a/./b', 'a//b']) assert.throws(() => ownedPath(process.cwd(), name));
  const env = childEnvironment();
  for (const name of Object.keys(env)) assert.ok(['path', 'pathext', 'systemroot', 'systemdrive', 'windir', 'comspec', 'temp', 'tmp', 'os'].includes(name.toLowerCase()));
  for (const name of ['NODE_OPTIONS', 'NODE_PATH', 'BOTA_API_KEY', 'NPM_TOKEN', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NODE_USE_ENV_PROXY']) assert.equal(env[name], undefined);
});

test('packed inventory and embedded output provenance refuse altered JS, metadata, missing and extra files', () => {
  const manifest = { name: '@bota.dev/api-sdk', version: '0.1.0-beta.0', private: false, license: 'MIT', type: 'module',
    publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' },
    main: './dist/index.js', types: './dist/index.d.ts', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } }, files: ['dist/', 'README.md', 'LICENSE'] };
  const contents = Object.fromEntries(packedFiles.map(name => [name, `fixture:${name}`]));
  contents['package.json'] = JSON.stringify(manifest);
  const outputs = Object.fromEntries(emittedFiles.map(name => [name, hash(contents[`dist/${name}`])]));
  contents['dist/package-provenance.json'] = JSON.stringify({ outputs });
  const expected = Object.fromEntries(Object.entries(contents).map(([name, value]) => [name, hash(value)]));
  const pack = values => gzipSync(tar(Object.entries(values).map(([name, content]) => ({ name: `package/${name}`, content }))));
  verifyArchive(pack(contents), expected);
  assert.throws(() => verifyArchive(pack({ ...contents, 'dist/runtime.js': 'changed' }), expected), /packed_bytes/);
  assert.throws(() => verifyArchive(pack({ ...contents, 'dist/unapproved.js': 'extra' }), expected), /packed_inventory/);
  const missing = { ...contents }; delete missing['dist/cohort.json'];
  assert.throws(() => verifyArchive(pack(missing), expected), /packed_inventory/);
  const altered = { ...contents, 'dist/package-provenance.json': JSON.stringify({ outputs: { ...outputs, 'runtime.js': 'wrong' } }) };
  const alteredExpected = Object.fromEntries(Object.entries(altered).map(([name, value]) => [name, hash(value)]));
  assert.throws(() => verifyArchive(pack(altered), alteredExpected), /emitted_bytes/);
});
