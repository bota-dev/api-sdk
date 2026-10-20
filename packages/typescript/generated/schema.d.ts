export interface paths {
    "/auth/identity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Project Credential Identity
         * @description Read only the verified project secret/restricted key context without a business-read scope. Secret scopes are null with project_secret mode; restricted scopes are exact granted metadata, including an empty array. Other operation-specific admission still applies. The test-mode flag does not certify test/live data or billing isolation. No human identity, key material, expiry or OAuth authority is returned. Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getAuthIdentity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Devices
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getDevices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Device
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getDevicesById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/end-users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List End Users
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getEndUsers"];
        put?: never;
        post?: never;
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
        /**
         * Get End User
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getEndUsersById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/recordings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Recordings
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getRecordings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/recordings/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Recording
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getRecordingsById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/summaries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Summaries
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getSummaries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/summaries/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Summary
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getSummariesById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/transcriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Transcriptions
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getTranscriptions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/transcriptions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Transcription
         * @description Error and header metadata describes the authenticated non-playground middleware chain. Header presence is conditional and does not imply cross-origin browser access; CORS policy applies.
         */
        get: operations["getTranscriptionsById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
        Device: {
            battery_percent: number | null;
            binding_generation: number;
            capabilities: number;
            /** Format: date-time */
            created_at: string;
            end_user_id: string | null;
            firmware_version: string | null;
            /** @example dev_abc123 */
            id: string;
            /** Format: date-time */
            last_heartbeat_at: string | null;
            mac_address: string | null;
            metadata: {
                [key: string]: unknown;
            };
            /** @enum {string} */
            model: "bota_pin" | "bota_note" | "bota_pin_pro";
            name: string | null;
            recording_state: {
                [key: string]: unknown;
            } | null;
            serial_number: string;
            settings: components["schemas"]["DeviceSettings"];
            signal_strength_dbm: number | null;
            /** @enum {string} */
            status: "unbound" | "bound";
            storage_total_mb: number | null;
            storage_used_mb: number | null;
            /** Format: date-time */
            updated_at: string;
        };
        DeviceSettings: {
            connection: {
                enabled_connections: {
                    cellular: boolean;
                    wifi: boolean;
                };
                heartbeat_enabled_connections: {
                    cellular: boolean;
                    wifi: boolean;
                };
                power_management: {
                    cellular_idle_timeout_seconds: -1 | 0 | number;
                    wifi_idle_timeout_seconds: -1 | 0 | number;
                };
                upload_network_preference: ("wifi" | "ble" | "cellular")[];
            };
            ota: {
                auto_update: {
                    enabled: boolean;
                };
                /** @enum {string} */
                source: "legacy" | "service";
            };
            processing: {
                auto_embedding: {
                    enabled: boolean;
                };
                auto_enhancement: {
                    enabled: boolean;
                    /** @enum {string} */
                    provider?: "cleanvoice";
                };
                auto_summary: {
                    enabled: boolean;
                    provider?: ("gemini" | "openai" | "claude") | null;
                    template?: string;
                };
                auto_transcription: {
                    enabled: boolean;
                    provider?: ("whisper" | "deepgram" | "assemblyai" | "elevenlabs") | null;
                };
            };
            upload: {
                /** @description Stored target; not enforced by released compatibility firmware */
                allow_roaming: boolean;
                /** @description Stored target; not enforced by released compatibility firmware */
                daily_data_limit_mb: number;
                /** @description Stored target; not enforced by released compatibility firmware */
                off_peak_hours: {
                    enabled: boolean;
                    end: string;
                    start: string;
                    timezone: string;
                } | null;
                /** @description Stored target; not enforced by released compatibility firmware */
                pause_on_low_battery: boolean;
                /** @description Stored target; released compatibility firmware uses a 512 KB full-chunk target */
                streaming_chunk_kb: number;
                streaming_enabled: boolean;
                /** @description Partial-chunk timer in seconds; 0 disables time-based flush */
                streaming_flush_interval_seconds: number;
            };
            upload_security: {
                /** @enum {string} */
                encrypted_upload_policy: "legacy_allowed" | "v2_preferred" | "v2_required";
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
        Error: {
            error: {
                code: string;
                message: string;
                param?: string;
                request_id?: string;
            };
        };
        ProjectIdentity: {
            is_test_mode: boolean;
            key_id: string;
            /** @enum {string} */
            key_type: "secret";
            organization_id: string;
            project_id: string;
            /** @enum {string} */
            scope_mode: "project_secret";
            scopes: null;
        } | {
            is_test_mode: boolean;
            key_id: string;
            /** @enum {string} */
            key_type: "restricted";
            organization_id: string;
            project_id: string;
            /** @enum {string} */
            scope_mode: "restricted";
            scopes: string[];
        };
        Recording: {
            /**
             * Format: uri
             * @description Pre-signed URL when a storage key is assigned; URL presence does not prove that the object exists or upload completion was accepted
             */
            audio_url?: string | null;
            chunk_count: number | null;
            content_sha256: string | null;
            /**
             * Format: date-time
             * @description Successful asynchronous server-side verification time; plaintext device OGG/Opus also requires valid media and declared length; null is not proof of failure
             */
            content_sha256_verified_at: string | null;
            /** Format: date-time */
            created_at: string;
            device_id: string | null;
            duration_seconds: number | null;
            end_user_id: string | null;
            /** @description Integer or canonical signed decimal string (up to 19 digits); raw PostgreSQL BIGINT values are strings. Preserve the string to avoid precision loss. */
            file_size_bytes: number | string | null;
            /** @example rec_abc123 */
            id: string;
            is_streaming: boolean;
            metadata: {
                [key: string]: unknown;
            };
            mime_type: string | null;
            name: string | null;
            /** Format: date-time */
            recorded_at: string | null;
            /** @description Generation of the stable logical recording identity */
            recording_generation: number | string | null;
            /**
             * Format: uuid
             * @description Stable device-side logical recording identity used for retry-safe creation
             */
            recording_uuid: string | null;
            /** @enum {string} */
            source: "device" | "app_import" | "api_upload";
            /** @enum {string} */
            status: "pending" | "streaming" | "uploaded" | "processing" | "completed" | "failed" | "integrity_failure";
            /** Format: date-time */
            updated_at: string;
            /**
             * @description Server-owned upload contract. Coordinated and BYO flows have their own admission and recovery contracts; their presence is not proof of enabled deployment. Not accepted on ordinary create.
             * @enum {string}
             */
            readonly upload_contract?: "legacy_v1" | "stream_v1" | "coordinated_v1" | "byo_v1";
            upload_method: ("ble" | "bluetooth_sync" | "wifi_upload" | "cellular_upload" | "wifi_direct" | "4g_direct" | "import" | "unknown") | null;
        };
        RecordingDetail: components["schemas"]["Recording"] & {
            /**
             * Format: uri
             * @description Pre-signed URL when a storage key is assigned; URL presence does not prove object existence or accepted upload completion
             */
            audio_url: string | null;
        };
        RecordingListItem: components["schemas"]["Recording"] & {
            summary_status: ("pending" | "processing" | "completed" | "failed") | null;
            transcription_status: ("pending" | "processing" | "completed" | "failed") | null;
        };
        RecordingMarkerAIContext: {
            marker_revision: string;
            recording_generation: number;
            recording_id: string;
            /** @description SHA-256 of raw canonical snapshot bytes, without a domain prefix */
            snapshot_sha256: string;
            transcription_id: string;
            /** @description Summary context pins the completed transcription version */
            transcription_version?: string;
        };
        RecordingMarkerAnnotation: {
            /** Format: uuid */
            id: string;
            media_offset_ms: string;
            segment_index: number;
            segment_offset_ms: string;
            sequence: number;
            /** @description Zero-based matching ASR intervals; empty means no matching transcript text, not inferred speech */
            transcript_segment_indices: number[];
        };
        Summary: {
            /** Format: date-time */
            completed_at: string | null;
            /** Format: date-time */
            created_at: string;
            custom_prompt: string | null;
            error_message: string | null;
            /** @example sum_abc123 */
            id: string;
            marker_annotations?: components["schemas"]["RecordingMarkerAnnotation"][] | null;
            marker_context?: components["schemas"]["RecordingMarkerAIContext"] | null;
            /** @description True only for a job bound to a verified published marker set; not a completion or deletion proof */
            marker_required?: boolean;
            output: {
                [key: string]: unknown;
            } | null;
            project_id: string;
            provider: string | null;
            /** Format: date-time */
            started_at: string | null;
            /** @enum {string} */
            status: "pending" | "processing" | "completed" | "failed";
            template_id: string | null;
            transcription_id: string;
            /** Format: date-time */
            updated_at: string;
        };
        Transcription: {
            /** Format: date-time */
            completed_at: string | null;
            /** @description Number or raw PostgreSQL DECIMAL(4,3) string with three fractional digits, including the PostgreSQL NaN sentinel. No probability-range constraint is imposed. */
            confidence: number | string | "NaN" | null;
            /** Format: date-time */
            created_at: string;
            error_message: string | null;
            full_text: string | null;
            /** @example txn_abc123 */
            id: string;
            language: string | null;
            marker_annotations?: components["schemas"]["RecordingMarkerAnnotation"][] | null;
            marker_context?: components["schemas"]["RecordingMarkerAIContext"] | null;
            /** @description True only for a job bound to a verified published marker set; not a completion or deletion proof */
            marker_required?: boolean;
            provider: string | null;
            recording_id: string;
            segments: components["schemas"]["TranscriptionSegment"][] | null;
            /** Format: date-time */
            started_at: string | null;
            /** @enum {string} */
            status: "pending" | "processing" | "completed" | "failed";
            /** @description Immutable server-issued version after marked transcription completion; null for ordinary legacy rows */
            transcript_version?: string | null;
            /** Format: date-time */
            updated_at: string;
            word_count: number | null;
        };
        TranscriptionSegment: {
            confidence?: number;
            end: number;
            speaker?: string;
            start: number;
            text: string;
        };
    };
    responses: {
        /** @description Organization access is temporarily locked while an organization deletion request is active. The organization owner may cancel the request through the dashboard during the grace period. */
        AuthenticatedReadOrganizationAccessQuarantined: {
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
    getAuthIdentity: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Verified project credential metadata */
            200: {
                headers: {
                    /** @description Identity responses must not be cached. */
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
                    "application/json": components["schemas"]["ProjectIdentity"];
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
            /** @description Project secret or restricted key required */
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getDevices: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description Exact scalar text; NUL characters are not accepted. */
                end_user_id?: string;
                limit?: number;
                /** @description Exact scalar text; NUL characters are not accepted. */
                serial_number?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of devices */
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
                    "application/json": {
                        data: components["schemas"]["Device"][];
                        has_more: boolean;
                        next_cursor?: string;
                    };
                };
            };
            /** @description Invalid pagination or supported date filters */
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
            /** @description A returned device no longer has configuration in the expected project */
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getDevicesById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Device details */
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
                    "application/json": components["schemas"]["Device"];
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getEndUsers: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description Exact scalar text; NUL characters are not accepted. */
                email?: ("" | string) & string;
                /** @description Exact scalar text; NUL characters are not accepted. */
                external_id?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of end users */
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
                    "application/json": {
                        data: components["schemas"]["EndUser"][];
                        has_more: boolean;
                        next_cursor?: string;
                    };
                };
            };
            /** @description Invalid pagination or supported date filters */
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getEndUsersById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description End user details */
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
                    "application/json": components["schemas"]["EndUser"];
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getRecordings: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description Exact scalar text; NUL characters are not accepted. */
                device_id?: string;
                /** @description RFC 3339 creation-time bound with zero to six fractional digits and Z or a numeric offset no greater than 15:59; date-only values are not accepted. Exclusive created_at bound; must be after start_date when both are supplied. */
                end_date?: string;
                /** @description Exact scalar text; NUL characters are not accepted. */
                end_user_id?: string;
                limit?: number;
                /** @description RFC 3339 creation-time bound with zero to six fractional digits and Z or a numeric offset no greater than 15:59; date-only values are not accepted. Inclusive created_at bound; must be before end_date when both are supplied. */
                start_date?: string;
                status?: "pending" | "streaming" | "uploaded" | "processing" | "completed" | "failed" | "integrity_failure";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of recordings with current processing statuses and total matching count */
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
                    "application/json": {
                        data: components["schemas"]["RecordingListItem"][];
                        has_more: boolean;
                        next_cursor?: string;
                        /** @description Count of all matching recordings before the page cursor is applied */
                        total: number;
                    };
                };
            };
            /** @description Invalid pagination or supported date filters */
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getRecordingsById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Recording details with an explicit nullable audio URL */
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
                    "application/json": components["schemas"]["RecordingDetail"];
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getSummaries: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description RFC 3339 creation-time bound with zero to six fractional digits and Z or a numeric offset no greater than 15:59; date-only values are not accepted. Exclusive created_at bound; must be after start_date when both are supplied. */
                end_date?: string;
                limit?: number;
                /** @description RFC 3339 creation-time bound with zero to six fractional digits and Z or a numeric offset no greater than 15:59; date-only values are not accepted. Inclusive created_at bound; must be before end_date when both are supplied. */
                start_date?: string;
                /** @description Exact scalar text; NUL characters are not accepted. */
                transcription_id?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of summaries */
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
                    "application/json": {
                        data: components["schemas"]["Summary"][];
                        has_more: boolean;
                        next_cursor?: string;
                    };
                };
            };
            /** @description Invalid pagination or supported date filters */
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getSummariesById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Summary details */
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
                    "application/json": components["schemas"]["Summary"];
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getTranscriptions: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description RFC 3339 creation-time bound with zero to six fractional digits and Z or a numeric offset no greater than 15:59; date-only values are not accepted. Exclusive created_at bound; must be after start_date when both are supplied. */
                end_date?: string;
                limit?: number;
                /** @description Exact scalar text; NUL characters are not accepted. */
                recording_id?: string;
                /** @description RFC 3339 creation-time bound with zero to six fractional digits and Z or a numeric offset no greater than 15:59; date-only values are not accepted. Inclusive created_at bound; must be before end_date when both are supplied. */
                start_date?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of transcriptions */
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
                    "application/json": {
                        data: components["schemas"]["Transcription"][];
                        has_more: boolean;
                        next_cursor?: string;
                    };
                };
            };
            /** @description Invalid pagination or supported date filters */
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
    getTranscriptionsById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Transcription details */
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
                    "application/json": components["schemas"]["Transcription"];
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
            423: components["responses"]["AuthenticatedReadOrganizationAccessQuarantined"];
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
