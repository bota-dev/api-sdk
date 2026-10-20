// Only the Node builtin used internally; this is not a general Node type shim.
declare module 'node:util' {
  export const types: { isProxy(value: unknown): boolean };
}
