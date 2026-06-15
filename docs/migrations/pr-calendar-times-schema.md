# Migration — PR-Calendar-Times-Schema

**Run this in psql BEFORE merging the PR.** It adds two nullable time columns to
`calendar_events` so committed trip events (flights, hotels) can carry a time-of-day and
render as timed blocks instead of all-day. Nullable → every existing row is unaffected
(null times = all-day, exactly the current behavior).

## SQL (run via psql)

```sql
ALTER TABLE calendar_events
  ADD COLUMN start_time TIME(6),
  ADD COLUMN end_time   TIME(6);
```

That's it — no backfill, no NOT NULL, no index. Existing inserts (explicit column lists,
e.g. `vendor-commit/route.ts:336`, shopping/agenda/growth/etc.) omit these columns, so they
keep writing null → all-day, unchanged.

## What this PR already did (so the types match the DB)

- `prisma/schema.prisma` `model calendar_events`: added
  `start_time DateTime? @db.Time(6)` and `end_time DateTime? @db.Time(6)` (mirrors
  `trip_itinerary.block_start_time/block_end_time`, which use `@db.Time(6)`).
- Ran `npx prisma generate` so the Prisma client TypeScript types include the columns.

## Not in this PR (the next two PRs)

- **PR-Flight-Times** — write depart/arrive times into `calendar_events.start_time/end_time`
  at flight commit + map them in `HubCalendar` so flights render wheels-up → wheels-down.
- **PR-Hotel-Nightly** — per-night timed blocks for a stay (check-in → check-out × N nights).

This PR is foundation only: the columns exist; nothing writes or reads them yet.
