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

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM G — Data Security: GLBA/FTC Safeguards
// ═══════════════════════════════════════════════════════════════════

export const workstreamG: OpsWorkstream = {
  id: 'bk-g',
  letter: 'G',
  title: 'Data Security: GLBA/FTC Safeguards',
  description: 'Core information security program requirements under the FTC Safeguards Rule and IRS WISP mandate.',
  questions: [
    {
      id: 'bk-g-01',
      text: 'Who is the designated Qualified Individual, and is their authority documented in a board/founder resolution?',
      type: 'text',
      regulatoryTag: 'GLBA_Safeguards',
      launchStage: 'required_now',
      helpText: 'FTC Safeguards §314.4 requires designating a Qualified Individual to run the information security program. For solo founders, you designate yourself but must document it formally.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-02',
      text: 'Have you completed a written risk assessment covering data inventory, threat modeling, and encryption scope (both at rest and in transit)?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      helpText: 'Core Safeguards element even under the small-firm exemption (<5,000 records). Must identify reasonably foreseeable internal and external risks.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-03',
      text: 'Is MFA enforced for all users with access to customer information, including you as founder and every contractor?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      helpText: 'MFA is a core Safeguards requirement that applies regardless of firm size. Covers admin panels, database access, cloud consoles, and any system touching customer data.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-04',
      text: 'Is all customer information encrypted at rest and in transit?',
      type: 'checklist',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      options: ['Azure PostgreSQL TDE enabled', 'Column-level encryption for SSN/bank data', 'TLS 1.2+ on all endpoints', 'Vercel HTTPS enforced', 'Plaid connection encrypted'],
      helpText: 'Encryption at rest and in transit is a core Safeguards requirement. Azure TDE covers database-level; column-level needed for SSN and financial account numbers.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-05',
      text: 'Do you have a documented Incident Response Plan that triggers FTC notification within 30 days for 500+ record unencrypted exposure?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      helpText: '16 CFR §314.5 requires FTC notification within 30 days for breaches affecting 500+ consumers. Must also notify IRS Stakeholder Liaison for tax data compromises.',
      sourceSection: '§4.2 Incident Response',
    },
    {
      id: 'bk-g-06',
      text: 'Is secure disposal configured for Azure PostgreSQL backups, Vercel logs, Prisma query logs, and any caches that touch customer data?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      helpText: 'Secure disposal means data cannot be reconstructed after deletion. Covers database backups, application logs, CDN caches, and any temporary storage.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-07',
      text: 'Do you have contractual data-protection terms (DPAs with audit, breach-notice, sub-processor, deletion clauses) with Plaid, Azure, Vercel, analytics vendors, email vendor, support vendor?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      helpText: 'Service-provider oversight is a core Safeguards element. Each vendor touching customer data needs a DPA with breach-notification, audit rights, sub-processor controls, and deletion on termination.',
      sourceSection: '§4.3 Vendor Management',
    },
    {
      id: 'bk-g-08',
      text: 'Is annual security awareness training built into your HR workflow (even for a solo founder, documented self-training satisfies the program)?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_now',
      helpText: 'Training is required for all personnel with customer-information responsibilities. Solo founders document self-training with date, topics covered, and completion record.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-09',
      text: 'Is continuous monitoring implemented (SIEM or cloud-native equivalent) and, once over 5,000 consumer records, is annual penetration testing + biannual vulnerability scanning scheduled and budgeted?',
      type: 'boolean',
      regulatoryTag: 'Safeguards',
      launchStage: 'required_at_scale',
      helpText: 'Full monitoring/testing cadence required once you exceed 5,000 consumer records. Below that threshold, the requirement is relaxed but core safeguards still apply.',
      sourceSection: '§4.1 GLBA Safeguards Rule',
    },
    {
      id: 'bk-g-10',
      text: "Have you produced a Written Information Security Plan based on IRS Pub 5708/5709 template that is tailored (not generic) to Temple Stuart's actual systems?",
      type: 'boolean',
      regulatoryTag: 'WISP',
      launchStage: 'required_now',
      helpText: 'Every PTIN holder and tax preparer is federally required to have a WISP. IRS publishes templates in Pub 5708 (sample plan) and Pub 5709 (how-to guide). Must be specific to your actual infrastructure.',
      sourceSection: '§4.4 WISP',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM H — Privacy & Transparency
// ═══════════════════════════════════════════════════════════════════

export const workstreamH: OpsWorkstream = {
  id: 'bk-h',
  letter: 'H',
  title: 'Privacy & Transparency',
  description: 'GLBA privacy notices, CCPA/CPRA compliance, NY SHIELD Act, breach notification, and cookie/tracking consent.',
  questions: [
    {
      id: 'bk-h-01',
      text: 'Does your privacy notice meet 16 CFR Part 313 (initial and annual notice, opt-out language for sharing with nonaffiliated third parties)?',
      type: 'boolean',
      regulatoryTag: 'GLBA_Privacy',
      launchStage: 'required_now',
      helpText: 'GLBA Privacy Rule requires initial privacy notice at account opening and annual notice thereafter. Must describe information-sharing practices and opt-out rights.',
      sourceSection: '§5.1 GLBA Privacy Rule',
    },
    {
      id: 'bk-h-02',
      text: 'Does the privacy page include all CCPA/CPRA required elements?',
      type: 'checklist',
      regulatoryTag: 'CCPA',
      launchStage: 'required_now',
      options: ['Categories of PI collected', 'Sources of PI', 'Business purpose for collection', 'Retention periods', 'SPI opt-out (Limit the Use)', 'Non-discrimination clause', 'Access/delete/correct/opt-out mechanisms', 'Do Not Sell or Share link'],
      helpText: 'CCPA applies if any California user. Financial data under GLBA is partially exempt but non-GLBA data (browsing, marketing) is fully subject. Statutory damages $100-$750 per consumer per breach incident.',
      sourceSection: '§5.2 CCPA/CPRA',
    },
    {
      id: 'bk-h-03',
      text: "Are SHIELD Act's specific reasonable-safeguard measures documented (designate program coordinator, identify risks, train, select capable vendors, adjust to change, protect during disposal)?",
      type: 'boolean',
      regulatoryTag: 'NY_SHIELD',
      launchStage: 'required_now',
      helpText: 'NY SHIELD Act applies to any business worldwide holding PI of a NY resident. GLBA-compliant firms are deemed compliant. Violations: $5,000/violation for safeguard failure.',
      sourceSection: '§5.3 NY SHIELD Act',
    },
    {
      id: 'bk-h-04',
      text: 'Do you have a state-by-state breach-notification runbook with deadlines, AG-contact templates, and credit-monitoring vendor relationships?',
      type: 'boolean',
      regulatoryTag: 'Breach_Notification',
      launchStage: 'required_now',
      helpText: 'All 50 states + DC have breach notification laws with varying deadlines (30-60 days or without unreasonable delay), AG notification thresholds, and consumer notification requirements.',
      sourceSection: '§5.4 Breach Notification',
    },
    {
      id: 'bk-h-05',
      text: 'If you use third-party analytics or ad-tech cookies on the marketing site, are CCPA/CPRA-compliant consent and Global Privacy Control signal handling implemented?',
      type: 'boolean',
      regulatoryTag: 'Cookie_Tracking',
      launchStage: 'required_now',
      helpText: 'GPC signal must be honored as a valid opt-out under CCPA/CPRA. Third-party analytics cookies require consent mechanisms.',
      sourceSection: '§5.5 Cookie/Tracking Consent',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM I — Plaid & Bank Data
// ═══════════════════════════════════════════════════════════════════

export const workstreamI: OpsWorkstream = {
  id: 'bk-i',
  letter: 'I',
  title: 'Plaid & Bank Data',
  description: 'Plaid production approval, consent flows, data deletion, credential handling, and CFPB §1033 readiness.',
  questions: [
    {
      id: 'bk-i-01',
      text: "Have you submitted your use case for Plaid's Permitted Use Case review and received production approval in writing?",
      type: 'boolean',
      regulatoryTag: 'Plaid',
      launchStage: 'required_now',
      helpText: 'Plaid requires written approval of your specific use case before production access. Development/sandbox access does not equal production approval.',
      sourceSection: '§6.1 Plaid Developer Policy',
    },
    {
      id: 'bk-i-02',
      text: "Does your UX present Express Consents that specifically list data categories, use cases, third-party recipients, and revocation mechanism, per Plaid's End Client terms?",
      type: 'boolean',
      regulatoryTag: 'Plaid',
      launchStage: 'required_now',
      helpText: 'Plaid Developer Policy requires Express Consents from each end user describing categories of FI Data, specific uses, how to revoke, and any third parties.',
      sourceSection: '§6.1 Plaid Developer Policy',
    },
    {
      id: 'bk-i-03',
      text: 'Is there a verified code path that deletes all FI Data on user request or on Plaid account deactivation, with only legally required retention exceptions?',
      type: 'boolean',
      regulatoryTag: 'Plaid',
      launchStage: 'required_now',
      helpText: 'Plaid requires deletion of FI Data that exceeds consent scope or on user request. Only legal-retention exceptions (e.g., §6107 tax records) justify keeping data after user requests deletion.',
      sourceSection: '§6.1 Plaid Developer Policy',
    },
    {
      id: 'bk-i-04',
      text: 'Are bank credentials and any EFTA-protected authentication data never persisted at any layer (code review, infra review, log review)?',
      type: 'boolean',
      regulatoryTag: 'Plaid',
      launchStage: 'required_now',
      helpText: 'Plaid prohibits storing end-user bank credentials or EFTA-protected authentication data. Must verify at code level, infrastructure level, and log level.',
      sourceSection: '§6.2 EFTA Compliance',
    },
    {
      id: 'bk-i-05',
      text: 'Does your authorization UI and data-use disclosures meet the evolving §1033 requirements for authorized third parties (reasonably-necessary-only, disclosure on screen, revocation path)?',
      type: 'boolean',
      regulatoryTag: 'CFPB_1033',
      launchStage: 'required_at_scale',
      helpText: 'CFPB §1033 rule is currently stayed but will require authorized third parties to limit collection to what is reasonably necessary. Monitor the final rule and build compliant disclosures proactively.',
      sourceSection: '§6.3 CFPB §1033',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM J — Bookkeeping & Accounting Module
// ═══════════════════════════════════════════════════════════════════

export const workstreamJ: OpsWorkstream = {
  id: 'bk-j',
  letter: 'J',
  title: 'Bookkeeping & Accounting Module',
  description: 'GAAP presentation, audit trail integrity, multi-entity isolation, auto-categorization, and investment lot tracking.',
  questions: [
    {
      id: 'bk-j-01',
      text: "Are the P&L, balance sheet, and cash flow outputs clearly labeled 'management-prepared, unaudited' and avoid CPA-reserved terms (audit, review, compilation, attest, certified)?",
      type: 'boolean',
      regulatoryTag: 'GAAP',
      launchStage: 'required_now',
      helpText: 'State accountancy acts reserve the words audit, review, compilation, attest, and certified to licensees. Platform UI must avoid these unless a licensed CPA is involved.',
      sourceSection: '§7.2 Financial Statements',
    },
    {
      id: 'bk-j-02',
      text: 'Does the chart of accounts follow ASC Topic 205/210/220/230 structure by default, with user-override allowed?',
      type: 'boolean',
      regulatoryTag: 'GAAP',
      launchStage: 'required_now',
      helpText: 'ASC 205 (presentation), 210 (balance sheet), 220 (comprehensive income), 230 (cash flows). Default GAAP structure with user customization preserves compliance while allowing flexibility.',
      sourceSection: '§7.2 Financial Statements',
    },
    {
      id: 'bk-j-03',
      text: 'Is the ledger implemented with append-only entries, hash-chained or WORM-backed, with voids posted as reversing entries rather than hard deletes?',
      type: 'boolean',
      regulatoryTag: 'Audit_Trail',
      launchStage: 'required_now',
      helpText: 'No federal statute mandates immutable logs for generic bookkeeping software, but SOC 2 requires tamper-evident logs, §6001 requires reconstructible records, and SOX applies if public-company users exist.',
      sourceSection: '§7.3 Audit Trail',
    },
    {
      id: 'bk-j-04',
      text: 'Can each entity\'s ledger produce its own P&L/BS/CF without cross-entity leakage, and are transfers booked as intercompany due-to/due-from?',
      type: 'boolean',
      regulatoryTag: 'Multi_Entity',
      launchStage: 'required_now',
      helpText: 'IRC §6001 requires separate books per entity. Co-mingling is a classic audit trigger and supports piercing-the-corporate-veil arguments. Transactions must post to exactly one entity.',
      sourceSection: '§7.1 IRS Separate-Books Requirement',
    },
    {
      id: 'bk-j-05',
      text: 'Does the UI disclose that auto-categorization is probabilistic, require user review before filing, and never auto-push categorizations into a tax filing without explicit confirmation?',
      type: 'boolean',
      regulatoryTag: 'Auto_Categorization',
      launchStage: 'required_now',
      helpText: 'No specific U.S. regulation on auto-categorization accuracy, but FTC UDAP prohibits deceptive performance claims. If categorization drives tax line items, §6662 accuracy penalties apply to the taxpayer.',
      sourceSection: '§7.4 Auto-Categorization',
    },
    {
      id: 'bk-j-06',
      text: 'Which lot-selection method(s) do you support (FIFO, specific ID, average), and can the user change method at year-end as elected on Form 8949?',
      type: 'select',
      regulatoryTag: 'Stocks_Crypto',
      launchStage: 'required_now',
      options: ['FIFO only', 'FIFO + Specific ID', 'FIFO + Specific ID + Average', 'All methods'],
      helpText: 'Form 1099-B and 8949 require lot-level basis tracking. Method must match what is elected on the return. Average cost only available for mutual funds and certain dividend reinvestment plans.',
      sourceSection: '§7.5 Investment Tracking',
    },
    {
      id: 'bk-j-07',
      text: 'Does the platform reconcile 1099-B/1099-DA broker data against user lots and surface wash-sale adjustments under §1091?',
      type: 'boolean',
      regulatoryTag: 'Stocks_Crypto',
      launchStage: 'required_now',
      helpText: 'Wash-sale rule (§1091) applies to securities but not currently to crypto. Starting 2025/2026, digital-asset brokers must issue Form 1099-DA. Platform should reconcile broker-reported data against internal lot tracking.',
      sourceSection: '§7.5 Investment Tracking',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM K — Tax Module Workflow
// ═══════════════════════════════════════════════════════════════════

export const workstreamK: OpsWorkstream = {
  id: 'bk-k',
  letter: 'K',
  title: 'Tax Module Workflow',
  description: 'Form versioning, e-file signature authorization, pre-file accuracy review, and state return coverage.',
  questions: [
    {
      id: 'bk-k-01',
      text: 'For each supported form (W-2, 1099-R, 1098-T, 1098-E, Schedule 1-A, AOTC, LLC, Student Loan Interest, SE Tax), is the form revision current to the filing year and mapped to correct MeF schema versions?',
      type: 'boolean',
      regulatoryTag: 'Forms',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-b-06'],
      helpText: 'IRS revises forms annually. Each form must map to the correct MeF XML schema version for that tax year. Using prior-year schemas causes rejection.',
      sourceSection: '§7.6 Tax Forms',
    },
    {
      id: 'bk-k-02',
      text: 'If e-filing, how will you collect Form 8879 IRS e-file Signature Authorization and retain it per Pub 1345?',
      type: 'text',
      regulatoryTag: 'Signatures',
      launchStage: 'required_before_charging',
      dependsOn: ['bk-b-01'],
      helpText: 'Form 8879 is the taxpayer\'s e-file signature authorization. Must be collected before transmission and retained per Publication 1345 requirements. Electronic signature acceptable under IRS guidance.',
      sourceSection: '§7.7 Signature Authorization',
    },
    {
      id: 'bk-k-03',
      text: "Is there a pre-file review screen with §6662 accuracy messaging and a 'user signs the return' confirmation?",
      type: 'boolean',
      regulatoryTag: 'Accuracy',
      launchStage: 'required_before_charging',
      helpText: '§6662 accuracy-related penalties apply to understatements. Pre-file review screen with clear messaging protects both user and platform. User must affirmatively confirm before submission.',
      sourceSection: '§7.8 Pre-File Review',
    },
    {
      id: 'bk-k-04',
      text: 'Which state returns will the module produce at launch, and have you entered state-by-state electronic-filing mandates and vendor-approval testing (e.g., Massachusetts LOI)?',
      type: 'text',
      regulatoryTag: 'State_Tax',
      launchStage: 'required_before_charging',
      helpText: 'Each state has its own e-filing mandates and vendor-approval testing requirements. Massachusetts requires IRS MeF acceptance plus a state Letter of Intent and annual vendor approval testing.',
      sourceSection: '§7.9 State Returns',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM L — Sales Tax on Temple Stuart's Own Subscriptions
// ═══════════════════════════════════════════════════════════════════

export const workstreamL: OpsWorkstream = {
  id: 'bk-l',
  letter: 'L',
  title: "Sales Tax on Temple Stuart's Own Subscriptions",
  description: 'SaaS taxability rules, economic nexus thresholds, registration obligations, and invoice structuring.',
  questions: [
    {
      id: 'bk-l-01',
      text: "Have you configured a sales-tax engine (TaxJar/Anrok/Stripe Tax/Sphere) and mapped each state's SaaS-taxability rule (taxable in ~24 states, including Texas-80%, Chicago-PPLTT 9%)?",
      type: 'boolean',
      regulatoryTag: 'State_Sales_Tax',
      launchStage: 'required_before_charging',
      helpText: 'SaaS is taxable in ~24-25 states with varying rules. Texas taxes 80% under data-processing rule. Chicago imposes 9% PPLTT. California, Florida, Georgia, Illinois are non-taxable.',
      sourceSection: '§8.3 SaaS Sales Tax',
    },
    {
      id: 'bk-l-02',
      text: 'Do you have a monitoring trigger that alerts when approaching the $100k (or $500k in CA/NY/TX) economic-nexus threshold for each state?',
      type: 'boolean',
      regulatoryTag: 'State_Sales_Tax',
      launchStage: 'required_at_scale',
      helpText: 'Post-Wayfair, most states use $100k/200 transactions threshold. CA, NY, TX use $500k. Even in non-taxable states, revenue counts toward threshold requiring registration and $0 returns.',
      sourceSection: '§8.3 SaaS Sales Tax',
    },
    {
      id: 'bk-l-03',
      text: 'Will you register and collect even in SaaS-non-taxable states once threshold is crossed, to file $0 returns?',
      type: 'boolean',
      regulatoryTag: 'State_Sales_Tax',
      launchStage: 'required_at_scale',
      helpText: 'Even where SaaS is non-taxable, crossing the economic-nexus threshold requires state registration and filing $0 returns. Failure to register is a compliance risk even with no tax due.',
      sourceSection: '§8.3 SaaS Sales Tax',
    },
    {
      id: 'bk-l-04',
      text: 'Is your invoicing system configured to itemize SaaS subscription separately from bundled services (implementation, training, support) to preserve non-taxability where state rules allow?',
      type: 'boolean',
      regulatoryTag: 'State_Sales_Tax',
      launchStage: 'required_before_charging',
      helpText: 'Bundling taxable and non-taxable items can make the entire invoice taxable in some states. Itemizing SaaS subscription separately preserves non-taxability where allowed.',
      sourceSection: '§8.3 SaaS Sales Tax',
    },
  ],
};

// --- Workstreams M through R will be added in subsequent prompts ---
// M: Insurance & Risk Transfer (4 questions)
// N: SOC 2 & Security Attestations (3 questions)
// O: Terms of Service & User-Facing Legal (6 questions)
// P: Operational Runbook (6 questions)
// Q: Growth / At-Scale Triggers (5 questions)
// R: Go/No-Go Gates (2 questions)
