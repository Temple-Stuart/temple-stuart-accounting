-- REBUILD-01 PR-4b: NO SECRET AT REST IN THE WIRE ROW EITHER. Ruled (Q3):
-- secrets are redacted before landing, the fingerprint covers the redacted
-- bytes, and the redaction is declared on the row — for the wire row as for
-- the arrival. provider_responses.redactions declares every path blanked in
-- the stored body: '{}' means the body is the exact wire bytes; a non-empty
-- list means the body is the canonical (RFC 8785) re-serialization of the
-- redacted answer and body_sha256 is over THOSE stored bytes
-- (src/lib/arrivals/land.ts landResponse; the Stripe landing declares
-- client_secret paths, src/lib/arrivals/stripeWebhook.ts).
--
-- ADDITIVE-ONLY: one column with a default; every existing row reads '{}' —
-- true of them: nothing was ever redacted before this. Zero data rewrites.
-- Applied by `prisma migrate deploy` at deploy (schema.prisma moves with it).

ALTER TABLE provider_responses ADD COLUMN redactions text[] NOT NULL DEFAULT '{}';
