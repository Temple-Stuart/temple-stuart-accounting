// src/lib/ops/tradingQuestions.ts
// Trading Analytics Operations Planner Question Registry
// Pattern follows bookkeepingQuestions.ts — single source of truth

import type { QuestionType, LaunchStage, OpsModule } from './bookkeepingQuestions';

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

// --- Workstreams G through R will be added in subsequent prompts ---
// G: Books & Records / Defensive Preservation (3 questions)
// H: Competitive / Structural (3 questions)
// I: Codebase — API Routes (3 questions)
// J: Codebase — External Data Feeds (6 questions)
// K: Codebase — AI Synthesis (3 questions)
// L: Codebase — Composite Scoring (3 questions)
// M: Codebase — Trade Cards (3 questions)
// N: Codebase — Trade Journal (4 questions)
// O: Codebase — Scanner Filters (3 questions)
// P: Codebase — Backtest Infrastructure (3 questions)
// Q: Codebase — Deployment Hygiene (5 questions)
// R: Strategic (4 questions)
