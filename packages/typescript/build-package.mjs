import { compilerPath, workspaceHashes, assertWorkspace, gitSource } from './workspace.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm, copyFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { packageName, buildInputs, emittedFiles, compiledFiles, assertManifest, fileHashes, regularFiles, ownedPath, run, json, hash } from './package-policy.mjs';

await assertWorkspace();
const root = fileURLToPath(new URL('./', import.meta.url));
const dist = ownedPath(root, 'dist');
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
assertManifest(manifest);
run(process.execPath, ['migration-provenance.mjs', '--check'], root);
run(process.execPath, ['generate.mjs', '--check'], root);
run(process.execPath, ['generate-client.mjs', '--check'], root);
run(process.execPath, ['conformance/provenance.mjs', '--check'], root);
run(process.execPath, ['runtime-provenance.mjs', '--check'], root);
run(process.execPath, ['check-licenses.mjs'], root);
assert.equal(run(process.execPath, [compilerPath, '--version'], root).trim(), `Version ${manifest.devDependencies.typescript}`);
const inputs = await fileHashes(root, buildInputs);
const source = await gitSource();
const workspaceFiles = await workspaceHashes();
try {
  const stat = await lstat(dist);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'unsafe_dist');
  const existing = await regularFiles(dist);
  assert.ok(existing.every(file => [...emittedFiles, 'package-provenance.json'].includes(file)), 'unowned_dist_files');
  // Fixed resolved target, checked regular-file inventory; generated files only.
  await rm(dist, { recursive: true });
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(dist);
run(process.execPath, [compilerPath, '--project', 'tsconfig.build.json'], root);
const copied = emittedFiles.filter(file => !compiledFiles.includes(file));
for (const file of copied) {
  const destination = new URL(`./dist/${file}`, import.meta.url);
  await mkdir(new URL('./', destination), { recursive: true });
  // tsc reserializes JSON imports. Restore the original bytes so the included
  // source/generator provenance also verifies against the installed assets.
  await copyFile(new URL(`./${file}`, import.meta.url), destination);
}
assert.deepEqual(await regularFiles(dist), [...emittedFiles].sort(), 'emitted_inventory');
assert.deepEqual(await fileHashes(root, buildInputs), inputs, 'source_changed_during_build');
assert.deepEqual(await workspaceHashes(), workspaceFiles, 'workspace_changed_during_build');
assert.deepEqual(await gitSource(), source, 'git_source_changed_during_build');
const outputs = await fileHashes(dist, [...emittedFiles].sort());
for (const file of copied) assert.equal(outputs[file], inputs[file], `copied_source_bytes:${file}`);
const provenance = {
  version: 1, status: 'beta-packed-candidate-not-publication', package: { name: packageName, version: manifest.version, private: false, license: 'MIT' },
  source, workspaceFiles, typescript: manifest.devDependencies.typescript, inputs,
  outputs,
};
await writeFile(new URL('./dist/package-provenance.json', import.meta.url), json(provenance));
console.log(`Built beta JavaScript/declaration candidate; ${hash(json(provenance))}`);
