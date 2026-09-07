-- RULEBOOK-01: EVERY ARRIVAL GETS ITS KIND. The deck's step 4: each feed gets
-- one written rule — its kind — and the system applies it to every arrival of
-- that feed, forever after. The rule book is src/lib/providers.ts RULE_BOOK
-- (the deck's ROUTING_RULES rows verbatim plus the rows the deck's sample
-- omits); landing consults it (src/lib/arrivals/land.ts) and an arrival with
-- no rule is a loud failure. This migration gives the store the column and
-- applies the book to the rows already landed.
--
-- THE UPDATE APPLIES THE RULE BOOK; IT INVENTS NOTHING. Three rules cover
-- every (provider, resource) the store has landed (Alex's census, September 7,
-- 2026: plaid · transaction, plaid · investment_transaction, plaid · security):
--   plaid · transaction            → event      (ROUTING_RULES, the deck)
--   plaid · investment_transaction → event      (ADDED_RULES)
--   plaid · security               → reference  (ADDED_RULES)
-- A row the book does not cover STOPS the migration (the DO block below raises
-- before SET NOT NULL); the fix is a rule in providers.ts, never a default.
--
-- Applied by `prisma migrate deploy` at deploy (schema.prisma moves with it);
-- Prisma runs it in one transaction on Postgres, so a raise leaves nothing
-- behind. Enum order = src/lib/providers.ts ARRIVAL_KINDS = the deck's
-- HANDOFF_KINDS (asserted at build). Promise 1 grows by one column: kind is
-- frozen at insert like every other identity column.

CREATE TYPE arrival_kind AS ENUM ('reference', 'registry', 'event', 'derived', 'snapshot', 'posting');

ALTER TABLE arrivals ADD COLUMN kind arrival_kind NULL;

UPDATE arrivals SET kind = 'event'     WHERE kind IS NULL AND provider = 'plaid' AND resource = 'transaction';
UPDATE arrivals SET kind = 'event'     WHERE kind IS NULL AND provider = 'plaid' AND resource = 'investment_transaction';
UPDATE arrivals SET kind = 'reference' WHERE kind IS NULL AND provider = 'plaid' AND resource = 'security';

DO $$
DECLARE
    n bigint;
    pairs text;
BEGIN
    SELECT count(*), string_agg(DISTINCT provider::text || ' · ' || resource, ', ')
      INTO n, pairs
      FROM arrivals WHERE kind IS NULL;
    IF n > 0 THEN
        RAISE EXCEPTION 'arrival_kind: % arrivals carry no rule (%) — add the rule to src/lib/providers.ts RULE_BOOK and this migration before SET NOT NULL; nothing is assumed', n, pairs
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
END;
$$;

ALTER TABLE arrivals ALTER COLUMN kind SET NOT NULL;

-- Promise 1 now covers kind: an arrival's kind never changes after it lands.
CREATE OR REPLACE FUNCTION arrivals_promise_1() RETURNS trigger
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
    OR NEW.guest_ref     IS DISTINCT FROM OLD.guest_ref
    OR NEW.kind          IS DISTINCT FROM OLD.kind THEN
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
