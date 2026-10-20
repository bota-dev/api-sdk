import { BotaApiClient, BotaMutationError } from './index.ts';
import type { MutationInput, MutationResult } from './index.ts';

const client = new BotaApiClient({ credentials: 'synthetic_type_only' });
const create: MutationInput<'postEndUsers'> = { body: { external_id: 'customer-id', metadata: { nested: [null, true] } } };
const created: Promise<MutationResult<'postEndUsers'>> = client.postEndUsers(create, { maxRetries: 0 });
const updated = client.patchEndUsersById({ path: { id: 'eu_opaque' }, body: { metadata: {} } });
void created; void updated; void BotaMutationError;
// @ts-expect-error body is explicit, including empty objects
void client.postEndUsers({});
// @ts-expect-error PATCH requires a resource id
void client.patchEndUsersById({ body: {} });
// @ts-expect-error mutations cannot request a retry
void client.postEndUsers(create, { maxRetries: 1 });
// @ts-expect-error external_id is immutable through PATCH
void client.patchEndUsersById({ path: { id: 'eu' }, body: { external_id: 'new' } });
