import { BotaApiClient, createReadPrototype, type operations, type components, type ReadData, type ReadResult, type ReadInput, type RequestOptions } from './index.ts';

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type NamedReads = Omit<BotaApiClient, 'pages'>;
type ExactMethodCohort = Expect<Equal<keyof NamedReads, keyof operations>>;
type RequiredParameters = { [O in keyof operations]: operations[O]['parameters']['path'] extends undefined
  ? (input?: ReadInput<O>, options?: RequestOptions) => Promise<ReadResult<O>>
  : (input: ReadInput<O>, options?: RequestOptions) => Promise<ReadResult<O>> };
const client = new BotaApiClient({ credentials: async ({ signal }) => {
  signal.throwIfAborted(); return 'synthetic_named_key';
} });
const typedMethods: RequiredParameters = client;
async function consumer() {
  const identity = await client.getAuthIdentity();
  if (identity.status === 200) {
    const project: string = identity.data.project_id; void project;
  }
  const result = await client.getRecordingsById({ path: { id: 'rec_opaque' } }, { maxRetries: 0 });
  if (result.status === 200) {
    const recording: components['schemas']['RecordingDetail'] = result.data;
    const bytes: string | number | null = recording.file_size_bytes;
    const audio: string | null = recording.audio_url;
    void bytes; void audio;
  } else { const empty: undefined = result.data; void empty; }
  const rows: ReadData<'getRecordings'>[] = [];
  for await (const page of client.pages('getRecordings', { query: { limit: 1 } }, { maxItems: 3 })) rows.push(page);
  const legacy = createReadPrototype({ credentials: 'synthetic_factory_key' });
  await legacy.read('getDevices', { query: { limit: 1 } });
  // @ts-expect-error required detail path cannot be omitted
  await client.getDevicesById();
  // @ts-expect-error query retains numeric type
  await client.getDevices({ query: { limit: '1' } });
  // @ts-expect-error wrong detail path field
  await client.getSummariesById({ path: { recording_id: 'rec_opaque' } });
  // @ts-expect-error no undeclared mutation
  await client.createRecording();
  // @ts-expect-error required explicit credentials in constructor
  new BotaApiClient();
  // @ts-expect-error no alternate per-call API URL
  await client.getAuthIdentity({ baseUrl: 'https://elsewhere.example/v1' });
  // @ts-expect-error generic pages is list-only
  client.pages('getAuthIdentity');
  void rows;
}
void typedMethods; void consumer;
export type { ExactMethodCohort };
