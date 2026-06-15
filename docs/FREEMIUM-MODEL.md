# Freemium Model — locked reference

The access model for Temple Stuart. Standard freemium SaaS (like Claude, ChatGPT, Notion).
**All future tab work follows this.** This is a reference, not a build spec.

## The three rules

**1 · Open & use free.** Anyone — guest, no account — can use the free features live. They
work fully in-session. No login wall just to try something.

**2 · Nothing saves without an account.** A guest's actions run live but do **not** persist.
Refresh or leave and it's gone. Persistence (saved trips, calendar, budgets) needs a free
account.

**3 · Paid features are locked until pay.** Paid tabs/features stay locked until the user
agrees to pay and enters a card. The free vendor booking feeds (Duffel flights, LiteAPI
hotels, Viator activities) are **never** locked — they're the free hook.

## Per-tab application (the target, not a build order)

| Tab | Access | Notes |
|---|---|---|
| **Calendar** | Free | Guest sees only what they do in-session — no persisted blocks, no demo blocks for a true guest. Account → calendar persists. Travel/booking maps in as **budgeted**; bookkeeping maps in as **actual** (account-level). |
| **Travel** | Free to use | Free vendor feeds (flights / hotels / activities) always open. Paid add-ons (Google Places advanced planning categories) locked behind pay. Guest can create/see a trip in-session; **saving it needs an account**. |
| **Trade** | Fully paid | Locked until card. |
| **Operations** | Fully paid | Locked until card. Needs a mobile-friendly layout. |
| **Books** | Fully paid | Locked until card. Full pipeline. Needs a mobile-friendly layout. |
| **Tax** | Paid | Own tab — migrate out of Books. Pricing TBD. |
| **Compliance** | Fully paid | Integration TBD. |

## Home & auth

- Log in → lands on **home** (not `/hub`) → unlocks whatever the user has paid for.
- **Logout** lives in the header, where "Enter →" is today.
- `/hub` is being retired (folded into the home app).

## In one line

**Free to use · account to save · pay to unlock.**
