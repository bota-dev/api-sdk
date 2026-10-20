# Synthetic localhost TLS fixture

This certificate and private key were newly generated solely for the SDK's
loopback certificate-validation rejection test. They are intentionally public
test data, carry only localhost/127.0.0.1/::1 identities, and are not trusted by
the SDK. They grant no access to any Bota account, API, deployment or service.

Never install this certificate into a trust store or use this key outside the
local negative test. The test uses the SDK's normal certificate verification
and proves refusal before HTTP/Authorization reaches the server. It does not
establish trusted TLS success, hostname validation, live backend acceptance or
production certificate configuration.

OpenSSL created the fixture once; running tests requires only Python's standard
`ssl` module and the locked aiohttp adapter, with no OpenSSL executable or network
dependency beyond the test's loopback listener.
