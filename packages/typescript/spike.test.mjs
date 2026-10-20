import { lockUrl } from './workspace.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import { cohort, digest, project, json, selectReadCohort } from './project.mjs';
import { inlineResponseHeaderReferences } from './header-references.mjs';

const inputBytes = await readFile(new URL('./input.json', import.meta.url));
const input = JSON.parse(inputBytes);
test('cohort exposes exactly eleven named reads and resolves every local reference', () => {
  assert.equal(Object.keys(input.paths).length, 11);
  assert.deepEqual(Object.keys(input.paths), cohort.paths);
  const refs = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.match(value.$ref, /^#\/components\/[^/]+\/[^/]+$/);
      const parts = value.$ref.slice(2).split('/').map(x => x.replaceAll('~1', '/').replaceAll('~0', '~'));
      assert.ok(parts.reduce((node, key) => node?.[key], input), value.$ref);
    }
    Object.values(value).forEach(refs);
  };
  refs(input);
  for (const item of Object.values(input.paths)) assert.deepEqual(Object.keys(item).filter(key => key !== 'parameters'), ['get']);
});
test('projection refuses any unpinned contract', () => {
  assert.throws(() => project(Buffer.from('{}')), /source_digest_mismatch/);
});
test('cohort is exactly rederived from the pinned full public source fixture', async () => {
  const source = gunzipSync(await readFile(new URL('./source-openapi.json.gz', import.meta.url)), { maxOutputLength: 5 * 1024 * 1024 });
  assert.equal(digest(source), cohort.source.sha256);
  assert.equal(json(project(source)), inputBytes.toString('utf8'));
});
test('provenance binds projection, schema, lock and declared scope', async () => {
  const provenance = JSON.parse(await readFile(new URL('./generated/provenance.json', import.meta.url)));
  assert.equal(provenance.projectionSha256, digest(inputBytes));
  assert.equal(provenance.schemaSha256, digest(await readFile(new URL('./generated/schema.d.ts', import.meta.url))));
  assert.equal(provenance.lockSha256, digest(await readFile(lockUrl)));
  assert.equal(provenance.headerAdapterScriptSha256, digest(await readFile(new URL('./header-references.mjs', import.meta.url))));
  assert.equal(provenance.generatorInputSha256, digest(json(inlineResponseHeaderReferences(input))));
  assert.equal(provenance.operationCount, 11);
  assert.equal(provenance.status, 'beta-generation-not-certified-sdk');
  assert.deepEqual(provenance.source, cohort.source);
});

function headerFixture(headers = { Optional: { required: false, description: 'Optional opaque header', schema: { type: 'string' } },
  Required: { required: true, description: 'Required fixture header', schema: { type: 'string' } } }) {
  return { openapi: '3.1.0', info: { title: 'Header adapter fixture', version: '1' },
    paths: { '/fixture': { get: { operationId: 'headerFixture', responses: { 200: {
      description: 'Fixture', headers: { 'X-Optional': { $ref: '#/components/headers/Optional' },
        'X-Required': { $ref: '#/components/headers/Required' },
        'X-Inline': { required: false, schema: { type: 'string' } } },
    } } } } }, components: { headers } };
}

test('header adapter preserves source refs and equivalent inline schema/description/required semantics', () => {
  const fixture = headerFixture();
  fixture.components.headers['Owned/Header~Name'] = { required: false, description: 'Escaped own name', schema: { type: 'string' } };
  fixture.paths['/fixture'].get.responses[200].headers['X-Escaped'] = { $ref: '#/components/headers/Owned~1Header~0Name' };
  fixture.components.schemas = { Application: { type: 'object', properties: { child: { $ref: '#/components/schemas/Child' } } },
    Child: { type: 'string' } };
  fixture.components.parameters = { Filter: { name: 'filter', in: 'query', schema: { type: 'string' } } };
  fixture.paths['/fixture'].get.parameters = [{ $ref: '#/components/parameters/Filter' }];
  fixture.paths['/fixture'].get.responses[200].content = { 'application/json': { schema: { $ref: '#/components/schemas/Application' } } };
  fixture.components.responses = { Shared: structuredClone(fixture.paths['/fixture'].get.responses[200]) };
  const original = structuredClone(fixture);
  const adapted = inlineResponseHeaderReferences(fixture);
  assert.deepEqual(fixture, original);
  assert.deepEqual(adapted.paths['/fixture'].get.responses[200].headers['X-Optional'], fixture.components.headers.Optional);
  assert.deepEqual(adapted.paths['/fixture'].get.responses[200].headers['X-Required'], fixture.components.headers.Required);
  assert.deepEqual(adapted.paths['/fixture'].get.responses[200].headers['X-Inline'], fixture.paths['/fixture'].get.responses[200].headers['X-Inline']);
  assert.deepEqual(adapted.components.responses.Shared.headers, adapted.paths['/fixture'].get.responses[200].headers);
  assert.deepEqual(adapted.paths['/fixture'].get.responses[200].headers['X-Escaped'], fixture.components.headers['Owned/Header~Name']);
  assert.deepEqual(adapted.paths['/fixture'].get.responses[200].content, fixture.paths['/fixture'].get.responses[200].content);
  assert.deepEqual(adapted.paths['/fixture'].get.parameters, fixture.paths['/fixture'].get.parameters);
  assert.deepEqual(adapted.components.schemas, fixture.components.schemas);
  assert.deepEqual(adapted.components.parameters, fixture.components.parameters);
  assert.deepEqual(adapted.components.headers, fixture.components.headers);
});

test('adapted locked-generator types accept absent optional headers and reject absent required headers', async () => {
  const generated = astToString(await openapiTS(inlineResponseHeaderReferences(headerFixture()), { defaultNonNullable: false }));
  const consumer = `${generated}\n
type FixtureHeaders = operations['headerFixture']['responses'][200]['headers'];
const present: FixtureHeaders = { 'X-Required': 'fixture' };
const all: FixtureHeaders = { 'X-Required': 'fixture', 'X-Optional': 'opaque', 'X-Inline': 'opaque' };
// @ts-expect-error The required fixture header must remain required.
const missing: FixtureHeaders = {};
// @ts-expect-error Optional does not mean that numeric values are accepted.
const invalid: FixtureHeaders = { 'X-Required': 'fixture', 'X-Optional': 1 };
void [present, all, missing, invalid];`;
  const filename = fileURLToPath(new URL('./header-adapter-virtual-consumer.ts', import.meta.url));
  const options = { strict: true, noEmit: true, skipLibCheck: false,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const isVirtual = file => file.replaceAll('\\', '/') === filename.replaceAll('\\', '/');
  host.fileExists = file => isVirtual(file) || originalFileExists(file);
  host.readFile = file => isVirtual(file) ? consumer : originalReadFile(file);
  host.getSourceFile = (file, languageVersion, ...rest) => isVirtual(file)
    ? ts.createSourceFile(filename, consumer, languageVersion, true)
    : originalGetSourceFile(file, languageVersion, ...rest);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('header adapter refuses missing, external, cyclic, ambiguous and excessive reference chains', () => {
  for (const [reference, error] of [
    [{ $ref: '#/components/headers/Missing' }, 'missing_header_reference'],
    [{ $ref: '#/components/headers/__proto__' }, 'missing_header_reference'],
    [{ $ref: 'https://example.invalid/header.json' }, 'unsupported_header_reference'],
    [{ $ref: '#/components/schemas/Optional' }, 'unsupported_header_reference'],
    [{ $ref: '#/components/headers/Optional~2' }, 'unsupported_header_reference'],
    [{ $ref: '#/components/headers/Required', description: 'Ambiguous override' }, 'ambiguous_header_reference'],
  ]) {
    const fixture = headerFixture(); fixture.paths['/fixture'].get.responses[200].headers['X-Optional'] = reference;
    assert.throws(() => inlineResponseHeaderReferences(fixture), new RegExp(error));
  }
  const cyclic = headerFixture(); cyclic.components.headers.Optional = { $ref: '#/components/headers/Optional' };
  assert.throws(() => inlineResponseHeaderReferences(cyclic), /cyclic_header_reference/);
  const chain = count => {
    const fixture = headerFixture();
    for (let index = 0; index < count - 1; index++) fixture.components.headers[`Chain${index}`] = { $ref: `#/components/headers/Chain${index + 1}` };
    fixture.components.headers[`Chain${count - 1}`] = { required: false, schema: { type: 'string' } };
    fixture.paths['/fixture'].get.responses[200].headers['X-Optional'] = { $ref: '#/components/headers/Chain0' };
    return fixture;
  };
  assert.deepEqual(inlineResponseHeaderReferences(chain(16)).paths['/fixture'].get.responses[200].headers['X-Optional'],
    { required: false, schema: { type: 'string' } });
  assert.throws(() => inlineResponseHeaderReferences(chain(17)), /header_reference_depth/);
});
test('projection refuses external references and inherited component names', () => {
  const external = structuredClone(input);
  external.paths['/auth/identity'].get.responses['200'] = { $ref: 'https://example.invalid/schema.json' };
  assert.throws(() => selectReadCohort(external), /nonlocal_reference/);
  const inherited = structuredClone(input);
  inherited.paths['/auth/identity'].get.responses['200'] = { $ref: '#/components/schemas/__proto__' };
  assert.throws(() => selectReadCohort(inherited), /missing_reference/);
});
test('discriminator mapping targets are included or explicitly refused', () => {
  const local = structuredClone(input);
  local.paths['/auth/identity'].get.responses['200'] = { description: 'fixture', content: { 'application/json': { schema: { type: 'object', discriminator: { propertyName: 'kind', mapping: { fixture: '#/components/schemas/MappingTarget' } } } } } };
  local.components.schemas.MappingTarget = { type: 'object', properties: { kind: { type: 'string' } } };
  assert.deepEqual(selectReadCohort(local).components.schemas.MappingTarget, local.components.schemas.MappingTarget);
  local.paths['/auth/identity'].get.responses['200'].content['application/json'].schema.discriminator.mapping.fixture = 'MappingTarget';
  assert.throws(() => selectReadCohort(local), /unsupported_discriminator_mapping/);
});
