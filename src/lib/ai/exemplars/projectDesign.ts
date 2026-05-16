/**
 * Project Design Exemplar — Student Loan for Bachelors.
 *
 * Institutional gold-standard project scoping reference for the AI
 * design and tasks generators. PR-Ops-3.8 adds tasks_exemplar — an
 * array of operational tasks with verified vendor URLs, matching
 * the new structured output contract.
 *
 * URLs in tasks_exemplar were verified via web search at exemplar-
 * creation time (2026-05-14). If any vendor URL stops resolving,
 * regenerate this exemplar.
 *
 * The design field (prose STEPS plan) is retained for legacy fallback
 * rendering but is no longer sent to the AI in PR-Ops-3.8+ prompts.
 * Only tasks_exemplar is shown as the few-shot example.
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
  tasks_exemplar: [
    {
      title: 'Complete and file 2025 personal tax return (Form 1040)',
      description: 'File the 2025 federal tax return at irs.gov/forms-pubs/about-form-1040. Use FreeFile or paid software. The IRS Data Retrieval Tool pulls this return into the FAFSA in two weeks. Filing late kills the auto-pull and forces manual income entry — slower and error-prone.',
      link_url: 'https://www.irs.gov/forms-pubs/about-form-1040',
      notes: 'Do this first. FAFSA pulls income data from this return via the IRS Data Retrieval Tool. Without a filed return, FAFSA income fields must be entered manually, which slows verification and adds error risk. Filing electronically makes the data available to FAFSA in roughly two weeks.',
      suggested_order: 0,
    },
    {
      title: 'Create FSA ID at studentaid.gov',
      description: 'Create the Federal Student Aid ID at studentaid.gov/fsa-id/create-account/launch. This is the login for FAFSA, MPN, entrance counseling, and federal aid disbursement. Activation takes 1-3 business days — start now so it is ready when FAFSA opens.',
      link_url: 'https://studentaid.gov/fsa-id/create-account/launch',
      notes: 'Can run alongside the tax return. The FSA ID gates every federal aid action downstream — FAFSA submission, MPN signing, entrance counseling, loan disbursement. Activation lag is 1-3 business days, so create it now rather than the day before FAFSA opens.',
      suggested_order: 0,
    },
    {
      title: 'Request official transcripts from all prior post-secondary institutions',
      description: 'Order sealed official transcripts from every college previously attended and have them sent directly to Cal State LA Admissions. Order at calstatela.edu/registrar/transcripts-verifications. Transcripts take 1-3 weeks to arrive. The Cal State Apply application cannot be reviewed until they land.',
      link_url: 'https://www.calstatela.edu/registrar/transcripts-verifications',
      notes: 'Cal State Apply review is blocked until transcripts arrive from every prior college. Most schools take 1-3 weeks to send. Start as soon as the FSA ID is active — this is the longest-lead-time blocker in the application pipeline.',
      suggested_order: 1,
    },
    {
      title: 'File FAFSA 2026-2027 at studentaid.gov',
      description: 'Submit the FAFSA at studentaid.gov/h/apply-for-aid/fafsa for award year 2026-2027. Use the FSA ID. Use the IRS Data Retrieval Tool to import 2025 tax data. List Cal State LA (school code 001140) as a recipient. The FAFSA window opens October 1, 2025.',
      link_url: 'https://studentaid.gov/h/apply-for-aid/fafsa',
      notes: 'Requires FSA ID active and 2025 tax return filed. Cal State LA priority FAFSA deadline is March 2, 2026 for maximum state aid. Filing after March 2 still qualifies for federal aid but loses Cal Grant eligibility. School code 001140 must be on the recipient list or the data does not reach the campus.',
      suggested_order: 2,
    },
    {
      title: 'Submit Cal State LA admission application via Cal State Apply',
      description: 'File the undergraduate admission application at calstate.edu/apply. The Fall 2026 application window opens October 1, 2025 and closes November 30, 2025. Application fee is $70 per campus — fee waivers are available for FAFSA-eligible applicants. Cal State LA is impacted, so applying in October maximizes admission odds.',
      link_url: 'https://www.calstate.edu/apply',
      notes: 'Runs parallel with FAFSA — both windows open October 1. Cal State LA is impacted for most majors, meaning supplementary criteria apply (GPA, course rigor, residency). Apply in the first two weeks of October if possible. Fee waivers post-FAFSA submission cover the $70 application fee.',
      suggested_order: 2,
    },
    {
      title: 'Verify Cal State LA cost of attendance for 2026-2027',
      description: 'Pull the 2026-2027 cost of attendance from calstatela.edu/financialaid/cost-attendance. Capture tuition, fees, housing, food, books, transportation, personal expenses. The total drives the maximum federal loan amount and informs private loan sizing.',
      link_url: 'https://www.calstatela.edu/financialaid/cost-attendance',
      notes: 'Federal loans cap at cost of attendance minus other aid. Private loans cannot exceed this number either. The 2026-2027 figures publish in late spring 2026 — use the current year as a placeholder if not yet published, but update before signing any loan.',
      suggested_order: 3,
    },
    {
      title: 'Run Sallie Mae undergraduate loan pre-qualification',
      description: 'Pre-qualify for a Sallie Mae undergraduate loan at salliemae.com/student-loans/undergraduate-student-loans/. Pre-qualification is a soft pull — no credit score impact. Captures estimated rate, term, and approval likelihood. Compare against College Ave and Earnest before committing.',
      link_url: 'https://www.salliemae.com/student-loans/undergraduate-student-loans/',
      notes: 'Soft pull only. Sallie Mae offers undergraduate, graduate, and parent loan products — pre-qualify for the undergraduate product. Rates vary by credit, cosigner, and repayment plan. Compare against the other two lenders before applying — the application itself is a hard pull.',
      suggested_order: 4,
    },
    {
      title: 'Run College Ave undergraduate loan pre-qualification',
      description: 'Pre-qualify at collegeave.com/prequalify/. Soft pull. Captures rate range and approval likelihood. College Ave offers a flat rate without origination fees, which can beat Sallie Mae on total cost depending on term length.',
      link_url: 'https://www.collegeave.com/prequalify/',
      notes: 'Soft pull only. College Ave is often the lowest sticker rate of the three but has tighter cosigner requirements. Run alongside Sallie Mae and Earnest — comparing all three takes ten minutes and one credit pull is not done until you submit a full application.',
      suggested_order: 4,
    },
    {
      title: 'Run Earnest undergraduate loan eligibility check',
      description: 'Check eligibility at earnest.com/eligibility. Soft pull. Earnest does not service all states for undergrad loans — California is supported. Captures rate range and term options.',
      link_url: 'https://www.earnest.com/eligibility',
      notes: 'Soft pull only. Earnest weighs job history and savings in addition to credit — useful for applicants with thin credit files. State availability is restrictive but California qualifies. Compare against Sallie Mae and College Ave before applying.',
      suggested_order: 4,
    },
    {
      title: 'Sign Master Promissory Note (MPN) for Direct Subsidized + Unsubsidized Loans',
      description: 'Sign the MPN at studentaid.gov/mpn/ in one session — partial completion does not save. The MPN covers all federal Direct Loans for the next 10 years. Required before disbursement. Uses the FSA ID for signature.',
      link_url: 'https://studentaid.gov/mpn/',
      notes: 'Single session, no save. Block out 20-30 minutes uninterrupted. One MPN covers all federal Direct Loans for 10 years — does not need re-signing each academic year. Federal aid cannot disburse without this on file.',
      suggested_order: 5,
    },
    {
      title: 'Complete federal loan entrance counseling',
      description: 'Complete entrance counseling at studentaid.gov/entrance-counseling/. Covers loan terms, repayment options, and borrower rights. Required for first-time federal loan borrowers. Takes 20-30 minutes. Cannot save partial progress.',
      link_url: 'https://studentaid.gov/entrance-counseling/',
      notes: 'Required for first-time federal loan borrowers. Returning borrowers may not need to repeat — check Cal State LA financial aid office to confirm. Federal loan disbursement is blocked until this completes. Same FSA ID flow as the MPN.',
      suggested_order: 5,
    },
    {
      title: 'Confirm Fall 2026 enrollment with Cal State LA and pay enrollment deposit',
      description: 'After admission, confirm enrollment via the Cal State LA admit portal by the deadline on the admission letter (typically May 1, 2026 for Fall 2026). Pay the non-refundable enrollment deposit. Deposit secures the seat — missing the deadline forfeits admission.',
      link_url: 'https://www.calstatela.edu/admissions/fall-2026-admission-deadlines-undergraduates',
      notes: 'Deadline is on the admission letter — usually May 1, 2026 for Fall. Deposit is non-refundable and forfeits the seat if missed. Confirm enrollment only after FAFSA disbursement and loan approval are locked, so the financial picture is real before committing.',
      suggested_order: 6,
    },
  ],
} as const;
