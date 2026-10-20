import type { components, operations, paths } from './generated/schema.js';

type Identity = operations['getAuthIdentity']['responses'][200]['content']['application/json'];
const identity: Identity = {
  project_id: 'proj_fixture', organization_id: 'org_fixture', key_id: 'sk_fixture',
  key_type: 'restricted', is_test_mode: false,
  scope_mode: 'restricted', scopes: ['recordings:read'],
};
const opaqueProjectId: string = identity.project_id;
const request: NonNullable<operations['getRecordings']['parameters']['query']> = { limit: 10, cursor: 'opaque-cursor', end_user_id: 'usr_fixture' };
// @ts-expect-error Deferred writes have no operation in this declared cohort.
type CreateRecording = operations['postRecordings'];
// @ts-expect-error There is no mutation method on the projected path.
const write: paths['/recordings']['post'] = {};
// @ts-expect-error No device-only key lookup is included.
type BleKey = paths['/ble-pubkey'];
// @ts-expect-error Query limits retain a number, not a CLI string.
const badLimit: NonNullable<operations['getRecordings']['parameters']['query']> = { limit: '10' };
void [opaqueProjectId, request, write, badLimit];

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type Recording = operations['getRecordingsById']['responses'][200]['content']['application/json'];
type Transcription = operations['getTranscriptionsById']['responses'][200]['content']['application/json'];
type Summary = operations['getSummariesById']['responses'][200]['content']['application/json'];
type Device = operations['getDevicesById']['responses'][200]['content']['application/json'];
type Processing = components['schemas']['DeviceSettings']['processing'];

// Exact unions prevent a future generator refresh from silently dropping null,
// numeric compatibility or enums, or widening these fields to unknown/any.
type ByteWire = Expect<Equal<Recording['file_size_bytes'], number | string | null>>;
type ConfidenceWire = Expect<Equal<Transcription['confidence'], number | string | null>>;
type DurationWire = Expect<Equal<Recording['duration_seconds'], number | null>>;
type UsedStorageWire = Expect<Equal<Device['storage_used_mb'], number | null>>;
type TotalStorageWire = Expect<Equal<Device['storage_total_mb'], number | null>>;
type RecordingGenerationWire = Expect<Equal<Recording['recording_generation'], number | string | null>>;
type MarkerGenerationWire = Expect<Equal<components['schemas']['RecordingMarkerAIContext']['recording_generation'], number>>;
type AsrWire = Expect<Equal<Processing['auto_transcription']['provider'],
  'whisper' | 'deepgram' | 'assemblyai' | 'elevenlabs' | null | undefined>>;
type LlmWire = Expect<Equal<Processing['auto_summary']['provider'],
  'gemini' | 'openai' | 'claude' | null | undefined>>;
type UploadMethodWire = Expect<Equal<Recording['upload_method'],
  'ble' | 'bluetooth_sync' | 'wifi_upload' | 'cellular_upload' | 'wifi_direct' |
  '4g_direct' | 'import' | 'unknown' | null>>;
type MarkerWire = Expect<Equal<Transcription['marker_context'],
  components['schemas']['RecordingMarkerAIContext'] | null | undefined>>;
type SummaryMarkerWire = Expect<Equal<Summary['marker_context'], Transcription['marker_context']>>;

const bytes: Recording['file_size_bytes'][] = [null, 13824000, '13824000', '9223372036854775807'];
const confidence: Transcription['confidence'][] = [null, 0.95, '0.950', '-9.999', 'NaN'];
const uploadMethods: Recording['upload_method'][] = [null, 'import', 'wifi_upload'];
const processing: Processing[] = [
  { auto_transcription: { enabled: false }, auto_summary: { enabled: false },
    auto_embedding: { enabled: false }, auto_enhancement: { enabled: false } },
  { auto_transcription: { enabled: true, provider: null }, auto_summary: { enabled: true, provider: null },
    auto_embedding: { enabled: false }, auto_enhancement: { enabled: false } },
  { auto_transcription: { enabled: true, provider: 'deepgram' }, auto_summary: { enabled: true, provider: 'openai' },
    auto_embedding: { enabled: false }, auto_enhancement: { enabled: false } },
];
const marker = {
  recording_id: 'rec_fixture', recording_generation: 1, marker_revision: '1',
  snapshot_sha256: 'a'.repeat(64), transcription_id: 'txn_fixture',
};
const transcriptionMarkers: Pick<Transcription, 'marker_context'>[] = [{}, { marker_context: null }, { marker_context: marker }];
const summaryMarkers: Pick<Summary, 'marker_context'>[] = [{}, { marker_context: null },
  { marker_context: { ...marker, transcription_version: 'b'.repeat(64) } }];

// @ts-expect-error JSON wire bytes are number/string/null, never a JS bigint.
const bigintBytes: Recording['file_size_bytes'] = 9223372036854775807n;
// @ts-expect-error A confidence value is not a boolean.
const booleanConfidence: Transcription['confidence'] = true;
// @ts-expect-error The INTEGER duration field was not widened to string.
const stringDuration: Recording['duration_seconds'] = '12';
// @ts-expect-error Device INTEGER storage was not widened to string.
const stringStorage: Device['storage_used_mb'] = '12';
// @ts-expect-error JSONB transcription-segment confidence remains numeric.
const stringSegmentConfidence: components['schemas']['TranscriptionSegment']['confidence'] = '0.950';
// @ts-expect-error Provider enums retain their separate ASR/LLM vocabularies.
const wrongAsr: Processing['auto_transcription']['provider'] = 'openai';
// @ts-expect-error Provider enums retain their separate ASR/LLM vocabularies.
const wrongLlm: Processing['auto_summary']['provider'] = 'deepgram';
// @ts-expect-error An arbitrary connection name is not an upload method.
const wrongUpload: Recording['upload_method'] = 'wifi';
// @ts-expect-error Nullable referenced objects still require their provenance fields.
const partialMarker: NonNullable<Transcription['marker_context']> = { recording_id: 'rec_fixture' };
// @ts-expect-error Marker provenance generation remains numeric, unlike the raw recording field.
const stringMarkerGeneration: NonNullable<Summary['marker_context']> = { ...marker, recording_generation: '1' };

// JSON Schema patterns/scale/range checks are not represented by plain TS
// strings. This deliberately compiles, demonstrating why these generated types
// cannot replace runtime wire validation or certify arbitrary string values.
const notRuntimeValidated: Recording['file_size_bytes'] = 'not-a-numeric-string';
void [bytes, confidence, uploadMethods, processing, transcriptionMarkers, summaryMarkers,
  bigintBytes, booleanConfidence, stringDuration, stringStorage, stringSegmentConfidence, wrongAsr, wrongLlm, wrongUpload,
  partialMarker, stringMarkerGeneration, notRuntimeValidated];

type ApiError = components['schemas']['Error'];
type BillingError = components['schemas']['BillingRateLimitError'];
type Read429 = operations['getRecordings']['responses'][429]['content']['application/json'];
type ParamWire = Expect<Equal<ApiError['error']['param'], string | undefined>>;
type RequestIdWire = Expect<Equal<ApiError['error']['request_id'], string | undefined>>;
type RateErrorWire = Expect<Equal<Read429, ApiError | BillingError>>;
const minimalError: ApiError = { error: { code: 'invalid_api_key', message: 'Invalid API key' } };
const parameterError: ApiError = { error: { code: 'invalid_request', message: 'Invalid cursor', param: 'cursor', request_id: 'request-fixture' } };
const billingError: BillingError = { error: {
  type: 'rate_limit_exceeded', code: 'RATE_LIMIT_EXCEEDED', message: 'Limit exceeded',
  details: { limit: 60, current: 61, reset_at: '2026-10-19T12:01:00.000Z', tier: 'future-tier' },
} };
const rateErrors: Read429[] = [minimalError, parameterError, billingError];
// @ts-expect-error The generic envelope still requires its message.
const missingMessage: ApiError = { error: { code: 'invalid_request' } };
// @ts-expect-error Parameter metadata remains a string.
const numericParam: ApiError['error']['param'] = 1;
// @ts-expect-error An absent request ID is optional, not null.
const nullRequestId: ApiError['error']['request_id'] = null;
// @ts-expect-error The explicit billing model requires complete numeric details.
const invalidBillingDetails: BillingError['error']['details'] = { limit: '60', current: 61, reset_at: '2026-10-19T12:01:00Z', tier: 'free' };
// Generic Error has an unrestricted code and permits additional wire fields.
// Thus the 429 anyOf is not a strict discriminated billing validator: this
// intentionally compiles through the generic alternative despite absent details.
const notBillingValidated: Read429 = { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'No details supplied' } };

type RecordingPage = operations['getRecordings']['responses'][200]['content']['application/json'];
type RecordingListItem = RecordingPage['data'][number];
type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | null;
type TranscriptionStatusWire = Expect<Equal<RecordingListItem['transcription_status'], ProcessingStatus>>;
type SummaryStatusWire = Expect<Equal<RecordingListItem['summary_status'], ProcessingStatus>>;
type TotalWire = Expect<Equal<RecordingPage['total'], number>>;
type AudioUrlWire = Expect<Equal<Recording['audio_url'], string | null>>;
type SummaryProjectWire = Expect<Equal<Summary['project_id'], string>>;
type SharedRecordingHasNoListStatuses = Expect<Equal<Extract<keyof components['schemas']['Recording'],
  'transcription_status' | 'summary_status'>, never>>;
const statuses: Pick<RecordingListItem, 'transcription_status' | 'summary_status'>[] = [
  { transcription_status: null, summary_status: null },
  { transcription_status: 'completed', summary_status: 'pending' },
];
const page: RecordingPage = { data: [], has_more: false, total: 0 };
const audioUrls: Pick<Recording, 'audio_url'>[] = [{ audio_url: null }, { audio_url: 'https://storage.example.test/fixture' }];
const sharedWithoutAudio: Pick<components['schemas']['Recording'], 'audio_url'> = {};
const summaryProject: Pick<Summary, 'project_id'> = { project_id: 'proj_fixture' };
// @ts-expect-error Both list processing statuses are required even when null.
const missingStatus: Pick<RecordingListItem, 'transcription_status' | 'summary_status'> = { transcription_status: null };
// @ts-expect-error 'none' is a filter value, not a returned processing status.
const filterOnlyStatus: RecordingListItem['transcription_status'] = 'none';
// @ts-expect-error The list envelope requires the total matching count.
const missingTotal: RecordingPage = { data: [], has_more: false };
// @ts-expect-error Detail always includes audio_url, including null.
const missingAudio: Pick<Recording, 'audio_url'> = {};
// @ts-expect-error Summary rows require their project ID.
const missingProject: Pick<Summary, 'project_id'> = {};
void [minimalError, parameterError, rateErrors, missingMessage, numericParam, nullRequestId,
  invalidBillingDetails, notBillingValidated, statuses, page, audioUrls, sharedWithoutAudio,
  summaryProject, missingStatus, filterOnlyStatus, missingTotal, missingAudio, missingProject];

type ReadHeaders = operations['getRecordings']['responses'][200]['headers'];
type RetryHeaders = operations['getRecordings']['responses'][429]['headers'];
type RelativeResetWire = Expect<Equal<ReadHeaders['RateLimit-Reset'], string | undefined>>;
type EpochResetWire = Expect<Equal<ReadHeaders['X-RateLimit-Reset'], string | undefined>>;
type HeaderRequestIdWire = Expect<Equal<ReadHeaders['X-Request-Id'], string | undefined>>;
type RetryAfterWire = Expect<Equal<RetryHeaders['Retry-After'], string | undefined>>;
type TierHeaderWire = Expect<Equal<ReadHeaders['X-RateLimit-Tier'], string | undefined>>;
type QuarantineCacheWire = Expect<Equal<operations['getRecordings']['responses'][423]['headers']['Cache-Control'], 'no-store' | undefined>>;
const absentConditionalHeaders: ReadHeaders = {};
const absentRetryHeader: RetryHeaders = {};
// Both resets are strings on the wire; their different units remain documented
// semantics, not different TS types: relative seconds versus Unix epoch seconds.
const rateHeaders: ReadHeaders = { 'RateLimit-Reset': '1', 'X-RateLimit-Reset': '1792411260',
  'X-Request-Id': 'caller-supplied ID', 'X-RateLimit-Tier': 'future-tier' };
// @ts-expect-error Raw HTTP header values remain strings, not parsed numbers.
const numericResetHeader: ReadHeaders = { 'RateLimit-Reset': 1 };
// @ts-expect-error A cache header declaration is not an arbitrary cache policy.
const wrongCacheHeader: operations['getRecordings']['responses'][423]['headers']['Cache-Control'] = 'public';
void [absentConditionalHeaders, absentRetryHeader, rateHeaders, numericResetHeader, wrongCacheHeader];
