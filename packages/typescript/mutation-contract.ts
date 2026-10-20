import cohort from './mutation-cohort.json' with { type: 'json' };
import type { operations } from './generated/mutations-schema.d.ts';

export type MutationOperation = keyof operations;
type Body<O extends MutationOperation> = NonNullable<operations[O]['requestBody']>['content']['application/json'];
export type MutationInput<O extends MutationOperation> = {
  body: Body<O>;
} & (O extends 'patchEndUsersById' ? { path: { id: string } } : { path?: never });
export type MutationData<O extends MutationOperation> = O extends 'postEndUsers'
  ? operations['postEndUsers']['responses'][201]['content']['application/json']
  : operations['patchEndUsersById']['responses'][200]['content']['application/json'];
export type MutationResult<O extends MutationOperation> = {
  status: O extends 'postEndUsers' ? 201 : 200;
  data: MutationData<O>;
  headers: Readonly<Record<string, string>>;
};
export interface MutationRequestOptions { signal?: AbortSignal; timeoutMs?: number; maxRetries?: 0 }

/** An explicit admitted cohort; arbitrary OpenAPI operations do not gain write authority. */
export function mutationOperation(operation: MutationOperation) {
  const item = cohort.operations.find(item => item.operationId === operation);
  return item ? Object.freeze({ ...item }) as Readonly<
    { operationId: MutationOperation; method: 'POST' | 'PATCH'; path: string; successStatus: 200 | 201 }> : undefined;
}
