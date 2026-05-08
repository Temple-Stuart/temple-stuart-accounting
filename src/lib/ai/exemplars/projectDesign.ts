/**
 * Project Design Exemplar — Student Loan for Bachelors.
 *
 * This is the institutional gold-standard project scoping that the AI
 * design generator uses as its few-shot example. The user's Student
 * Loan project (UUID: ea189313-296c-4c9e-8279-7e3450debe7e) was scoped
 * manually with Bridgewater 5-step rigor; its content is embedded here
 * verbatim as the exemplar all future generations should match in
 * depth and structure.
 *
 * Updating this constant is a deliberate code change — the exemplar is
 * NOT runtime-fetched from DB. Reasoning:
 *   1. Engineered standard, not variable user data
 *   2. Deterministic cost per call (input tokens fixed)
 *   3. Code review gates exemplar evolution
 *
 * If the canonical exemplar needs to evolve, edit this file with a
 * commit explaining why.
 */

export const PROJECT_DESIGN_EXEMPLAR = {
  title: 'Student Loan for Bachelors - Sallie Mae | FASFA | Grants | Scholarships',
  goal: `Federal student aid (subsidized + unsubsidized Direct Loans) and a private loan alternative both fully approved and ready to disburse to Cal State LA, covering the full cost of attendance for the academic year (tuition + mandatory fees + books + reasonable cost-of-living allowance per CSU guidelines), with all loan terms — interest rates, repayment schedules, deferment options, total cost over loan life — documented in writing and reviewed against each other to choose the lowest-cost path.

Success means:

(a) FAFSA submitted and Student Aid Index determined;
(b) Cal State LA financial aid award letter received;
(c) federal loan offers accepted at the chosen amount;
(d) at least one private loan offer obtained for comparison (even if not accepted) so the federal vs. private decision is informed;
(e) all required Master Promissory Notes signed;
(f) entrance counseling completed;
(g) disbursement scheduled to align with Cal State LA's enrollment confirmation.`,
  problem: `Current state: California-based, no concrete prerequisite work started. No FSA ID created, FAFSA not yet filed, Cal State LA admission application not submitted, transcripts from prior institutions not requested, 2025 personal tax return not yet completed, no private lender pre-qualifications run.
Gap to goal — required actions not yet taken:

FSA ID creation (federalstudentaid.gov account) — required to file FAFSA.
FAFSA 2026-2027 submission — Cal State LA's specific deadline needs verification.
Cal State LA admission application — separate from financial aid; needed before financial aid award letter can be issued.
Transcripts from any prior institutions — required for admission application.
Tax return data for FAFSA — FAFSA pulls IRS data via Data Retrieval Tool; clean personal return must be filed first.
Private lender shortlist — Sallie Mae, College Ave, Earnest are major options; comparison requires soft-pull pre-qualification at minimum 2-3 lenders.

Specific known unknowns:

Cal State LA accounting bachelor's program total cost of attendance for 2026-2027 academic year.
Whether trading P&L is reportable income on FAFSA and how it's classified.
Whether Temple Stuart LLC pass-through income affects Student Aid Index calculation.
Whether prior coursework transfers to Cal State LA accounting bachelor's program.
The actual May 9 date significance — internal goal, deadline, or arbitrary.`,
  diagnosis: `First: this project is the FINAL step of a four-stage chain (clean tax return → FAFSA + admission → award letter + offers → loan acceptance + signing + disbursement). Treating it as standalone creates the illusion that loan-specific work needs doing now, when the real upstream blockers are tax filing and admission paperwork. The "Student Loan" project is downstream of the "Taxes Personal" and "Sign up for Cal State LA" projects.
Second: the FAFSA filing for a solo founder with trading entity P&L plus Temple Stuart LLC pass-through plus Schedule C plus capital gains is materially more complex than a standard W-2 filer. This is CPA-level disclosure work that benefits from completing both personal AND business tax returns first so the FAFSA's IRS Data Retrieval Tool pulls clean numbers.
Third: the May 9 target date was set without verification of any external deadline. FAFSA 2026-2027 priority deadlines have already passed (March 2 at most California schools). Cal State LA's actual fall 2026 enrollment plus disbursement timeline runs through August/September, not May. Target was aspirational, not calendar-anchored.`,
  design: `Phase 1 (immediate, ~2 weeks): unblock the upstream chain. Complete personal tax return so FAFSA has clean IRS data. Complete business tax return if it affects pass-through to personal. Request transcripts from all prior institutions. Create FSA ID. Look up Cal State LA published cost of attendance and confirm fall 2026 enrollment is the actual target. Outcome: ready to file FAFSA and Cal State LA admission application with all source documents in hand.
Phase 2 (~4 weeks after phase 1): file FAFSA 2026-2027. Submit Cal State LA admission application with transcripts. Contact Cal State LA financial aid office for any program-specific questions about transferring credits and accounting program structure. Outcome: applications submitted, awaiting determination.
Phase 3 (~8 weeks after phase 2): receive Cal State LA admission decision. Receive financial aid award letter and Student Aid Index from FAFSA. Run private loan comparison shopping in parallel — soft-pull pre-qualifications with Sallie Mae, College Ave, Earnest. Compare federal subsidized + unsubsidized offers against private offers across interest rate, total cost over loan life, repayment terms, deferment flexibility. Outcome: full financing menu in hand for decision.
Phase 4 (immediately before enrollment, ~August 2026): accept federal loan amounts at the chosen level. Sign all required Master Promissory Notes. Complete entrance counseling. Optionally accept private loan if comparison favors it. Confirm disbursement schedule aligns with Cal State LA's fall 2026 enrollment confirmation. Outcome: financing locked, classes can begin.
Decision points:

Phase 1 reveals tax filing is more complex than scoped → push entire project timeline; do not skip clean tax data.
Cal State LA admission rejected → reset entire project; goal becomes irrelevant.
FAFSA Student Aid Index produces unexpected aid amount → re-evaluate private loan need.
Cost of attendance exceeds federal aid maximum → private loan becomes mandatory rather than comparative.`,
} as const;
