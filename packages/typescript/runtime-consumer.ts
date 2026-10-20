import { createReadPrototype, type ReadResult } from './runtime.ts';
import type { components } from './generated/schema.d.ts';

const client = createReadPrototype({ credentials: async ({ signal }) => {
  signal.throwIfAborted();
  return 'synthetic_explicit_key';
} });
async function consume() {
  const identity = await client.read('getAuthIdentity');
  if (identity.status === 200) {
    const project: string = identity.data.project_id;
    void project;
  } else {
    const empty: undefined = identity.data;
    void empty;
  }
  const recording = await client.read('getRecordingsById', { path: { id: 'rec_example' } });
  if (recording.status === 200) {
    const audio: string | null = recording.data.audio_url;
    const bytes: string | number | null = recording.data.file_size_bytes;
    void audio; void bytes;
  }
  for await (const page of client.pages('getRecordings', { query: { device_id: 'dev_example', limit: 20 } }, { maxPages: 2, maxItems: 40 })) {
    const total: number = page.total;
    const rows: components['schemas']['RecordingListItem'][] = page.data;
    void total; void rows;
  }
  await client.read('getDevices', { query: { serial_number: 'demo', limit: 1 } });
  await client.read('getDevices', undefined, { maxRetries: 0 });
  client.pages('getDevices', undefined, { maxRetries: 1 });
  createReadPrototype({ credentials: 'synthetic_explicit_key', maxRetries: 2 });
  // @ts-expect-error retry policy does not accept strings or unbounded policies
  await client.read('getDevices', undefined, { maxRetries: '2' });
  // @ts-expect-error there is no generic mutation or auth-refresh retry hook
  createReadPrototype({ credentials: 'synthetic_explicit_key', retry: () => true });
  // @ts-expect-error eleven-read cohort has no mutation operation
  await client.read('createRecording');
  // @ts-expect-error detail path is required
  await client.read('getDevicesById');
  // @ts-expect-error unknown detail path key
  await client.read('getDevicesById', { path: { recording_id: 'x' } });
  // @ts-expect-error limit remains numeric
  await client.read('getDevices', { query: { limit: '10' } });
  // @ts-expect-error no per-request origin escape hatch
  await client.read('getDevices', { baseUrl: 'https://elsewhere.example/v1' });
  // @ts-expect-error iterator is list-only
  client.pages('getAuthIdentity');
  // @ts-expect-error explicit API credential is required, no environment/profile fallback
  createReadPrototype({});
}
function resultConsumer(result: ReadResult<'getSummariesById'>) {
  if (result.status === 200) {
    const projectId: string = result.data.project_id;
    void projectId;
  } else {
    // @ts-expect-error empty 204 has no summary fields
    result.data.project_id;
  }
}
void consume; void resultConsumer;
