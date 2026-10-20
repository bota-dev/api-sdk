import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const cohort = JSON.parse(await readFile(new URL('./cohort.json', import.meta.url)));
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
const componentKinds = new Set(['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems']);
const token = value => value.replaceAll('~', '~0').replaceAll('/', '~1');

// A read cohort keeps original schemas, including known mismatches. Fix the
// authoritative backend/spec before refreshing the pin; never patch generated types.
export function project(bytes) {
  if (digest(bytes) !== cohort.source.sha256) throw Error('source_digest_mismatch');
  return selectReadCohort(JSON.parse(bytes));
}

export function selectReadCohort(source) {
  if (source.openapi !== '3.1.0' || source.servers[0].url !== cohort.baseUrl) throw Error('source_contract_mismatch');
  const result = { openapi: source.openapi, info: source.info, servers: source.servers, paths: Object.create(null), components: Object.create(null), security: source.security };
  for (const path of cohort.paths) {
    const item = source.paths[path];
    if (!item?.get?.operationId || item.get.servers || item.servers) throw Error('read_contract_missing');
    result.paths[path] = { ...(item.parameters ? { parameters: item.parameters } : {}), get: item.get };
  }
  const seen = new Set();
  const addRef = ref => {
    if (!/^#\/components\/[^/]+\/[^/]+$/.test(ref)) throw Error('nonlocal_reference');
    if (seen.has(ref)) return;
    seen.add(ref);
    const [, , kind, encoded] = ref.split('/');
    if (!componentKinds.has(kind) || /~(?![01])/.test(encoded)) throw Error('unsupported_reference');
    const name = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!Object.hasOwn(source.components ?? {}, kind) || !Object.hasOwn(source.components[kind], name)) throw Error('missing_reference');
    const value = source.components?.[kind]?.[name];
    if (!value) throw Error('missing_reference');
    (result.components[kind] ??= Object.create(null))[name] = value;
    walk(value);
  };
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') addRef(value.$ref);
    if (value.discriminator?.mapping) {
      for (const target of Object.values(value.discriminator.mapping)) {
        if (typeof target !== 'string' || !target.startsWith('#/components/schemas/')) throw Error('unsupported_discriminator_mapping');
        addRef(target);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'security' && Array.isArray(child)) {
        for (const requirement of child) for (const scheme of Object.keys(requirement)) addRef(`#/components/securitySchemes/${token(scheme)}`);
      }
      walk(child);
    }
  };
  walk(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw Error('usage: node project.mjs PATH_TO_PINNED_PUBLIC_OPENAPI');
  await writeFile(new URL('./input.json', import.meta.url), json(project(await readFile(process.argv[2]))));
}
