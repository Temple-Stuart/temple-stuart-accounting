# STRATEGY-EVIDENCE — the peer-reviewed evidence report, and the correction it forces

**Date:** 2026-07-08 · **Branch:** `claude/strategy-evidence-roadmap-f9dv23` · **Base:** main @ `940185dd` · **DOCUMENTATION ONLY** (no code, no logic touched)

This commits the completed deep-research evidence report (peer-reviewed sources) into the
audit trail. It **CORRECTS one ranking** in `audit-reports/STRATEGY-ROADMAP.md` (committed on
branch `claude/strategy-roadmap`, pending merge): the roadmap's §2 Tier-1 table put **fed net
liquidity first** among the free regime levers, and its §4 proposed EDGE-6 wiring order listed
it first. The evidence below supersedes that ordering. Everything else in the roadmap — the
measurement discipline, the fail-loud combiner pattern, the one-signal-at-a-time loop — is
**confirmed**, not changed.

---

## 1. The core finding (survival > signals)

**Survival engineering — defined risk, fractional-Kelly sizing, regime conditioning — is the
primary determinant of institutional-grade quality in a vol-selling system. NOT signal count.**

The variance risk premium is real, persistent, and harvestable: sellers of index variance are
systematically paid more than realized variance costs (Carr & Wu 2009, *Review of Financial
Studies*; Bollerslev, Tauchen & Zhou 2009, *Review of Financial Studies*). But the premium is
compensation for bearing crash risk, not free money — the AQR analysis of option selling
(Israelov et al. 2018) is explicit that it is **"not a free lunch"**: the strategy's return
distribution is short-tailed by construction, and the left tail arrives exactly when everything
else is falling.

The kill mechanism is documented, not hypothetical. On **February 5, 2018 ("Volmageddon"), VIX
rose +115% in a single session and XIV — a short-vol product with years of smooth gains — lost
−96% and was terminated** (Cboe data; Augustin, Cheng & Van den Bergen 2021, on the failure
mechanism of short-volatility products). Years of accumulated premium, erased in one un-survived
day. No signal stack prevents that outcome; **only position structure does** — defined-risk
spreads instead of naked short options, fractional-Kelly sizing, and regime conditioners that
cut exposure before the tail, not after.

Implication for this codebase: the engine's honesty layer (KILL-1..7, MIG-1) and its measurement
instrument (EDGE-5) are necessary but not sufficient. The missing institutional piece is the
**survival layer** (§6, §7) — and it outranks every candidate data feed.

## 2. CORRECTION to STRATEGY-ROADMAP.md — regime signal ranking

**What the roadmap said:** `STRATEGY-ROADMAP.md` §2 (Tier-1 table, first row) ranked **fed net
liquidity (WALCL − WTREGEN − RRPONTSYD)** as a top Tier-1 free signal — "a first-order driver of
risk-asset regimes … one wire away" — and §4's proposed EDGE-6 listed it first in the wiring
order (fed net liquidity → regime).

**What the evidence says — this SUPERSEDES that ranking:** Fed net liquidity is **LOW-value for
vol-selling**. Its support is practitioner correlation only (net-liquidity vs. equity-index
level charts); there is **no peer-reviewed support for it as a volatility-selling timing
signal**. It should not lead the regime-conditioner build.

**The correct highest-value regime conditioners, in order:**

| rank | conditioner | peer-reviewed basis |
|---|---|---|
| 1 | **VIX term-structure slope (VIX/VIX3M)** | Simon & Campasano 2014, *Journal of Derivatives* — the VIX futures basis predicts short-vol trade returns; Johnson 2017, *Journal of Financial and Quantitative Analysis* — the VIX term structure's slope carries priced information about variance risk premia |
| 2 | **VVIX (vol-of-vol)** | Park 2015 (Federal Reserve working-paper series / *Journal of Empirical Finance* line of research) — VVIX predicts tail-risk-hedge returns; elevated VVIX marks expensive, binding tails |
| 3 | **Credit spreads (BBB OAS)** | established risk-regime literature; corroborates equity-vol regimes from an independent (credit) market |

**Convention care (do not get the sign backwards):** the ratio convention here is
**VIX/VIX3M < 1 = contango** (front cheap vs. back — the normal, favorable state for selling
premium) and **VIX/VIX3M > 1 = backwardation** (stress — the unfavorable state). The roadmap
referred to this ratio as "VIX ÷ VXV" — VXV is the pre-2017 ticker for the 3-month VIX index,
renamed VIX3M (FRED series `VXVCLS`); same series, same convention.

Fed net liquidity, BBB/T10Y3M/dollar and the other roadmap Tier-1 regime rows remain candidates
— but they enter the same measure-before-weight loop as everything else (§5) and none of them
leads the build. The build lead is the term-structure/VVIX brake (§6, §9).

## 3. Signal evidence table (from the report)

The signals-that-predict table as the research found it. "Verdict" is the level of evidence,
not a promise of live edge — every row still passes through the §5 measurement bar before
earning composite weight. Where no peer-reviewed citation exists, the column says so plainly
(no invented authority).

| signal | verdict | direction (for short-vol) | transform | citation |
|---|---|---|---|---|
| **VRP z-score** (IV² vs. realized variance) | **KEEP — core signal.** The premium is persistent and peer-reviewed | high VRP → premium rich → favorable to sell (but see §6 brake) | z-score of implied-minus-realized variance over a rolling window | Carr & Wu 2009 (RFS); Bollerslev/Tauchen/Zhou 2009 (RFS) |
| **VIX term structure (VIX/VIX3M)** | **KEEP — highest-value regime conditioner** | < 1 (contango) = favorable; > 1 (backwardation) = cut exposure | ratio level + days-in-state; regime flag, not a linear score | Simon & Campasano 2014 (JoD); Johnson 2017 (JFQA) |
| **VVIX** | **KEEP — tail-risk conditioner** | elevated VVIX = tails expensive and binding = cut short-vol | percentile vs. trailing distribution; brake input (§6) | Park 2015 (Fed/JEF) |
| **Skew** (put-wing steepness) | **CONDITIONAL** — practitioner support, mixed peer-reviewed timing evidence for vol-selling specifically | steep skew = crash insurance bid — informative for structure choice more than entry timing | percentile of 25Δ put-call IV spread | no mandate-grade peer-reviewed timing citation — earns weight only via EDGE-5 |
| **IV rank** | **TRANSFORM, not a signal** — a normalization device; no independent peer-reviewed timing support | high IVR favorable **only jointly** with contango + calm VVIX | percentile normalization applied to other signals | practitioner convention only |
| **Put/call ratio** | **WEAK — noise until proven** | contrarian folklore; unstable | — | no robust peer-reviewed timing support; excluded from composite until it clears t > 3 (§5) |

## 4. Finnhub edge-vs-noise ranking (the honest verdict)

The roadmap's §2 Tier-2 table mapped every unfetched Finnhub endpoint to a gate as a
"candidate." The evidence sorts them harder — most are noise that would dilute the composite:

**WIRE (evidence-backed):**

| feed | gate | basis |
|---|---|---|
| SEC filing-NLP sentiment (`/stock/financials/sentiment`) | **info-edge** | Loughran & McDonald 2011, *Journal of Finance* — domain-specific tone dictionaries on 10-K/10-Q text predict returns/risk; the canonical filing-NLP result |
| Earnings-call transcript tone | **info-edge** | same textual-analysis literature line; management tone carries forward information |
| Forward estimate revisions | **quality** | analyst-revision momentum is an established quality/forward-risk input |

**LEAVE ON THE TABLE (noise — would dilute the composite):** congressional trading, social
sentiment, lobbying, government contracts, supply-chain, ESG. No peer-reviewed evidence at the
bar this system requires; adding them stacks variance, not edge. (This supersedes the roadmap's
Tier-2 gate mappings for these rows — they were priors, and the evidence came back negative.)

**SPECIAL CASE — defensive filter, not a signal:** the FDA calendar (`/calendar/fda`) and
earnings dates are a **"do NOT sell into this event" flag** — a binary event-avoidance filter
on short-vol entries, not a stock-picking input. Selling premium across a binary catalyst is
exactly the single-trade tail §1 describes.

The roadmap's entitlement hard-flag stands unchanged: every Finnhub endpoint must be confirmed
in-plan before any wiring.

## 5. The measurement bar (non-negotiable)

- **Harvey, Liu & Zhu 2016 (*Review of Financial Studies*):** after decades of collective
  data-mining, a newly claimed signal needs a **walk-forward, out-of-sample t-statistic > 3.0 —
  not the classical 2.0** — before it deserves belief. Operationally here: **≥ 50–100 closed
  trades** in the outcome record before a signal's contribution is even scored.
- **McLean & Pontiff 2016 (*Journal of Finance*):** live, post-publication edge runs **26–58%
  below backtest**. Haircut every backtested number by that band before it informs sizing or
  weighting.
- **Pre-register direction before testing.** A signal's expected sign is written down before
  the walk-forward runs — no post-hoc sign flipping.
- **EDGE-5's loop is the instrument** (`closeSnapshotOutcomes`, per
  `EDGE-5-outcome-closer-audit.md`): snapshots graded against realized spot/IV, keep-or-kill by
  the data. No signal earns gate weight on its prior — exactly the discipline the roadmap's §3
  already stated; the evidence report confirms it and sharpens the bar to t > 3.

## 6. The survival brake (the anti-wipeout rule)

Hard rule from the research:

> **If VVIX is elevated OR VIX/VIX3M > 1 (backwardation), CUT short-vol exposure — regardless
> of how attractive the VRP z-score looks.**

That combination is precisely when the premium looks **richest** and the tail is **largest**:
implied vol spikes inflate the measured VRP at the exact moment realized vol is about to be
delivered (Feb 5 2018 is the type specimen — §1). A VRP-score-only system maximizes size at the
point of maximum ruin probability. The brake is the rule that prevents the single-trade wipeout,
and it is why the term-structure/VVIX conditioners rank first in §2: they are not return
enhancers, they are the **survival gate** the composite's output must pass through.

## 7. Sizing (survival layer)

- **Quarter-Kelly**, capped at **1–2% of capital at risk per trade** — fractional-Kelly because
  edge estimates are noisy and overbetting a noisy Kelly estimate is ruin (§5's haircut applies
  to the edge input).
- **Hard aggregate caps across the book:** net short vega and beta-weighted delta — correlated
  short-vol positions lose **together**; per-trade caps alone do not bound the book's tail.
- **Negative Kelly = no trade.** If the measured edge is not positive after the McLean-Pontiff
  haircut, size is zero. No override.

## 8. Regulatory line

The publisher's exclusion (**Lowe v. SEC**, 472 U.S. 181 (1985); reaffirmed in the analytics
context by **Lingley v. Seeking Alpha** (2024)) covers **impersonal, disinterested,
generally-circulated analytics** that the user acts on independently. The system stays clearly
inside that line by construction:

- **Data, not directives** — scores and declared conditions, not "buy/sell this now."
- **No personalization** to an individual user's portfolio or situation.
- **No auto-execution** — a human acts, or nothing happens.
- **No measured-edge claims before EDGE-5 validates them** — an unvalidated edge claim is both
  a truth-first violation and the fastest way out of the publisher's exclusion.

## 9. Corrected build sequence (proposal)

Proposal for Alex to rule on — nothing scheduled. This **supersedes STRATEGY-ROADMAP.md §2's
fed-liquidity-first ordering** (and the §4 EDGE-6 wiring order that followed it):

- **Stage 1 — the survival gate first:** wire **VIX/VIX3M + VVIX** as regime conditioners,
  implement the **§6 survival brake**, add the **BBB credit-spread filter**. Fail-loud,
  exclusion-aware, per the established combiner pattern — one gate per PR, atomic and
  revertible.
- **Stage 2 — the evidence-backed info feeds:** filing-NLP sentiment + earnings-call tone →
  info-edge; forward estimate revisions → quality; FDA/earnings **event-avoid flag** as a
  defensive filter (entitlement check first, per the roadmap's hard flag).
- **Stage 3 — the bar:** every signal (including fed net liquidity, if it ever earns a slot)
  cleared by **t > 3.0 walk-forward** on ≥ 50–100 closed trades before earning any composite
  weight. Pre-registered direction, McLean-Pontiff haircut applied.

---

## Plain-language summary

The architecture is already institutional-grade **by survival design** — honest inputs (the
KILL series), an honest exclusion-renormalizing scorer (MIG-1), and a real outcome instrument
(EDGE-5) are the parts most retail systems never build. What the peer-reviewed evidence adds is
a correction of emphasis, not of architecture: the highest-value next build is **not more data
feeds and not fed-liquidity wiring — it is the term-structure/VVIX regime brake**, the rule
that cuts exposure exactly when the premium looks richest and the tail is largest, because in
vol-selling the whole game is surviving the day that erases the unprepared. After the brake,
signals are added one at a time and **measured before they are weighted** — t > 3 walk-forward,
haircut applied, negative Kelly means no trade. Measure-before-weight is the whole game.
