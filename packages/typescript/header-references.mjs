const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const maximumDepth = 16;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Adapt only response-header references in the checked read projection.
 * openapi-typescript 7.13 treats referenced headers as required even when the
 * target has required:false. Equivalent inline HeaderObjects retain that flag.
 * The source/projection stay byte-exact; emitted types are never patched. */
export function inlineResponseHeaderReferences(document) {
  const result = structuredClone(document);
  const definitions = result.components?.headers;
  const resolve = (value, seen = new Set()) => {
    if (!object(value)) throw Error('invalid_header_object');
    if (!Object.hasOwn(value, '$ref')) return value;
    // Supporting overrides would require a separate Reference Object policy.
    // This adapter deliberately supports only pure, unambiguous local refs.
    if (Object.keys(value).length !== 1) throw Error('ambiguous_header_reference');
    if (typeof value.$ref !== 'string' || !/^#\/components\/headers\/[^/]+$/.test(value.$ref)) {
      throw Error('unsupported_header_reference');
    }
    const encoded = value.$ref.slice('#/components/headers/'.length);
    if (/~(?![01])/.test(encoded)) throw Error('unsupported_header_reference');
    if (seen.has(value.$ref)) throw Error('cyclic_header_reference');
    if (seen.size >= maximumDepth) throw Error('header_reference_depth');
    const name = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!object(definitions) || !Object.hasOwn(definitions, name)) throw Error('missing_header_reference');
    return resolve(definitions[name], new Set([...seen, value.$ref]));
  };
  const response = value => {
    if (!object(value) || Object.hasOwn(value, '$ref') || value.headers === undefined) return;
    if (!object(value.headers)) throw Error('invalid_response_headers');
    for (const [name, definition] of Object.entries(value.headers)) value.headers[name] = resolve(definition);
  };
  // The caller has already checked that input.json contains only eleven GETs.
  // Do not walk schema/property/parameter refs or perform network resolution.
  for (const path of Object.values(result.paths ?? {})) {
    for (const [method, operation] of Object.entries(path)) {
      if (methods.has(method)) Object.values(operation.responses ?? {}).forEach(response);
    }
  }
  Object.values(result.components?.responses ?? {}).forEach(response);
  return result;
}
