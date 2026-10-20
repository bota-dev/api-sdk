import { compilerPath, workspaceRoot, assertWorkspace } from './workspace.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, realpath, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { packageName, packedFiles, assertManifest, assertExternalDirectory, regularFiles, fileHashes, ownedPath, run, verifyArchive, hash, json } from './package-policy.mjs';

const options = Object.create(null);
for (let n = 2; n < process.argv.length; n += 2) {
  const name = process.argv[n]; const value = process.argv[n + 1];
  assert.ok(['--npm-cli', '--node22', '--node24'].includes(name) && value && isAbsolute(value) && !options[name], 'usage: node verify-package.mjs --npm-cli PATH --node22 PATH --node24 PATH');
  options[name] = resolve(value);
}
assert.equal(Object.keys(options).length, 3, 'explicit npm11 and Node22/24 paths are required');
await assertWorkspace();
const root = fileURLToPath(new URL('./', import.meta.url));
for (const directory of [root, workspaceRoot]) {
  try { await lstat(join(directory, '.npmrc')); assert.fail('project npm configuration is outside this isolated qualification'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const artifactRoot = ownedPath(root, '.package-artifacts');
try { assert.ok((await lstat(artifactRoot)).isDirectory() && !(await lstat(artifactRoot)).isSymbolicLink(), 'unsafe_artifact_root'); }
catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(artifactRoot); }
const output = await mkdtemp(join(artifactRoot, 'qualification-'));
// Consumers live outside the checkout and cannot resolve its node_modules/source.
const temporary = await mkdtemp(join(tmpdir(), 'bota-beta-packed-'));
await assertExternalDirectory(workspaceRoot, temporary);
const userconfig = join(temporary, 'empty-user.npmrc');
const globalconfig = join(temporary, 'empty-global.npmrc');
await writeFile(userconfig, ''); await writeFile(globalconfig, '');
const npmArgs = ['--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--update-notifier=false',
  '--userconfig', userconfig, '--globalconfig', globalconfig];
function npm(node, args, cwd, cache) {
  return run(node, [options['--npm-cli'], ...args, ...npmArgs, '--cache', cache], cwd);
}
for (const [key, version] of [['--node22', 'v22.23.2'], ['--node24', 'v24.19.0']]) {
  assert.equal(run(options[key], ['--version'], temporary).trim(), version);
  assert.equal(npm(options[key], ['--version'], temporary, join(temporary, `version-cache-${key.slice(2)}`)).trim(), '11.17.0');
}
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
assertManifest(manifest);
const packs = [];
for (let attempt = 0; attempt < 2; attempt++) {
  const builder = options[attempt === 0 ? '--node24' : '--node22'];
  run(builder, ['build-package.mjs'], root);
  const expected = await fileHashes(root, packedFiles);
  const target = join(output, `pack-${attempt}`); await mkdir(target);
  const result = JSON.parse(npm(builder, ['pack', '--workspace=@bota.dev/api-sdk', '--json', '--pack-destination', target], workspaceRoot, join(temporary, `pack-cache-${attempt}`)));
  assert.equal(result.length, 1);
  assert.equal(result[0].filename, 'bota.dev-api-sdk-0.1.0-beta.0.tgz');
  assert.deepEqual(result[0].files.map(file => file.path).sort(), packedFiles);
  const archive = await readFile(ownedPath(target, result[0].filename));
  const sha512 = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
  assert.equal(result[0].integrity, sha512);
  const validated = verifyArchive(archive, expected);
  packs.push({ bytes: archive, sha256: hash(archive), integrity: sha512, expected, provenance: validated.provenance });
}
assert.equal(packs[0].sha256, packs[1].sha256, 'repeated_build_pack_drift');
const candidate = packs[0];
const seed = join(temporary, 'seed'); await mkdir(seed);
const packageJson = json({ name: 'beta-packed-consumer', version: '0.0.0', private: true, type: 'module',
  dependencies: { [packageName]: 'file:candidate.tgz' } });
await writeFile(join(seed, 'package.json'), packageJson);
await writeFile(join(seed, 'candidate.tgz'), candidate.bytes);
npm(options['--node24'], ['install', '--package-lock-only'], seed, join(temporary, 'seed-empty-cache'));
const lockBytes = await readFile(join(seed, 'package-lock.json'));
const lock = JSON.parse(lockBytes);
assert.equal(lock.lockfileVersion, 3);
assert.deepEqual(Object.keys(lock.packages).sort(), ['', `node_modules/${packageName}`]);
assert.equal(lock.packages[`node_modules/${packageName}`].resolved, 'file:candidate.tgz');
assert.equal(lock.packages[`node_modules/${packageName}`].integrity, candidate.integrity);
await writeFile(join(output, 'consumer-package-lock.json'), lockBytes);
const consumers = [];
for (const label of ['node22', 'node24']) {
  const node = options[`--${label}`];
  const destination = join(temporary, label); await mkdir(destination);
  await writeFile(join(destination, 'package.json'), packageJson);
  await writeFile(join(destination, 'package-lock.json'), lockBytes);
  await writeFile(join(destination, 'candidate.tgz'), candidate.bytes);
  for (const [source, target] of [['package-consumer.mjs', 'consumer.mjs'], ['package-consumer.ts', 'consumer.ts'], ['package-consumer-tsconfig.json', 'tsconfig.json']]) {
    await copyFile(new URL(`./${source}`, import.meta.url), join(destination, target));
  }
  npm(node, ['ci'], destination, join(temporary, `${label}-empty-cache`));
  assert.deepEqual(await readFile(join(destination, 'package-lock.json')), lockBytes, 'frozen_consumer_lock_changed');
  const installed = join(destination, 'node_modules', packageName);
  assert.equal(await realpath(installed), installed, 'installed_package_is_linked');
  assert.deepEqual(await regularFiles(installed), packedFiles, 'installed_inventory');
  assert.deepEqual(await fileHashes(installed, packedFiles), candidate.expected, 'installed_bytes_drift');
  // The compiler is the explicitly pinned dev tool; all package resolution starts
  // in this isolated consumer, with no ambient @types or checkout path mappings.
  assert.equal(run(node, [compilerPath, '--version'], destination).trim(), `Version ${manifest.devDependencies.typescript}`);
  run(node, [compilerPath, '--project', join(destination, 'tsconfig.json')], destination);
  const smoke = JSON.parse(run(node, ['--no-experimental-strip-types', 'consumer.mjs'], destination).trim());
  assert.equal(smoke.passed, true); assert.equal(smoke.nativeTypeScript, false);
  assert.equal(smoke.node, label === 'node22' ? 'v22.23.2' : 'v24.19.0');
  consumers.push({ node: smoke.node, strictTypes: true, runtime: smoke,
    installedFilesSha256: hash(json(await fileHashes(installed, packedFiles))) });
}
const receipt = {
  version: 1, status: 'beta-packed-consumers-not-publication', package: { name: packageName, version: manifest.version, private: false, license: 'MIT' },
  source: candidate.provenance.source, buildProvenanceSha256: candidate.expected['dist/package-provenance.json'],
  tarball: { sha256: candidate.sha256, integrity: candidate.integrity, bytes: candidate.bytes.length, repeatedBuildPackMatch: true },
  npm: '11.17.0', npmCliSha256: hash(await readFile(options['--npm-cli'])), buildRuntimes: ['24.19.0', '22.23.2'],
  consumerLockSha256: hash(lockBytes), compiler: manifest.devDependencies.typescript,
  consumerLibraries: ['ES2022', 'DOM', 'DOM.Iterable'], offline: true, dependencyScripts: false,
  consumers, files: candidate.expected,
};
await writeFile(join(output, 'receipt.json'), json(receipt));
console.log(json({ receipt: `./.package-artifacts/${basename(output)}/receipt.json`, ...receipt }));
// Leave only our uniquely named temporary consumers for optional independent
// inspection. They contain synthetic credentials and the beta candidate only.
console.log(`Temporary consumers retained: ${temporary}`);
