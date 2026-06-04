# OPS-CE-8F — Full legibility for task rows (no data truncation on the content page)

**Branch:** `claude/ops-ce-8f` (off `main`; CE-8E merged)
**Date:** 2026-06-03
**One concept:** task rows fully readable — every field labeled + wrapped, nothing
clipped. **Presentation only; 0-schema; no payload/route changes.**

> ✅ `git diff` = new shared `TaskBand.tsx` + the row renders/sweep
> (`ScenifyDraft`, `DailyLog`, `ContentPipeline`, `PieceGrid`). No `prisma/schema.prisma`,
> no `api/`. tsc exit 0; eslint exit 0.

---

## 1 · S2 + S3 task rows — labeled, wrapped fields (shared `TaskBand`)
**Before:** one cramped flex line — `▦ {time} {title} · {project} {status}` ran
together, title clipped ("Build the Co…"); duplicated in ScenifyDraft + DailyLog.

**After:** a new shared **`TaskBand`** (used by both renders → no drift) lays out
clearly separated, **labeled** fields (small purple uppercase labels mirroring the
scene rows), all **wrapped**:
- **TIME** — the actual/scheduled clock label (labeled which), or the inline
  `TaskTimeCommit` form on planned rows.
- **TASK** — full title, `break-words`, visually primary (`flex-1 min-w-[160px]`).
- **PROJECT** — full name, `break-words`.
- **STATUS** — badge.

Each `renderTaskRow` (ScenifyDraft `colSpan={8}`, DailyLog `colSpan={6}`) now renders
`<TaskBand .../>` inside the amber band `<td>` (chrome unchanged; padding `py-2`).
Multi-line rows are fine — readable beats compact. `TaskTimeCommit` (CE-8E) is now
invoked *inside* `TaskBand`, so both callers stay identical.

## 2 · S1 task list — full wrap (sweep)
`ContentPipeline` (S1): removed `truncate max-w-[…]` on the task **project**
(`:312`) and **entity** (`:314`) labels and the routine **entity** label (`:279`) →
`break-words` (project/entity keep a soft `max-w` that now *wraps* instead of
clipping). The task **title** was already `break-words` (CE-8D).

## 3 · Sweep — every data truncation found + fixed (cited)
`grep -rnE 'truncate|text-ellipsis|overflow-hidden|whitespace-nowrap|max-w-\[' content/*.tsx`:

| Location | Was | Action |
|---|---|---|
| `ContentPipeline.tsx:279` routine entity | `truncate max-w-[90px]` | → `break-words` ✅ |
| `ContentPipeline.tsx:312` task project | `truncate max-w-[100px]` | → `break-words max-w-[140px]` (wraps) ✅ |
| `ContentPipeline.tsx:314` task entity | `truncate max-w-[80px]` | → `break-words max-w-[110px]` (wraps) ✅ |
| `PieceGrid.tsx:321` day-column title | `truncate max-w-[160px]` | → `break-words max-w-[160px]` (wraps) ✅ |
| S2/S3 task band title/project | cramped/clipped line | → labeled wrapped `TaskBand` ✅ |
| `headerCellClass whitespace-nowrap` (DailyLog/ScenifyDraft/ScenifyModal) | label chrome | **kept** (labels, not data) |
| `PieceGrid.tsx:372` "+ day" button `whitespace-nowrap` | chrome | **kept** |
| `PieceGrid.tsx:387` scene card | already `break-words` | no change |
| `TaskBand` status/time spans `whitespace-nowrap` | a badge + a clock string (atomic) | intentional (not clipped — no max-w) |

**Legacy, NOT on the content page (left as-is, cited):** `ContentTable.tsx`
(`truncateScript`, header `whitespace-nowrap`), `SceneHeaderRow.tsx`,
`ScriptDrawer.tsx`, `SectionG_Content.tsx` — all retired from the page in CE-7
(`page.tsx` renders only `ContentPipeline`); `ContentTable` survives only for the
home preview (empty arrays). Not rendered on the content page → out of scope.

---

## Verify
- **Every task field readable + labeled in S1/S2/S3:** `TaskBand` labels TIME/TASK/
  PROJECT/STATUS, all `break-words`; S1 project/entity wrap. ✅
- **No data truncation anywhere on the content page:** active-pipeline files
  (`ContentPipeline`/`ScenifyDraft`/`DailyLog`/`PieceGrid`/`TaskBand`) have **zero**
  `truncate`/ellipsis on data text (grep → none but a comment). Remaining hits are
  legacy files not mounted on the page. ✅
- **Contrast standard kept:** purple uppercase field labels, body `text-primary`/
  `text-muted`, no `text-faint`. ✅
- **0-schema, no payload/route change:** task rows read-only (the inline commit reuses
  CE-8E's route); no schema/`api/` in the diff. ✅
- **tsc** exit 0; **eslint** exit 0.

## git diff scope
New: `content/TaskBand.tsx`. Modified: `content/ScenifyDraft.tsx` +
`content/DailyLog.tsx` (renderTaskRow → `TaskBand`; import swap),
`content/ContentPipeline.tsx` (S1 wrap sweep), `content/PieceGrid.tsx` (day-title
wrap) (+ this report). No schema, no routes.

---

## Result
Task rows now read as labeled, wrapped fields — **TIME · TASK · PROJECT · STATUS** —
via one shared `TaskBand` in both the S2 day map and the S3 timeline, with the inline
time-commit living in the TIME field on planned rows. The S1 task list and the
day-column title wrap too. No data text truncates anywhere on the content page (legacy
off-page files noted). Presentation only; 0-schema; tsc + eslint clean.
