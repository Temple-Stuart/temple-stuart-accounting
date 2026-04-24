// src/lib/ops/bookkeepingQuestions.ts
// Bookkeeping & Tax Operations Planner Question Registry
// Single source of truth for all compliance questions — pattern follows travelCOA.ts

export type QuestionType = 'text' | 'boolean' | 'multiselect' | 'checklist' | 'date' | 'select';

export type RegulatoryTag =
  | 'Entity' | 'IP_Licensing' | 'IRS_EFile' | 'Tax_Advice'
  | 'Bookkeeping_Services' | 'Multi_Entity' | 'Tax_Module_Scope'
  | 'CPA_Licensing' | 'Circular_230' | 'PTIN' | 'EFIN' | 'MeF'
  | 'MeF_Security' | 'IRC_7216' | 'Record_Retention' | 'Due_Diligence'
  | 'State_Compliance' | 'GLBA_Safeguards' | 'Safeguards' | 'WISP'
  | 'GLBA_Privacy' | 'CCPA' | 'NY_SHIELD' | 'Breach_Notification'
  | 'Cookie_Tracking' | 'Plaid' | 'CFPB_1033' | 'GAAP' | 'Audit_Trail'
  | 'Auto_Categorization' | 'Stocks_Crypto' | 'Forms' | 'Signatures'
  | 'Accuracy' | 'State_Tax' | 'State_Sales_Tax' | 'EO_Insurance'
  | 'Cyber_Insurance' | 'DO_Insurance' | 'Fidelity_Bond' | 'SOC2'
  | 'Penetration_Testing' | 'TOS' | 'Guarantees' | 'Accessibility'
  | 'Marketing_FTC' | 'Section_1033' | 'Training' | 'Vendor_Review'
  | 'Incident_Response' | 'Change_Management' | 'Backup_Recovery' | 'Scale'
  | 'Go_No_Go';

export type LaunchStage = 'required_now' | 'required_before_charging' | 'required_at_scale' | 'best_practice';

export interface OpsQuestion {
  id: string;
  text: string;
  type: QuestionType;
  regulatoryTag: RegulatoryTag;
  launchStage: LaunchStage;
  options?: string[];
  dependsOn?: string[];
  helpText?: string;
  sourceSection?: string;
}

export interface OpsWorkstream {
  id: string;
  letter: string;
  title: string;
  description: string;
  questions: OpsQuestion[];
}

export interface OpsModule {
  id: string;
  title: string;
  description: string;
  workstreams: OpsWorkstream[];
  totalQuestions: number;
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
] as const;

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM A — Corporate Foundation
// ═══════════════════════════════════════════════════════════════════

export const workstreamA: OpsWorkstream = {
  id: 'bk-a',
  letter: 'A',
  title: 'Corporate Foundation',
  description: 'Entity structure, IP licensing, and state registration decisions that must be answered first.',
  questions: [
    {
      id: 'bk-a-01',
      text: 'In what state will Temple Stuart be incorporated, and as what entity type?',
      type: 'select',
      regulatoryTag: 'Entity',
      launchStage: 'required_now',
      options: ['Delaware C-Corp', 'LLC (any state)', 'PLLC/PC (CPA-licensed)', 'S-Corp', 'Other'],
      helpText: 'Delaware C-corp is standard for venture path. LLC for solo cashflow. PLLC/PC required in some states if CPA-licensed.',
      sourceSection: '§A Corporate Foundation',
    },
    {
      id: 'bk-a-02',
      text: 'Will the platform and any CPA-branded services operate from the same legal entity, or will a separate CPA firm own attest-related services to preserve state-board compliance?',
      type: 'select',
      regulatoryTag: 'Entity',
      launchStage: 'required_before_charging',
      options: ['Same entity', 'Separate CPA firm entity', 'Undecided — need legal counsel'],
      helpText: 'State accountancy boards may require attest services (audit/review/compilation) to be offered through a registered CPA firm, separate from the SaaS entity.',
      sourceSection: '§A Corporate Foundation',
    },
    {
      id: 'bk-a-03',
      text: 'Who signs the Contributor License Agreement for AGPL-3.0 contributions, and what is the exact language of the commercial-dual-license grant for paying customers?',
      type: 'text',
      regulatoryTag: 'IP_Licensing',
      launchStage: 'required_now',
      helpText: 'AGPL-3.0 network-use-as-distribution trigger means hosted users may claim source access. Commercial license must clearly govern paying customers. Many enterprise buyers refuse AGPL outright.',
      sourceSection: '§10.5 IP & Licensing',
    },
    {
      id: 'bk-a-04',
      text: 'In which states will Temple Stuart register for foreign qualification based on where you hire employees/contractors or lease space?',
      type: 'multiselect',
      regulatoryTag: 'Entity',
      launchStage: 'required_before_charging',
      options: [...US_STATES],
      helpText: 'Foreign qualification is required in any state where you have physical presence, employees, or leased space — not just incorporation state.',
      sourceSection: '§A Corporate Foundation',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM B — Scope of Service
// ═══════════════════════════════════════════════════════════════════

export const workstreamB: OpsWorkstream = {
  id: 'bk-b',
  letter: 'B',
  title: 'Scope of Service',
  description: 'Define what the platform does and does not do — e-filing, human experts, entity support, form coverage.',
  questions: [
    {
      id: 'bk-b-01',
      text: 'Will the tax module e-file returns with the IRS, or will it only generate PDFs that users file themselves?',
      type: 'select',
      regulatoryTag: 'IRS_EFile',
      launchStage: 'required_now',
      options: ['PDF generation only', 'E-file via third-party transmitter', 'E-file as own transmitter', 'Undecided'],
      helpText: 'PDF-only avoids EFIN/ERO/MeF ATS entirely. E-filing triggers the full IRS e-file provider regime including suitability checks, ATS testing, and ongoing compliance.',
      sourceSection: '§1.4 PDF vs E-Filing',
    },
    {
      id: 'bk-b-02',
      text: 'If e-filing, will Temple Stuart be a Software Developer only (passes data to a third-party transmitter) or also a Transmitter (directly talks to MeF)?',
      type: 'select',
      regulatoryTag: 'IRS_EFile',
      launchStage: 'required_before_charging',
      options: ['Software Developer only', 'Software Developer + Transmitter', 'N/A — PDF only'],
      dependsOn: ['bk-b-01'],
      helpText: 'Software Developer only is lighter — you build the XML but a third party transmits. Being your own Transmitter requires Strong Authentication Certificates and direct MeF integration.',
      sourceSection: '§1.3 MeF for Software Developers',
    },
    {
      id: 'bk-b-03',
      text: "Will the platform offer any human-expert 'ask a tax pro' feature? If yes, are those experts W-2 employees under your EFIN or contractors under their own?",
      type: 'select',
      regulatoryTag: 'Tax_Advice',
      launchStage: 'required_before_charging',
      options: ['No human expert feature', 'W-2 employees under our EFIN', 'Independent contractors under their own credentials', 'Future consideration'],
      helpText: 'Human experts who sign returns assume preparer liability. If under your EFIN, you assume firm-level responsibility. Contractors under their own credentials reduce your liability but require careful TOS structuring.',
      sourceSection: '§2.1 Tax Advice vs Software',
    },
    {
      id: 'bk-b-04',
      text: 'Will Temple Stuart ever do bookkeeping for a user (Bench/Pilot model), or only provide software the user operates themselves?',
      type: 'select',
      regulatoryTag: 'Bookkeeping_Services',
      launchStage: 'required_now',
      options: ['Software only — user operates', 'Done-for-you bookkeeping service', 'Both (tiered)', 'Undecided'],
      helpText: 'Done-for-you bookkeeping multiplies FTC Safeguards and §7216 obligations per customer, requires higher cyber insurance, and triggers annual SOC 2 expectations from clients.',
      sourceSection: '§9 Competitive Landscape — Bench/Pilot',
    },
    {
      id: 'bk-b-05',
      text: 'Which entity types will the bookkeeping module support?',
      type: 'multiselect',
      regulatoryTag: 'Multi_Entity',
      launchStage: 'required_now',
      options: ['Sole Proprietorship', 'Single-Member LLC', 'Multi-Member LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Trust', 'Nonprofit'],
      helpText: 'Each entity type has different tax filing requirements (Schedule C vs 1120 vs 1120-S vs 1065). Supporting more types increases form coverage requirements in the tax module.',
      sourceSection: '§7.1 IRS Separate-Books Requirement',
    },
    {
      id: 'bk-b-06',
      text: 'Which tax forms/situations are explicitly in-scope at launch and which are explicitly excluded?',
      type: 'text',
      regulatoryTag: 'Tax_Module_Scope',
      launchStage: 'required_now',
      helpText: 'Current scope: W-2, 1099-R, 1098-T, 1098-E, AOTC, LLC, student loan interest, SE tax, standard deduction. Explicitly listing exclusions protects against scope creep and limits MeF ATS testing surface.',
      sourceSection: '§B Scope of Service',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM C — CPA Candidate Professional Positioning
// ═══════════════════════════════════════════════════════════════════

export const workstreamC: OpsWorkstream = {
  id: 'bk-c',
  letter: 'C',
  title: 'CPA Candidate Professional Positioning',
  description: 'Licensure timeline, title usage, EA credential path, and Circular 230 compliance ownership.',
  questions: [
    {
      id: 'bk-c-01',
      text: 'What is your target CPA licensure date, and which state board of accountancy will you license through?',
      type: 'text',
      regulatoryTag: 'CPA_Licensing',
      launchStage: 'required_before_charging',
      helpText: 'Affects 150-hour credit requirements, experience hours, two-tier vs one-tier states, and reciprocity. Licensure exempts you from most state preparer registration regimes (CTEC, NYTPRIN, Oregon, etc.).',
      sourceSection: '§8.1 CPA Candidate Status',
    },
    {
      id: 'bk-c-02',
      text: "Until licensure, what exact title will you use in marketing ('CPA candidate,' 'staff accountant,' 'tax preparer,' 'founder'), and have you confirmed with the state board that this title is permissible?",
      type: 'text',
      regulatoryTag: 'CPA_Licensing',
      launchStage: 'required_now',
      helpText: "Using 'CPA' without an active license is illegal under every state accountancy act. Even 'CPA candidate' usage rules vary by state board. Confirm with your licensing state before publishing any marketing materials.",
      sourceSection: '§2.4 CPA-Candidate Status',
    },
    {
      id: 'bk-c-03',
      text: 'Are you also pursuing the EA credential as an earlier path to unlimited IRS representation rights?',
      type: 'boolean',
      regulatoryTag: 'CPA_Licensing',
      launchStage: 'required_before_charging',
      helpText: 'Enrolled Agent status grants unlimited IRS representation rights without waiting for CPA licensure. EA exam (SEE) can be taken at any time and provides immediate credentialing upon passing all three parts.',
      sourceSection: '§8.2 Capabilities Unlocked by Licensure',
    },
    {
      id: 'bk-c-04',
      text: 'Once licensed/enrolled, who in your organization is the Circular 230 compliance owner?',
      type: 'text',
      regulatoryTag: 'Circular_230',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-c-01'],
      helpText: 'Circular 230 (31 CFR Part 10) governs practice before the IRS — diligence, competence, conflict-of-interest, contingent-fee restrictions, and advertising rules. Violations can result in censure, suspension, disbarment, and monetary penalties.',
      sourceSection: '§10.1 Circular 230',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM D — IRS Registration Workstream
// ═══════════════════════════════════════════════════════════════════

export const workstreamD: OpsWorkstream = {
  id: 'bk-d',
  letter: 'D',
  title: 'IRS Registration Workstream',
  description: 'PTIN, EFIN application, MeF ATS testing, schema retrieval, and security requirements.',
  questions: [
    {
      id: 'bk-d-01',
      text: 'Will you obtain a PTIN now to sign returns you personally prepare for paying users (and have you paid the 2026 $18.75 renewal)?',
      type: 'boolean',
      regulatoryTag: 'PTIN',
      launchStage: 'required_before_charging',
      helpText: 'PTIN is required for any person who, for compensation, prepares or assists in preparing all or substantially all of a federal tax return. $18.75 annual renewal. Failure triggers §6695 penalties.',
      sourceSection: '§1.1 PTIN',
    },
    {
      id: 'bk-d-02',
      text: 'When will you submit the IRS e-file application (accounting for ~45-day suitability), which Provider Options will you check (ERO, Software Developer, Transmitter, Online Provider), and who will be listed as Principal/Responsible Official/Primary Contact?',
      type: 'text',
      regulatoryTag: 'EFIN',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-b-01'],
      helpText: 'EFIN application requires suitability check on every Principal/Responsible Official including credit, criminal background, and tax compliance. ~45-day processing. $0 fee for EFIN itself.',
      sourceSection: '§1.2 EFIN',
    },
    {
      id: 'bk-d-03',
      text: 'Will any Principal or Responsible Official need fingerprinting, and have you scheduled the IRS-authorized vendor appointment?',
      type: 'boolean',
      regulatoryTag: 'EFIN',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-d-02'],
      helpText: 'CPAs, EAs, and attorneys substitute professional credentials for fingerprinting. Uncredentialed Principals must submit fingerprints via IRS-authorized vendor scheduling system.',
      sourceSection: '§1.2 EFIN',
    },
    {
      id: 'bk-d-04',
      text: 'Who owns passage of the MeF Assurance Testing System (ATS) for every form/schedule supported at launch (Publications 1436 and 4163)?',
      type: 'text',
      regulatoryTag: 'MeF',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-b-01', 'bk-b-02'],
      helpText: 'ATS passage is required for every form/schedule you support. Only companies with a valid software ID that have passed ATS are listed as approved MeF providers.',
      sourceSection: '§1.3 MeF for Software Developers',
    },
    {
      id: 'bk-d-05',
      text: 'What is your plan for retrieving the MeF schemas/business rules and WSDLs via e-Services Secure Object Repository, including the 60-day purge awareness?',
      type: 'text',
      regulatoryTag: 'MeF',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-b-01', 'bk-b-02'],
      helpText: 'Schemas and business rules are retrieved via e-Services Secure Object Repository. Content is purged after 60 days — you must have a process to retrieve and archive regularly.',
      sourceSection: '§1.3 MeF for Software Developers',
    },
    {
      id: 'bk-d-06',
      text: 'Have you confirmed TLS 1.2+, SHA-256+ XML signing, and Strong Authentication Certificate procurement if using A2A?',
      type: 'checklist',
      regulatoryTag: 'MeF_Security',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-b-01', 'bk-b-02'],
      options: ['TLS 1.2+ enforced', 'SHA-256+ XML signatures (SHA-1 rejected)', 'Strong Authentication Certificate procured (if A2A)', 'e-Services Secure Object Repository access confirmed'],
      helpText: 'SHA-1 is rejected by MeF. TLS 1.2 is minimum. A2A (Application-to-Application) requires Strong Authentication Certificates purchased from IRS-approved vendors.',
      sourceSection: '§1.3 MeF for Software Developers',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM E — IRC §7216 and Taxpayer Data Handling
// ═══════════════════════════════════════════════════════════════════

export const workstreamE: OpsWorkstream = {
  id: 'bk-e',
  letter: 'E',
  title: 'IRC §7216 and Taxpayer Data Handling',
  description: 'Return data usage consent, cross-use compliance, offshore processing, record retention, and due diligence.',
  questions: [
    {
      id: 'bk-e-01',
      text: 'What exactly will the platform do with tax return information beyond preparing the current return (e.g., bookkeeping insights, trend analytics, AI features, cross-sell to financial products)?',
      type: 'text',
      regulatoryTag: 'IRC_7216',
      launchStage: 'required_before_charging',
      helpText: 'IRC §7216 makes it a misdemeanor to disclose or use return information for any purpose other than preparing that return. Penalties: up to $1,000 fine or $100,000 in §6713(b) cases, and/or 1 year imprisonment.',
      sourceSection: '§2.5 IRC §7216',
    },
    {
      id: 'bk-e-02',
      text: 'For each cross-use of return data, have you produced a Rev. Proc. 2013-14-compliant Consent to Use or Consent to Disclose, with mandatory language and single-purpose separation, presented before data is used?',
      type: 'boolean',
      regulatoryTag: 'IRC_7216',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-e-01'],
      helpText: 'Consent must use mandatory language from Rev. Proc. 2013-14. Each use requires separate consent (no bundling). Consent must be presented and signed before data is used, not retroactively.',
      sourceSection: '§2.5 IRC §7216',
    },
    {
      id: 'bk-e-03',
      text: 'Will any return data ever be processed by a non-U.S. contractor, vendor, or sub-processor? If yes, have you built the specific "outside the United States" consent?',
      type: 'boolean',
      regulatoryTag: 'IRC_7216',
      launchStage: 'required_before_charging',
      helpText: 'Offshore processing of return data requires a specific additional consent form beyond the standard §7216 consent. This applies to any non-U.S. contractor, cloud region, or vendor.',
      sourceSection: '§2.5 IRC §7216',
    },
    {
      id: 'bk-e-04',
      text: 'Does the platform automatically satisfy the §6107(b) 3-year retention of returns or a names/TIN list, indexed by return period (July 1 start)?',
      type: 'boolean',
      regulatoryTag: 'Record_Retention',
      launchStage: 'required_before_charging',
      helpText: 'Under IRC §6107(b), preparers must retain a complete copy of each return OR a list of names and TINs for 3 years after the close of the return period. Failure: $50 per failure up to $25,000 per return period under §6695(d).',
      sourceSection: '§1.5 Record Retention',
    },
    {
      id: 'bk-e-05',
      text: 'For every EITC/AOTC/CTC/ACTC/HOH return, does the workflow produce a Form 8867 checklist and retain the five required records per Reg. §1.6695-2(b)(4)(ii) for three years?',
      type: 'boolean',
      regulatoryTag: 'Due_Diligence',
      launchStage: 'required_before_charging',
      helpText: 'Due-diligence requirements apply whenever EITC, CTC/ACTC, AOTC, or HOH status is claimed. Form 8867 and five specific records must be retained for three years. Penalties are $500+ per return for failure.',
      sourceSection: '§1.5 Record Retention',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM F — State Tax Preparer Regimes
// ═══════════════════════════════════════════════════════════════════

export const workstreamF: OpsWorkstream = {
  id: 'bk-f',
  letter: 'F',
  title: 'State Tax Preparer Regimes',
  description: 'State-by-state preparer registration requirements — CTEC, NYTPRIN, Oregon, and others.',
  questions: [
    {
      id: 'bk-f-01',
      text: 'Will the platform accept California users before you are CPA-licensed, and if so, will you register with CTEC (60-hr course, $5k bond, annual $33 fee)?',
      type: 'boolean',
      regulatoryTag: 'State_Compliance',
      launchStage: 'required_before_charging',
      helpText: 'California requires CTEC registration for non-exempt preparers: 60-hour qualifying education, $5,000 surety bond, 20 hrs CPE/year, $33 annual fee. CPAs are exempt.',
      sourceSection: '§3.1 State Preparer Registration',
    },
    {
      id: 'bk-f-02',
      text: 'Will you register with New York (NYTPRIN, $100 commercial fee if 10+ NY returns, 16-hr initial or 4-hr continuing ed, Publication 135.1 posting)?',
      type: 'boolean',
      regulatoryTag: 'State_Compliance',
      launchStage: 'required_before_charging',
      helpText: 'New York requires NYTPRIN registration with $100 commercial fee if preparing 10 or more NYS returns. Must post Publication 135.1 Consumer Bill of Rights. CPAs are exempt.',
      sourceSection: '§3.1 State Preparer Registration',
    },
    {
      id: 'bk-f-03',
      text: 'Will you operate in Oregon, Maryland, Connecticut, Nevada, Illinois, or Iowa, and have you built pre-launch state-by-state registration into the launch schedule?',
      type: 'multiselect',
      regulatoryTag: 'State_Compliance',
      launchStage: 'required_before_charging',
      options: ['Oregon (license + exam)', 'Maryland (registration + exam)', 'Connecticut (permit, AFSP required)', 'Nevada ($50k bond)', 'Illinois (PTIN mandate)', 'Iowa (PTIN mandate)', 'None of these'],
      helpText: 'Each state has different requirements ranging from exams to surety bonds. All exempt CPAs, attorneys, and EAs. Pure self-prep software is generally not subject to these regimes.',
      sourceSection: '§3.1 State Preparer Registration',
    },
    {
      id: 'bk-f-04',
      text: 'Where will the NYTPRIN, CRTP number, or other state registration numbers be surfaced on each state return the software produces?',
      type: 'text',
      regulatoryTag: 'State_Compliance',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-f-01', 'bk-f-02', 'bk-f-03'],
      helpText: 'State preparer registration numbers must appear on returns filed in those states. The platform must have a field for the preparer state registration numbers and auto-populate them on relevant state returns.',
      sourceSection: '§3.1 State Preparer Registration',
    },
  ],
};

// --- Workstreams G through R will be added in subsequent prompts ---
// G: Data Security — GLBA/FTC Safeguards (10 questions)
// H: Privacy & Transparency (5 questions)
// I: Plaid & Bank Data (5 questions)
// J: Bookkeeping & Accounting Module (7 questions)
// K: Tax Module Workflow (4 questions)
// L: Sales Tax on Temple Stuart's Own Subscriptions (4 questions)
// M: Insurance & Risk Transfer (4 questions)
// N: SOC 2 & Security Attestations (3 questions)
// O: Terms of Service & User-Facing Legal (6 questions)
// P: Operational Runbook (6 questions)
// Q: Growth / At-Scale Triggers (5 questions)
// R: Go/No-Go Gates (2 questions)
