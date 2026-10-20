import { BotaApiClient, createReadPrototype, ReadPrototypeError, type ReadData, type ReadResult, type components } from '@bota.dev/api-sdk';

const client = createReadPrototype({ credentials: async ({ signal, baseUrl }) => {
  const apiRoot: string = baseUrl;
  const cancellation: AbortSignal = signal;
  void apiRoot; void cancellation;
  return 'synthetic_packed_key';
} });
async function consumer() {
  const named = new BotaApiClient({ credentials: 'synthetic_named_packed' });
  const created = await named.postEndUsers({ body: { external_id: 'packed001', metadata: { nested: null } } }, { maxRetries: 0 });
  const createdStatus: 201 = created.status;
  const updated = await named.patchEndUsersById({ path: { id: 'eu_packed' }, body: { metadata: {} } });
  const updatedStatus: 200 = updated.status;
  void createdStatus; void updatedStatus;
  // @ts-expect-error required JSON object body
  await named.postEndUsers({});
  // @ts-expect-error explicit mutation retry is refused
  await named.postEndUsers({ body: {} }, { maxRetries: 1 });
  const namedDetail = await named.getRecordingsById({ path: { id: 'rec_opaque' } }, { maxRetries: 0 });
  if (namedDetail.status === 200) {
    const recording: components['schemas']['RecordingDetail'] = namedDetail.data;
    const audio: string | null = recording.audio_url; void audio;
  }
  // The README example narrows the explicit no-content branch before reading data.
  const exampleIdentity = await named.getAuthIdentity();
  const exampleDevices = await named.getDevices({ query: { limit: 20 } });
  if (exampleIdentity.status === 200 && exampleDevices.status === 200) {
    const project: string = exampleIdentity.data.project_id;
    const devices: components['schemas']['Device'][] = exampleDevices.data.data;
    void project; void devices;
  }
  const namedIdentity = await named.getAuthIdentity();
  if (namedIdentity.status === 200) { const project: string = namedIdentity.data.project_id; void project; }
  // @ts-expect-error generated detail method requires its path
  await named.getDevicesById();
  // @ts-expect-error generated list method retains numeric query types
  await named.getDevices({ query: { limit: '1' } });
  // @ts-expect-error generated class has no undeclared mutations
  await named.createRecording();
  // @ts-expect-error explicit constructor options remain required
  new BotaApiClient();
  const result = await client.read('getRecordingsById', { path: { id: 'rec_opaque' } });
  if (result.status === 200) {
    const audio: string | null = result.data.audio_url;
    const bytes: string | number | null = result.data.file_size_bytes;
    void audio; void bytes;
  } else { const empty: undefined = result.data; void empty; }
  const identity = await client.read('getAuthIdentity');
  if (identity.status === 200) {
    const kind: 'secret' | 'restricted' = identity.data.key_type;
    const grants: string[] | null = identity.data.scopes;
    void kind; void grants;
  }
  for await (const page of client.pages('getRecordings', { query: { device_id: 'dev_opaque', limit: 1 } }, { maxPages: 2, maxItems: 2 })) {
    const total: number = page.total;
    const status: 'pending' | 'processing' | 'completed' | 'failed' | null | undefined = page.data[0]?.transcription_status;
    void total; void status;
  }
  // @ts-expect-error details require a path
  await client.read('getRecordingsById');
  // @ts-expect-error string limit is invalid
  await client.read('getDevices', { query: { limit: '1' } });
  // @ts-expect-error no declared writes in this package
  await client.read('createRecording');
  // @ts-expect-error no alternate URL in operation input
  await client.read('getDevices', { baseUrl: 'https://elsewhere.example/v1' });
  // @ts-expect-error detail operation cannot be paginated
  client.pages('getDevicesById');
  // @ts-expect-error no credentials from CLI/environment fallback
  createReadPrototype({});
}
function errorConsumer(error: ReadPrototypeError) {
  const status: number | undefined = error.status;
  const code: string | undefined = error.code;
  const requestId: string | undefined = error.requestId;
  const reset: string | undefined = error.headers['ratelimit-reset'];
  void status; void code; void requestId; void reset;
}
function dataConsumer(result: ReadResult<'getSummariesById'>) {
  if (result.status === 200) {
    const summary: ReadData<'getSummariesById'> = result.data;
    const projectId: string = summary.project_id;
    void projectId;
  }
}
void consumer; void errorConsumer; void dataConsumer;
