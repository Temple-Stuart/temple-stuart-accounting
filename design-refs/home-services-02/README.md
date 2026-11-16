# Temple Stuart — Professional Services: a proposal form for each service, in place (HOME-SERVICES-02) · Handoff

Alex asked for this in two parts on 2026-11-16, Manila time. At 09:58: the services should toggle, as Financial Software's do, a press opening a form tailored to the pick under them, with its button at the foot, "Scoped by proposal" gone and nothing leading to another page. He approved those boards at 10:26. At 12:08 he asked why five of the six services got the same questions. The doc that answered, "Professional Services intake: what top firms ask, and a questionnaire for each service", proposed a questionnaire for each service; he approved it at 12:59 and its boards at 13:07. At 13:24 he asked for the two in one PR.

This is the form HOME-SERVICES-01 drew under its stage and left for a later PR, opened by the services themselves and asking each service its own questions. No earlier handoff for it has landed.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-services-02/Section-Reference.html` | **The spec.** Open it in a browser, press a service, press it again, press another, read each service's form and send one. Its first stylesheet is `design-refs/home-services-01`'s, byte for byte. Its second is the short view's, as this brief leaves it. Its third is the page's own. |
| `design-refs/home-services-02/README.md` | This file. The tables below are the questions, drawn from the same list as the reference. |

## What changes on the home page

- **At rest no service is picked**, and the panel holds the question and the six services only. Today Full setup is picked at rest.
- **A press on a service picks it and opens the proposal form** under the six, inside the panel. A press on another service picks that one, and the form changes in place. A press on the picked service closes the form, and so does Close.
- **The form's head** is its eyebrow, `WORK WITH ME`, with Close at the right, then the picked service's name and line. `Send proposal` ends it.
- **The form asks that service's questions.** Five open every form and How did you find me closes it; between them, each service asks its own. The tables below are the questions.
- **Nothing in the section leads to another page.** The brief row goes: the picked service's name and line, the gold link "Send a project proposal →" and "Scoped by proposal" beside it. The link under the panel, "See how a proposal works →", goes too.

| Section height | Today | At rest | Full setup | Monthly maintenance | Custom builds | Integration | Bookkeeping | Something else | Sent |
|---|---|---|---|---|---|---|---|---|---|
| 1440px wide | 700px | 496px | 1,723px | 1,697px | 1,706px | 1,788px | 2,049px | 1,493px | 679px |
| 390px wide | 918px | 638px | 2,536px | 2,410px | 2,326px | 2,633px | 3,030px | 2,094px | 824px |

Each service's height is with More details closed.

## What changes on two other pages

- **"Scoped by proposal" leaves** `/professional-services`, where it stands beside the gold button, and `/work-with-me`, where it stands beside Send proposal.
- **`/work-with-me` asks the same questions** as the panel, for the door its need question picks, with its own controls. More details (optional) replaces Project details there too.
- Nothing else on either page changes.

## What stays

- The section's name, its line, the question and the six tiles: their order, look and words.
- `/professional-services`: the whole section, its picture, its three steps and its gold button to `/work-with-me` with the pick. Its pick still starts at Full setup, and a press there still only picks.
- `/work-with-me`: the page, its need question and its `?need=` link.
- The route, `POST /api/proposals`: public, written to the database only, rate-limited, behind its honeypot.

## The questions

### Asked of every service

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| Name | Text | Yes | Top |
| Email | Email | Yes | Top |
| What's your business? (or: it's just for me) | Text, several lines, "e.g. I run a 12-unit property management company in Austin — we collect rent, pay vendors, file 1099s" | Yes | Top |
| Website (optional) | Web address, "https://" | No | Top |
| Your part in the decision | Pick one: I decide · I recommend, someone else approves · Just looking | Yes | Top |
| How did you find me? | Pick one: Reddit · Instagram · TikTok · X · YouTube · Referral · Other | No | More details, last |
| ↳ the follow-up | Text: "Who referred you? (name)" for Referral, "Where'd you find me?" for Other | Yes, when shown | More details, last |

### Full setup

Today's modules question moves here, where it scopes the build, with its Other and its description.

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| Who is it for? | Pick one: Just me · My household · My business · Several businesses or entities | Yes | Under the core |
| ↳ How many? | A number, shown when Several businesses or entities is picked | No | Under the core |
| What should it run on day one? | Pick any: Travel · Runway · Books · Trade · Tax · Compliance · Routines · Projects · Content · Other | Yes | Under the core |
| ↳ What is it? | Text, several lines, "Describe what you need built.", shown when Other is picked | Yes, when shown | Under the core |
| How many bank, card and brokerage accounts should it connect? | Pick one: 1–3 · 4–10 · 11–25 · More than 25 | Yes | Under the core |
| What are you moving off? | Pick any: QuickBooks · Xero · Spreadsheets · Nothing · Other (Nothing stands alone) | Yes | Under the core |
| Where should it run? | Pick one: Host it for me · In my own cloud account · Not sure | Yes | Under the core |
| Timeline | Pick one: Now · 2–4 weeks · 1–3 months · Exploring (Exploring at first) | Set at first | Under the core |
| Budget range | Pick one: <$2k · $2–10k · $10–50k · $50k+ · not sure (not sure at first) | Set at first | Under the core |
| How much history should come across? | Pick one: None · This year · 2–3 years · All of it | No | More details |
| Who keeps it running after launch? | Pick one: Me or my team · You, monthly · Not sure | No | More details |
| Security or compliance needs | Text, several lines, "e.g. single sign-on, SOC 2, where data may be stored" | No | More details |
| What does done look like? | Text, several lines, "e.g. By March I can see all my rentals' income in one dashboard and my CPA gets a clean export." | No | More details |

### Monthly maintenance

No timeline, no finish line, no deadline: a month to take over, and monthly bands.

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| Which copy will I look after? | Pick one: One you set up for me · One I set up myself · Not running yet | Yes | Under the core |
| Where does it run? | Pick one: Vercel · Azure · AWS · Google Cloud · My own server · Not sure | Yes | Under the core |
| How many people use it? | Pick one: Just me · 2–10 · 11–50 · More than 50 | Yes | Under the core |
| If it stopped for a day | Pick one: A nuisance · It slows us down · It stops the business | Yes | Under the core |
| When should I be reachable? | Pick one: Business hours in my time zone · Longer hours · Around the clock for outages | Yes | Under the core |
| Monthly budget | Pick one: Under $250 · $250–750 · $750–2,000 · More than $2,000 · Not sure (Not sure at first) | Set at first | Under the core |
| What needs attention now? | Text, several lines, "What is broken, slow or out of date" | No | More details |
| How much change do you expect? | Pick one: Updates and fixes only · A small feature a month · Ongoing development | No | More details |
| When should I take over? | A month | No | More details |
| Your time zone | Text, "e.g. Manila, New York" | No | More details |

### Custom builds

The problem and its test are the two required free-text answers; every other answer is a tap.

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| What should it let you do that you can't today? | Text, several lines | Yes | Under the core |
| Who will use it? | Pick any: Me · My team · My customers · The public | Yes | Under the core |
| Where should it live? | Pick one: In my Temple Stuart copy · In another system · On its own · Not sure | Yes | Under the core |
| How will you know it worked? | Text, several lines, "e.g. Month-end takes an hour, not a day." | Yes | Under the core |
| Timeline | Pick one: Now · 2–4 weeks · 1–3 months · Exploring (Exploring at first) | Set at first | Under the core |
| Budget range | Pick one: <$2k · $2–10k · $10–50k · $50k+ · not sure (not sure at first) | Set at first | Under the core |
| What data does it touch? | Pick any: Money · Personal details · Neither · Not sure (Neither and Not sure stand alone) | No | More details |
| Must-haves, and what can wait | Text, several lines | No | More details |
| Can the code join the open-source core? | Pick one: Yes · I'd rather it stay mine · Not sure | No | More details |
| Designs, documents or examples | Links, today's rows | No | More details |
| A date it must exist by, and why | A date and its reason | No | More details |

### Integration

Both systems named, the direction, the frequency, the volume, and how the other system is reached.

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| Which piece? | Pick any: The booking engine · The books · The scanner · Something else | Yes | Under the core |
| Into which system? | Text, "e.g. NetSuite, Shopify, our own app" | Yes | Under the core |
| Which way does data move? | Pick one: Into your system · Out of it · Both ways | Yes | Under the core |
| How often? | Pick one: As it happens · Hourly · Daily · On demand | Yes | Under the core |
| How much, on a busy day? | Pick one: Under 100 · 100–1,000 · 1,000–10,000 · More than 10,000 records | Yes | Under the core |
| How can that system be reached? | Pick one: An API with documentation · An API without it · Files only (CSV, SFTP) · Not sure | Yes | Under the core |
| Timeline | Pick one: Now · 2–4 weeks · 1–3 months · Exploring (Exploring at first) | Set at first | Under the core |
| Budget range | Pick one: <$2k · $2–10k · $10–50k · $50k+ · not sure (not sure at first) | Set at first | Under the core |
| Is there a test copy of it? | Pick one: Yes · No · Not sure | No | More details |
| Is there an admin or developer on that system? | Pick one: Yes · No | No | More details |
| What data crosses? | Pick any: Money · Personal details · Card numbers · Not sure (Not sure stands alone) | No | More details |
| If a sync fails | Pick one: Alert me · Retry, then alert me · Not sure | No | More details |

### Bookkeeping

Its three lines stay where they stand today, under Name and Email. The modules question and the example under "What does done look like?" leave with that question.

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| What do you need? | Pick one: Catch-up only · Monthly from now on · Catch-up, then monthly | Yes | Under the core |
| How far behind are the books? | Pick one: Up to date · 1–3 months · 4–6 months · 7–12 months · More than a year · Never kept | Yes | Under the core |
| What kind of entity? | Pick one: Sole proprietor · Single-member LLC · Partnership or multi-member LLC · S corporation · C corporation · Nonprofit · Personal or household · Not sure | Yes | Under the core |
| How many accounts to reconcile? | A number each: Bank · Cards · Loans | Yes | Under the core |
| Transactions a month, across all of them | Pick one: Under 50 · 50–150 · 150–300 · 300–600 · More than 600 | Yes | Under the core |
| Where are the books kept now? | Pick one: QuickBooks Online · Xero · Spreadsheets · Nowhere · Other | Yes | Under the core |
| Monthly budget | Pick one: Under $300 · $300–600 · $600–1,000 · More than $1,000 · Not sure (Not sure at first) | Set at first | Under the core |
| Payment platforms | Pick any: Stripe · PayPal · Square · Shopify · Venmo · Other | No | More details |
| Payroll | Pick one: None · Gusto · ADP · Rippling · Other | No | More details |
| Anything that adds work | Pick any: Inventory · Sales tax in more than one state · Contractors paid on 1099 · More than one entity · Foreign currency · Investor reporting | No | More details |
| Cash or accrual? | Pick one: Cash · Accrual · Not sure | No | More details |
| Who files your taxes? | Pick one: A CPA or enrolled agent · I do · No one yet | No | More details |
| Reports you want | Pick any: Monthly P&L and balance sheet · Cash flow · Budget against actual · Investor package | No | More details |
| Anything open? | Pick any: Notices from the IRS or a state · Unfiled sales tax · Problems left by a previous bookkeeper · None (None stands alone) | No | More details |
| A date the books must be ready by | A date and its reason | No | More details |
| What do you pay for bookkeeping now? | Text, "e.g. $400 a month, or nothing" | No | More details |

### Something else

Something ongoing turns the budget into "Monthly budget" with the monthly bands Monthly maintenance uses; any other answer keeps the project bands.

| Question | Answers | Required | Where |
| --- | --- | --- | --- |
| What do you need? | Text, several lines | Yes | Under the core |
| Is it closer to | Pick one: A one-time project · Something ongoing · Advice or a second opinion · Not sure | Yes | Under the core |
| Timeline | Pick one: Now · 2–4 weeks · 1–3 months · Exploring (Exploring at first) | Set at first | Under the core |
| Budget range | Pick one: <$2k · $2–10k · $10–50k · $50k+ · not sure (not sure at first) | Set at first | Under the core |
| What's driving it? | Text | No | More details |
| Links | Links, today's rows | No | More details |

## Behaviour

- **States.** Nothing picked: no form. A service picked: its form, headed by that service. Sent: the eyebrow, Close and the thank-you, in place of the service's name and line and the fields, until the page is left. The services still open and close it.
- **What was typed survives.** Closing the form hides it. The core's answers carry from service to service, and each service keeps its own while another is looked at. A reload starts empty. Nothing is stored, and nothing goes in the URL.
- **Focus.** A press leaves focus on the service. Close sends focus back to the service that was picked. Opening moves nothing.
- **Keyboard.** Tab reaches the six services, then Close and the form's fields in order, then Send proposal. Space and Enter press a service or a pick.
- **Pick one** groups hold one answer; pressing it again clears it, except Timeline and the budget, which keep one. **Pick any** groups hold several; an answer marked as standing alone clears the others, and any other answer clears it.
- **Follow-ups** appear under their group: How many? under Several businesses or entities, What is it? under Other, the referral's question under Referral or Other.
- **The button waits for the answers a quote needs**: the required picks, Bookkeeping's three counts, Other's description and the referral's follow-up. It never waits for a deadline. The required text answers are the browser's required fields, as Name and Email are today.
- **Budgets follow the billing.** The three project services keep today's bands under Budget range. Monthly maintenance and Bookkeeping ask Monthly budget with their own bands, Alex's placeholders: Under $250 to More than $2,000, and Under $300 to More than $1,000. Something else takes Monthly maintenance's bands when Something ongoing is its answer.
- **Each service** is a button with `aria-pressed`, as today, and `aria-controls` naming the form. The service's name in the form keeps `aria-live="polite"`, so a change is heard.

## The words

Every word is the app's today or the doc's, as Alex approved it, except those listed last.

| On the page | Where it stands today |
|---|---|
| Professional Services · Hands-on services, tailored to your needs. | `BUILD_PILLAR`, `src/lib/homeActWords.ts` |
| What do you need? | `NEED_QUESTION`, `src/lib/proposalNeeds.ts` |
| the six titles, kinds and lines | `SERVICES`, `src/lib/proposalNeeds.ts`, in its order |
| Bookkeeping's three lines | `BOOKKEEPING_WORDS`, `src/lib/proposalNeeds.ts` |
| Timeline · Budget range | `ASK_TIMELINE`, `ASK_BUDGET`, `src/lib/proposalNeeds.ts` |
| the thank-you | the form's line, with `PROPOSAL_STEPS.read` |
| WORK WITH ME, Name, Email, the business question with its example and hint, the four timeline picks, the five project bands, the nine modules with Other and its question, What does done look like? with its example and hint, Links, How did you find me? with its picks and follow-ups, Send proposal | `src/app/work-with-me/WorkWithMeForm.tsx`, as typed there |
| every other question and answer in the tables | the doc, as approved at 12:59 |
| Close; More details (optional); Website (optional) and its https://; How many?; Your time zone and its example; Why that date?; the example under What do you pay for bookkeeping now?; Date and Why, the date's two names for screen readers | **New** in this handoff |

The apostrophes are straight, as the form types them.

## Tokens

None is added. The form reads `fs-white`, `fs-ink`, `fs-ink-soft`, `fs-ink-muted`, `fs-gold-text`, `fs-chip-line`, `fs-button-line`, `fs-rule`, `ps-field-line`, `ps-wash`, `bg`, `red` and the hero's violets and golds. Each is in the app's `:root` already, behind the house prefix.

## The stylesheets, and what to port

1. **The first stylesheet** is `design-refs/home-services-01/Section-Reference.html`'s, byte for byte. Most of it is on main as the `.ts-ps…` port. Its form's rules are not: section 4 entire, and the four rules of sections 5 and 6 that name only the form's elements (`.ps-fields` from 640px; the hover of Close and the two link buttons, of a pick, and of Project details). **Port those**, behind the house prefix, into the port's empty section 4 and its sections 5 and 6, in the reference's order. The port's own note already names them as its fourth difference.
2. **The second stylesheet** is the short view's: home-trim-03's, without the brief row's rules and the link's, with nine rules more. `.ps-form__door` sets the service's name 10px under the eyebrow. `.ps-sent` sizes the thank-you from border to border, as the app's base already does. `.ps-counts`, `.ps-count` and `.ps-count__name` lay Bookkeeping's three counts side by side; `.ps-input--short` is How many?; `.ps-dated`, with its 640px rule, sets a date beside its reason. One rule lets a pick longer than its row wrap its words; a pick on one line keeps its 38px, and only at 340px does one wrap, Problems left by a previous bookkeeper. **It replaces the short view's block** at the port's foot.
3. **Leaving the port:** `.ts-ps-brief`, `.ts-ps-brief__text`, `.ts-ps-brief__go`, `.ts-ps-how` with its hover rule, and `.ts-ps-note`. Nothing draws them after this.
4. **The third stylesheet is the page's own**, not ported: `.ps-set` lays each service's questions into the grid as if alone, because all six are in this file. Production draws the picked one.

Two inline margins come with the form's markup: each follow-up stands 14px under its group. The reference writes it on the element.

## In the reference but not on the canvas

- **The placeholders' colour.** The boards drew the browser's grey (#757575). The design is `fs-ink-muted` (#6F6988), as the first stylesheet writes it and the reference draws it.
- **The thank-you**, and the button awake once the required answers are given. Neither was on a board.
- **The honeypot** is not drawn, because nobody sees it. The form brings its own.

## Checked

- **Against the approved boards**: the section at rest is the Nov 16 board's, and each service's form is the board that draws it, equal but for the placeholders' colour.
- **For fit**: each of the six forms, with More details closed and open, at 1440, 1280, 1024, 768, 390 and 340: nothing scrolls sideways (72 states).
- **Against the app's base styles**: with Tailwind 3.4.18's preflight loaded ahead of the stylesheets, the same 72 screenshots are equal to the file's as it ships.
- **Behaviour**: nothing picked at rest; Enter on a service opens its form and leaves focus there; Space closes it; a second service changes it in place and keeps what was typed; Close unpicks and returns focus to the service; Tab goes from the sixth service to Close. Bookkeeping's button stays asleep until the decision role, its five picks and its three counts are answered, and again when Referral is picked without a name. Something ongoing brings Monthly budget and the monthly bands. Neither clears Money. Several businesses or entities shows How many?, and Other shows What is it?.
