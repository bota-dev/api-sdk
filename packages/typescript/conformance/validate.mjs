/** Bounded JSON Schema evaluator for corpus.schema.json only; not a public schema library. */
const keywords = new Set(['$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'const', 'enum',
  'oneOf', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems',
  'minLength', 'maxLength', 'minimum', 'maximum']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function assertCorpus(schema, value) {
  function check(rule, item, path, depth = 0) {
    if (depth > 32 || !object(rule) || Object.keys(rule).some(key => !keywords.has(key))) {
      throw Error('unsupported_conformance_schema');
    }
    const errors = [];
    const bad = () => errors.push(path);
    if ('$ref' in rule) {
      if (typeof rule.$ref !== 'string' || !/^#\/\$defs\/[A-Za-z0-9]+$/.test(rule.$ref)) {
        throw Error('unsupported_conformance_reference');
      }
      const target = schema.$defs?.[rule.$ref.slice(8)];
      if (!target) throw Error('missing_conformance_reference');
      errors.push(...check(target, item, path, depth + 1));
    }
    if (rule.oneOf && rule.oneOf.filter(part => check(part, item, path, depth + 1).length === 0).length !== 1) bad();
    if ('const' in rule && !equal(rule.const, item)) bad();
    if (rule.enum && !rule.enum.some(part => equal(part, item))) bad();
    if (rule.type && !(rule.type === 'object' ? object(item) : rule.type === 'array' ? Array.isArray(item) :
      rule.type === 'integer' ? Number.isSafeInteger(item) : rule.type === 'null' ? item === null : typeof item === rule.type)) bad();
    if (typeof item === 'number' && (item < (rule.minimum ?? -Infinity) || item > (rule.maximum ?? Infinity))) bad();
    // Schema lengths count Unicode code points, independently of runtime's bounded scalar implementation.
    if (typeof item === 'string' && ([...item].length < (rule.minLength ?? 0) || [...item].length > (rule.maxLength ?? Infinity))) bad();
    if (Array.isArray(item)) {
      if (item.length < (rule.minItems ?? 0) || item.length > (rule.maxItems ?? Infinity)) bad();
      if (rule.items) item.forEach((part, index) => errors.push(...check(rule.items, part, `${path}/${index}`, depth + 1)));
    }
    if (object(item)) {
      if (rule.required?.some(key => !Object.hasOwn(item, key))) bad();
      for (const [key, part] of Object.entries(item)) {
        const property = rule.properties?.[key];
        if (property) errors.push(...check(property, part, `${path}/${key}`, depth + 1));
        else if (rule.additionalProperties === false) bad();
        else if (object(rule.additionalProperties)) errors.push(...check(rule.additionalProperties, part, `${path}/${key}`, depth + 1));
      }
    }
    return errors;
  }
  const errors = check(schema, value, '#');
  if (errors.length) throw Error(`invalid_conformance_corpus:${[...new Set(errors)].join(',')}`);
  const ids = new Set();
  for (const fixture of value.cases) {
    if (ids.has(fixture.id)) throw Error('duplicate_conformance_case');
    ids.add(fixture.id);
    const expected = fixture.expect;
    if (fixture.script.length !== expected.calls.length) throw Error('invalid_conformance_script_calls');
    if ((Object.hasOwn(expected, 'result') ? 1 : 0) + (Object.hasOwn(expected, 'error') ? 1 : 0) > 1 ||
      fixture.invoke.mode === 'read' && !Object.hasOwn(expected, 'result') && !Object.hasOwn(expected, 'error') ||
      fixture.invoke.mode === 'read' && Object.hasOwn(expected, 'pages') ||
      fixture.invoke.mode === 'pages' && (!Object.hasOwn(expected, 'pages') || Object.hasOwn(expected, 'result'))) {
      throw Error('invalid_conformance_outcome');
    }
    if (expected.credentialCalls !== expected.calls.length && !expected.error) throw Error('invalid_conformance_calls');
    for (const step of fixture.script) {
      if (step.type === 'response' && ['body', 'bodyText', 'bodyBytes', 'bodyFault'].filter(key => Object.hasOwn(step, key)).length !== 1) {
        throw Error('invalid_conformance_response');
      }
    }
  }
  return value;
}
