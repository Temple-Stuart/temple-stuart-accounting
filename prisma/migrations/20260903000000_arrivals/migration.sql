-- REBUILD-01 PR-1: THE ARRIVALS STORE — the blueprint's step 3 as tables.
-- Every provider answer lands once, word for word, fingerprinted, before
-- anyone decides what it means. Two tables:
--   provider_responses — the wire: the exact bytes of one HTTP answer, sha256'd
--   arrivals           — the deck's row: one per provider object, the eleven
--                        fields of IMPORT_COLUMNS (src/components/landing/
--                        Landing.tsx) plus who it belongs to and which
--                        response it came from
-- The ten README-desk rulings, all locked: per-object rows over a wire-exact
-- response store; composed ids labeled (their_id_kind); secrets redacted and
-- declared (redactions); Stripe's first feed is the webhook; guests land by
-- reference (guest_ref); one Plaid writer (PR-2/3); no synthetic backfill;
-- keep forever (no DELETE policy here — a purge is a future policy PR); tokens
-- already encrypted (SEC-02); one provider vocabulary shared by deck, schema
-- and code (src/lib/providers.ts — the enum below IS its code set, and the
-- build asserts it).
--
-- SCHEMA ONLY: nothing in this PR writes a row. The generated Prisma client
-- is not committed.
--
-- ADDITIVE-ONLY (the HARD-GATE posture): three types, two tables, one trigger.
-- Zero data rewrites, zero changes to existing rows or tables.
--
-- Applied by Alex via psql (repo law: schema.prisma + this SQL move together;
-- Claude Code authors the file only — it cannot reach Azure). Idempotence is
-- deliberately NOT claimed: this file runs once; a second run fails loudly on
-- the first CREATE TYPE.
--
-- id types matched to their targets (verified against schema.prisma):
--   users.id  TEXT  (String @id; schema:494)
-- FK posture: NO ACTION on users and on provider_responses — an arrival is
-- kept forever, so deleting an owner or a response with arrivals behind it
-- fails LOUDLY (the corpus foundation precedent of hash + UNIQUE columns is
-- reused here in shape: bytea hashes, octet_length CHECKs, a UNIQUE key).
--
-- Constraint and index names follow Prisma's defaults (<table>_<cols>_idx /
-- _key / _fkey / _pkey) so `prisma migrate diff` reads the database as the
-- model describes it.

BEGIN;

-- STEP 1: the three vocabularies.
-- arrival_provider: every provider the deck names (PROVIDER_MENU, today and
-- next), alphabetical — src/lib/providers.ts PROVIDER_CODES, asserted at build.
CREATE TYPE arrival_provider AS ENUM ('alpaca', 'amadeus', 'anthropic', 'ecfr', 'federal_register', 'finnhub', 'fred', 'google_places', 'ibkr', 'irs', 'liteapi', 'openai', 'plaid', 'polygon', 'schwab', 'sec', 'snaptrade', 'square', 'stripe', 'tastytrade', 'teller', 'tradier', 'travel_buddy', 'us_code', 'viator', 'voyage', 'xai_grok');
CREATE TYPE arrival_status AS ENUM ('pending', 'done', 'failed');
CREATE TYPE their_id_kind AS ENUM ('provider', 'composed');

-- STEP 2: provider_responses — the wire, exact bytes, one row per HTTP answer.
CREATE TABLE provider_responses (
    id          text PRIMARY KEY,
    provider    arrival_provider NOT NULL,
    resource    text NOT NULL,
    user_id     text NULL REFERENCES users(id),
    guest_ref   text NULL,
    http_status integer NOT NULL,
    body        bytea NOT NULL,
    body_sha256 bytea NOT NULL,
    asked       timestamptz NOT NULL,
    arrived     timestamptz NOT NULL,
    CONSTRAINT provider_responses_body_sha256_len_chk CHECK (octet_length(body_sha256) = 32),
    CONSTRAINT provider_responses_body_size_chk CHECK (octet_length(body) <= 1048576),
    CONSTRAINT provider_responses_owner_chk CHECK (user_id IS NOT NULL OR guest_ref IS NOT NULL)
);

CREATE INDEX provider_responses_user_id_provider_arrived_idx
    ON provider_responses (user_id, provider, arrived DESC);

-- STEP 3: arrivals — the deck's row, one per provider object.
-- id is "our id"; (provider, their_id) is unique so the same thing is never
-- imported twice; their_id_kind says whether their_id is the provider's own
-- id or one we composed; redactions declares every path we blanked before
-- the payload was saved (secrets never land).
CREATE TABLE arrivals (
    id            text PRIMARY KEY,
    provider      arrival_provider NOT NULL,
    connection    text NULL,
    resource      text NOT NULL,
    their_id      text NOT NULL,
    their_id_kind their_id_kind NOT NULL,
    payload       jsonb NOT NULL,
    fingerprint   bytea NOT NULL,
    redactions    text[] NOT NULL DEFAULT '{}',
    asked         timestamptz NOT NULL,
    arrived       timestamptz NULL,
    read          timestamptz NULL,
    status        arrival_status NOT NULL DEFAULT 'pending',
    response_id   text NULL REFERENCES provider_responses(id),
    user_id       text NULL REFERENCES users(id),
    guest_ref     text NULL,
    CONSTRAINT arrivals_fingerprint_len_chk CHECK (octet_length(fingerprint) = 32),
    CONSTRAINT arrivals_payload_size_chk CHECK (pg_column_size(payload) <= 1048576),
    CONSTRAINT arrivals_owner_chk CHECK (user_id IS NOT NULL OR guest_ref IS NOT NULL),
    CONSTRAINT arrivals_provider_their_id_key UNIQUE (provider, their_id)
);

CREATE INDEX arrivals_user_id_provider_resource_arrived_idx
    ON arrivals (user_id, provider, resource, arrived DESC);
CREATE INDEX arrivals_status_idx ON arrivals (status);
CREATE INDEX arrivals_response_id_idx ON arrivals (response_id);

-- STEP 4: PROMISE 1 as a database law, not a convention. An arrival never
-- changes: every identity, payload, timing and ownership column is frozen at
-- insert. Only `read` and `status` may move, and each exactly once — read
-- from NULL to a time, status from 'pending' to 'done' or 'failed'. There is
-- no updated_at column because there is no update to stamp.
CREATE FUNCTION arrivals_promise_1() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.provider      IS DISTINCT FROM OLD.provider
    OR NEW.connection    IS DISTINCT FROM OLD.connection
    OR NEW.resource      IS DISTINCT FROM OLD.resource
    OR NEW.their_id      IS DISTINCT FROM OLD.their_id
    OR NEW.their_id_kind IS DISTINCT FROM OLD.their_id_kind
    OR NEW.payload       IS DISTINCT FROM OLD.payload
    OR NEW.fingerprint   IS DISTINCT FROM OLD.fingerprint
    OR NEW.redactions    IS DISTINCT FROM OLD.redactions
    OR NEW.asked         IS DISTINCT FROM OLD.asked
    OR NEW.arrived       IS DISTINCT FROM OLD.arrived
    OR NEW.response_id   IS DISTINCT FROM OLD.response_id
    OR NEW.user_id       IS DISTINCT FROM OLD.user_id
    OR NEW.guest_ref     IS DISTINCT FROM OLD.guest_ref THEN
        RAISE EXCEPTION 'arrivals promise 1: an arrival never changes (id %)', OLD.id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.read IS DISTINCT FROM OLD.read AND OLD.read IS NOT NULL THEN
        RAISE EXCEPTION 'arrivals promise 1: read is set once, from NULL (id %)', OLD.id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending' THEN
        RAISE EXCEPTION 'arrivals promise 1: status moves once, from pending (id %)', OLD.id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER arrivals_promise_1
    BEFORE UPDATE ON arrivals
    FOR EACH ROW EXECUTE FUNCTION arrivals_promise_1();

COMMIT;
