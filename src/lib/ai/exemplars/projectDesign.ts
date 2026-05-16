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
      description: 'File Form 1040 for tax year 2025 including Schedule C for Temple Stuart LLC pass-through income, Schedule D + Form 8949 for capital gains from trading P&L, and any required Schedule 1 / Schedule SE forms. Given the complexity (LLC pass-through + Schedule C + trading capital gains + potential mark-to-market election analysis), engage a CPA who knows trader tax — DIY is high-risk. Confirm e-file acceptance receipt is saved.',
      link_url: 'https://www.irs.gov/forms-pubs/about-form-1040',
      notes: 'UPSTREAM BLOCKER for FAFSA. The FAFSA Direct Data Exchange (DDX, formerly IRS DRT) pulls income data directly from a filed IRS return — without a clean filed return, FAFSA either requires manual income entry (error-prone, slows verification) or blocks Student Aid Index calculation. 2025 return is due April 15, 2026 (extension to October 15 available via Form 4868). Budget: $400-1200 with a CPA, 4-8 hours DIY. Decision points: (1) if 2024 return is also unfiled, file both simultaneously — FAFSA looks at prior-prior year (2024 income for 2026-27 FAFSA); (2) if trading P&L pushes AGI into a different aid-eligibility bracket, the SAI calculation changes materially; (3) if Section 475(f) trader status was elected, Schedule C losses can offset other income — but that election had to be filed by April 15, 2025 for tax year 2025. This is the FIRST task — every downstream financial-aid task depends on it completing cleanly.',
      suggested_order: 0,
    },
    {
      title: 'Create FSA ID at studentaid.gov',
      description: 'Register a Federal Student Aid (FSA) account at studentaid.gov/fsa-id/create-account/launch. Provide SSN, full legal name, date of birth, a memorable username, password, four challenge questions, and a permanent email + mobile number. Verify both email and phone via the codes sent. The FSA ID is required to sign the FAFSA, complete the MPN, and finish entrance counseling.',
      link_url: 'https://studentaid.gov/fsa-id/create-account/launch',
      notes: 'PARALLEL with tax return — no dependency. Most accounts verify within one business day. SSN-name-DOB combo is matched against SSA records; mismatches (e.g., maiden vs. married name not updated with SSA) cause verification failures that take days to resolve. Decision point: if verification fails, call the FSA Information Center at 1-800-433-3243 immediately — do not abandon the account and create another, that compounds the mismatch.',
      suggested_order: 0,
    },
    {
      title: 'Request official transcripts from all prior post-secondary institutions',
      description: 'For every college or university previously attended, log into the institution\'s registrar portal (or contact via their Transcripts & Verifications office) and request an official transcript be sent electronically to Cal State LA admissions. Cal State LA accepts transcripts directly from the issuing institution or via Parchment/Credentials Solutions. Pay any transcript fees ($5-20 each). Save confirmation emails.',
      link_url: 'https://www.calstatela.edu/registrar/transcripts-verifications',
      notes: 'Required to confirm admission and to evaluate transfer credit toward the accounting bachelor\'s. Decision point: if any institution attended was outside the US, transcripts must be evaluated by IERF or WES before submission to Cal State LA — that evaluation takes 4-8 weeks, so trigger it now. Cal State LA accepts final transcripts up to July 15 for Fall admission, but earlier is better for credit-evaluation lead time.',
      suggested_order: 1,
    },
    {
      title: 'File FAFSA 2026-2027 at studentaid.gov',
      description: 'Log into studentaid.gov with the FSA ID, navigate to Apply for Aid → 2026-27 FAFSA. Complete all five sections (Student, Student Spouse, Parent, Parent Spouse/Partner if applicable, Preparer). Use the Direct Data Exchange to import IRS data from the filed 2024 return (the FAFSA uses prior-prior-year income). List Cal State LA (federal school code 001140) as a recipient. Review the Submission Summary; sign and submit.',
      link_url: 'https://studentaid.gov/h/apply-for-aid/fafsa',
      notes: 'Federal deadline is June 30, 2027 — but California state priority deadlines (Cal Grant: March 2) have already passed for 2026-27. File anyway: federal Direct Loans are not deadline-gated, only state grants. Decision points: (1) if 2024 IRS data cannot be pulled via DDX, manual entry is required and FAFSA may flag for verification (Verification Worksheet, additional document submission); (2) if Student Aid Index comes back materially different from expected, re-check Schedule C net income and any capital-loss carryover entries; (3) if filing as an independent student, expect to upload supporting documentation. LLC pass-through income reports under "Other untaxed income" or via the Schedule C linkage depending on filing structure — review with the CPA.',
      suggested_order: 2,
    },
    {
      title: 'Submit Cal State LA admission application via Cal State Apply',
      description: 'Apply at calstate.edu/apply (Cal State Apply portal). Select Cal State LA as the campus, choose the accounting bachelor\'s program, complete personal information, academic history, course-by-course transfer-credit entries, and any program-specific essays. Pay the $70 per-campus application fee. Upload required supporting documents.',
      link_url: 'https://www.calstate.edu/apply',
      notes: 'DECISION POINT — TIMING: The Cal State Apply window for Fall 2026 was October 1 - December 1, 2025; that window is CLOSED as of 2026-05-14. Options: (1) check the Cal State LA admissions office for a late-application waiver (some campuses accept past the deadline if space remains); (2) target Spring 2027 admission (apply August-September 2026) instead, which shifts the entire project timeline 4-5 months; (3) consider community-college coursework for Fall 2026 to maintain enrollment status and improve transfer GPA, then transfer for Spring 2027. Do NOT skip this triage — every downstream task assumes a confirmed admission target term. Cal State LA is currently test-blind (no SAT/ACT required).',
      suggested_order: 2,
    },
    {
      title: 'Verify Cal State LA cost of attendance for 2026-2027',
      description: 'Download or print the official Cost of Attendance worksheet from Cal State LA Financial Aid. For the accounting bachelor\'s program (undergraduate, California resident, on-campus or off-campus living): tuition + campus fees + books/supplies + room/board + transportation + personal expenses. Compute total annual COA. This is the cap on how much federal aid can be packaged.',
      link_url: 'https://www.calstatela.edu/financialaid/cost-attendance',
      notes: 'Estimated 2026-27 COA: ~$34,500 for CA-resident undergraduate living on-campus; ~$47,000 for non-resident. Tuition alone is ~$7,528/year for CA residents (5.7% increase over 2025-26). Decision point: if Cal State LA COA exceeds federal aid maximum (~$12,500/year for dependent undergraduates including subsidized + unsubsidized Direct Loans), private loans become MANDATORY rather than just comparative — that changes the financing strategy in the next steps. Cross-reference COA against the FAFSA award letter when it arrives.',
      suggested_order: 3,
    },
    {
      title: 'Run Sallie Mae undergraduate loan pre-qualification',
      description: 'Apply at salliemae.com/student-loans/undergraduate-student-loans. Enter requested loan amount (cover the gap between FAFSA award + savings and total COA), school information, personal information, and cosigner information if applicable. Complete the credit check and capture the rate quote, term options, and any cosigner-release conditions.',
      link_url: 'https://www.salliemae.com/student-loans/undergraduate-student-loans/',
      notes: 'CRITICAL DIFFERENCE FROM COLLEGE AVE / EARNEST: Sallie Mae does NOT offer a soft-pull pre-qualification — the credit inquiry is a HARD pull that hits the credit report. Sequence Sallie Mae LAST among the three lenders if credit-report impact matters (multiple hard pulls within ~30 days for the same loan type are typically bucketed as one inquiry by FICO, but Sallie Mae shouldn\'t be the first hit). Minimum credit score is mid-600s; borrow $1,000 to 100% of school-certified COA. Application-to-credit-decision: ~10 minutes; application-to-disbursement: ~10 business days.',
      suggested_order: 4,
    },
    {
      title: 'Run College Ave undergraduate loan pre-qualification',
      description: 'Visit collegeave.com/prequalify and enter name, street address, date of birth, and zip code. The pre-qualification tool returns a status and interest rate range in ~3 seconds. If pre-qualified, capture the rate range, term options (5/8/10/15 years), and repayment options (in-school deferment, fixed payment, interest-only, full deferment).',
      link_url: 'https://www.collegeave.com/prequalify/',
      notes: 'SOFT PULL — no credit-score impact. Pre-qualification is indicative; final approval and exact rate depend on full application. Do this BEFORE Sallie Mae since this one is free of credit-report cost. College Ave\'s rate range typically spans 4-5 percentage points — the bottom of the range requires excellent credit and/or a strong cosigner. After pre-qual, the full application takes ~3 minutes.',
      suggested_order: 4,
    },
    {
      title: 'Run Earnest undergraduate loan eligibility check',
      description: 'Visit earnest.com/eligibility and complete the eligibility check (SSN, basic financial information, school enrollment status, state of residence). Authorize the soft credit inquiry. Capture the rate quote and term options if eligible.',
      link_url: 'https://www.earnest.com/eligibility',
      notes: 'SOFT PULL — no credit-score impact. Eligibility check takes ~2 minutes. HARD CONSTRAINT: Earnest does NOT lend to residents of Nevada — verify state of residence is not NV before spending time on this. Requires enrollment (or planned enrollment) at a 4-year Title IV not-for-profit institution at least half-time. Minimum 650 credit score for borrower or cosigner. Full approval-to-disbursement: 2-5 weeks once school certifies the loan.',
      suggested_order: 4,
    },
    {
      title: 'Sign Master Promissory Note (MPN) for Direct Subsidized + Unsubsidized Loans',
      description: 'Log into studentaid.gov with the FSA ID, click "Complete Aid Process," then under "Sign Loan Agreement" click "Complete a Master Promissory Note (MPN)." Select the Subsidized/Unsubsidized MPN. Enter two personal references (name, address, phone — typically parents, siblings, or close friends). Read the loan terms, accept, electronically sign.',
      link_url: 'https://studentaid.gov/mpn/',
      notes: 'The MPN must be completed in a SINGLE session — there is no save-and-resume. Total time: ~30 minutes. The MPN is valid for up to 10 years and covers all federal Direct Loans for the borrower across multiple academic years — only sign once per loan type. Dependency: must come after FAFSA submission AND after the Cal State LA financial aid award letter has been received and federal loan amounts accepted. Decision point: if planning to also borrow Direct PLUS Loans (parent or grad), a separate PLUS MPN is required.',
      suggested_order: 5,
    },
    {
      title: 'Complete federal loan entrance counseling',
      description: 'Log into studentaid.gov, navigate to studentaid.gov/entrance-counseling. Complete the interactive modules covering loan terms, repayment plans, borrower rights and responsibilities, default consequences, and budgeting. Answer the comprehension questions correctly. Save the completion confirmation.',
      link_url: 'https://studentaid.gov/entrance-counseling/',
      notes: 'Required for all FIRST-TIME federal Direct Loan borrowers BEFORE the first disbursement. Single session, cannot be saved and resumed. Takes 20-30 minutes. After completion, the FSA system notifies Cal State LA automatically — verify within 1-2 business days that the school has the completion on file (check the Cal State LA financial aid portal). Decision point: if previously took out federal student loans at any prior institution, entrance counseling may not be required again — confirm with Cal State LA financial aid before completing redundantly.',
      suggested_order: 5,
    },
    {
      title: 'Confirm Fall 2026 enrollment with Cal State LA and pay enrollment deposit',
      description: 'After admission decision is received and accepted, pay the Enrollment Confirmation Deposit in the Cal State LA admissions portal. Sign up for orientation (Orientation for freshmen, First Flight for transfers) when the email invitation arrives. Confirm class registration window and ensure financial aid disbursement is timed to the registrar\'s fee-pay deadline.',
      link_url: 'https://www.calstatela.edu/admissions/fall-2026-admission-deadlines-undergraduates',
      notes: 'Enrollment Confirmation Deposit is the binding step — once paid, Cal State LA holds the seat. Orientation sign-up priority date: June 1, 2026. New-student email invitations begin February 2026. Decision point: if financial aid disbursement is delayed (e.g., verification flag, MPN pending), contact Cal State LA financial aid BEFORE the fee-pay deadline to request a fee-payment extension — losing the seat to a late deposit is reversible only through reapplication. Final transcripts (with summer-2026 grades if applicable) must be on file by September 1, 2026.',
      suggested_order: 6,
    },
  ],
} as const;
