/*
 * A tiny JSON Schema checker for the keywords schema/case.schema.json uses.
 * Not a general validator: no dependencies is a project rule, so the tests
 * check the contract with this instead of Ajv.
 * Returns a list of "path: problem" strings; empty means valid.
 */

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value, type) {
  if (type === "integer") return Number.isInteger(value);
  return typeOf(value) === type;
}

function resolve(ref, root) {
  if (!ref.startsWith("#/")) throw new Error(`Unsupported $ref ${ref}`);
  return ref
    .slice(2)
    .split("/")
    .reduce((node, part) => node[part], root);
}

export function check(schema, value, root = schema, path = "$") {
  const errors = [];
  const fail = (message) => errors.push(`${path}: ${message}`);

  if (schema.$ref) errors.push(...check(resolve(schema.$ref, root), value, root, path));

  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((type) => matchesType(value, type))) fail(`expected ${types.join("|")}, got ${typeOf(value)}`);
  }
  if ("const" in schema && value !== schema.const) fail(`expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`${JSON.stringify(value)} not in enum`);

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail("too short");
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail("too long");
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail(`does not match ${schema.pattern}`);
    if (schema.format === "date-time" && !DATE_TIME.test(value)) fail("not a date-time");
    if (schema.format === "uuid" && !UUID.test(value)) fail("not a uuid");
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) fail("below minimum");
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) fail("not above exclusiveMinimum");
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(`fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(`more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...check(schema.items, item, root, `${path}[${i}]`)));
  }

  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) fail(`missing ${key}`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...check(sub, value[key], root, `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) fail(`unexpected ${key}`);
    }
  }

  if (schema.anyOf && !schema.anyOf.some((sub) => check(sub, value, root, path).length === 0)) {
    fail("matches no anyOf branch");
  }
  for (const sub of schema.allOf ?? []) errors.push(...check(sub, value, root, path));
  if (schema.if) {
    const branch = check(schema.if, value, root, path).length === 0 ? schema.then : schema.else;
    if (branch) errors.push(...check(branch, value, root, path));
  }

  return errors;
}
