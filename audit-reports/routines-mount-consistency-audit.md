# Routines homepage mount + tab visual consistency (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** the routine CRUD **mounts cleanly on the homepage as-is, functionally** — wrap the
workbench `SectionE_Routines` in its self-fetching `OperationsEntityProvider` (no extraction, no
CRUD rewrite). But it would **look wrong**: the routine surface is **terminal-styled** (`font-mono`
everywhere, a `rounded border shadow-sm` card, a purple-tinted create box), while the homepage's
"app tabs" (Calendar + Travel) follow a **flush, sans-serif, bandless** contract. And Routines
currently renders inside MODULES.map's **purple-band card** (`:443-453`) — the exact chrome
Calendar + Travel were deliberately pulled OUT of. So the work splits cleanly: **mount** (logic,
clean) then **align style** (font + wrapper + pull out of the band card). Good news: both surfaces
already share the **same color tokens** — the gap is font + wrapper, not a token overhaul.

---

## PART A — MOUNT PATH

### 1. The homepage Routines-tab placeholder
`ModuleLauncher.tsx:279-291` — inside `renderBody`, `m.key === 'routines'` returns a static text
block (*"Build recurring routines… The routine builder lands here next."*). **No auth branch** —
it's the same for authed and logged-out today. `renderBody` (`:187`) has `authed` (`:110`) in
scope, so it CAN branch. The logged-out teaser `home/RoutineCreateForm.tsx` (default export,
`onRequireAuth` prop, fetch-free) **exists but is not mounted** (the placeholder comment says PR-B
was meant to). — EXISTS-BUT-UNUSED (the teaser), `:279-291`.

### 2. How Calendar + Travel are mounted
- **Calendar** (`:366-382`): a FLUSH section, NOT in MODULES.map. `authed===true` →
  `<section className="w-full bg-white border-b border-border [block/hidden]"> <div
  className="max-w-7xl mx-auto"> <HubCalendar /> <HubBudgetSection /> </div></section>`.
  `authed===false` → `<HubCalendar demoEvents={demoCalendar} onRequireAuth=… />`. **No purple band,
  no card chrome** (comment `:363-365`: "Calendar tab is flush — no purple band, no card chrome").
- **Travel** (`:389-433`): same FLUSH section, ALSO pulled OUT of MODULES.map (PR-TG1, comment
  `:383-388`: "sheds the generic purple band + rounded card + wide container inset"). `<section
  className="w-full bg-white border-b border-border …"> <div className="max-w-7xl mx-auto"> <div
  className="px-4 py-4 space-y-6"> {renderBody(travelModule)} <PublicFlightSearch/> … </div></div>`.
- **Routines (+ the other 4 modules)** (`:440-456`): the OLD pattern in MODULES.map — `py-10`,
  alternating `bg-bg-row`/`bg-white`, then a `rounded-lg overflow-hidden border shadow-sm` **card**
  whose header is a `bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold` **purple
  band** (label + the "Live demo · log in to use" tag `:447`), body `bg-white p-4`. — EXISTS / the
  visual MISMATCH, `:440-453`.

### 3. The workbench routine surface — self-contained?
`app/operations/routines/page.tsx` = `<SectionE_Routines />`. `SectionE_Routines`:
- consumes **`useOperationsEntity()`** (`:16,21`) → `entities` (a CONTEXT from `EntitySelector`,
  provided by `OperationsEntityProvider`, normally wired in `/operations/layout.tsx`).
- mounts `TodaysStrip` + **`RoutineList`** (`:47`). `RoutineList` (`:33`) **self-fetches**
  `/api/operations/routines` (`:51`), takes an `entities` prop, mounts `RoutineCreateForm`
  (the real one — HB-4b COA picker + budget) + `RoutineRow` (edit/PATCH). **CRUD fully
  self-contained.**
- **`OperationsEntityProvider`** (`EntitySelector.tsx:38`) **SELF-FETCHES** `/api/entities`
  (`:61`, account-gated) — so wrapping the homepage tab in it supplies everything. — REUSABLE.

**Mount cleanly?** YES, functionally: `<OperationsEntityProvider><SectionE_Routines
/></OperationsEntityProvider>` reuses the whole CRUD verbatim. Blast radius of those components is
ONLY `/operations/routines` + the new homepage mount (grep: `SectionE_Routines` used only at the
workbench page). — REUSABLE (logic), RISK (styling, §7).

---

## PART B — VISUAL LANGUAGE (the consistency spec)

### 4. Calendar tab
Flush section (§2). Inside, the controls live in **`CalendarGrid`** (the Day/Week/Month +
tzMode toggles, opt-in Hub chrome via `enableHubChrome`, `CalendarGrid.tsx:329,505`) and
**`HubBudgetSection`** (HB-1, the homepage-native budget table). HubBudgetSection is the cleanest
reference for the homepage table/control idiom (it was built TO match):
- Wrapper: `border-t border-border bg-white px-4 py-4 lg:px-8` (`HubBudgetSection.tsx:104`).
- Header: `h2 text-sm font-semibold text-text-primary tracking-tight` + `p text-xs text-text-muted`
  sub-line (`:107-108`).
- Toggle buttons: `text-xs px-3 py-1 rounded border transition-colors font-medium`, active
  `bg-brand-purple text-white border-brand-purple`, inactive `text-text-secondary border-border
  hover:bg-bg-row` (`:134`).
- Select: `text-xs border border-border rounded px-2 py-1 text-text-secondary bg-white` (`:115`).
- Table: `w-full text-sm`, header `border-b border-border text-xs text-text-faint`, `th py-2 px-3
  font-medium`, rows `border-b border-border-light`; numbers `font-mono tabular-nums` (`:160-164`).
- Empty/pending: `rounded-lg border border-dashed border-border bg-bg-row/40 px-4 py-8 text-center
  text-sm text-text-muted` (`:147`).

### 5. Travel tab
Flush section (§2), inner `px-4 py-4 space-y-6` (`:391`). Section headers via **`ComingSoonSection`**
(`:23-30`): `mt-10 pt-8 border-t border-border`, title `text-lg font-bold text-brand-purple`, a
pill `rounded-full bg-bg-row px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted`,
explainer `text-xs text-text-muted`. The live searches (`PublicFlightSearch`/`PublicHotelSearch`)
+ the trip ledger (`TripBudgetActual`) carry their own controls but in the **same sans, text-xs/
text-sm, border-border, brand-purple** idiom. — EXISTS.

### 6. THE SHARED PATTERN (the homepage tab visual contract)
Calendar + Travel both follow, with **no shared layout component** (each inlines it):
1. **Section wrapper:** `w-full bg-white border-b border-border` + visibility toggle
   `${active ? 'block' : 'hidden'}`, inner `max-w-7xl mx-auto`, content padding `px-4 py-4
   (lg:px-8) space-y-6`. **Flush, edge-to-edge, NO purple band, NO rounded card.**
2. **Headers:** sans-serif `text-sm font-semibold text-text-primary` (or `text-lg font-bold
   text-brand-purple` for a module title) + a `text-xs text-text-muted` sub-line.
3. **Controls:** `text-xs … rounded border border-border` selects; toggle pills
   `px-3 py-1 rounded border` (active `bg-brand-purple text-white`, inactive `border-border
   hover:bg-bg-row`).
4. **Tables:** `text-sm`, `border-b border-border` header in `text-xs text-text-faint`, rows
   `border-b border-border-light`, numbers `font-mono tabular-nums`.
5. **Font:** **sans-serif** for labels/headers; `font-mono` ONLY for numeric/data cells.
6. **Tokens (shared by BOTH surfaces):** `text-text-primary/secondary/muted/faint`,
   `border-border`/`border-border-light`, `bg-bg-row`, `brand-purple`. No hardcoded hex.

**Shared layout component?** **NONE** — there is no `TabSection`/`SectionWrapper` (grep empty).
Calendar/Travel each replicate the flush-section markup. — MISSING (a reusable wrapper).

### 7. WORKBENCH vs HOMEPAGE — the styling gap
The routine surface follows a **terminal/monospace** idiom — the mismatches:
| Aspect | Workbench (routine surface) | Homepage contract | Cite |
|---|---|---|---|
| **Font** | `font-mono` EVERYWHERE (labels, headers, inputs) | sans; mono only for numbers | `RoutineCreateForm:98`, `RoutineList:139`, `RoutineRow:173-174`, `SectionE:31` |
| **Wrapper** | a `bg-white rounded border shadow-sm p-5` **card** | flush `w-full bg-white border-b` section | `SectionE_Routines.tsx:29` |
| **Create box** | `border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono` (purple-tinted) | clean white controls on a flush section | `RoutineCreateForm.tsx:98` |
| **Labels** | lowercase terminal ("new routine", "name", "entity"), `uppercase tracking-wide font-mono` | `text-sm font-semibold` headers | `RoutineCreateForm:99`, `RoutineRow:174` |
| **Outer chrome** | rendered in MODULES.map's **purple-band card** (`:443-453`) | flush, no band (Calendar/Travel) | `ModuleLauncher.tsx:440-453` |

**Crucially, the COLOR TOKENS already match** (both use `text-text-*`, `border-border`,
`brand-purple`, `bg-bg-row` — grep: HubBudgetSection 16 refs, RoutineRow 20 refs). So aligning is
mostly **(a) drop `font-mono` from labels/headers, (b) drop the card → flush, (c) drop the
purple-tinted create box, (d) pull the tab out of the band card** — NOT a re-theme.

---

## Explicit answers

**(a) Mount path.** **Mount as-is functionally** — `<OperationsEntityProvider><SectionE_Routines
/></OperationsEntityProvider>` on the authed tab (`renderBody` `m.key==='routines'`,
`ModuleLauncher.tsx:279`); the provider self-fetches entities (`EntitySelector.tsx:61`) and the
list self-fetches routines (`RoutineList.tsx:51`). **No extraction, no CRUD rewrite.** The
components are shared ONLY with `/operations/routines`, so the mount doesn't fork logic. — REUSABLE
(logic).

**(b) The homepage tab VISUAL CONTRACT** (§6): flush `w-full bg-white border-b border-border` →
`max-w-7xl mx-auto` → `px-4 py-4 lg:px-8 space-y-6`, **no band/card**; sans headers
`text-sm font-semibold text-text-primary` + `text-xs text-text-muted` sub-line; toggle pills
`px-3 py-1 rounded border` (active `bg-brand-purple text-white`, inactive `border-border
hover:bg-bg-row`); selects `text-xs border border-border rounded px-2 py-1`; tables `text-sm`,
`border-b border-border` headers `text-xs text-text-faint`, rows `border-b border-border-light`,
numbers `font-mono tabular-nums`; tokens `text-text-*`/`border-border`/`brand-purple`/`bg-bg-row`.
The HB-1 `HubBudgetSection` is the live reference implementation. — EXISTS / REUSABLE (as the spec).

**(c) The styling gap** (§7): `font-mono` on labels/headers, the `rounded border shadow-sm p-5`
card wrapper, the `bg-purple-50/30` purple-tinted create box, terminal lowercase labels, and the
MODULES.map purple-band card chrome. These would look WRONG next to Calendar/Travel.

**(d) Reusable layout component?** **None exists** (no `TabSection`/`SectionWrapper`, grep empty).
Calendar + Travel each inline the flush-section markup consistently. **Recommend creating a small
shared `<HomeTabSection>`** (the flush `w-full bg-white border-b border-border` → `max-w-7xl
mx-auto` → padded `space-y-6` wrapper + the standard header) so Routines — and a future refactor of
Calendar/Travel — share ONE wrapper. Optional but it's the durable consistency fix. — MISSING
(create it).

**(e) Recommended PR sequence.**
1. **HB-4e-mount (SMALL-MED, no migration).** Pull Routines OUT of MODULES.map into its own FLUSH
   section (mirroring Travel/PR-TG1, `:389-433`); `authed===true` →
   `<OperationsEntityProvider><SectionE_Routines/></OperationsEntityProvider>`, `authed===false` →
   the `home/RoutineCreateForm` teaser, `null` → nothing; drop the "Live demo · log in to use" tag
   for authed routines. **Ships the working builder immediately** — but it still carries the
   workbench `font-mono`/card look (a known, temporary mismatch — call it out).
2. **HB-4e-style (MED).** Restyle the routine surface to the §6 contract — drop `font-mono` from
   labels/headers (keep it on numbers), replace `SectionE`'s card with a flush wrapper, de-tint the
   create box, sans headers. **RISK / decision:** these components are shared with
   `/operations/routines`, so restyling changes the workbench too. If the homepage is becoming the
   primary surface (and /operations is legacy), restyle both to the homepage look (cleanest). If
   /operations must keep its terminal aesthetic, the restyle needs a `variant` prop or a thin
   homepage wrapper — **flag for decision before building** (do NOT fork a second CRUD).
3. **(Optional) HB-4e-wrapper (SMALL).** Extract `<HomeTabSection>` and adopt it for
   Routines (and later Calendar/Travel) — the durable shared-layout fix (d).

**Honest sizing:** mount = SMALL-MED; restyle = MED (gated on the shared-component decision);
wrapper = SMALL. One combined PR is possible but the **restyle's /operations blast radius** argues
for splitting mount (ship now) from style (decide the workbench's fate first).

### Citation index
- Placeholder + renderBody auth scope: `ModuleLauncher.tsx:279-291, 187, 110`.
- Calendar/Travel flush mounts: `:363-382` (calendar), `:383-433` (travel); band card `:440-453`
  (`:447` tag).
- Workbench surface: `app/operations/routines/page.tsx`; `SectionE_Routines.tsx:16,21,29,47`;
  `RoutineList.tsx:33,51`; `EntitySelector.tsx:38,61`.
- Homepage contract refs: `HubBudgetSection.tsx:104,107-108,115,134,147,160-164`;
  `ComingSoonSection.tsx:23-30`; `CalendarGrid.tsx:329,505`.
- Workbench styling gap: `RoutineCreateForm.tsx:98-99`, `RoutineList.tsx:139,157`,
  `RoutineRow.tsx:173-174`, `SectionE_Routines.tsx:29,31`.

*Do not implement — audit only.*
