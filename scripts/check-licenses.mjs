#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately bounded SPDX subset, not a general SPDX validator or legal opinion.
// Unknown atoms grant no admitted branch; WITH/unknown operators are unsupported.
const permittedLicenses = new Set([
  'MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'Python-2.0', 'BlueOak-1.0.0',
].map(identifier => identifier.toUpperCase()));
const forbiddenFamilies = /^(?:A?GPL|LGPL|SSPL|BUSL|EUPL|CC-BY-NC|CC-BY-SA|OSL|EPL|MPL)(?:-|$)/i;

export function licenseIsAdmitted(expression) {
  if (typeof expression !== 'string' || !expression || expression.length > 4096) return false;
  const tokens = [];
  const token = /\s+|[()]|[A-Za-z0-9][A-Za-z0-9.-]*\+?/y;
  for (let offset = 0; offset < expression.length;) {
    token.lastIndex = offset;
    const match = token.exec(expression);
    if (!match || tokens.length >= 256) return false;
    offset = token.lastIndex;
    if (!/^\s+$/.test(match[0])) tokens.push(match[0]);
  }
  let position = 0;
  function atom(depth) {
    if (depth > 32) throw new Error('license_expression_depth');
    const current = tokens[position++];
    if (current === '(') {
      const value = or(depth + 1);
      if (tokens[position++] !== ')') throw new Error('license_expression_parentheses');
      return value;
    }
    if (!current || ['AND', 'OR', 'WITH', ')'].includes(current)) throw new Error('license_expression_atom');
    return !forbiddenFamilies.test(current) && permittedLicenses.has(current.toUpperCase());
  }
  function and(depth) {
    let value = atom(depth);
    while (tokens[position] === 'AND') {
      position++;
      const right = atom(depth); // Parse even a branch whose value cannot change the result.
      value = value && right;
    }
    return value;
  }
  function or(depth) {
    let value = and(depth);
    while (tokens[position] === 'OR') {
      position++;
      const right = and(depth);
      value = value || right;
    }
    return value;
  }
  try {
    const result = or(0);
    return position === tokens.length && result;
  } catch { return false; }
}

function owned(root, name) {
  assert.ok(typeof name === 'string' && name && !isAbsolute(name) &&
    !/[\\:*?[\]]/.test(name) && ![...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
    name.split('/').every(part => part && part !== '.' && part !== '..'), 'unsafe_lock_path');
  const path = resolve(root, name);
  const tail = relative(root, path);
  assert.ok(tail && tail !== '..' && !tail.startsWith('..' + sep) && !isAbsolute(tail), 'escaping_lock_path');
  return path;
}
async function metadata(path) {
  const stat = await lstat(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'nonregular_package_metadata');
  const value = JSON.parse(await readFile(path, 'utf8'));
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'invalid_package_metadata');
  return value;
}
function declaredManifest(manifest, locked) {
  for (const field of ['name', 'version', 'license']) {
    assert.equal(typeof manifest[field], 'string', 'invalid_package_metadata');
    assert.ok(manifest[field], 'invalid_package_metadata');
    assert.equal(manifest[field], locked[field], 'manifest_lock_metadata_mismatch');
  }
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'workspaces']) {
    assert.deepEqual(manifest[field], locked[field], 'manifest_lock_declarations_mismatch');
  }
  assert.ok(licenseIsAdmitted(manifest.license), 'license_not_admitted');
}
function publicRegistryEntry(entry) {
  assert.equal(typeof entry.resolved, 'string', 'unbound_registry_package');
  const url = new URL(entry.resolved);
  assert.ok(url.protocol === 'https:' && url.hostname === 'registry.npmjs.org' && !url.port &&
    !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith('.tgz'), 'nonpublic_registry_package');
  assert.match(entry.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/, 'unbound_registry_package');
  const integrity = entry.integrity.slice('sha512-'.length);
  const bytes = Buffer.from(integrity, 'base64');
  assert.ok(bytes.length === 64 && bytes.toString('base64') === integrity, 'unbound_registry_package');
}

export async function checkLicenses(directory) {
  const root = await realpath(resolve(directory));
  const manifest = await metadata(join(root, 'package.json'));
  const lock = await metadata(join(root, 'package-lock.json'));
  assert.equal(lock.lockfileVersion, 3, 'unsupported_lock_version');
  assert.ok(lock.packages && typeof lock.packages === 'object' && !Array.isArray(lock.packages), 'invalid_lock_packages');
  assert.ok(Object.hasOwn(lock.packages, ''), 'missing_lock_root');
  declaredManifest(manifest, lock.packages['']);
  assert.ok(Array.isArray(manifest.workspaces) && manifest.workspaces.length, 'missing_declared_workspace');
  const workspaces = new Set(manifest.workspaces);
  assert.equal(workspaces.size, manifest.workspaces.length, 'duplicate_workspace');
  for (const workspace of workspaces) owned(root, workspace);
  const expectedInstalled = new Set();
  const links = [];
  let count = 1;
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!name) continue;
    assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), 'invalid_lock_package');
    const path = owned(root, name);
    if (entry.link === true) {
      assert.ok(name.startsWith('node_modules/') && workspaces.has(entry.resolved), 'unapproved_workspace_link');
      links.push({ path, target: owned(root, entry.resolved) });
      expectedInstalled.add(path);
      continue;
    }
    const workspace = workspaces.has(name);
    assert.ok(workspace || name.startsWith('node_modules/') ||
      [...workspaces].some(item => name.startsWith(item + '/node_modules/')), 'unapproved_lock_package_path');
    const stat = await lstat(path);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && await realpath(path) === path, 'linked_registry_or_workspace_package');
    const installed = await metadata(join(path, 'package.json'));
    if (workspace) declaredManifest(installed, entry);
    else {
      publicRegistryEntry(entry);
      const expectedName = name.slice(name.lastIndexOf('node_modules/') + 'node_modules/'.length);
      assert.equal(installed.name, entry.name ?? expectedName, 'installed_package_name_mismatch');
      assert.ok(typeof installed.version === 'string' && installed.version &&
        typeof entry.version === 'string' && entry.version, 'invalid_package_version_metadata');
      assert.equal(installed.version, entry.version, 'installed_package_version_mismatch');
      assert.equal(typeof installed.license, 'string', 'missing_installed_license');
      assert.equal(installed.license, entry.license, 'installed_license_metadata_mismatch');
      assert.ok(licenseIsAdmitted(installed.license), 'license_not_admitted');
      expectedInstalled.add(path);
    }
    count++;
  }
  for (const workspace of workspaces) {
    assert.ok(Object.hasOwn(lock.packages, workspace), 'missing_locked_workspace');
    const path = owned(root, workspace);
    assert.ok(links.some(link => link.target === path), 'missing_installed_workspace_link');
  }
  for (const { path, target } of links) {
    assert.ok((await lstat(path)).isSymbolicLink() && await realpath(path) === target, 'workspace_link_target_mismatch');
  }
  assert.ok(expectedInstalled.size, 'missing_locked_dependency_graph');
  const visited = new Set();
  async function modules(path, required = false) {
    let stat;
    try { stat = await lstat(path); }
    catch (error) { if (!required && error.code === 'ENOENT') return; throw error; }
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'missing_or_linked_installed_graph');
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (['.bin', '.cache', '.package-lock.json'].includes(entry.name)) continue;
      const child = join(path, entry.name);
      if (entry.name.startsWith('@')) await modules(child, true);
      else {
        assert.ok(expectedInstalled.has(child), 'unlocked_installed_package');
        const canonical = await realpath(child);
        if (visited.has(canonical)) continue;
        visited.add(canonical);
        await modules(join(canonical, 'node_modules'));
      }
    }
  }
  await modules(join(root, 'node_modules'), true);
  for (const workspace of workspaces) await modules(join(owned(root, workspace), 'node_modules'));
  return { packages: count };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 0 || args.length === 2 && args[0] === '--root' && isAbsolute(args[1]), 'usage_license_gate_root');
    const result = await checkLicenses(args[1] ?? fileURLToPath(new URL('../', import.meta.url)));
    console.log('license-gate: ' + result.packages + ' locked manifests verified; no forbidden or unapproved license branch selected.');
  } catch (error) {
    // Filesystem/parser causes may contain arbitrary metadata. Report a bounded,
    // fixed diagnostic; source fixtures expose assertions directly for debugging.
    const reason = error instanceof assert.AssertionError ? error.message.split('\n', 1)[0] : 'graph_or_metadata_unavailable';
    console.error('license-gate: failed (' + reason + ')');
    process.exitCode = 1;
  }
}
