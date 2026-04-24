// src/lib/ops/tradingQuestions.ts
// Trading Analytics Operations Planner Question Registry
// Pattern follows bookkeepingQuestions.ts — single source of truth

import type { QuestionType, LaunchStage, OpsModule } from './bookkeepingQuestions';
export type { LaunchStage } from './bookkeepingQuestions';

export interface TradingQuestion {
  id: string;
  text: string;
  type: QuestionType;
  regulatoryTag: string;
  launchStage: LaunchStage;
  options?: string[];
  dependsOn?: string[];
  helpText?: string;
  sourceSection?: string;
}

export interface TradingWorkstream {
  id: string;
  letter: string;
  title: string;
  description: string;
  questions: TradingQuestion[];
}

export interface TradingModule {
  id: string;
  title: string;
  description: string;
  workstreams: TradingWorkstream[];
  totalQuestions: number;
}

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM A — Core Legal Identity
// ═══════════════════════════════════════════════════════════════════

export const workstreamA: TradingWorkstream = {
  id: 'tr-a',
  letter: 'A',
  title: 'Core Legal Identity',
  description: 'Investment Adviser Act classification, publisher exclusion analysis, and anti-fraud baseline.',
  questions: [
    {
      id: 'tr-a-01',
      text: "Am I structuring Temple Stuart as (a) a 'publisher' relying on §202(a)(11)(D) / Lowe v. SEC, (b) a state-registered investment adviser, or (c) an SEC-registered adviser via the Internet Adviser Exemption?",
      type: 'select',
      regulatoryTag: 'Investment_Adviser_Act',
      launchStage: 'required_now',
      options: ['Publisher (Lowe exclusion)', 'State-registered RIA', 'SEC-registered RIA (Internet Adviser Exemption)'],
      helpText: 'At $99/month for specific option-leg recommendations with composite scores, all three elements of the IA definition are facially satisfied. The publisher exclusion is the only path that avoids registration.',
      sourceSection: '§1.1 Investment Adviser Act',
    },
    {
      id: 'tr-a-02',
      text: "If choosing publisher path, what affirmative design constraints will I enforce: no individualized advice, no authority over funds, no trading on behalf of users, identical content for all subscribers at same tier, disinterested commentary, general and regular circulation?",
      type: 'text',
      regulatoryTag: 'Investment_Adviser_Act',
      launchStage: 'required_now',
      dependsOn: ['tr-a-01'],
      helpText: "Lowe v. SEC requires all three prongs — impersonal, bona fide/disinterested, general and regular circulation. Failing any one destroys the exclusion.",
      sourceSection: '§1.2 Publisher Exclusion',
    },
    {
      id: 'tr-a-03',
      text: "For each personalization feature, classify as 'impersonal content caught by user filter' (Seeking Alpha-OK) or 'advice attuned to specific portfolio' (Weiss-NOT-OK).",
      type: 'checklist',
      regulatoryTag: 'Investment_Adviser_Act',
      launchStage: 'required_now',
      options: [
        'User-customizable filter thresholds',
        'Saved watchlists',
        'Trade journal with actual positions',
        'Composite score on filtered results',
        'AI strategy analysis',
        'Broker-position linkage',
        'Letter grades',
        'Thesis points',
        'Specific option legs',
        'Social sentiment overlay',
        'Macro regime applied to user universe',
      ],
      helpText: "The Seeking Alpha court held user-created filters don't destroy impersonality. But trade journal tied to real positions is the highest-risk feature — creates an ongoing personalized monitoring relationship.",
      sourceSection: '§1.3 Feature Classification',
    },
    {
      id: 'tr-a-04',
      text: 'Will the trade journal (a) remain purely private user-only log, (b) display aggregated performance, or (c) be restructured to avoid personalized monitoring?',
      type: 'select',
      regulatoryTag: 'Investment_Adviser_Act',
      launchStage: 'required_now',
      options: ['Private user-only log (no server analytics)', 'Aggregated performance display', 'Remove broker-position linkage', 'Undecided'],
      helpText: 'Trade journal tied to actual positions is the single feature most likely to break the publisher exclusion. Creates an ongoing personalized monitoring relationship that looks like traditional advisory.',
      sourceSection: '§1.4 Trade Journal Risk',
    },
    {
      id: 'tr-a-05',
      text: 'Will I or any employee hold, trade, or have financial interest in tickers the scanner recommends, and how will I disclose?',
      type: 'boolean',
      regulatoryTag: 'Investment_Adviser_Act',
      launchStage: 'required_now',
      helpText: "Lowe requires 'disinterested' commentary. If you trade the same tickers you recommend, the SEC could argue you're not disinterested (SEC v. Park / Tokyo Joe precedent).",
      sourceSection: '§1.5 Disinterested Commentary',
    },
    {
      id: 'tr-a-06',
      text: 'Are scanner outputs published on a regular, predictable schedule (not episodic response to market events)?',
      type: 'boolean',
      regulatoryTag: 'Investment_Adviser_Act',
      launchStage: 'required_now',
      helpText: "Lowe requires 'general and regular circulation.' Episodic, event-driven publication could break this prong.",
      sourceSection: '§1.6 Regular Circulation',
    },
    {
      id: 'tr-a-07',
      text: 'Have I reviewed every claim on website and marketing (win rates, POP, EV, R/R ratios) to ensure each is substantiable on regulatory demand?',
      type: 'boolean',
      regulatoryTag: 'Anti_Fraud',
      launchStage: 'required_now',
      helpText: '§10(b)/Rule 10b-5 and §206(4) anti-fraud apply to everyone regardless of registration status. False or unsubstantiable claims create personal liability.',
      sourceSection: '§1.7 Anti-Fraud',
    },
    {
      id: 'tr-a-08',
      text: 'Have I obtained E&O and D&O insurance with specific coverage for financial-software liability and AI-related claims?',
      type: 'boolean',
      regulatoryTag: 'Entity_Liability',
      launchStage: 'required_now',
      helpText: 'Solo founder has personal liability for control-person fraud. No corporate shield for securities fraud. E&O with AI coverage is essential before first subscriber.',
      sourceSection: '§1.8 Insurance',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM B — Data Licensing
// ═══════════════════════════════════════════════════════════════════

export const workstreamB: TradingWorkstream = {
  id: 'tr-b',
  letter: 'B',
  title: 'Data Licensing',
  description: 'OPRA vendor agreements, TastyTrade API terms, Finnhub commercial licensing, and data redistribution rights.',
  questions: [
    {
      id: 'tr-b-01',
      text: 'Will I display real-time or 15-minute-delayed options prices at launch?',
      type: 'select',
      regulatoryTag: 'OPRA',
      launchStage: 'required_before_charging',
      options: ['Real-time (OPRA per-user fees apply)', '15-minute delayed (no per-user fees, $1,500/mo vendor fee only)', 'No options prices displayed (scoring only)', 'Undecided'],
      helpText: 'Delayed data is the standard cost-effective path. OptionStrat free tier, Market Chameleon, and OptionCharts all use 15-minute delayed. Saves all per-user OPRA fees.',
      sourceSection: '§2.1 OPRA Data',
    },
    {
      id: 'tr-b-02',
      text: 'If displaying any OPRA data externally to paid subscribers, have I executed an OPRA Vendor Agreement ($1,500/mo or $650/mo query-only)?',
      type: 'boolean',
      regulatoryTag: 'OPRA',
      launchStage: 'required_before_charging',
      dependsOn: ['tr-b-01'],
      helpText: 'OPRA Vendor fee is the biggest hard-dollar compliance cost. $1,500/month regardless of subscriber count. $650/month if query-only (no streaming, no auto-refresh).',
      sourceSection: '§2.1 OPRA Data',
    },
    {
      id: 'tr-b-03',
      text: 'Have I built a subscriber-classification workflow asking every user if they are SEC/FINRA registrant, investment adviser, or use data for business (Professional vs. Nonprofessional)?',
      type: 'boolean',
      regulatoryTag: 'OPRA',
      launchStage: 'required_before_charging',
      helpText: 'OptionStrat bars professionals from real-time tiers entirely. Nonprofessional per-user fees start at $1.25/month. Professional at $31.50/month. Burden is on you to classify.',
      sourceSection: '§2.2 OPRA Classification',
    },
    {
      id: 'tr-b-04',
      text: 'Have I obtained written confirmation from TastyTrade that my commercial product is authorized and data redistribution to subscribers is within their OPRA Vendor scope?',
      type: 'boolean',
      regulatoryTag: 'TastyTrade_API',
      launchStage: 'required_before_charging',
      helpText: 'TastyTrade API terms prohibit token sharing, allow immediate termination for regulatory/reputational risk, and require indemnification. No explicit commercial-product permission exists.',
      sourceSection: '§2.3 TastyTrade Terms',
    },
    {
      id: 'tr-b-05',
      text: 'If TastyTrade revokes API access tomorrow, what is my 30-day fallback plan?',
      type: 'text',
      regulatoryTag: 'TastyTrade_API',
      launchStage: 'required_now',
      helpText: 'Single-broker dependency is existential risk. Competitors use pure data vendors (Polygon, CBOE Data Services, dxFeed, ORATS, Barchart). Plan alternative before depending on TastyTrade for commercial product.',
      sourceSection: '§2.4 Vendor Dependency',
    },
    {
      id: 'tr-b-06',
      text: 'Have I upgraded to Finnhub commercial tier and obtained written redistribution license for each data category (analyst estimates, insider data, earnings, news sentiment, institutional ownership)?',
      type: 'boolean',
      regulatoryTag: 'Finnhub_License',
      launchStage: 'required_before_charging',
      helpText: 'Underlying data vendors (Morningstar, Zacks, S&P, Benzinga) impose their own restrictions. Need category-specific written authorization.',
      sourceSection: '§2.5 Finnhub License',
    },
    {
      id: 'tr-b-07',
      text: 'Have I audited every FRED series to confirm redistributability and implemented automated source attribution?',
      type: 'boolean',
      regulatoryTag: 'FRED_License',
      launchStage: 'required_now',
      helpText: 'FRED has three tiers: Public Domain, Copyrighted-Citation-Required, Third-Party-Restricted. VIX/Treasury/CLI are public domain. Some Moody series are restricted.',
      sourceSection: '§2.6 FRED License',
    },
    {
      id: 'tr-b-08',
      text: "Am I displaying 'Source: SEC EDGAR' citation on every Form 4 and 8-K display?",
      type: 'boolean',
      regulatoryTag: 'EDGAR_License',
      launchStage: 'required_now',
      helpText: 'SEC EDGAR data is public and freely redistributable with citation. Trivial to satisfy.',
      sourceSection: '§2.7 EDGAR License',
    },
    {
      id: 'tr-b-09',
      text: 'Have I confirmed xAI API terms and X developer-platform terms authorize commercial reuse of tweet-sentiment signals?',
      type: 'boolean',
      regulatoryTag: 'xAI_License',
      launchStage: 'required_before_charging',
      helpText: 'X developer terms have been restrictive since 2023-2024. Synthesizing sentiment scores is much safer than re-exposing raw tweets.',
      sourceSection: '§2.8 xAI/X Terms',
    },
    {
      id: 'tr-b-10',
      text: "Have I reviewed Anthropic's Commercial Terms and confirmed commercial use is authorized, noting copyright indemnity does NOT cover financial-advice claims?",
      type: 'boolean',
      regulatoryTag: 'Anthropic_License',
      launchStage: 'required_before_charging',
      helpText: 'Anthropic explicitly disclaims fitness for securities advice. You are the legal author of everything Claude produces for your users.',
      sourceSection: '§2.9 Anthropic Terms',
    },
    {
      id: 'tr-b-11',
      text: 'What is my caching/storage policy for TastyTrade, OPRA, and Finnhub data — do contracts permit storage beyond session?',
      type: 'text',
      regulatoryTag: 'Data_Caching',
      launchStage: 'required_before_charging',
      helpText: 'TastyTrade terms prohibit exploitation without written consent. Historical storage requires separate licensed products (ORATS, CBOE DataShop, dxFeed).',
      sourceSection: '§2.10 Data Caching',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM C — Disclaimers & Risk Disclosures
// ═══════════════════════════════════════════════════════════════════

export const workstreamC: TradingWorkstream = {
  id: 'tr-c',
  letter: 'C',
  title: 'Disclaimers & Risk Disclosures',
  description: 'Site-wide disclaimers, OCC ODD links, per-card disclosures, AI notices, backtest warnings, and ToS structure.',
  questions: [
    { id: 'tr-c-01', text: 'Do I have a persistent site-wide disclaimer: not an RIA, not a BD, educational/informational only, not a recommendation, past performance does not equal future results?', type: 'boolean', regulatoryTag: 'Disclaimers', launchStage: 'required_before_charging', helpText: 'Every competitor uses this exact structure. Model on OptionStrat, SpotGamma, Trade Ideas terms.', sourceSection: '§3.1 Site-Wide Disclaimer' },
    { id: 'tr-c-02', text: 'Do I link prominently to the current June 2024 OCC Options Disclosure Document on every options-related page?', type: 'boolean', regulatoryTag: 'Options_Disclosure', launchStage: 'required_before_charging', helpText: 'Not legally required for non-BDs but universal industry practice. OptionStrat, SpotGamma, SteadyOptions all link to it.', sourceSection: '§3.2 OCC ODD' },
    { id: 'tr-c-03', text: 'Does each trade card embed: hypothetical, not investment advice, options involve risk, multi-leg commissions not reflected, assignment risk?', type: 'boolean', regulatoryTag: 'Trade_Card_Disclosure', launchStage: 'required_before_charging', helpText: 'Trade cards with specific legs, strikes, expiries, and thesis points are the most recommendation-like feature. Per-card disclaimers are essential.', sourceSection: '§3.3 Trade Card Disclaimers' },
    { id: 'tr-c-04', text: "Does every AI-generated analysis display 'AI-Generated — may contain errors — not reviewed by licensed adviser'?", type: 'boolean', regulatoryTag: 'AI_Disclosure', launchStage: 'required_before_charging', helpText: 'SEC 2025 exam priorities explicitly target AI disclosures. AI-washing enforcement has been aggressive. Adjacent per-paragraph badges are best practice.', sourceSection: '§3.4 AI Disclosure' },
    { id: 'tr-c-05', text: 'If any backtest data is user-facing, does it include: hypothetical results, inherent limitations, commissions/slippage not reflected, hindsight bias, criteria/assumptions?', type: 'boolean', regulatoryTag: 'Backtest_Disclosure', launchStage: 'required_before_charging', helpText: 'SEC September 2023 enforcement sweep charged nine advisers $50k-$175k each for presenting backtested performance without proper disclosures.', sourceSection: '§3.5 Backtest Disclaimers' },
    { id: 'tr-c-06', text: 'Do I warn users about Pattern Day Trader / intraday-margin rules (transitioning June 4, 2026)?', type: 'boolean', regulatoryTag: 'PDT_Disclosure', launchStage: 'required_before_charging', helpText: 'New FINRA intraday-margin framework replacing PDT rule effective June 4, 2026 with 18-month phase-in.', sourceSection: '§3.6 PDT Warning' },
    { id: 'tr-c-07', text: 'Do I have margin/leverage risk language for every multi-leg and uncovered-short-option strategy?', type: 'boolean', regulatoryTag: 'Margin_Disclosure', launchStage: 'required_before_charging', helpText: 'Include that margin multiplies gains and losses, margin calls may force liquidation, specific margin requirements come from user broker.', sourceSection: '§3.7 Margin Disclosure' },
    { id: 'tr-c-08', text: 'Does ToS include binding arbitration, class-action waiver, limitation of liability, choice of law, indemnification, severability?', type: 'boolean', regulatoryTag: 'TOS', launchStage: 'required_before_charging', helpText: 'Model on OptionStrat, SpotGamma, Trade Ideas, Predicting Alpha terms.', sourceSection: '§3.8 ToS' },
    { id: 'tr-c-09', text: 'Have I avoided hedge-clause language that could mislead users into believing they waive nonwaivable securities-law claims?', type: 'boolean', regulatoryTag: 'Hedge_Clause', launchStage: 'required_before_charging', helpText: 'January 2025 SEC enforcement action against adviser for excessive liability disclaimers. Can backfire if you ever register.', sourceSection: '§3.9 Hedge Clauses' },
    { id: 'tr-c-10', text: 'Do I disclose per-strategy risks: early exercise, pin risk, dividend risk on short calls, tax complexity (wash-sale, §1256, straddle rules), bid-ask compound spread?', type: 'boolean', regulatoryTag: 'Multi_Leg_Disclosure', launchStage: 'required_before_charging', helpText: 'ODD covers most, but supplemental multi-leg-specific disclosures are industry best practice.', sourceSection: '§3.10 Multi-Leg Risks' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM D — AI-Specific Controls
// ═══════════════════════════════════════════════════════════════════

export const workstreamD: TradingWorkstream = {
  id: 'tr-d',
  letter: 'D',
  title: 'AI-Specific Controls',
  description: 'AI output logging, guardrails, AI-washing compliance, EU AI Act, and formal AI-use policy.',
  questions: [
    { id: 'tr-d-01', text: 'Do I log every AI-generated market brief and strategy analysis (timestamp, prompt, output, model version) for at least 5 years?', type: 'boolean', regulatoryTag: 'AI_Logging', launchStage: 'required_now', helpText: 'Books-and-records analog. Required for audit/defense. You are the legal author of all Claude output served to users.', sourceSection: '§4.1 AI Logging' },
    { id: 'tr-d-02', text: 'What deterministic guardrails exist for AI output?', type: 'checklist', regulatoryTag: 'AI_Guardrails', launchStage: 'required_now', options: ['Strikes/expiries validated against chain data', 'Win-rate numbers from scoring engine not LLM', 'No tickers outside filtered universe in output', 'No personalized pronouns (you should)', 'No buy/sell directives', 'Hypothetical nature noted', 'No SEC/FINRA endorsement claims'], helpText: 'Post-processing validation is essential. Claude can hallucinate numbers, tickers, and personalized language.', sourceSection: '§4.2 AI Guardrails' },
    { id: 'tr-d-03', text: 'Have I audited every marketing claim that touches AI to ensure substantiability on SEC demand?', type: 'boolean', regulatoryTag: 'AI_Washing', launchStage: 'required_now', helpText: 'SEC AI-washing enforcement doubled between 2023-2024. Claims like "AI finds trades" or "AI-powered recommendations" must be precisely accurate.', sourceSection: '§4.3 AI-Washing' },
    { id: 'tr-d-04', text: 'Do I have EU subscribers? If yes, have I implemented limited-risk AI transparency notice?', type: 'boolean', regulatoryTag: 'EU_AI_Act', launchStage: 'required_before_charging', helpText: 'EU AI Act requires users be clearly informed they are interacting with AI. Fines up to €35M or 7% of global annual turnover. Options analytics is limited-risk category.', sourceSection: '§4.4 EU AI Act' },
    { id: 'tr-d-05', text: 'Have I written a formal AI-use policy covering development, deployment, monitoring, and incident response?', type: 'boolean', regulatoryTag: 'AI_Policy', launchStage: 'required_before_charging', helpText: 'FINRA Regulatory Notice 06/2024 expects formal AI policies. SEC 2025 exam priorities signal this is an examination focus area.', sourceSection: '§4.5 AI Policy' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM E — State-Level Registration
// ═══════════════════════════════════════════════════════════════════

export const workstreamE: TradingWorkstream = {
  id: 'tr-e',
  letter: 'E',
  title: 'State-Level Registration',
  description: 'State investment adviser registration, blue-sky laws, and Internet Adviser Exemption compatibility.',
  questions: [
    { id: 'tr-e-01', text: 'What is my principal office and place of business?', type: 'text', regulatoryTag: 'State_Registration', launchStage: 'required_before_charging', dependsOn: ['tr-a-01'], helpText: 'Drives state-registration path if publisher exclusion fails. Below $100M AUM, register with principal-office state.', sourceSection: '§5.1 Principal Office' },
    { id: 'tr-e-02', text: 'If deemed an investment adviser, which state regulator has jurisdiction and what are Form ADV, surety-bond, net-worth, and Series 65 requirements?', type: 'text', regulatoryTag: 'State_Registration', launchStage: 'required_at_scale', dependsOn: ['tr-a-01'], helpText: 'Each state has different requirements. NY firms at $25M+ RAUM register with SEC, not state.', sourceSection: '§5.2 State Requirements' },
    { id: 'tr-e-03', text: 'Am I targeting Washington State residents?', type: 'boolean', regulatoryTag: 'State_Registration', launchStage: 'required_before_charging', helpText: 'Washington has stricter blue-sky prohibition on backtested/hypothetical model performance than federal rules.', sourceSection: '§5.3 Washington State' },
    { id: 'tr-e-04', text: 'If SEC registration needed under $100M RAUM, am I providing ALL advice exclusively through interactive website (Internet Adviser Exemption)?', type: 'boolean', regulatoryTag: 'State_Registration', launchStage: 'required_at_scale', dependsOn: ['tr-a-01'], helpText: 'Rule 203A-2(e) amended March 2025. Cannot have any non-internet clients. Cannot simultaneously claim publisher exclusion.', sourceSection: '§5.4 Internet Adviser Exemption' },
    { id: 'tr-e-05', text: "Have I confirmed I cannot simultaneously claim publisher's exclusion AND Internet Adviser Exemption — must pick one?", type: 'boolean', regulatoryTag: 'State_Registration', launchStage: 'required_now', dependsOn: ['tr-a-01'], helpText: 'These are mutually exclusive legal positions. Claiming both destroys credibility with regulators.', sourceSection: '§5.5 Mutual Exclusivity' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM F — Subscriber Operations
// ═══════════════════════════════════════════════════════════════════

export const workstreamF: TradingWorkstream = {
  id: 'tr-f',
  letter: 'F',
  title: 'Subscriber Operations',
  description: 'KYC/OFAC screening, OPRA classification, privacy compliance, sales tax, affiliates, and marketing.',
  questions: [
    { id: 'tr-f-01', text: 'Do I collect enough at sign-up for: OFAC screening, Professional vs. Nonprofessional OPRA classification, age verification (18+)?', type: 'checklist', regulatoryTag: 'KYC', launchStage: 'required_before_charging', options: ['OFAC geo-IP blocking implemented', 'Professional/Nonprofessional self-attestation form', 'Age verification (18+)', 'Sanctions-screening on every subscriber'], helpText: 'OPRA classification burden is on you as Vendor. OFAC violations carry strict liability.', sourceSection: '§6.1 KYC' },
    { id: 'tr-f-02', text: 'Have I implemented geo-IP block on sanctioned jurisdictions (Iran, North Korea, Cuba, Syria, Crimea/Donetsk/Luhansk) and sanctions screening?', type: 'boolean', regulatoryTag: 'OFAC', launchStage: 'required_now', helpText: 'Cannot knowingly provide service to OFAC-sanctioned jurisdictions. Strict liability.', sourceSection: '§6.2 OFAC' },
    { id: 'tr-f-03', text: 'Do I have CCPA/CPRA-compliant privacy policy, GDPR notices for EU users, DSAR process, and DPA templates for subprocessors?', type: 'boolean', regulatoryTag: 'Privacy', launchStage: 'required_before_charging', helpText: 'CCPA applies if $25M+ revenue, 100K+ CA data subjects, or 50%+ revenue from selling PI. GDPR applies if any EU users.', sourceSection: '§6.3 Privacy' },
    { id: 'tr-f-04', text: 'Have I registered for state sales tax where SaaS revenue crosses economic-nexus threshold?', type: 'boolean', regulatoryTag: 'Sales_Tax', launchStage: 'required_before_charging', helpText: 'Same Wayfair thresholds as bookkeeping module. SaaS taxable in ~24 states. Use shared sales-tax engine.', sourceSection: '§6.4 Sales Tax' },
    { id: 'tr-f-05', text: 'If running referral program, do I comply with FTC endorsement disclosure and file 1099-NECs?', type: 'boolean', regulatoryTag: 'Affiliate_Program', launchStage: 'required_before_charging', helpText: 'FTC requires paid-testimonial disclosure. 1099-NEC required for commission payments.', sourceSection: '§6.5 Affiliates' },
    { id: 'tr-f-06', text: 'Do ad campaigns, landing pages, and email drips comply with CAN-SPAM and TCPA?', type: 'boolean', regulatoryTag: 'Marketing_Compliance', launchStage: 'required_before_charging', helpText: 'CAN-SPAM requires unsubscribe mechanism, physical address, non-deceptive subject lines. TCPA requires prior express written consent for SMS.', sourceSection: '§6.6 Marketing' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM G — Books & Records / Defensive Preservation
// ═══════════════════════════════════════════════════════════════════

export const workstreamG: TradingWorkstream = {
  id: 'tr-g', letter: 'G', title: 'Books & Records / Defensive Preservation',
  description: 'Content retention, user activity logging, and books-and-records readiness.',
  questions: [
    { id: 'tr-g-01', text: 'Do I retain for at least 5 years every piece of user-facing content: scanner outputs, trade cards, AI market briefs, AI strategy analyses, with version timestamps and source-data snapshots?', type: 'boolean', regulatoryTag: 'Books_Records', launchStage: 'required_now', helpText: 'Books-and-records retention is essential whether you claim publisher status or register. 5 years minimum, 7 ideal. Must be indexed for instant retrieval on regulator demand.', sourceSection: '§7.1 Content Retention' },
    { id: 'tr-g-02', text: 'Do I retain every user filter selection, subscription event log, and support communication?', type: 'boolean', regulatoryTag: 'Books_Records', launchStage: 'required_now', helpText: "If a regulator asks 'what did subscriber X see on date Y,' you must be able to answer. Filter selections determine output personalization level — critical for publisher's exclusion defense.", sourceSection: '§7.2 User Activity Logging' },
    { id: 'tr-g-03', text: 'If I register as an adviser, am I prepared for SEC Rule 204-2 books-and-records requirements plus Reg S-P deadlines (June 3, 2026 for smaller firms)?', type: 'boolean', regulatoryTag: 'Books_Records', launchStage: 'required_at_scale', helpText: 'Rule 204-2 requires retention of policies, procedures, Form ADV updates, communication archives, and marketing materials. Reg S-P adds privacy safeguard deadlines.', sourceSection: '§7.3 Adviser Records' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM H — Competitive / Structural
// ═══════════════════════════════════════════════════════════════════

export const workstreamH: TradingWorkstream = {
  id: 'tr-h', letter: 'H', title: 'Competitive / Structural',
  description: 'Competitive regulatory positioning, moat building, and acquisition readiness.',
  questions: [
    { id: 'tr-h-01', text: 'Which competitor regulatory model best fits Temple Stuart: OptionStrat (bars professionals from real-time), Trade Ideas (self-identifies as publisher), Unusual Whales (separate registered entity for ETFs), or SpotGamma (research-only disclaimer)?', type: 'text', regulatoryTag: 'Competitive', launchStage: 'required_before_charging', helpText: 'Each has made specific structural choices to stay on the right side of regulation. Your feature set is closest to Trade Ideas + SpotGamma hybrid.', sourceSection: '§8.1 Competitive Models' },
    { id: 'tr-h-02', text: 'Am I treating OPRA Vendor Agreement, exchange relationships, and broker-agnostic data-vendor contracts as a real moat worth building?', type: 'boolean', regulatoryTag: 'Regulatory_Moat', launchStage: 'required_at_scale', helpText: 'The $1,500/month OPRA fee, professional/nonprofessional classification burden, and exchange data agreements create a real barrier to entry.', sourceSection: '§8.2 Regulatory Moat' },
    { id: 'tr-h-03', text: 'If acquired by a broker-dealer or RIA, every piece of content becomes their Rule 2210 / Marketing Rule liability — have I structured content for clean acquisition due diligence?', type: 'boolean', regulatoryTag: 'Acquisition_Path', launchStage: 'required_at_scale', helpText: 'Acquirers will audit every trade card, AI output, and marketing claim against their compliance framework. Structure content today so it does not blow up a deal.', sourceSection: '§8.3 Acquisition Readiness' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM I — Codebase: API Routes
// ═══════════════════════════════════════════════════════════════════

export const workstreamI: TradingWorkstream = {
  id: 'tr-i', letter: 'I', title: 'Codebase: API Routes',
  description: 'Rate limiting, request logging, and route classification for the 22 trading API endpoints.',
  questions: [
    { id: 'tr-i-01', text: 'Are all 22 trading routes rate-limited per-user so a subscriber cannot scrape and redistribute OPRA/Finnhub data downstream (which would breach Vendor agreements)?', type: 'boolean', regulatoryTag: 'Codebase_Auth', launchStage: 'required_now', helpText: 'A single subscriber scraping your API and redistributing data makes YOU liable for their redistribution under your OPRA Vendor agreement. Per-user rate limiting is essential.', sourceSection: '§9.1 Rate Limiting' },
    { id: 'tr-i-02', text: 'Do authenticated routes log user ID, timestamp, IP, and query parameters for every scanner run, trade-card view, and AI-synthesis call?', type: 'boolean', regulatoryTag: 'Codebase_Logging', launchStage: 'required_now', helpText: 'Sufficient to defend an SEC or FINRA inquiry about who saw what when. Minimum 5-year retention.', sourceSection: '§9.2 Request Logging' },
    { id: 'tr-i-03', text: 'Have I classified each of the 22 routes by type and applied appropriate retention/PII policies?', type: 'checklist', regulatoryTag: 'Codebase_Classification', launchStage: 'required_now', options: ['Read-only scanner output routes classified', 'AI generation routes classified', 'User-private trade journal routes classified', 'Admin/operational routes classified', 'PII-handling policy applied per classification'], helpText: 'Different route types have different data sensitivity and retention requirements.', sourceSection: '§9.3 Route Classification' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM J — Codebase: External Data Feeds
// ═══════════════════════════════════════════════════════════════════

export const workstreamJ: TradingWorkstream = {
  id: 'tr-j', letter: 'J', title: 'Codebase: External Data Feeds',
  description: 'Audit each of the 5 external data integrations for licensing, caching, attribution, and commercial compliance.',
  questions: [
    { id: 'tr-j-01', text: 'Is TastyTrade integration per-user (each subscriber authenticates own token) or single-master-token (you authenticate once and broadcast)?', type: 'select', regulatoryTag: 'Codebase_TastyTrade', launchStage: 'required_now', options: ['Per-user authentication', 'Single master token', 'Hybrid (master for scanner / per-user for positions)', 'Unknown — need to audit'], helpText: "Single-master-token violates TastyTrade's no-token-sharing terms. Per-user is compliant but more complex.", sourceSection: '§10.1 TastyTrade Integration' },
    { id: 'tr-j-02', text: 'Am I caching Finnhub responses longer than my commercial-tier license permits, or serving Finnhub data to unauthenticated users?', type: 'boolean', regulatoryTag: 'Codebase_Finnhub', launchStage: 'required_now', helpText: 'Common license violations. Verify cache TTL against contract terms. Ensure all Finnhub-sourced data is behind authentication.', sourceSection: '§10.2 Finnhub Caching' },
    { id: 'tr-j-03', text: "Does my UI display 'Source: [Original Source] via FRED' on every graph or data display using FRED data?", type: 'boolean', regulatoryTag: 'Codebase_FRED', launchStage: 'required_now', helpText: "FRED terms require source attribution. Must show the original data source (e.g., BLS, Treasury) not just 'FRED.'", sourceSection: '§10.3 FRED Attribution' },
    { id: 'tr-j-04', text: "Does my UI cite 'Source: SEC EDGAR' on every Form 4 and 8-K display?", type: 'boolean', regulatoryTag: 'Codebase_EDGAR', launchStage: 'required_now', helpText: 'Trivial to satisfy. SEC requires citation when redistributing EDGAR data.', sourceSection: '§10.4 EDGAR Citation' },
    { id: 'tr-j-05', text: "Am I re-exposing raw tweets/X content verbatim (likely violating X's developer terms), or synthesizing sentiment scores (safer)?", type: 'select', regulatoryTag: 'Codebase_Grok', launchStage: 'required_now', options: ['Raw tweets displayed', 'Synthesized sentiment scores only', 'Both raw and synthesized', 'Not applicable — Grok not user-facing'], helpText: 'X developer terms since 2023-2024 restrict verbatim tweet redistribution. Synthesized sentiment scores are much safer commercially.', sourceSection: '§10.5 Grok/X Terms' },
    { id: 'tr-j-06', text: "Is Claude's output stored per-session only, or persisted in a database with books-and-records logging?", type: 'select', regulatoryTag: 'Codebase_Claude', launchStage: 'required_now', options: ['Per-session only (lost on refresh)', 'Persisted with full logging (timestamp / prompt / output / model)', 'Persisted without logging', 'Unknown — need to audit'], helpText: 'If persisted, must be indexed for instant retrieval. You are the legal author of all output. 5-year minimum retention.', sourceSection: '§10.6 Claude Persistence' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM K — Codebase: AI Synthesis
// ═══════════════════════════════════════════════════════════════════

export const workstreamK: TradingWorkstream = {
  id: 'tr-k', letter: 'K', title: 'Codebase: AI Synthesis',
  description: 'System prompt compliance, output validation, and graceful degradation for Claude-generated content.',
  questions: [
    { id: 'tr-k-01', text: "Does the system prompt explicitly instruct Claude to: not personalize to user's portfolio, not make buy/sell directives, note hypothetical nature of probabilities, not claim SEC/FINRA endorsement?", type: 'boolean', regulatoryTag: 'Codebase_AI_Prompt', launchStage: 'required_now', helpText: 'The system prompt is your first line of compliance defense. It must affirmatively constrain Claude from generating content that crosses the advice line.', sourceSection: '§11.1 System Prompt' },
    { id: 'tr-k-02', text: "Do I post-process Claude output to strip or flag: hallucinated numbers, unauthorized tickers, personalized pronouns ('you should'), unsupported superlatives?", type: 'boolean', regulatoryTag: 'Codebase_AI_Validation', launchStage: 'required_now', helpText: 'Claude can hallucinate strikes, expiries, tickers, and win rates. Post-processing validation against the actual data layer is non-negotiable.', sourceSection: '§11.2 Output Validation' },
    { id: 'tr-k-03', text: "If Claude's API is down, does the platform degrade gracefully ('AI analysis temporarily unavailable') rather than surface stale cached text?", type: 'boolean', regulatoryTag: 'Codebase_AI_Fallback', launchStage: 'required_now', helpText: 'Stale AI analysis could contain outdated prices, expired options, or obsolete market conditions. Must show unavailability rather than misleading content.', sourceSection: '§11.3 Graceful Degradation' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM L — Codebase: Composite Scoring
// ═══════════════════════════════════════════════════════════════════

export const workstreamL: TradingWorkstream = {
  id: 'tr-l', letter: 'L', title: 'Codebase: Composite Scoring',
  description: 'Scoring determinism, grade-boundary versioning, and methodology disclosure.',
  questions: [
    { id: 'tr-l-01', text: 'Is the 0-100 composite score deterministic and reproducible from the same inputs?', type: 'boolean', regulatoryTag: 'Codebase_Scoring', launchStage: 'required_now', helpText: "If a regulator asks how you arrived at an 'A' grade for a specific trade, you must reproduce the exact calculation. Non-deterministic scoring is indefensible.", sourceSection: '§12.1 Scoring Determinism' },
    { id: 'tr-l-02', text: 'Is the letter-grade mapping documented, version-controlled, and unchanged within a subscription period?', type: 'boolean', regulatoryTag: 'Codebase_Scoring_Version', launchStage: 'required_now', helpText: 'Silently changing grade boundaries mid-period could be construed as manipulative. Document and version-control all scoring parameters.', sourceSection: '§12.2 Grade Versioning' },
    { id: 'tr-l-03', text: 'Is the scoring methodology disclosed to subscribers at a criteria-and-assumptions level in a public doc?', type: 'boolean', regulatoryTag: 'Codebase_Scoring_Disclosure', launchStage: 'required_before_charging', helpText: 'FINRA Rule 2214 requires disclosure of criteria, assumptions, and limitations for investment analysis tools. Even as a non-member, this is best practice.', sourceSection: '§12.3 Methodology Disclosure' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM M — Codebase: Trade Cards
// ═══════════════════════════════════════════════════════════════════

export const workstreamM: TradingWorkstream = {
  id: 'tr-m', letter: 'M', title: 'Codebase: Trade Cards',
  description: 'Strike/expiry validation, per-card disclaimers, and trade card archival.',
  questions: [
    { id: 'tr-m-01', text: 'Is every strike/expiry in every trade card validated against the current options chain at display time, with a visible timestamp showing data age?', type: 'boolean', regulatoryTag: 'Codebase_Trade_Card_Validation', launchStage: 'required_now', helpText: 'Displaying stale strikes or expired options is misleading. Users must know data age to make informed decisions.', sourceSection: '§13.1 Chain Validation' },
    { id: 'tr-m-02', text: 'Does each trade card embed (not just reference) disclaimers: hypothetical, not investment advice, options involve risk, multi-leg commissions not reflected?', type: 'boolean', regulatoryTag: 'Codebase_Trade_Card_Disclaimer', launchStage: 'required_before_charging', helpText: 'Per-card embedded disclaimers are stronger than a single site-wide disclaimer. Each trade card is the most recommendation-like artifact your platform produces.', sourceSection: '§13.2 Card Disclaimers' },
    { id: 'tr-m-03', text: 'Am I archiving every trade card ever generated with exact numbers and AI narrative, provable per specific date?', type: 'boolean', regulatoryTag: 'Codebase_Trade_Card_Archive', launchStage: 'required_now', helpText: 'If a subscriber claims they relied on a specific trade card, you must be able to produce exactly what they saw. Archive with full data snapshot.', sourceSection: '§13.3 Card Archival' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM N — Codebase: Trade Journal
// ═══════════════════════════════════════════════════════════════════

export const workstreamN: TradingWorkstream = {
  id: 'tr-n', letter: 'N', title: 'Codebase: Trade Journal',
  description: 'Known bugs, uncommit logic, encryption, and aggregation controls.',
  questions: [
    { id: 'tr-n-01', text: "The strategy_name='unknown' bug — is this display-layer or structural? Does it indicate a broken linkage between trade card generation and position tracking?", type: 'text', regulatoryTag: 'Codebase_Journal_Bug', launchStage: 'required_now', helpText: "If users rely on the journal to remember what they traded, 'unknown' is a user-protection problem. Structural break could mean orphaned data affecting aggregation.", sourceSection: '§14.1 Strategy Name Bug' },
    { id: 'tr-n-02', text: 'The uncommit logic not cleaning up — does this mean orphaned records persist? Could orphaned records give misleading performance picture or leak another user data?', type: 'text', regulatoryTag: 'Codebase_Journal_Uncommit', launchStage: 'required_now', helpText: 'Orphaned journal entries or trade card links could inflate or deflate performance metrics. Any cross-user data leakage is a security violation.', sourceSection: '§14.2 Uncommit Logic' },
    { id: 'tr-n-03', text: 'Is journal data (actual positions, entry/exit prices, P&L) classified as sensitive PII and encrypted at rest with column-level encryption?', type: 'boolean', regulatoryTag: 'Codebase_Journal_Encryption', launchStage: 'required_now', helpText: 'Journal contains real brokerage position data. Should be treated with same sensitivity as bank account data.', sourceSection: '§14.3 Journal Encryption' },
    { id: 'tr-n-04', text: 'Does any aggregation of journal data surface to other users, marketing content, or public landing page?', type: 'boolean', regulatoryTag: 'Codebase_Journal_Aggregation', launchStage: 'required_now', helpText: 'If yes, this crosses into Marketing Rule / performance-advertising territory. Journal data must remain strictly per-user.', sourceSection: '§14.4 Journal Aggregation' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM O — Codebase: Scanner Filters
// ═══════════════════════════════════════════════════════════════════

export const workstreamO: TradingWorkstream = {
  id: 'tr-o', letter: 'O', title: 'Codebase: Scanner Filters',
  description: 'Filter storage location, default values, and transparency for publisher exclusion defense.',
  questions: [
    { id: 'tr-o-01', text: 'Are user-saved filters stored server-side (producing different outputs per user) or purely client-side?', type: 'select', regulatoryTag: 'Codebase_Filter_Storage', launchStage: 'required_now', options: ['Server-side (personalized output)', 'Client-side only (cosmetic)', 'Both (server persists but output is from same universe)', 'Unknown'], helpText: "Server-side personalization strengthens the argument that the platform provides personalized advice. Client-side is friendlier for publisher's exclusion.", sourceSection: '§15.1 Filter Storage' },
    { id: 'tr-o-02', text: 'Are default filter values identical for every new user (publisher-friendly)?', type: 'boolean', regulatoryTag: 'Codebase_Filter_Defaults', launchStage: 'required_now', helpText: 'If you auto-tune defaults based on user behavior or ML, that looks like personalized advisory. Identical defaults for all new users is publisher-friendly.', sourceSection: '§15.2 Default Values' },
    { id: 'tr-o-03', text: 'Do I expose to users exactly what each filter does (IV rank range, market-cap thresholds, sector toggles) so output is auditable?', type: 'boolean', regulatoryTag: 'Codebase_Filter_Transparency', launchStage: 'required_now', helpText: "Black-box filters are harder to defend. Transparent, user-visible filter criteria support the 'impersonal tool the user operates' argument.", sourceSection: '§15.3 Filter Transparency' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM P — Codebase: Backtest Infrastructure
// ═══════════════════════════════════════════════════════════════════

export const workstreamP: TradingWorkstream = {
  id: 'tr-p', letter: 'P', title: 'Codebase: Backtest Infrastructure',
  description: 'Backtest exposure status, result honesty, and feature-flag protection.',
  questions: [
    { id: 'tr-p-01', text: 'Is the backtest infrastructure user-facing today?', type: 'boolean', regulatoryTag: 'Codebase_Backtest_Exposure', launchStage: 'required_now', helpText: 'If user-facing, every display needs the full hypothetical-performance disclosure stack. SEC Marketing Rule standard even without registration.', sourceSection: '§16.1 Backtest Exposure' },
    { id: 'tr-p-02', text: 'Does the backtest engine include realistic commissions, slippage, bid-ask crossing costs, early-assignment modeling, and survivorship-bias controls?', type: 'boolean', regulatoryTag: 'Codebase_Backtest_Honesty', launchStage: 'required_now', dependsOn: ['tr-p-01'], helpText: 'Publishing backtest results without these controls is anti-fraud risk. Misleading hypothetical performance is actionable under §10(b).', sourceSection: '§16.2 Backtest Honesty' },
    { id: 'tr-p-03', text: 'If backtest should NOT be user-facing at launch, is it behind a feature flag that is OFF in production?', type: 'boolean', regulatoryTag: 'Codebase_Backtest_Lock', launchStage: 'required_now', dependsOn: ['tr-p-01'], helpText: 'An accidentally deployed backtest UI without proper disclosures is a compliance incident. Feature flags prevent accidental exposure.', sourceSection: '§16.3 Feature Flag' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM Q — Codebase: Deployment Hygiene
// ═══════════════════════════════════════════════════════════════════

export const workstreamQ: TradingWorkstream = {
  id: 'tr-q', letter: 'Q', title: 'Codebase: Deployment Hygiene',
  description: 'Retention policies, content versioning, disclaimer enforcement, incident response, and AI badges.',
  questions: [
    { id: 'tr-q-01', text: 'How long do I keep scanner outputs, AI narratives, trade cards, and journal entries? Do backups actually preserve them for 5+ years?', type: 'text', regulatoryTag: 'Codebase_Retention', launchStage: 'required_now', helpText: '5-year minimum for defensive purposes. Verify backup retention policies actually match this requirement.', sourceSection: '§17.1 Retention Policy' },
    { id: 'tr-q-02', text: 'Is every AI-generated piece of content versioned with model version, system-prompt version, and data-snapshot timestamp?', type: 'boolean', regulatoryTag: 'Codebase_Content_Versioning', launchStage: 'required_now', helpText: 'Must reproduce exactly what a user saw on a specific date on regulator or litigation demand.', sourceSection: '§17.2 Content Versioning' },
    { id: 'tr-q-03', text: 'Is every disclaimer rendered server-side (not bypassable by client-side manipulation) and logged as displayed per session?', type: 'boolean', regulatoryTag: 'Codebase_Disclaimer_Enforcement', launchStage: 'required_before_charging', helpText: 'Client-side-only disclaimers can be stripped by browser extensions. Server-side rendering with display logging proves the disclaimer was shown.', sourceSection: '§17.3 Disclaimer Enforcement' },
    { id: 'tr-q-04', text: 'If the scanner surfaces a materially incorrect trade card (stale borrow rate, wrong strike), what is my 24-hour user-notification plan?', type: 'text', regulatoryTag: 'Codebase_Incident_Response', launchStage: 'required_before_charging', helpText: 'Securities anti-fraud provisions require you to not leave misleading information in circulation. Rapid correction and notification are essential.', sourceSection: '§17.4 Incident Response' },
    { id: 'tr-q-05', text: "Does every AI-rendered sentence have a visible 'AI-Generated' badge adjacent to it, or only a single site-footer disclosure?", type: 'boolean', regulatoryTag: 'Codebase_AI_Badge', launchStage: 'required_before_charging', helpText: 'Best practice per SEC AI-washing direction is adjacent, per-paragraph badges. A single site-footer is weaker defense.', sourceSection: '§17.5 AI Badge' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// WORKSTREAM R — Strategic
// ═══════════════════════════════════════════════════════════════════

export const workstreamR: TradingWorkstream = {
  id: 'tr-r', letter: 'R', title: 'Strategic',
  description: 'Registration willingness, restructuring options, scaling triggers, and legal counsel.',
  questions: [
    { id: 'tr-r-01', text: "If I cannot claim the publisher's exclusion, am I willing to register as a state or SEC investment adviser, bear ADV/Marketing Rule/books-and-records burden, and pass Series 65?", type: 'text', regulatoryTag: 'Strategic', launchStage: 'required_before_charging', helpText: 'Registration is not catastrophic — many platforms operate as registered advisers. But it adds significant compliance overhead and cost.', sourceSection: '§18.1 Registration Path' },
    { id: 'tr-r-02', text: 'If unwilling to register, am I willing to restructure: remove trade journal linkage to real positions, force identical scanner output for all subscribers, replace specific-leg recommendations with generic examples?', type: 'text', regulatoryTag: 'Strategic', launchStage: 'required_before_charging', helpText: 'These structural changes would more clearly place Temple Stuart on the publisher side of the line. The tradeoff is reduced product value.', sourceSection: '§18.2 Restructuring' },
    { id: 'tr-r-03', text: 'At what subscriber count or revenue level do I revisit this structural decision?', type: 'text', regulatoryTag: 'Strategic', launchStage: 'required_at_scale', helpText: 'Seeking Alpha reached millions without registration. Unusual Whales spun out a registered entity for ETFs while keeping analytics unregistered.', sourceSection: '§18.3 Scale Trigger' },
    { id: 'tr-r-04', text: 'Do I have a securities lawyer with fintech experience on retainer to review every public-facing claim, marketing page, new feature, and disclaimer before it ships?', type: 'boolean', regulatoryTag: 'Strategic', launchStage: 'required_before_charging', helpText: "This is the single most important pre-launch item for the trading module. The Investment Advisers Act exposure is personal liability — no corporate shield for control-person fraud.", sourceSection: '§18.4 Legal Counsel' },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// FINAL MODULE EXPORT
// ═══════════════════════════════════════════════════════════════════

export const TRADING_OPS_MODULE: TradingModule = {
  id: 'trading',
  title: 'Trading Analytics',
  description: 'Regulatory compliance, data licensing, disclaimers, AI controls, and codebase audit for launching an options-focused trading analytics SaaS platform.',
  workstreams: [
    workstreamA, workstreamB, workstreamC, workstreamD, workstreamE, workstreamF,
    workstreamG, workstreamH, workstreamI, workstreamJ, workstreamK, workstreamL,
    workstreamM, workstreamN, workstreamO, workstreamP, workstreamQ, workstreamR,
  ],
  totalQuestions: 88,
};
