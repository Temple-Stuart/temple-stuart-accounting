/**
 * Project Design Exemplar — Student Loan for Bachelors.
 *
 * The institutional gold-standard project scoping that the AI design
 * generator uses as its few-shot example. Reformatted in PR-Ops-3.7
 * to the structured-lists shape:
 *   - goal_items, problem_items, diagnosis_items as arrays of natural-
 *     voice items with verb prefix included
 *   - design as STEP-based prose (replacing PR-Ops-3.5/3.6 phase-based
 *     prose; same content, new section labels)
 *
 * The original Student Loan project (UUID ea189313-...) was deleted
 * from the user's DB on 2026-05-08 as part of clean-slate preparation
 * for PR-Ops-3.7. Its content lives on here as the engineered standard
 * for what good scoping looks like — a code-review-gated artifact, not
 * runtime user data.
 *
 * Updating this constant requires a deliberate code change. If the
 * exemplar evolves (e.g., a new domain becomes a better template),
 * commit explicit reasoning.
 */

export const PROJECT_DESIGN_EXEMPLAR = {
  title: 'Student Loan for Bachelors - Sallie Mae | FASFA | Grants | Scholarships',
  goal_items: [
    'I WANT federal student aid (subsidized + unsubsidized Direct Loans) fully approved and ready to disburse to Cal State LA',
    'I WANT a private loan alternative obtained for comparison so the federal vs. private decision is informed',
    'I WANT all loan terms (interest rates, repayment schedules, deferment options, total cost over loan life) documented in writing',
    'I WANT FAFSA submitted and Student Aid Index determined',
    'I WANT Cal State LA financial aid award letter received',
    'I WANT federal loan offers accepted at the chosen amount',
    'I WANT all required Master Promissory Notes signed',
    'I WANT entrance counseling completed',
    'I WANT disbursement scheduled to align with Cal State LA\'s enrollment confirmation',
  ],
  problem_items: [
    'I DID NOT create an FSA ID yet (federalstudentaid.gov account required to file FAFSA)',
    'I HAVE NOT filed FAFSA 2026-2027',
    'I DID NOT submit the Cal State LA admission application',
    'I HAVE NOT requested transcripts from prior institutions',
    'I DID NOT file my 2025 personal tax return yet',
    'I HAVE NOT run private lender pre-qualifications (Sallie Mae, College Ave, Earnest)',
    'I DID NOT verify Cal State LA accounting bachelor\'s program total cost of attendance for 2026-2027',
    'I HAVE NOT determined whether trading P&L is reportable income on FAFSA and how it\'s classified',
    'I HAVE NOT determined whether Temple Stuart LLC pass-through income affects Student Aid Index calculation',
    'I HAVE NOT confirmed whether prior coursework transfers to Cal State LA accounting bachelor\'s program',
  ],
  diagnosis_items: [
    'I NEED TO complete personal tax return first so FAFSA pulls clean IRS data via Data Retrieval Tool',
    'I NEED TO complete business tax return so Schedule C and pass-through income are accurate before FAFSA',
    'I NEED TO recognize this project is downstream of "Taxes Personal" and "Sign up for Cal State LA" — not standalone work',
    'I NEED TO acknowledge that FAFSA priority deadlines (March 2 at most CA schools) have already passed for 2026-2027',
    'I NEED TO calendar-anchor the target date to Cal State LA\'s actual fall 2026 enrollment plus disbursement timeline (August/September), not the aspirational May 9',
    'I NEED TO treat FAFSA filing as CPA-level disclosure work given trading entity P&L plus LLC pass-through plus Schedule C plus capital gains complexity',
  ],
  design: `STEP 1 (immediate, ~2 weeks): unblock the upstream chain. Complete personal tax return so FAFSA has clean IRS data. Complete business tax return if it affects pass-through to personal. Request transcripts from all prior institutions. Create FSA ID. Look up Cal State LA published cost of attendance and confirm fall 2026 enrollment is the actual target. Outcome: ready to file FAFSA and Cal State LA admission application with all source documents in hand.
STEP 2 (~4 weeks after step 1): file FAFSA 2026-2027. Submit Cal State LA admission application with transcripts. Contact Cal State LA financial aid office for any program-specific questions about transferring credits and accounting program structure. Outcome: applications submitted, awaiting determination.
STEP 3 (~8 weeks after step 2): receive Cal State LA admission decision. Receive financial aid award letter and Student Aid Index from FAFSA. Run private loan comparison shopping in parallel — soft-pull pre-qualifications with Sallie Mae, College Ave, Earnest. Compare federal subsidized + unsubsidized offers against private offers across interest rate, total cost over loan life, repayment terms, deferment flexibility. Outcome: full financing menu in hand for decision.
STEP 4 (immediately before enrollment, ~August 2026): accept federal loan amounts at the chosen level. Sign all required Master Promissory Notes. Complete entrance counseling. Optionally accept private loan if comparison favors it. Confirm disbursement schedule aligns with Cal State LA's fall 2026 enrollment confirmation. Outcome: financing locked, classes can begin.
Decision points:

STEP 1 reveals tax filing is more complex than scoped → push entire project timeline; do not skip clean tax data.
Cal State LA admission rejected → reset entire project; goal becomes irrelevant.
FAFSA Student Aid Index produces unexpected aid amount → re-evaluate private loan need.
Cost of attendance exceeds federal aid maximum → private loan becomes mandatory rather than comparative.`,
} as const;
