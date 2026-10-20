import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import openapiTS, { astToString } from 'openapi-typescript';
import { lockUrl } from './workspace.mjs';
import { digest, json } from './project.mjs';
import { selectMutations, verifyMutationProjection } from './mutation-project.mjs';
import { inlineResponseHeaderReferences } from './header-references.mjs';

const { cohort, bytes, input } = await verifyMutationProjection();
const source = gunzipSync(await readFile(new URL('./mutation-source-openapi.json.gz', import.meta.url)), { maxOutputLength: 5 * 1024 * 1024 });
assert.equal(digest(source), cohort.source.sha256, 'mutation_source_digest');
assert.equal(json(selectMutations(JSON.parse(source))), bytes.toString('utf8'), 'mutation_source_projection');
const own = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
assert.equal(own.devDependencies['openapi-typescript'], cohort.generator.version);
assert.equal(own.devDependencies.typescript, cohort.typescript);
const generatorInput = inlineResponseHeaderReferences(input);
const schema = astToString(await openapiTS(generatorInput, { alphabetize: true, defaultNonNullable: false }));
const files = ['generate-mutations.mjs', 'mutation-project.mjs', 'mutation-contract.ts', 'header-references.mjs'];
const hashes = {};
for (const name of files) hashes[name] = digest(await readFile(new URL(`./${name}`, import.meta.url)));
const proof = json({ version: 1, status: 'ordinary-end-user-write-candidate-not-publication', source: cohort.source,
  projectionSha256: digest(bytes), generator: cohort.generator, typescript: cohort.typescript,
  lockSha256: digest(await readFile(lockUrl)), generatorInputSha256: digest(json(generatorInput)),
  schemaSha256: digest(schema), operationCount: 2, files: hashes });
for (const [name, content] of [['generated/mutations-schema.d.ts', schema], ['generated/mutations-provenance.json', proof]]) {
  const target = new URL(`./${name}`, import.meta.url);
  if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), content, `mutation_generated_drift:${name}`);
  else await writeFile(target, content);
}
console.log(`Verified two ordinary end-user mutation types; ${digest(schema)}`);
