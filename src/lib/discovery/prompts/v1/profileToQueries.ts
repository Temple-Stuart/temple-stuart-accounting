export interface UserProfileInput {
  business_description: string;
  operating_jurisdictions: string[];
  customer_jurisdictions: string[];
  products_services: string[];
  ai_use_in_product: boolean;
  handles_personal_data: boolean;
  handles_financial_data: boolean;
  handles_health_data: boolean;
  revenue_stage: string;
  employee_count: number;
  planned_actions_24mo: string[];
}

export interface SearchQuery {
  query: string;
  allowed_domains: string[];
  practice_areas: string[];
}

const STATE_DOMAINS: Record<string, string[]> = {
  'US-CA': ['oag.ca.gov', 'cppa.ca.gov', 'leginfo.legislature.ca.gov', 'ftb.ca.gov', 'cdtfa.ca.gov', 'sos.ca.gov'],
  'US-NY': ['ag.ny.gov', 'tax.ny.gov', 'dos.ny.gov', 'dfs.ny.gov', 'nysenate.gov'],
  'US-DE': ['revenue.delaware.gov', 'sos.delaware.gov', 'delcode.delaware.gov', 'attorneygeneral.delaware.gov'],
  'US-TX': ['comptroller.texas.gov', 'texasattorneygeneral.gov', 'capitol.texas.gov', 'sos.state.tx.us'],
  'US-FL': ['floridarevenue.com', 'myfloridalegal.com', 'flsenate.gov', 'dos.myflorida.com'],
  'US-WA': ['dor.wa.gov', 'atg.wa.gov', 'leg.wa.gov', 'sos.wa.gov'],
  'US-IL': ['tax.illinois.gov', 'illinoisattorneygeneral.gov', 'ilga.gov', 'sos.illinois.gov'],
  'US-MA': ['mass.gov', 'malegislature.gov'],
  'US-CO': ['tax.colorado.gov', 'coag.gov', 'leg.colorado.gov', 'sos.state.co.us'],
  'US-VA': ['tax.virginia.gov', 'oag.state.va.us', 'lis.virginia.gov'],
  'US-NJ': ['nj.gov', 'njleg.state.nj.us'],
  'US-PA': ['revenue.pa.gov', 'attorneygeneral.gov', 'legis.state.pa.us'],
  'US-UT': ['tax.utah.gov', 'attorneygeneral.utah.gov', 'le.utah.gov'],
};

const FEDERAL_DOMAINS = ['irs.gov', 'ftc.gov', 'sec.gov', 'congress.gov', 'govinfo.gov', 'ecfr.gov', 'federalregister.gov'];
const AI_GOVERNANCE_DOMAINS = ['cppa.ca.gov', 'leginfo.legislature.ca.gov', 'capitol.texas.gov', 'coag.gov', 'le.utah.gov', 'ilga.gov', 'nyc.gov', 'eur-lex.europa.eu', 'whitehouse.gov', 'nist.gov', 'ncsl.org'];
const PRIVACY_DOMAINS = ['ftc.gov', 'congress.gov', 'ncsl.org'];
const FINANCIAL_DATA_DOMAINS = ['ftc.gov', 'ecfr.gov', 'govinfo.gov', 'congress.gov'];
const FINANCIAL_SERVICES_DOMAINS = ['sec.gov', 'finra.org', 'cftc.gov', 'aicpa.org'];

function filterDomains(domains: string[], activeDomains: string[]): string[] {
  return domains.filter((d) => activeDomains.includes(d));
}

function allJurisdictions(profile: UserProfileInput): string[] {
  return [...new Set([...profile.operating_jurisdictions, ...profile.customer_jurisdictions])];
}

export function profileToQueries(profile: UserProfileInput, activeDomains: string[]): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const jurisdictions = allJurisdictions(profile);

  queries.push({
    query: 'IRS small business tax obligations federal income tax estimated payments',
    allowed_domains: filterDomains(['irs.gov', 'congress.gov', 'govinfo.gov'], activeDomains),
    practice_areas: ['tax_federal'],
  });

  queries.push({
    query: 'FTC Act Section 5 unfair deceptive business practices compliance',
    allowed_domains: filterDomains(['ftc.gov', 'ecfr.gov'], activeDomains),
    practice_areas: ['consumer_protection_ftc'],
  });

  for (const jur of jurisdictions) {
    const stateDomains = STATE_DOMAINS[jur];
    if (!stateDomains) continue;
    const filtered = filterDomains(stateDomains, activeDomains);
    if (filtered.length === 0) continue;

    const stateLabel = jur.replace('US-', '');

    queries.push({
      query: `${stateLabel} state income tax business obligations ${new Date().getFullYear()}`,
      allowed_domains: filtered,
      practice_areas: ['tax_state'],
    });

    queries.push({
      query: `${stateLabel} sales tax economic nexus SaaS digital services`,
      allowed_domains: filtered,
      practice_areas: ['sales_tax_nexus'],
    });

    queries.push({
      query: `${stateLabel} business registration formation annual report requirements`,
      allowed_domains: filtered,
      practice_areas: ['corporate_governance'],
    });
  }

  if (profile.handles_personal_data) {
    queries.push({
      query: 'FTC Safeguards Rule financial institutions customer information requirements',
      allowed_domains: filterDomains(PRIVACY_DOMAINS, activeDomains),
      practice_areas: ['data_privacy_us_federal'],
    });

    for (const jur of jurisdictions) {
      const stateDomains = STATE_DOMAINS[jur];
      if (!stateDomains) continue;
      const filtered = filterDomains(stateDomains, activeDomains);
      if (filtered.length === 0) continue;
      const stateLabel = jur.replace('US-', '');

      queries.push({
        query: `${stateLabel} data privacy law consumer rights business obligations`,
        allowed_domains: filtered,
        practice_areas: ['data_privacy_us_state'],
      });

      queries.push({
        query: `${stateLabel} data breach notification law requirements timeline`,
        allowed_domains: filtered,
        practice_areas: ['cybersecurity_breach_notification'],
      });
    }
  }

  if (profile.handles_financial_data) {
    queries.push({
      query: 'Gramm-Leach-Bliley Act GLBA financial privacy rule safeguards',
      allowed_domains: filterDomains(FINANCIAL_DATA_DOMAINS, activeDomains),
      practice_areas: ['financial_data_glba'],
    });

    queries.push({
      query: 'FTC Safeguards Rule amended 2023 information security program requirements',
      allowed_domains: filterDomains(['ftc.gov', 'ecfr.gov', 'federalregister.gov'], activeDomains),
      practice_areas: ['data_security'],
    });
  }

  if (profile.ai_use_in_product) {
    queries.push({
      query: 'AI governance regulations automated decision making transparency requirements US',
      allowed_domains: filterDomains(AI_GOVERNANCE_DOMAINS, activeDomains),
      practice_areas: ['ai_governance_us'],
    });

    queries.push({
      query: 'EU AI Act artificial intelligence regulation requirements classification',
      allowed_domains: filterDomains(['eur-lex.europa.eu'], activeDomains),
      practice_areas: ['ai_governance_eu'],
    });

    queries.push({
      query: 'NIST AI Risk Management Framework implementation guidance',
      allowed_domains: filterDomains(['nist.gov'], activeDomains),
      practice_areas: ['ai_governance_us'],
    });
  }

  const isCharging = ['charging_under_50k', 'charging_50k_500k', 'charging_500k_5m', 'charging_over_5m'].includes(profile.revenue_stage);
  const isPreCharging = profile.revenue_stage === 'pre_charging';

  if (isCharging || isPreCharging) {
    queries.push({
      query: 'PCI DSS payment card industry data security standard merchant requirements',
      allowed_domains: filterDomains(['pcisecuritystandards.org', 'ftc.gov'], activeDomains),
      practice_areas: ['payment_processing'],
    });

    for (const jur of jurisdictions) {
      const stateDomains = STATE_DOMAINS[jur];
      if (!stateDomains) continue;
      const filtered = filterDomains(stateDomains, activeDomains);
      if (filtered.length === 0) continue;
      const stateLabel = jur.replace('US-', '');

      queries.push({
        query: `${stateLabel} sales tax SaaS software services nexus threshold ${new Date().getFullYear()}`,
        allowed_domains: filtered,
        practice_areas: ['sales_tax_nexus'],
      });
    }
  }

  const isFinancialProduct = profile.products_services.some((p) =>
    /financial|accounting|bookkeeping|tax|trading|investment/i.test(p)
  );

  if (isFinancialProduct) {
    queries.push({
      query: 'SEC investment adviser registration exemptions requirements',
      allowed_domains: filterDomains(FINANCIAL_SERVICES_DOMAINS, activeDomains),
      practice_areas: ['investment_adviser'],
    });

    queries.push({
      query: 'IRS Circular 230 tax preparer practice requirements penalties',
      allowed_domains: filterDomains(['irs.gov', 'govinfo.gov', 'ecfr.gov'], activeDomains),
      practice_areas: ['tax_preparer_regulation'],
    });

    queries.push({
      query: 'SOC 2 Type II service organization controls trust criteria requirements',
      allowed_domains: filterDomains(['aicpa.org'], activeDomains),
      practice_areas: ['financial_reporting'],
    });
  }

  if (profile.handles_health_data) {
    queries.push({
      query: 'HIPAA health information privacy security business associate requirements',
      allowed_domains: filterDomains(['hhs.gov', 'congress.gov', 'govinfo.gov'], activeDomains),
      practice_areas: ['data_privacy_us_federal'],
    });
  }

  if (isFinancialProduct) {
    queries.push({
      query: 'FINRA broker-dealer registration rules compliance requirements financial services',
      allowed_domains: filterDomains(['finra.org', 'sec.gov'], activeDomains),
      practice_areas: ['broker_dealer', 'securities_disclosure'],
    });
  }

  // ── Planned actions (24-month look-ahead) ────────────────────────

  for (const action of profile.planned_actions_24mo) {
    const actionLower = action.toLowerCase();
    let extraDomains: string[] = [];
    let practiceAreas: string[] = [];

    if (/fundrais|investor|venture|seed|series/.test(actionLower)) {
      extraDomains = filterDomains(FINANCIAL_SERVICES_DOMAINS, activeDomains);
      practiceAreas = ['securities_disclosure', 'corporate_governance'];
    } else if (/hire|employee|contractor|payroll/.test(actionLower)) {
      practiceAreas = ['employment_solo', 'tax_federal'];
    } else if (/international|eu|gdpr|cross.?border/.test(actionLower)) {
      extraDomains = filterDomains(['eur-lex.europa.eu'], activeDomains);
      practiceAreas = ['data_privacy_eu', 'international_trade_sanctions'];
    } else if (/patent|trademark|copyright|ip/.test(actionLower)) {
      practiceAreas = ['intellectual_property'];
    }

    const actionDomains = filterDomains([...FEDERAL_DOMAINS, ...extraDomains], activeDomains);
    if (actionDomains.length > 0) {
      queries.push({
        query: `regulatory requirements for businesses planning to ${action}`,
        allowed_domains: actionDomains,
        practice_areas: practiceAreas.length > 0 ? practiceAreas : ['corporate_governance'],
      });
    }
  }

  // Filter out any queries that ended up with empty allowed_domains
  return queries.filter((q) => q.allowed_domains.length > 0);
}
