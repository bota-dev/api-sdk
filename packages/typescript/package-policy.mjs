import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

export const packageName = '@bota.dev/api-sdk';
export const emittedFiles = ['cohort.json', 'generated/operations.json', 'generated/provenance.json',
  'generated/runtime-provenance.json', 'generated/schema.d.ts', 'generated/client.js', 'generated/client.d.ts',
  'generated/client-methods.json', 'generated/client-provenance.json', 'input.json', 'runtime.d.ts', 'runtime.js', 'index.js', 'index.d.ts'];
export const compiledFiles = ['runtime.js', 'runtime.d.ts', 'index.js', 'index.d.ts', 'generated/client.js', 'generated/client.d.ts'];
export const packedFiles = ['LICENSE', 'README.md', 'package.json', 'dist/package-provenance.json', ...emittedFiles.map(name => `dist/${name}`)].sort();
export const buildInputs = ['runtime.ts', 'index.ts', 'generated/client.ts', 'generated/client-methods.json', 'generated/client-provenance.json',
  'generate-client.mjs', 'client-generation.mjs', 'client.test.mjs', 'client-consumer.ts', 'package.json', 'workspace.mjs', 'workspace.test.mjs', 'lineage.json', 'migration-provenance.mjs', 'generated/migration-provenance.json', 'LICENSE', 'README.md',
  'tsconfig.json', 'tsconfig.build.json', 'build-package.mjs', 'package-policy.mjs', 'check-licenses.mjs',
  'verify-package.mjs', 'package-consumer.mjs', 'package-consumer.ts', 'package-consumer-tsconfig.json',
  'package.test.mjs', 'cohort.json', 'input.json', 'generated/schema.d.ts', 'generated/operations.json',
  'generated/provenance.json', 'generated/runtime-provenance.json',
  'conformance/corpus.schema.json', 'conformance/corpus.json', 'conformance/policy.json',
  'conformance/validate.mjs', 'conformance/runner.test.mjs', 'conformance/provenance.mjs', 'conformance/provenance.json'];
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
export function childEnvironment() {
  const allowed = new Set(['path', 'pathext', 'systemroot', 'systemdrive', 'windir', 'comspec', 'temp', 'tmp', 'os']);
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())));
}
export function run(executable, args, cwd) {
  return execFileSync(executable, args, {
    cwd, env: childEnvironment(), encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024,
  });
}
export function assertManifest(manifest) {
  assert.equal(manifest.name, packageName);
  assert.equal(manifest.version, '0.1.0-beta.0');
  assert.equal(manifest.private, false);
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(manifest.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org' }, 'publication_destination_drift');
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.main, './dist/index.js');
  assert.equal(manifest.types, './dist/index.d.ts');
  assert.deepEqual(manifest.exports, { '.': { types: './dist/index.d.ts', import: './dist/index.js' } });
  assert.deepEqual(manifest.files, ['dist/', 'README.md', 'LICENSE']);
  assert.equal(manifest.bin, undefined);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.optionalDependencies, undefined);
  assert.equal(manifest.peerDependencies, undefined);
  assert.equal(manifest.bundledDependencies, undefined);
  for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepublish', 'prepublishOnly',
    'preprepare', 'prepare', 'postprepare', 'prepack', 'postpack', 'publish', 'postpublish']) {
    assert.equal(manifest.scripts?.[lifecycle], undefined, `lifecycle:${lifecycle}`);
  }
}
export function ownedPath(root, path) {
  assert.ok(typeof path === 'string' && path && !path.includes('\\') && !path.startsWith('/') &&
    !Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === ':') && path.split('/').every(part => part && part !== '.' && part !== '..'), 'unsafe_package_path');
  const absolute = resolve(root, path);
  const tail = relative(root, absolute);
  assert.ok(tail && tail !== '..' && !tail.startsWith(`..${sep}`) && !isAbsolute(tail), 'escaping_package_path');
  return absolute;
}
export async function assertExternalDirectory(workspace, directory) {
  const canonicalWorkspace = await realpath(workspace);
  const canonicalDirectory = await realpath(directory);
  const tail = relative(canonicalWorkspace, canonicalDirectory);
  assert.ok(tail === '..' || tail.startsWith(`..${sep}`) || isAbsolute(tail), 'consumer_must_be_outside_checkout');
}
export async function regularFiles(root) {
  const initial = await lstat(root);
  assert.ok(initial.isDirectory() && !initial.isSymbolicLink(), 'unsafe_artifact_directory');
  const files = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      const path = ownedPath(root, name);
      assert.equal(entry.isSymbolicLink(), false, 'symlink_in_artifact');
      if (entry.isDirectory()) await visit(path, `${name}/`);
      else { assert.ok(entry.isFile(), 'nonregular_artifact'); files.push(name); }
    }
  }
  await visit(root);
  return files.sort();
}
export async function fileHashes(root, names) {
  const hashes = {};
  for (const name of names) {
    const path = ownedPath(root, name);
    let parent = root;
    const parts = name.split('/');
    for (const [n, part] of parts.entries()) {
      parent = resolve(parent, part);
      const stat = await lstat(parent);
      assert.ok(!stat.isSymbolicLink() && (n === parts.length - 1 ? stat.isFile() : stat.isDirectory()), `nonregular_input:${name}`);
    }
    hashes[name] = hash(await readFile(path));
  }
  return hashes;
}
// npm's small fixed inventory uses ordinary USTAR files only. Refuse links,
// extensions, duplicate/escaping paths and malformed archives instead of extracting.
export function archiveFiles(compressed) {
  assert.ok(compressed.byteLength <= 4 * 1024 * 1024, 'archive_byte_limit');
  const bytes = gunzipSync(compressed, { maxOutputLength: 16 * 1024 * 1024 });
  const files = new Map();
  const octal = field => {
    const text = field.toString('ascii').replace(/[\0 ]+$/g, '').replace(/^ +/, '');
    assert.match(text, /^[0-7]+$/, 'invalid_tar_number');
    const value = parseInt(text, 8);
    assert.ok(Number.isSafeInteger(value), 'unsafe_tar_number');
    return value;
  };
  for (let offset = 0; ; ) {
    assert.ok(offset + 1024 <= bytes.length, 'missing_tar_terminator');
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(value => value === 0)) {
      assert.ok(bytes.subarray(offset).every(value => value === 0), 'nonzero_tar_trailer');
      return files;
    }
    let checksum = 0;
    for (let n = 0; n < 512; n++) checksum += n >= 148 && n < 156 ? 32 : header[n];
    assert.equal(octal(header.subarray(148, 156)), checksum, 'tar_checksum');
    const text = field => new TextDecoder('utf-8', { fatal: true }).decode(field.subarray(0, field.indexOf(0) < 0 ? field.length : field.indexOf(0)));
    const name = text(header.subarray(0, 100));
    assert.equal(text(header.subarray(345, 500)), '', 'tar_prefix_not_supported');
    assert.ok(header[156] === 0 || header[156] === 48, 'nonregular_tar_entry');
    assert.equal(text(header.subarray(157, 257)), '', 'tar_link_target');
    assert.match(name, /^package\//, 'invalid_tar_root');
    const path = name.slice(8);
    ownedPath(process.cwd(), path);
    assert.equal(files.has(path), false, 'duplicate_tar_path');
    const length = octal(header.subarray(124, 136));
    assert.ok(length <= 4 * 1024 * 1024 && offset + 512 + length <= bytes.length, 'tar_entry_limit');
    files.set(path, Buffer.from(bytes.subarray(offset + 512, offset + 512 + length)));
    offset += 512 + Math.ceil(length / 512) * 512;
  }
}
export function verifyArchive(bytes, expected) {
  const files = archiveFiles(bytes);
  assert.deepEqual([...files.keys()].sort(), packedFiles, 'packed_inventory');
  for (const [name, digest] of Object.entries(expected)) assert.equal(hash(files.get(name)), digest, `packed_bytes:${name}`);
  assertManifest(JSON.parse(files.get('package.json')));
  const provenance = JSON.parse(files.get('dist/package-provenance.json'));
  for (const [name, digest] of Object.entries(provenance.outputs)) {
    assert.ok(emittedFiles.includes(name), 'unrecognized_emitted_file');
    assert.equal(hash(files.get(`dist/${name}`)), digest, `emitted_bytes:${name}`);
  }
  assert.deepEqual(Object.keys(provenance.outputs).sort(), [...emittedFiles].sort());
  return { files, provenance };
}
