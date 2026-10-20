import { lockUrl } from './workspace.mjs';
import openapiTS, { astToString } from 'openapi-typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { cohort, digest, json, project } from './project.mjs';
import { inlineResponseHeaderReferences } from './header-references.mjs';

const check = process.argv.includes('--check');
const inputBytes = await readFile(new URL('./input.json', import.meta.url));
if (digest(inputBytes) !== cohort.projectionSha256) throw Error('projection_digest_mismatch');
const sourceBytes = gunzipSync(await readFile(new URL('./source-openapi.json.gz', import.meta.url)), { maxOutputLength: 5 * 1024 * 1024 });
if (json(project(sourceBytes)) !== inputBytes.toString('utf8')) throw Error('source_projection_mismatch');
const input = JSON.parse(inputBytes);
const ownPackage = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
if (ownPackage.devDependencies[cohort.generator.name] !== cohort.generator.version || ownPackage.devDependencies.typescript !== cohort.typescript) throw Error('tool_pin_mismatch');
if (JSON.stringify(Object.keys(input.paths)) !== JSON.stringify(cohort.paths)) throw Error('cohort_paths_mismatch');
const index = cohort.paths.map(path => {
  const item = input.paths[path];
  if (Object.keys(item).some(key => !['get', 'parameters'].includes(key))) throw Error('non_read_operation');
  const operation = item.get;
  return { operationId: operation.operationId, method: 'GET', path, responses: Object.keys(operation.responses) };
});
if (new Set(index.map(item => item.operationId)).size !== 11) throw Error('cohort_operation_identity');
const generatorInput = inlineResponseHeaderReferences(input);
const generatorInputSha256 = digest(json(generatorInput));
const generated = astToString(await openapiTS(generatorInput, {
  alphabetize: true,
  // Defaults are server defaults, not a reason to turn an optional wire property
  // into a required one in a generated response model.
  defaultNonNullable: false,
}));
const provenance = {
  version: 1,
  source: cohort.source,
  projectionSha256: cohort.projectionSha256,
  generator: cohort.generator,
  typescript: cohort.typescript,
  lockSha256: digest(await readFile(lockUrl)),
  generatorScriptSha256: digest(await readFile(new URL('./generate.mjs', import.meta.url))),
  projectionScriptSha256: digest(await readFile(new URL('./project.mjs', import.meta.url))),
  headerAdapterScriptSha256: digest(await readFile(new URL('./header-references.mjs', import.meta.url))),
  generatorInputSha256,
  schemaSha256: digest(generated),
  operationCount: index.length,
  lockScope: 'workspace-root',
  workspaceScriptSha256: digest(await readFile(new URL('./workspace.mjs', import.meta.url))),
  status: 'beta-generation-not-certified-sdk',
};
await mkdir(new URL('./generated/', import.meta.url), { recursive: true });
for (const [file, content] of [['schema.d.ts', generated], ['operations.json', json(index)], ['provenance.json', json(provenance)]]) {
  const target = new URL(`./generated/${file}`, import.meta.url);
  if (check) {
    if (await readFile(target, 'utf8') !== content) throw Error(`generated_drift:${file}`);
  } else await writeFile(target, content);
}
console.log(`${check ? 'Verified' : 'Generated'} ${index.length} read operations; ${digest(generated)}`);
