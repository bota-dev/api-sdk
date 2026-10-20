export interface paths {
    "/end-users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create End User
         * @description Create a project-scoped end user. A JSON object is required; {} is allowed. Unknown request properties are stripped. Omitted optional values use stored defaults. A non-null external_id is project-unique for active end users; duplicate creation returns 409, not a recovered success. The response preserves the existing repository row and may include additional properties. The SDK does not automatically retry, supply an Idempotency-Key, or reconcile an uncertain outcome. Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        post: operations["postEndUsers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/end-users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update End User
         * @description Update name, email or metadata in the authenticated project. A JSON object is required; {} is allowed and returns the current active row without an update. Omitted fields stay unchanged. Supplied metadata replaces the whole metadata object, without a merge. external_id is immutable through this operation; it and other unknown properties are stripped. Null is not accepted for the declared request fields. The response preserves the existing repository row and may include additional properties. The SDK does not automatically retry, supply an Idempotency-Key, or reconcile an uncertain outcome. Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        patch: operations["patchEndUsersById"];
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        BillingRateLimitError: {
            error: {
                /** @enum {string} */
                code: "RATE_LIMIT_EXCEEDED";
                details: {
                    current: number;
                    limit: number;
                    /** Format: date-time */
                    reset_at: string;
                    tier: string;
                };
                message: string;
                /** @enum {string} */
                type: "rate_limit_exceeded";
            };
        };
        EndUser: {
            /** Format: date-time */
            created_at: string;
            email: string | null;
            external_id: string | null;
            /** @example eu_abc123 */
            id: string;
            metadata: {
                [key: string]: unknown;
            };
            name: string | null;
            /** Format: date-time */
            updated_at: string;
        };
        EndUserWrite: components["schemas"]["EndUser"] & {
            deleted_at: null;
            project_assignment_generation: number;
            project_id: string;
        };
        Error: {
            error: {
                code: string;
                message: string;
                param?: string;
                request_id?: string;
            };
        };
    };
    responses: {
        /** @description Organization access is temporarily locked while an organization deletion request is active. The organization owner may cancel the request through the dashboard during the grace period. */
        AuthenticatedEndUserWriteOrganizationAccessQuarantined: {
            headers: {
                /** @description Quarantine responses must not be cached. */
                "Cache-Control"?: "no-store";
                /** @description Standard limiter request quota when evaluated. */
                "RateLimit-Limit"?: string;
                /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                "RateLimit-Policy"?: string;
                /** @description Remaining requests in the standard limiter window when evaluated. */
                "RateLimit-Remaining"?: string;
                /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                "RateLimit-Reset"?: string;
                /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                "X-RateLimit-Limit"?: string;
                /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                "X-RateLimit-Remaining"?: string;
                /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                "X-RateLimit-Reset"?: string;
                /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                "X-RateLimit-Tier"?: string;
                /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": {
                    error: {
                        /** @constant */
                        code: "organization_access_quarantined";
                        /** @constant */
                        message: "Organization access is temporarily locked";
                        request_id?: string;
                    };
                };
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: {
        /** @description Standard limiter request quota when evaluated. */
        AuthenticatedReadRateLimitLimit: string;
        /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
        AuthenticatedReadRateLimitPolicy: string;
        /** @description Remaining requests in the standard limiter window when evaluated. */
        AuthenticatedReadRateLimitRemaining: string;
        /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
        AuthenticatedReadRateLimitReset: string;
        /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
        AuthenticatedReadXRateLimitLimit: string;
        /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
        AuthenticatedReadXRateLimitRemaining: string;
        /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
        AuthenticatedReadXRateLimitReset: string;
        /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
        AuthenticatedReadXRateLimitTier: string;
        /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
        AuthenticatedReadXRequestId: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    postEndUsers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email?: string;
                    external_id?: string;
                    metadata?: {
                        [key: string]: unknown;
                    };
                    name?: string;
                };
            };
        };
        responses: {
            /** @description End user created; existing repository-row response */
            201: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EndUserWrite"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing, invalid, expired or revoked credential */
            401: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Credential type, restricted-key scope or exact-owner admission denied */
            403: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Duplicate active external_id, or optional generic idempotency admission refused */
            409: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            423: components["responses"]["AuthenticatedEndUserWriteOrganizationAccessQuarantined"];
            /** @description Standard limiter, failed-authentication block or conditional billing-tier limit exceeded; envelopes differ by source */
            429: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Delay in seconds set only by the standard limiter when it rejects a request. Failed-authentication blocks and billing-tier 429 responses omit this header. */
                    "Retry-After"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"] | components["schemas"]["BillingRateLimitError"];
                };
            };
            /** @description Unexpected server or dependency failure */
            500: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    patchEndUsersById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email?: string;
                    metadata?: {
                        [key: string]: unknown;
                    };
                    name?: string;
                };
            };
        };
        responses: {
            /** @description Updated or unchanged end user; existing repository-row response */
            200: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EndUserWrite"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing, invalid, expired or revoked credential */
            401: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Credential type, restricted-key scope or exact-owner admission denied */
            403: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Optional generic idempotency admission refused */
            409: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            423: components["responses"]["AuthenticatedEndUserWriteOrganizationAccessQuarantined"];
            /** @description Standard limiter, failed-authentication block or conditional billing-tier limit exceeded; envelopes differ by source */
            429: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Delay in seconds set only by the standard limiter when it rejects a request. Failed-authentication blocks and billing-tier 429 responses omit this header. */
                    "Retry-After"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"] | components["schemas"]["BillingRateLimitError"];
                };
            };
            /** @description Unexpected server or dependency failure */
            500: {
                headers: {
                    /** @description Standard limiter request quota when evaluated. */
                    "RateLimit-Limit"?: string;
                    /** @description Standard limiter policy when evaluated, currently draft-6 quota/window syntax. This header does not establish billing-tier admission. */
                    "RateLimit-Policy"?: string;
                    /** @description Remaining requests in the standard limiter window when evaluated. */
                    "RateLimit-Remaining"?: string;
                    /** @description Seconds remaining until the standard limiter window resets, not an epoch timestamp. */
                    "RateLimit-Reset"?: string;
                    /** @description Billing-tier request quota only when billing initializes, a limited tier resolves and its check succeeds; omitted for unlimited tiers, disabled billing or check failures. */
                    "X-RateLimit-Limit"?: string;
                    /** @description Remaining billing-tier requests when that limited-tier check succeeds. */
                    "X-RateLimit-Remaining"?: string;
                    /** @description Billing-tier window reset as Unix epoch seconds, unlike the relative RateLimit-Reset header; present only after a limited-tier check succeeds. */
                    "X-RateLimit-Reset"?: string;
                    /** @description Resolved billing tier when a limited-tier check succeeds. Unknown tier names can be returned; no closed tier enum is guaranteed. */
                    "X-RateLimit-Tier"?: string;
                    /** @description Opaque request correlation ID when request-ID middleware runs. Caller-supplied values are accepted; no generated-ID format is guaranteed. */
                    "X-Request-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
