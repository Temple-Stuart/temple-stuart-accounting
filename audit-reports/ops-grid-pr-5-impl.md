# OPS-GRID-PR-5 — PieceGrid view (scenes × days editable cell grid)

**Branch:** `claude/ops-grid-pr-5` (off `main`; PR-1..4 all merged — scenes `:2897`, pieces `:2926`, takes `:2958`)
**Date:** 2026-06-03
**One concept:** render Alex's content grid in-app — **rows = scenes**, **columns = pieces (days)**,
**cells = takes (editable script)** — reading the three tables from PR-1..4, with a fully-authed
read endpoint + cell-upsert endpoint (+ a "+ day" piece-create for columns to exist).
Per `audit-reports/ops-content-table-audit.md` (Q4: build a **new** pivoted PieceGrid) + ops-grid-pr-1..4.
**No schema change** (git diff carries no `prisma/schema.prisma`). New view + routes only.

---

## 1. Audit (cited)

### The three grid models (as they exist on `main` now)
- **Scene-row** `operations_content_scenes` (`schema.prisma:2897`): `routine_step_id @unique`,
  `camera_needed`/`filming_angle`/`shot_type` (VarChar 200), `b_roll`/`narrative_purpose`/`notes`
  (Text); relation `routine_step` → `operations_routine_steps` (`step_order`, `activity`,
  `time_of_day`) for row labels; inverse `takes` (PR-4).
- **Piece-column** `operations_content_pieces` (`:2926`): `piece_date @db.Date`, `title`,
  `project_id`, `source_ai_usage_id`; inverse `takes` (PR-4).
- **Cell** `operations_content_takes` (`:2958`): `scene_id`, `piece_id`, `script @db.Text`,
  `@@unique([scene_id, piece_id])` (the grid invariant → Prisma compound key `scene_id_piece_id`).

### Existing Content auth pattern mirrored (cited)
`src/app/api/operations/content/takes/route.ts` — `getVerifiedEmail()` (`@/lib/cookie-auth`) → 401;
`prisma.users.findFirst({ email insensitive })` → 404; every query `WHERE user_id = user.id`;
ownership pre-check → defensive **404** (`route.ts:149-152`); `entity_id` **server-derived from the
parent, never the client** (`:154-155`); `writeAuditLog({ actor, action, target, payload })` after
writes (`:180`); `isValidUuid` (`@/lib/operations/parseUuid`). The new routes copy this shape exactly.

### Primitive reused (not reshaped)
`ScriptDrawer` (`src/components/.../content/ScriptDrawer.tsx`) — its save semantics (trim →
empty=null, no-change closes without firing, optimistic + rollback by re-throwing from `onSave`)
are exactly a cell editor. **Reused verbatim** by feeding it cell data; `ContentTable` is **not**
touched. How scenes derive from routines (Scenify) is unchanged — the grid reads existing scenes
and labels each row by its `routine_step`.

### What was MISSING vs present
Present: the three tables + the field-list `ContentTable`. Missing (built here): a **read endpoint**
returning scenes+pieces+cells together, a **cell-upsert endpoint**, a **piece-create** ("+ day"),
and the **pivoted grid view**. No existing endpoint exposed pieces or the cell table.

---

## 2. Read endpoints (authed, read-only)

**`GET /api/operations/content/grid`** (`src/app/api/operations/content/grid/route.ts`) — three
user-scoped reads in one response: `scenes` (each `include: routine_step` for order/activity,
ordered by `step_order`), `pieces` (ordered by `piece_date`), `cells`. Auth mirrors the content
takes route (cookie verify → 401, users → 404, every `where` carries `user_id: user.id`); optional
`?entity_id` validated. **No audit** (read-only). A cell can only appear if its own row is the
user's, because the cell query is user-scoped too.

---

## 3. Cell upsert endpoint (authed write — the only cell write path)

**`POST /api/operations/content/grid/cell`** (`grid/cell/route.ts`):
- Validates `scene_id`/`piece_id` are UUIDs, `script` optional (trim → empty=null).
- **Both-ownership check:** `scene` must be the user's (`findFirst id+user_id`) → 404, **and**
  `piece` must be the user's → 404 — a single defensive 404, no leak of which failed.
- `entity_id` **server-derived from the scene**, never the client.
- Upserts on the `@@unique([scene_id, piece_id])` key (`scene_id_piece_id`); a `findUnique`
  pre-resolves create-vs-update so the audit action is accurate.
- `writeAuditLog` after: `operations_content_take_created` (insert) / `operations_content_take_updated`
  (update), `target.table = operations_content_takes`, `before`/`after`/`metadata` payload.
- No fabricated data, no silent fallback — a failed write throws and surfaces inline in the drawer.

---

## 4. The "+ day" piece-create endpoint (authed write)

**`POST /api/operations/content/grid/piece`** (`grid/piece/route.ts`) — creates a day/column.
`piece_date` (YYYY-MM-DD) required; `entity_id` **must name an entity owned by the caller**
(`prisma.entities.findFirst({ id, userId: user.id })` → defensive 404 — `entities.userId` is the
ownership column, `schema.prisma:66`); `user_id` server-set from auth; `project_id`/
`source_ai_usage_id` intentionally **not** set (linking is a later PR).

**Audit honesty note (the one judgment call):** there is **no `operations_content_piece_*`
AuditActionType** — adding one is a schema change, which this view PR must not make ("stop and flag
rather than ALTER mid-view-build"). Rather than skip the audit (forbidden) or mislabel it as a
scene/take, the write is logged + hash-chained under **`system_other`** with
`target.table = operations_content_pieces` and a descriptive message. **FOLLOW-UP flagged:** add
`operations_content_piece_created/updated/deleted` enum values and switch this route over. This
keeps every write audited while respecting no-schema-change.

---

## 5. The PieceGrid view (cited)

`src/components/workbench/operations/content/PieceGrid.tsx` — a **new** client component (does not
reshape `ContentTable`):
- **Rows** = scenes, labeled `{step_order}. {activity}` with shot meta (`filming_angle · shot_type`)
  beneath; sticky first column.
- **Columns** = pieces, header = `piece_date` (+ optional `title`); if `project_id`/
  `source_ai_usage_id` are set, a read-only `🔗 linked` indicator with a tooltip surfaces them
  (no linking UI — later PR).
- **Cells** = takes: a script preview (`+ script` when empty); clicking opens the **reused
  ScriptDrawer**, and saving calls the upsert and merges the returned cell into local state.
- **"+ day"** affordance (trailing column): inline date input → `POST …/grid/piece`, inserts the
  new column in date order.
- **Empty states:** no scenes → "Scenify a routine on the Content table above"; no days → "+ day to
  add the first column."
- **Entity selector** scopes rows/columns; defaults to the first entity with scenes so "+ day" has a
  concrete target.
- **Palette:** only existing tokens (`border-border`, `border-border-light`, `bg-bg-row`,
  `text-text-primary/muted/faint`, `brand-purple`, `font-mono`, red error block) — **no new colors**.

**Mounted** on the Content tab: `src/app/operations/content/page.tsx` now renders
`<SectionG_Content />` and `<PieceGrid />` stacked (one-line addition; SectionG untouched).

---

## 6. Verify (cited)
- **Grid renders scenes × pieces with editable cells; edit upserts via the unique key:** PieceGrid
  maps `cellByKey(scene_id:piece_id)`; `handleCellSave` → `POST /grid/cell` → upsert on
  `scene_id_piece_id`.
- **Reads + writes user-scoped + audited; defensive 404 cross-user:** all three routes filter by
  `user_id`; cell-upsert checks scene **and** piece ownership (404); piece-create checks entity
  ownership (404); both writes `writeAuditLog`.
- **New PieceGrid; ContentTable NOT reshaped; mounted on Content tab:** `git diff --name-only` shows
  only `page.tsx` modified + new `grid/*` routes + new `PieceGrid.tsx`; no `ContentTable`/`SectionG`
  change.
- **No schema change; no new colors; home + other tabs untouched:** no `prisma/schema.prisma` in the
  diff; palette uses existing tokens only; no `home`/showroom files touched.
- **tsc + lint clean:** `npx tsc --noEmit` → **exit 0** (also validates the `scene_id_piece_id`
  compound key against the generated client); `npx eslint` on all changed/new files → **exit 0**.

---

## 7. Scope boundaries (flagged for follow-ups)
- **`operations_content_piece_*` audit enum** — add it, switch piece-create off `system_other` (§4).
- **Project/version linking UI** — this PR only *surfaces* a piece's existing link; setting it is later.
- **PR-1 route/vocab mismatch** — the legacy `/content/scenes` & `/content/takes` URLs still map to
  the container/scene-row (flagged in PR-1); the new grid uses clean `/content/grid*` routes and does
  not touch them.

---

**git diff = read route + cell-upsert route + piece-create route + PieceGrid + Content-tab mount (+ this report).**
No schema change. Real authed routes (cookie + user-scope + defensive 404 + audit). Existing palette only.
