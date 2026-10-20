import source from './input.json' with { type: 'json' };
import index from './generated/operations.json' with { type: 'json' };
import cohort from './cohort.json' with { type: 'json' };
import type { operations } from './generated/schema.d.ts';

/** Private Node-only prototype. Generated types are assertions, not response validation. */
export type ReadOperation = keyof operations;
export type PageOperation = 'getEndUsers' | 'getDevices' | 'getRecordings' | 'getTranscriptions' | 'getSummaries';
export type ReadInput<O extends ReadOperation> = Pick<operations[O]['parameters'], 'path' | 'query'>;
export type ReadData<O extends ReadOperation> = operations[O]['responses'][200]['content']['application/json'];
export type ReadResult<O extends ReadOperation> =
  | { status: 200; data: ReadData<O>; headers: Readonly<Record<string, string>> }
  | { status: 204; data: undefined; headers: Readonly<Record<string, string>> };
export interface RequestOptions { signal?: AbortSignal; timeoutMs?: number; maxRetries?: number }
export interface PageOptions extends RequestOptions { maxPages?: number; maxItems?: number }
export interface PrototypeOptions {
  credentials: string | ((context: { baseUrl: string; signal: AbortSignal }) => string | Promise<string>);
  baseUrl?: string;
  /** Explicitly permits HTTP only to literal loopback hosts for local development/tests. */
  allowLoopbackHttp?: boolean;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  /** Zero disables automatic retries; the reviewed read cohort permits at most two. */
  maxRetries?: number;
}
export type FailureKind = 'invalid_input' | 'credentials' | 'aborted' | 'deadline' | 'transport' |
  'redirect' | 'invalid_response' | 'response_too_large' | 'http' | 'pagination';
const messages: Record<FailureKind, string> = {
  invalid_input: 'Invalid private read-prototype input.',
  credentials: 'A valid explicit API credential is required.',
  aborted: 'The read was cancelled.', deadline: 'The read deadline expired.',
  transport: 'The API transport failed.',
  redirect: 'The API response attempted a redirect.',
  invalid_response: 'The API returned an unsupported or invalid response.',
  response_too_large: 'The API response exceeded the configured byte limit.',
  http: 'The API returned an HTTP error.',
  pagination: 'Pagination stopped at an invalid continuation or configured bound.',
};

/** Body and parsed API fields may contain sensitive server data; nothing is logged. */
export class ReadPrototypeError extends Error {
  readonly kind: FailureKind;
  readonly status?: number;
  readonly headers: Readonly<Record<string, string>>;
  declare readonly body: unknown;
  readonly code?: string;
  readonly param?: string;
  readonly requestId?: string;
  declare readonly apiMessage: string | undefined;
  constructor(kind: FailureKind, details: {
    status?: number; headers?: Readonly<Record<string, string>>; body?: unknown;
  } = {}) {
    super(messages[kind]);
    this.name = 'ReadPrototypeError';
    this.kind = kind;
    if (details.status !== undefined) this.status = details.status;
    this.headers = details.headers ?? Object.freeze({});
    // Explicit access retains diagnostics without default Error inspection dumping the body.
    Object.defineProperty(this, 'body', { value: details.body, enumerable: false });
    const error = record(details.body) && record(details.body.error) ? details.body.error : undefined;
    if (typeof error?.code === 'string') this.code = error.code;
    if (typeof error?.param === 'string') this.param = error.param;
    const requestId = typeof error?.request_id === 'string' ? error.request_id : this.headers['x-request-id'];
    if (requestId !== undefined) this.requestId = requestId;
    Object.defineProperty(this, 'apiMessage', {
      value: typeof error?.message === 'string' ? error.message : undefined, enumerable: false,
    });
  }
}
function fail(kind: FailureKind): never { throw new ReadPrototypeError(kind); }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function boundedInteger(value: unknown, fallback: number, max: number): number {
  const n = value === undefined ? fallback : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > max) fail('invalid_input');
  return n;
}
function retryCount(value: unknown, fallback: number): number {
  const count = value === undefined ? fallback : value;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 2) fail('invalid_input');
  return count;
}
function checkedOptions(value: unknown, page = false): asserts value is RequestOptions & PageOptions {
  if (!record(value) || Object.keys(value).some(name =>
    !['signal', 'timeoutMs', 'maxRetries', ...(page ? ['maxPages', 'maxItems'] : [])].includes(name)) ||
    value.signal !== undefined && !(value.signal instanceof AbortSignal)) fail('invalid_input');
}
function apiRoot(value: string, loopback: boolean): URL {
  if (typeof value !== 'string' || /[\x00-\x20\x7f\\]/.test(value)) fail('invalid_input');
  let url: URL;
  try { url = new URL(value); } catch { fail('invalid_input'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
    (url.protocol !== 'https:' && !(loopback && local && url.protocol === 'http:')) ||
    !url.pathname.endsWith('/v1') && !url.pathname.endsWith('/v1/')) fail('invalid_input');
  // Reject canonicalization surprises (encoded separators/dots and dot-segment roots).
  const rawPath = value.slice(value.indexOf('://') + 3).replace(/^[^/]+/, '');
  if (rawPath !== url.pathname || /%2e|%2f|%5c/i.test(rawPath)) fail('invalid_input');
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}
const ownedScopes = new WeakMap<AbortSignal, { end: number; controller: AbortController }>();
function scope(parent: AbortSignal | undefined, milliseconds: number) {
  const controller = new AbortController();
  const end = Math.min(performance.now() + milliseconds, parent ? ownedScopes.get(parent)?.end ?? Infinity : Infinity);
  ownedScopes.set(controller.signal, { end, controller });
  const cancel = () => controller.abort(parent && ownedScopes.has(parent) && parent.reason instanceof ReadPrototypeError ? parent.reason : new ReadPrototypeError('aborted'));
  if (parent?.aborted) cancel(); else parent?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new ReadPrototypeError('deadline')), Math.max(0, end - performance.now()));
  return {
    signal: controller.signal,
    remaining() { return Math.max(0, end - performance.now()); },
    close() { clearTimeout(timer); parent?.removeEventListener('abort', cancel); },
  };
}
function aborted(signal: AbortSignal): void {
  const own = ownedScopes.get(signal);
  if (own && !signal.aborted && performance.now() >= own.end) own.controller.abort(new ReadPrototypeError('deadline'));
  if (signal.aborted) throw signal.reason instanceof ReadPrototypeError ? signal.reason : new ReadPrototypeError('aborted');
}
async function within<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  aborted(signal);
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(signal.reason instanceof ReadPrototypeError ? signal.reason : new ReadPrototypeError('aborted'));
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => { aborted(signal); return work(); }).then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', cancel));
  });
}
function scrub(text: string, keys: ReadonlySet<string>): string {
  let clean = text;
  const variants = [...keys].flatMap(key => [key, encodeURIComponent(key)]).sort((a, b) => b.length - a.length);
  for (const variant of variants) clean = clean.split(variant).join('[REDACTED]');
  return clean;
}
function scrubBody(body: unknown, keys: ReadonlySet<string>): unknown {
  if (typeof body === 'string') return scrub(body, keys);
  if (body === null || typeof body !== 'object') return body;
  const pending: object[] = [body];
  while (pending.length) {
    const current = pending.pop()!;
    for (const [name, value] of Object.entries(current)) {
      const cleanName = scrub(name, keys);
      const cleanValue = typeof value === 'string' ? scrub(value, keys) : value;
      if (cleanName !== name) delete (current as Record<string, unknown>)[name];
      Object.defineProperty(current, cleanName, { value: cleanValue, enumerable: true, writable: true, configurable: true });
      if (value !== null && typeof value === 'object') pending.push(value);
    }
  }
  return body;
}
function responseHeaders(response: Response, keys: ReadonlySet<string>): Readonly<Record<string, string>> {
  const headers: Record<string, string> = Object.create(null) as Record<string, string>;
  response.headers.forEach((value, name) => { headers[scrub(name, keys)] = scrub(value, keys); });
  return Object.freeze(headers);
}
async function jsonBody(response: Response, signal: AbortSignal, maximum: number): Promise<unknown> {
  if (!response.body) fail('invalid_response');
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const part = await within(() => reader.read(), signal);
      aborted(signal);
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) { cancel(); fail('response_too_large'); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
    catch { fail('invalid_response'); }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
type ScalarSchema = {
  type?: string; enum?: unknown[]; const?: unknown; minimum?: number; maximum?: number;
  minLength?: number; maxLength?: number; pattern?: string;
  allOf?: ScalarSchema[]; anyOf?: ScalarSchema[];
};
type Parameter = { in: string; name: string; required: boolean; schema: ScalarSchema };
// Deliberately a bounded scalar request subset, not a general JSON Schema validator.
// Formats/calendar/cross-field policies remain backend admission checks.
function scalarMatches(schema: ScalarSchema, value: unknown, depth = 0): boolean {
  if (depth > 8 || typeof value !== 'string' && typeof value !== 'number') return false;
  if (typeof value === 'string' && value.length > 16384) return false;
  if (schema.type === 'string' && typeof value !== 'string' ||
    schema.type === 'integer' && (typeof value !== 'number' || !Number.isSafeInteger(value)) ||
    schema.type !== undefined && schema.type !== 'string' && schema.type !== 'integer') return false;
  if (schema.enum && !schema.enum.includes(value) || 'const' in schema && schema.const !== value) return false;
  if (typeof value === 'string') {
    if (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)) return false;
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
  }
  if (typeof value === 'number' && (!Number.isSafeInteger(value) ||
    value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) return false;
  if (schema.allOf && !schema.allOf.every(part => scalarMatches(part, value, depth + 1))) return false;
  if (schema.anyOf && !schema.anyOf.some(part => scalarMatches(part, value, depth + 1))) return false;
  return true;
}
type Definition = { operationId: string; method: string; path: string };
const definitions = new Map<string, Definition>(index.map(entry => [entry.operationId, entry]));
const listOperations = new Set<string>(['getEndUsers', 'getDevices', 'getRecordings', 'getTranscriptions', 'getSummaries']);
// Deliberate admission, not an inference that future GET operations are replayable.
const retryOperations = new Set<string>(['getAuthIdentity', 'getEndUsers', 'getEndUsersById',
  'getDevices', 'getDevicesById', 'getRecordings', 'getRecordingsById',
  'getTranscriptions', 'getTranscriptionsById', 'getSummaries', 'getSummariesById']);
const MAX_RETRY_AFTER_MS = 10_000;
type RetryAfter = { delay: number } | 'absent' | 'invalid' | 'blocked';
function retryAfter(value: string | null): RetryAfter {
  if (value === null) return 'absent';
  if (value.length > 128) return 'blocked';
  if (/^[0-9]+$/.test(value)) {
    const seconds = value.replace(/^0+/, '') || '0';
    if (seconds.length > 2 || Number(seconds) > MAX_RETRY_AFTER_MS / 1000) return 'blocked';
    return { delay: Number(seconds) * 1000 };
  }
  // Only canonical IMF-fixdate is admitted; permissive Date.parse alone also
  // accepts invalid numeric strings and normalized impossible calendar dates.
  if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [0-9]{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(value)) return 'invalid';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toUTCString() !== value) return 'invalid';
  const delay = Math.max(0, parsed - Date.now());
  return delay > MAX_RETRY_AFTER_MS ? 'blocked' : { delay };
}
function retryDelay(operation: string, error: ReadPrototypeError, header: string | null,
  attempt: number, retries: number, remaining: number): number | undefined {
  if (!retryOperations.has(operation) || attempt >= retries) return undefined;
  if (!['http', 'transport', 'invalid_response'].includes(error.kind)) return undefined;
  const transientStatus = [502, 503, 504].includes(error.status ?? 0);
  const after = retryAfter(header);
  const limited = error.status === 429 && error.code !== 'RATE_LIMIT_EXCEEDED' && typeof after === 'object';
  if (!transientStatus && !limited && !(error.kind === 'transport' && (error.status === undefined || error.status === 200))) return undefined;
  if (after === 'blocked') return undefined;
  const base = 200 * 2 ** attempt;
  const jitter = base / 2 + Math.random() * base / 2;
  const delay = Math.max(jitter, typeof after === 'object' ? after.delay : 0);
  // Do not shorten the server's requested wait or spend a budget that cannot
  // admit another attempt. Preserve the last HTTP/transport error instead.
  return delay < remaining ? delay : undefined;
}
async function backoff(milliseconds: number, signal: AbortSignal): Promise<void> {
  aborted(signal);
  await new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, milliseconds);
    signal.addEventListener('abort', cancel, { once: true });
  });
  aborted(signal);
}
function dispose(response: Response | undefined): void {
  if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
}
function requestUrl(root: URL, operation: string, input: unknown): URL {
  const definition = definitions.get(operation);
  if (!definition || definition.method !== 'GET') fail('invalid_input');
  const spec = (source.paths as Record<string, { get: { operationId: string; parameters?: Parameter[] } }>)[definition.path]?.get;
  if (!spec || spec.operationId !== operation) fail('invalid_input');
  if (input !== undefined && !record(input)) fail('invalid_input');
  const params = input ?? {};
  if (Object.keys(params).some(name => name !== 'path' && name !== 'query')) fail('invalid_input');
  const path = params.path === undefined ? {} : params.path;
  const query = params.query === undefined ? {} : params.query;
  if (!record(path) || !record(query)) fail('invalid_input');
  const specs = spec.parameters ?? [];
  if (Object.keys(path).some(name => !specs.some(p => p.in === 'path' && p.name === name)) ||
    Object.keys(query).some(name => !specs.some(p => p.in === 'query' && p.name === name))) fail('invalid_input');
  let route = definition.path;
  const search = new URLSearchParams();
  for (const p of specs) {
    const value = (p.in === 'path' ? path : query)[p.name];
    if (value === undefined) { if (p.required) fail('invalid_input'); else continue; }
    if (!scalarMatches(p.schema, value)) fail('invalid_input');
    if (typeof value === 'string') { try { encodeURIComponent(value); } catch { fail('invalid_input'); } }
    if (p.in === 'path') {
      if (typeof value !== 'string' || !value || value === '.' || value === '..') fail('invalid_input');
      try { route = route.replace(`{${p.name}}`, encodeURIComponent(value)); } catch { fail('invalid_input'); }
    } else search.set(p.name, String(value));
  }
  const url = new URL(`${root.href}${route}`);
  if (url.origin !== root.origin || !url.pathname.startsWith(`${root.pathname}/`)) fail('invalid_input');
  url.search = search.toString();
  return url;
}

export function createReadPrototype(options: PrototypeOptions) {
  if (!options || typeof options !== 'object' ||
    typeof options.credentials !== 'string' && typeof options.credentials !== 'function') fail('invalid_input');
  const root = apiRoot(options.baseUrl ?? cohort.baseUrl, options.allowLoopbackHttp === true);
  const credential = options.credentials;
  const transport = options.fetch ?? globalThis.fetch;
  if (typeof transport !== 'function') fail('invalid_input');
  const timeout = boundedInteger(options.timeoutMs, 30000, 120000);
  const maximum = boundedInteger(options.maxResponseBytes, 8 * 1024 * 1024, 64 * 1024 * 1024);
  const retries = retryCount(options.maxRetries, 2);

  async function attempt<O extends ReadOperation>(url: URL, signal: AbortSignal,
    secrets: Set<string>, advice: { retryAfter: string | null }): Promise<ReadResult<O>> {
    let key: string | undefined;
    let response: Response | undefined;
    let headers: Readonly<Record<string, string>> | undefined;
    try {
      try { key = await within(async () => typeof credential === 'string' ? credential : credential({ baseUrl: root.href, signal }), signal); }
      catch { aborted(signal); fail('credentials'); }
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(key)) fail('credentials');
      secrets.add(key);
      try {
        response = await within(async () => {
          const received = await transport(url, {
            method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
            redirect: 'manual', credentials: 'omit', cache: 'no-store', signal,
          });
          if (signal.aborted) {
            dispose(received);
            aborted(signal);
          }
          return received;
        }, signal);
      } catch { aborted(signal); fail('transport'); }
      advice.retryAfter = response.headers.get('retry-after');
      headers = responseHeaders(response, secrets);
      try { aborted(signal); }
      catch (error) {
        if (!(error instanceof ReadPrototypeError)) throw error;
        throw new ReadPrototypeError(error.kind, { status: response.status, headers });
      }
      if (response.redirected || response.type === 'opaqueredirect' || response.status >= 300 && response.status < 400) {
        throw new ReadPrototypeError('redirect', { status: response.status, headers });
      }
      if (response.url) {
        let actual: URL;
        try { actual = new URL(response.url); }
        catch { throw new ReadPrototypeError('invalid_response', { status: response.status, headers }); }
        if (actual.href !== url.href) throw new ReadPrototypeError('redirect', { status: response.status, headers });
      }
      if (response.status === 204) return { status: 204, data: undefined, headers };
      let body: unknown;
      try {
        const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
        if (contentType !== 'application/json' && !contentType?.endsWith('+json')) fail('invalid_response');
        body = await jsonBody(response, signal, maximum);
        aborted(signal);
      } catch (error) {
        if (error instanceof ReadPrototypeError) {
          // Invalid HTTP error payloads retain status/headers without retaining raw text.
          throw new ReadPrototypeError(error.kind, { status: response.status, headers });
        }
        throw error;
      }
      if (!response.ok) throw new ReadPrototypeError('http', { status: response.status, headers, body: scrubBody(body, secrets) });
      if (response.status !== 200) throw new ReadPrototypeError('invalid_response', { status: response.status, headers });
      return { status: 200, data: body as ReadData<O>, headers };
    } catch (error) {
      if (error instanceof ReadPrototypeError) throw error;
      aborted(signal);
      throw new ReadPrototypeError('transport', {
        ...(response ? { status: response.status } : {}), ...(headers ? { headers } : {}),
      });
    } finally {
      // Also release unused redirect/non-JSON/error bodies. Cancellation is best effort
      // for caller-injected transports; do not wait forever on an uncooperative cancel.
      dispose(response);
      key = undefined;
    }
  }

  async function request<O extends ReadOperation>(operation: O, input: unknown,
    requestOptions: RequestOptions, secrets: Set<string>): Promise<ReadResult<O>> {
    checkedOptions(requestOptions);
    const count = retryCount(requestOptions.maxRetries, retries);
    const url = requestUrl(root, operation, input);
    const active = scope(requestOptions.signal, boundedInteger(requestOptions.timeoutMs, timeout, 120000));
    try {
      for (let index = 0; ; index++) {
        aborted(active.signal);
        const advice = { retryAfter: null as string | null };
        try { return await attempt<O>(new URL(url.href), active.signal, secrets, advice); }
        catch (error) {
          if (!(error instanceof ReadPrototypeError)) throw error;
          // Body reads already attach the received status/headers to their
          // cancellation error. Do not replace those diagnostics with the
          // context-free signal reason when entering the retry boundary.
          if (error.kind === 'aborted' || error.kind === 'deadline') throw error;
          const cancelled = (reason: unknown): never => {
            if (!(reason instanceof ReadPrototypeError)) throw reason;
            throw new ReadPrototypeError(reason.kind, {
              ...(error.status !== undefined ? { status: error.status } : {}), headers: error.headers,
            });
          };
          try { aborted(active.signal); } catch (reason) { cancelled(reason); }
          const wait = retryDelay(operation, error, advice.retryAfter, index, count, active.remaining());
          if (wait === undefined) throw error;
          try { await backoff(wait, active.signal); } catch (reason) { cancelled(reason); }
        }
      }
    } finally { active.close(); }
  }

  async function read<O extends ReadOperation>(operation: O,
    ...args: operations[O]['parameters']['path'] extends undefined
      ? [input?: ReadInput<O>, requestOptions?: RequestOptions]
      : [input: ReadInput<O>, requestOptions?: RequestOptions]
  ): Promise<ReadResult<O>> {
    const [input, requestOptions = {}] = args;
    const secrets = new Set<string>();
    try { return await request<O>(operation, input, requestOptions, secrets); }
    finally { secrets.clear(); }
  }

  async function* pages<O extends PageOperation>(operation: O, input?: ReadInput<O>, pageOptions: PageOptions = {}): AsyncGenerator<ReadData<O>, void, unknown> {
    if (!listOperations.has(operation)) fail('invalid_input');
    checkedOptions(pageOptions, true);
    const count = retryCount(pageOptions.maxRetries, retries);
    requestUrl(root, operation, input);
    const maxPages = boundedInteger(pageOptions.maxPages, 100, 10000);
    const maxItems = boundedInteger(pageOptions.maxItems, 10000, 1000000);
    const active = scope(pageOptions.signal, boundedInteger(pageOptions.timeoutMs, timeout, 120000));
    const query = { ...(input?.query ?? {}) } as Record<string, unknown>;
    const seen = new Set<unknown>();
    if (query.cursor !== undefined) seen.add(query.cursor);
    let items = 0;
    const secrets = new Set<string>();
    const forget = () => secrets.clear();
    active.signal.addEventListener('abort', forget, { once: true });
    try {
      for (let page = 0; page < maxPages; page++) {
        aborted(active.signal);
        const result = await request<O>(operation, { ...input, query }, { signal: active.signal, maxRetries: count }, secrets);
        if (result.status !== 200 || !record(result.data) || !Array.isArray(result.data.data) || typeof result.data.has_more !== 'boolean') fail('pagination');
        items += result.data.data.length;
        if (items > maxItems) fail('pagination');
        const hasMore = result.data.has_more;
        let next: string | undefined;
        if (hasMore) {
          if (typeof result.data.next_cursor !== 'string' || !result.data.next_cursor || seen.has(result.data.next_cursor)) fail('pagination');
          next = result.data.next_cursor;
          seen.add(next);
        }
        yield result.data;
        if (!hasMore) return;
        if (page + 1 === maxPages || items >= maxItems) fail('pagination');
        query.cursor = next;
      }
    } finally { active.close(); active.signal.removeEventListener('abort', forget); secrets.clear(); }
  }
  return Object.freeze({ read, pages });
}
