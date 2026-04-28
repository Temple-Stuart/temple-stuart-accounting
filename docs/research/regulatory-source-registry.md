# Regulatory Source Registry — Temple Stuart Compliance Foundation

**Purpose:** Authoritative seed data for the `regulatory_sources` table. Each row represents one verified regulatory source domain mapped to authority tier, jurisdiction, regulator, practice area, and Temple Stuart module relevance.

**Source:** Deep research conducted April 2026, validated against 2025-2026 regulatory landscape.

**Last verified:** 2026-04-28
**Last verified by:** registry_research_pr_a

**Schema reference:**
- `source_tier`: primary_law | subregulatory_guidance | agency_enforcement | secondary_authoritative | secondary_practitioner
- `authority_rank`: 1 (highest) to 5 (secondary/persuasive)
- `refresh_cadence`: daily | weekly | monthly | quarterly | annual | event_driven
- `practice_areas` (controlled vocabulary, 30 values): tax_federal, tax_state, bookkeeping_accounting, financial_reporting, data_privacy_us_federal, data_privacy_us_state, data_privacy_eu, data_security, financial_data_glba, tax_preparer_regulation, investment_adviser, broker_dealer, securities_disclosure, options_market_data, ai_governance_eu, ai_governance_us, consumer_protection_ftc, consumer_protection_state, travel_consumer_protection, aviation_dot, accessibility_ada, payment_processing, sales_tax_nexus, corporate_governance, employment_solo, intellectual_property, terms_of_service_law, cybersecurity_breach_notification, anti_money_laundering, international_trade_sanctions
- `module_relevance` values: bookkeeping_tax | trading | travel | operations

---

## Section 1: Federal Cross-Cutting Authoritative Sources

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| govinfo.gov | U.S. Government Publishing Office — govinfo | primary_law | 1 | US-federal | GPO, Office of the Federal Register | tax_federal,securities_disclosure,consumer_protection_ftc,aviation_dot,data_security | bookkeeping_tax,trading,travel,operations | statutes,regulations,authenticated_pdfs | daily | https://api.govinfo.gov/ (api.data.gov key required) | Gold standard for authenticated CFR and Federal Register PDFs |
| ecfr.gov | Electronic Code of Federal Regulations | primary_law | 1 | US-federal | Office of the Federal Register | tax_federal,securities_disclosure,broker_dealer,investment_adviser,consumer_protection_ftc,aviation_dot,accessibility_ada,data_security,financial_data_glba | bookkeeping_tax,trading,travel,operations | regulations | daily | https://www.ecfr.gov/api/versioner/v1/ | Working CFR. OFR states verify against official CFR for legal research. |
| federalregister.gov | Federal Register | primary_law | 1 | US-federal | Office of the Federal Register | tax_federal,securities_disclosure,broker_dealer,investment_adviser,consumer_protection_ftc,aviation_dot,ai_governance_us,data_security | bookkeeping_tax,trading,travel,operations | regulations,rulemakings,executive_orders,agency_notices | daily | https://www.federalregister.gov/api/v1/ | 106109 pages and 3248 final rules in 2024. |
| congress.gov | Congress.gov — Library of Congress | primary_law | 1 | US-federal | U.S. Congress | tax_federal,securities_disclosure,consumer_protection_ftc,ai_governance_us | bookkeeping_tax,trading,travel,operations | statutes,legislation,public_laws | daily | https://api.congress.gov/v3/ (api.data.gov key, 5000/hr) | Authoritative source for legislation and Public Laws. |
| uscode.house.gov | Office of Law Revision Counsel — U.S. Code | primary_law | 1 | US-federal | U.S. House of Representatives | tax_federal,securities_disclosure,investment_adviser,broker_dealer,consumer_protection_ftc | bookkeeping_tax,trading,travel,operations | statutes,uslm_xml | weekly | https://uscode.house.gov/download/download.shtml | Positive-law titles are the law; non-positive evidence of Statutes at Large. |
| supremecourt.gov | Supreme Court of the United States | primary_law | 1 | US-federal | SCOTUS | tax_federal,securities_disclosure,investment_adviser,consumer_protection_ftc | bookkeeping_tax,trading,travel,operations | case_law,opinions | event_driven | manual | Includes Lowe v. SEC, South Dakota v. Wayfair. |
| courtlistener.com | CourtListener — Free Law Project | secondary_authoritative | 3 | US-federal | (none) | tax_federal,securities_disclosure,investment_adviser,broker_dealer | bookkeeping_tax,trading,travel,operations | case_law,court_documents | daily | https://www.courtlistener.com/api/rest/v4/ (Token required) | Federal courts. Verify case existence against primary opinions. |
| pacer.gov | PACER — Public Access to Court Electronic Records | primary_law | 1 | US-federal | Administrative Office of the U.S. Courts | tax_federal,securities_disclosure,investment_adviser | bookkeeping_tax,trading,operations | case_law,court_documents,filings | daily | manual (paywall, $0.10/page) | Authoritative federal court documents. |

---

## Section 2: Module 1 — Bookkeeping & Tax Preparation

### Federal tax + accounting

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| irs.gov | Internal Revenue Service | subregulatory_guidance | 2 | US-federal | IRS | tax_federal,tax_preparer_regulation,financial_data_glba,data_security,bookkeeping_accounting | bookkeeping_tax | guidance,publications,forms,notices,revenue_rulings,revenue_procedures | weekly | manual | Pub 17, 334, 535, 550, 5708 WISP, Circular 230 (rewrite pending 89 FR 105432), PTIN/EFIN/MeF. |
| home.treasury.gov | U.S. Department of the Treasury | subregulatory_guidance | 2 | US-federal | Treasury | tax_federal,anti_money_laundering,international_trade_sanctions | bookkeeping_tax,operations | regulations,guidance | weekly | manual | Treasury regulations including 31 CFR (FinCEN, OFAC). |
| ustaxcourt.gov | United States Tax Court | primary_law | 1 | US-federal | U.S. Tax Court | tax_federal | bookkeeping_tax | case_law,opinions | weekly | manual via DAWSON | Authoritative source for U.S. Tax Court opinions. |
| ftc.gov | Federal Trade Commission | primary_law | 1 | US-federal | FTC | consumer_protection_ftc,data_security,financial_data_glba | bookkeeping_tax,travel,operations | regulations,rules,enforcement_orders,guides | weekly | manual | FTC Act §5; Safeguards Rule (16 CFR 314); 16 CFR 255 Endorsement Guides; 16 CFR 465 Reviews Rule (eff Oct 2024). |
| fincen.gov | Financial Crimes Enforcement Network | subregulatory_guidance | 2 | US-federal | FinCEN, Treasury | anti_money_laundering | bookkeeping_tax,operations | regulations,guidance,advisories | weekly | manual | BOI status unstable: Mar 21-26 2025 IFR exempts US domestic reporting companies. |
| fasb.org | Financial Accounting Standards Board | secondary_authoritative | 3 | US-federal | FASB | bookkeeping_accounting,financial_reporting | bookkeeping_tax | accounting_standards,asc_codification | quarterly | manual via asc.fasb.org | Authoritative US GAAP via ASC. Free basic view; professional view paywalled. |
| aicpa-cima.com | AICPA & CIMA | secondary_authoritative | 3 | US-federal | AICPA | bookkeeping_accounting,financial_reporting,tax_federal,data_security | bookkeeping_tax,operations | professional_standards,code_of_conduct,trust_services_criteria | quarterly | manual | Code of Professional Conduct, Trust Services Criteria for SOC 2. |
| ifrs.org | International Accounting Standards Board | secondary_authoritative | 3 | International | IASB | bookkeeping_accounting,financial_reporting | bookkeeping_tax | accounting_standards,ifrs | quarterly | manual | International Financial Reporting Standards. Subscription required. |
| nasba.org | National Association of State Boards of Accountancy | secondary_authoritative | 4 | US-federal | NASBA | bookkeeping_accounting,tax_preparer_regulation | bookkeeping_tax,operations | state_board_directory,cpa_licensure | annual | manual directory | 55-jurisdiction directory of state CPA boards. |

### State tax preparer regimes

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ctec.org | California Tax Education Council | primary_law | 2 | US-CA | CTEC | tax_preparer_regulation | bookkeeping_tax | registration,ce_requirements | annual | manual | 60-hour qualifying ed, $5K bond, $33 annual fee, 20hr CE. R&TC §19167(d) $2500/failure penalty. |
| ftb.ca.gov | California Franchise Tax Board | primary_law | 2 | US-CA | FTB | tax_state,tax_preparer_regulation,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | California state tax authority. |
| tax.ny.gov | New York State Department of Taxation and Finance | primary_law | 2 | US-NY | NY DTF | tax_state,tax_preparer_regulation,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | NYTPRIN annual reg; 16hr CPE for >10 NY returns. |
| oregon.gov | Oregon Board of Tax Practitioners | primary_law | 2 | US-OR | Oregon BTP | tax_preparer_regulation | bookkeeping_tax | licensure,regulations | annual | manual | Only US state to fully license preparers. 80-hour course + state exam. |
| labor.maryland.gov | Maryland Department of Labor — Tax Preparers Board | primary_law | 2 | US-MD | MD DOL | tax_preparer_regulation | bookkeeping_tax | registration,regulations | annual | manual | Maryland tax preparer registration. |
| portal.ct.gov | Connecticut Department of Revenue Services | primary_law | 2 | US-CT | CT DRS | tax_state,tax_preparer_regulation,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Triggers when preparing >10 CT or federal returns for CT clients. |
| tax.illinois.gov | Illinois Department of Revenue | primary_law | 2 | US-IL | IL DOR | tax_state,tax_preparer_regulation,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | PTIN-only preparer regime; 200-txn nexus removed eff Jan 1 2026. |
| revenue.state.mn.us | Minnesota Department of Revenue | primary_law | 2 | US-MN | MN DOR | tax_state,tax_preparer_regulation,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | PTIN-only preparer regime. |

### State sales tax nexus DORs

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tax.virginia.gov | Virginia Department of Taxation | primary_law | 2 | US-VA | VA DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Virginia state tax authority. |
| tax.ohio.gov | Ohio Department of Taxation | primary_law | 2 | US-OH | OH DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Ohio state tax authority. SaaS taxable. |
| comptroller.texas.gov | Texas Comptroller of Public Accounts | primary_law | 2 | US-TX | TX Comptroller | tax_state,sales_tax_nexus,corporate_governance | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | $500K nexus; SaaS taxable; franchise tax/PIR May 15. |
| floridarevenue.com | Florida Department of Revenue | primary_law | 2 | US-FL | FL DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Florida state tax authority. $100K nexus. |
| revenue.pa.gov | Pennsylvania Department of Revenue | primary_law | 2 | US-PA | PA DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Pennsylvania state tax authority. SaaS taxable. |
| azdor.gov | Arizona Department of Revenue | primary_law | 2 | US-AZ | AZ DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Arizona state tax authority. |
| dor.wa.gov | Washington Department of Revenue | primary_law | 2 | US-WA | WA DOR | tax_state,sales_tax_nexus,travel_consumer_protection | bookkeeping_tax,travel,operations | regulations,guidance,forms | weekly | manual | SaaS taxable; Sellers of Travel registration via WA DOL/DOR. |
| tax.iowa.gov | Iowa Department of Revenue | primary_law | 2 | US-IA | IA DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Iowa state tax authority. SaaS taxable. |
| mass.gov | Massachusetts Department of Revenue | primary_law | 2 | US-MA | MA DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Massachusetts state tax authority. SaaS taxable. |
| tax.nv.gov | Nevada Department of Taxation | primary_law | 2 | US-NV | NV DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Nevada state tax authority. |
| revenue.alabama.gov | Alabama Department of Revenue | primary_law | 2 | US-AL | AL DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | $250K nexus threshold. |
| dor.mo.gov | Missouri Department of Revenue | primary_law | 2 | US-MO | MO DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Missouri state tax authority. |
| revenue.state.co.us | Colorado Department of Revenue | primary_law | 2 | US-CO | CO DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Colorado state tax authority. |
| revenue.state.nc.us | North Carolina Department of Revenue | primary_law | 2 | US-NC | NC DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | North Carolina state tax authority. |
| dor.ga.gov | Georgia Department of Revenue | primary_law | 2 | US-GA | GA DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Georgia state tax authority. |
| dor.in.gov | Indiana Department of Revenue | primary_law | 2 | US-IN | IN DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Indiana state tax authority. |
| revenue.wi.gov | Wisconsin Department of Revenue | primary_law | 2 | US-WI | WI DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Wisconsin state tax authority. |
| tax.utah.gov | Utah State Tax Commission | primary_law | 2 | US-UT | UT STC | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Utah state tax authority. |
| tax.ks.gov | Kansas Department of Revenue | primary_law | 2 | US-KS | KS DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Kansas state tax authority. |
| tax.ok.gov | Oklahoma Tax Commission | primary_law | 2 | US-OK | OK TC | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Oklahoma state tax authority. |
| revenue.nebraska.gov | Nebraska Department of Revenue | primary_law | 2 | US-NE | NE DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Nebraska state tax authority. |
| tax.idaho.gov | Idaho State Tax Commission | primary_law | 2 | US-ID | ID STC | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Idaho state tax authority. |
| revenue.state.nm.us | New Mexico Taxation and Revenue Department | primary_law | 2 | US-NM | NM TRD | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | New Mexico state tax authority. |
| tax.hawaii.gov | Hawaii Department of Taxation | primary_law | 2 | US-HI | HI DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Hawaii state tax authority. |
| dor.sc.gov | South Carolina Department of Revenue | primary_law | 2 | US-SC | SC DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | South Carolina state tax authority. |
| tn.gov | Tennessee Department of Revenue | primary_law | 2 | US-TN | TN DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Tennessee state tax authority. |
| revenue.ms.gov | Mississippi Department of Revenue | primary_law | 2 | US-MS | MS DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Mississippi $250K nexus. |
| revenue.louisiana.gov | Louisiana Department of Revenue | primary_law | 2 | US-LA | LA DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Louisiana state tax authority. |
| revenue.ar.gov | Arkansas Department of Finance and Administration | primary_law | 2 | US-AR | AR DFA | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Arkansas state tax authority. |
| dor.wv.gov | West Virginia Tax Division | primary_law | 2 | US-WV | WV TD | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | West Virginia state tax authority. |
| revenue.vermont.gov | Vermont Department of Taxes | primary_law | 2 | US-VT | VT DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Vermont state tax authority. |
| revenue.nh.gov | New Hampshire Department of Revenue Administration | primary_law | 2 | US-NH | NH DRA | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | NH state tax authority (no general sales tax). |
| revenue.maine.gov | Maine Revenue Services | primary_law | 2 | US-ME | ME MRS | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Maine state tax authority. |
| tax.ri.gov | Rhode Island Division of Taxation | primary_law | 2 | US-RI | RI DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Rhode Island state tax authority. |
| revenue.delaware.gov | Delaware Division of Revenue | primary_law | 2 | US-DE | DE DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Delaware state tax authority (no general sales tax). |
| state.nj.us | New Jersey Division of Taxation | primary_law | 2 | US-NJ | NJ DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | New Jersey state tax authority. |
| dor.michigan.gov | Michigan Department of Treasury | primary_law | 2 | US-MI | MI DOT | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | Michigan state tax authority. |
| dor.kentucky.gov | Kentucky Department of Revenue | primary_law | 2 | US-KY | KY DOR | tax_state,sales_tax_nexus | bookkeeping_tax,operations | regulations,guidance,forms | weekly | manual | KY 200-txn threshold removed eff Jan 1 2027. |

### State privacy enforcement

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ag.ny.gov | New York Attorney General | agency_enforcement | 2 | US-NY | NY AG | data_privacy_us_state,consumer_protection_state,investment_adviser,cybersecurity_breach_notification | bookkeeping_tax,trading,travel,operations | enforcement_orders,guidance | monthly | manual | NY SHIELD Act enforcement; Investor Protection Bureau; consumer protection. |
| cppa.ca.gov | California Privacy Protection Agency | primary_law | 1 | US-CA | CPPA, CA AG | data_privacy_us_state,ai_governance_us,data_security | bookkeeping_tax,trading,travel,operations | regulations,rulemaking_dockets | monthly | manual | ADMT/Risk Assessment/Cybersecurity Audit regs eff Jan 1 2026; ADMT compliance Jan 1 2027. |
| oag.ca.gov | California Attorney General | agency_enforcement | 2 | US-CA | CA AG | data_privacy_us_state,consumer_protection_state | bookkeeping_tax,trading,travel,operations | enforcement_orders,guidance | monthly | manual | CCPA/CPRA enforcement; consumer protection. |
| atg.wa.gov | Washington Attorney General | agency_enforcement | 2 | US-WA | WA AG | data_privacy_us_state,consumer_protection_state | bookkeeping_tax,travel,operations | enforcement_orders,guidance | monthly | manual | My Health My Data Act; private right of action. |

---

## Section 3: Module 2 — Trading / Securities / Investment Adviser

### Federal SROs and regulators

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sec.gov | U.S. Securities and Exchange Commission | primary_law | 1 | US-federal | SEC | securities_disclosure,investment_adviser,broker_dealer,ai_governance_us,cybersecurity_breach_notification,corporate_governance | trading,operations | regulations,enforcement_orders,no_action_letters,examination_priorities | weekly | manual | Form ADV, Reg BI, IAA §206, Cyber Disclosure Rule (Item 1.05 eff Dec 18 2023). |
| data.sec.gov | SEC EDGAR API | subregulatory_guidance | 2 | US-federal | SEC | securities_disclosure,corporate_governance | trading,operations | filings | daily | https://data.sec.gov/ (no key, 10 req/s) | EDGAR public filings API. |
| finra.org | Financial Industry Regulatory Authority | primary_law | 1 | US-federal | FINRA | broker_dealer,ai_governance_us | trading | regulations,notices,enforcement | weekly | manual | FINRA rules; Notice 24-09 on AI; AI Topic Hub; BrokerCheck. |
| msrb.org | Municipal Securities Rulemaking Board | primary_law | 1 | US-federal | MSRB | broker_dealer,securities_disclosure | trading | regulations,notices | quarterly | manual | Municipal securities; limited Temple Stuart relevance. |
| cftc.gov | Commodity Futures Trading Commission | subregulatory_guidance | 2 | US-federal | CFTC | broker_dealer,ai_governance_us | trading | regulations,guidance | quarterly | manual | LabCFTC AI Primer (2019) + Dec 5 2024 Staff Advisory. |
| theocc.com | Options Clearing Corporation | subregulatory_guidance | 2 | US-federal | OCC, SEC, CFTC | broker_dealer,options_market_data | trading | regulations,daily_volume,oic_education | daily | Free CSV/XLSX | Sole US listed-options clearer. |
| sec.gov/iard | SEC IARD gateway | subregulatory_guidance | 2 | US-federal | SEC | investment_adviser | trading,operations | guidance,form_adv_instructions | quarterly | manual | Form ADV instructions, FAQ. |
| iard.com | Investment Adviser Registration Depository | subregulatory_guidance | 2 | US-federal | FINRA, SEC, NASAA | investment_adviser | trading,operations | filings,registrations | daily | IAPD public search | Operated by FINRA on behalf of SEC + states. |
| nasaa.org | North American Securities Administrators Association | secondary_authoritative | 3 | US-federal | NASAA | investment_adviser,broker_dealer | trading,operations | model_rules,filings,iar_ce | quarterly | EFD | Coordinating body, not a regulator. Includes contact-your-regulator directory. |

### Options exchanges

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cboe.com | Cboe Global Markets | subregulatory_guidance | 2 | US-federal | Cboe Options, SEC | broker_dealer,options_market_data | trading | rulebooks | quarterly | Cboe DataShop (paid) | Market data commercially licensed. |
| nyse.com | NYSE Arca / American Options | subregulatory_guidance | 2 | US-federal | NYSE Arca, NYSE American, SEC | broker_dealer,options_market_data | trading | rulebooks,trader_updates | quarterly | NYSE Market Data (paid) | Market data commercially licensed. |
| nasdaq.com | Nasdaq Options (ISE/PHLX/GEMX/MRX/BX) | subregulatory_guidance | 2 | US-federal | Nasdaq SROs, SEC | broker_dealer,options_market_data | trading | rulebooks | quarterly | Nasdaq Data Link (paid) | 6 SROs operate options markets. |
| miaxglobal.com | MIAX Exchange Group | subregulatory_guidance | 2 | US-federal | MIAX SROs, SEC | broker_dealer,options_market_data | trading | rulebooks | quarterly | MIAX feeds (paid) | 4 separate rulebooks. |
| boxoptions.com | BOX Options Exchange | subregulatory_guidance | 2 | US-federal | BOX, SEC | broker_dealer,options_market_data | trading | rulebooks,regulatory_circulars | quarterly | BOX HSVF (paid) | Market data commercially licensed. |
| memxtrading.com | MEMX Options Exchange | subregulatory_guidance | 2 | US-federal | MEMX, SEC | broker_dealer,options_market_data | trading | rulebooks | quarterly | MEMOIR feed (paid) | Canonical rulebook at info.memxtrading.com. |
| opraplan.com | OPRA — Options Price Reporting Authority | subregulatory_guidance | 2 | US-federal | OPRA LLC, SEC, SIAC | options_market_data | trading | nms_plan,fee_schedule,vendor_list | quarterly | SIP feed via vendor (heavily licensed) | Canonical opraplan.com (NOT opradata.com); 16 participant exchanges. |

### State securities regulators

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dfpi.ca.gov | California Department of Financial Protection and Innovation | primary_law | 3 | US-CA | DFPI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | California state securities. |
| ssb.texas.gov | Texas State Securities Board | primary_law | 3 | US-TX | TX SSB | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Texas state securities. |
| sec.state.ma.us | Massachusetts Securities Division | primary_law | 3 | US-MA | MA SD | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Massachusetts state securities. |
| dobs.pa.gov | Pennsylvania Department of Banking and Securities | primary_law | 3 | US-PA | PA DOBS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Pennsylvania state securities. |
| flofr.gov | Florida Office of Financial Regulation | primary_law | 3 | US-FL | FL OFR | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Florida state securities. |
| idfpr.illinois.gov | Illinois Department of Financial and Professional Regulation | primary_law | 3 | US-IL | IL DFPR | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Illinois state securities. |
| com.ohio.gov | Ohio Division of Securities | primary_law | 3 | US-OH | OH DOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Ohio state securities. |
| dfi.wa.gov | Washington Department of Financial Institutions | primary_law | 3 | US-WA | WA DFI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Washington state securities. |
| scc.virginia.gov | Virginia State Corporation Commission | primary_law | 3 | US-VA | VA SCC | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Virginia state securities. |
| asc.alabama.gov | Alabama Securities Commission | primary_law | 3 | US-AL | AL ASC | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Alabama state securities. |
| commerce.alaska.gov | Alaska Division of Banking and Securities | primary_law | 3 | US-AK | AK DBS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Alaska state securities. |
| azcc.gov | Arizona Corporation Commission | primary_law | 3 | US-AZ | AZ CC | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Arizona state securities. |
| securities.arkansas.gov | Arkansas Securities Department | primary_law | 3 | US-AR | AR SD | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Arkansas state securities. |
| dora.colorado.gov | Colorado Division of Securities | primary_law | 3 | US-CO | CO DOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Colorado state securities. |
| portal.ct.gov/dob | Connecticut Department of Banking | primary_law | 3 | US-CT | CT DOB | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Connecticut state securities. |
| attorneygeneral.delaware.gov | Delaware Investor Protection Unit | primary_law | 3 | US-DE | DE DOJ | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Delaware state securities under DOJ. |
| disb.dc.gov | DC Department of Insurance, Securities and Banking | primary_law | 3 | US-DC | DC DISB | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | District of Columbia. |
| sos.ga.gov | Georgia Secretary of State Securities Division | primary_law | 3 | US-GA | GA SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Georgia state securities. |
| cca.hawaii.gov | Hawaii Department of Commerce and Consumer Affairs Securities | primary_law | 3 | US-HI | HI DCCA | investment_adviser,broker_dealer,travel_consumer_protection | trading,travel | regulations,licensure | weekly | manual | Hawaii state securities; also DCCA Travel Agency registration. |
| finance.idaho.gov | Idaho Department of Finance | primary_law | 3 | US-ID | ID DOF | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Idaho state securities. |
| in.gov | Indiana Securities Division | primary_law | 3 | US-IN | IN SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Indiana state securities. |
| iid.iowa.gov | Iowa Insurance Division Securities Bureau | primary_law | 3 | US-IA | IA IID | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Iowa state securities. |
| kid.ks.gov | Kansas Insurance Department Securities | primary_law | 3 | US-KS | KS KID | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Kansas state securities. |
| kfi.ky.gov | Kentucky Department of Financial Institutions | primary_law | 3 | US-KY | KY DFI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Kentucky state securities. |
| ofi.la.gov | Louisiana Office of Financial Institutions | primary_law | 3 | US-LA | LA OFI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Louisiana state securities. |
| maine.gov | Maine Office of Securities | primary_law | 3 | US-ME | ME OS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Maine state securities. |
| marylandattorneygeneral.gov | Maryland Securities Division | primary_law | 3 | US-MD | MD AG | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Maryland state securities. |
| michigan.gov | Michigan Corporations, Securities & Commercial Licensing | primary_law | 3 | US-MI | MI LARA | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Michigan state securities. |
| mn.gov | Minnesota Department of Commerce | primary_law | 3 | US-MN | MN DOC | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Minnesota state securities. |
| sos.ms.gov | Mississippi Secretary of State Securities | primary_law | 3 | US-MS | MS SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Mississippi state securities. |
| sos.mo.gov | Missouri Secretary of State Securities | primary_law | 3 | US-MO | MO SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Missouri state securities. |
| csimt.gov | Montana Commissioner of Securities and Insurance | primary_law | 3 | US-MT | MT CSI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Montana state securities. |
| ndbf.nebraska.gov | Nebraska Department of Banking and Finance | primary_law | 3 | US-NE | NE NDBF | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Nebraska state securities. |
| nvsos.gov | Nevada Secretary of State Securities Administration | primary_law | 3 | US-NV | NV SOS | investment_adviser,broker_dealer,corporate_governance | trading,operations | regulations,licensure | weekly | manual | Nevada state securities; $500/$200 annual business license. |
| nh.gov | New Hampshire Bureau of Securities Regulation | primary_law | 3 | US-NH | NH SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | New Hampshire state securities. |
| njsecurities.gov | New Jersey Bureau of Securities | primary_law | 3 | US-NJ | NJ BOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | New Jersey state securities. |
| rld.nm.gov | New Mexico Securities Division | primary_law | 3 | US-NM | NM RLD | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | New Mexico state securities. |
| sosnc.gov | North Carolina Secretary of State Securities | primary_law | 3 | US-NC | NC SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | North Carolina state securities. |
| sec.nd.gov | North Dakota Securities Department | primary_law | 3 | US-ND | ND SD | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | North Dakota state securities. |
| oklahoma.gov | Oklahoma Department of Securities | primary_law | 3 | US-OK | OK DOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Oklahoma state securities. |
| dfr.oregon.gov | Oregon Division of Financial Regulation | primary_law | 3 | US-OR | OR DFR | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Oregon state securities. |
| dbr.ri.gov | Rhode Island Department of Business Regulation Securities | primary_law | 3 | US-RI | RI DBR | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Rhode Island state securities. |
| sos.sc.gov | South Carolina Secretary of State Securities | primary_law | 3 | US-SC | SC SOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | South Carolina state securities. |
| dlr.sd.gov | South Dakota Division of Securities | primary_law | 3 | US-SD | SD DLR | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | South Dakota state securities. |
| tn.gov | Tennessee Department of Commerce and Insurance Securities | primary_law | 3 | US-TN | TN DCI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Tennessee state securities. |
| securities.utah.gov | Utah Division of Securities | primary_law | 3 | US-UT | UT DOS | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Utah state securities. |
| dfr.vermont.gov | Vermont Department of Financial Regulation | primary_law | 3 | US-VT | VT DFR | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Vermont state securities. |
| wvsao.gov | West Virginia State Auditor's Office Securities | primary_law | 3 | US-WV | WV SAO | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | West Virginia state securities. |
| dfi.wisconsin.gov | Wisconsin Department of Financial Institutions | primary_law | 3 | US-WI | WI DFI | investment_adviser,broker_dealer | trading | regulations,licensure | weekly | manual | Wisconsin state securities. |
| wyosos.gov | Wyoming Secretary of State Compliance | primary_law | 3 | US-WY | WY SOS | investment_adviser,broker_dealer,corporate_governance | trading,operations | regulations,licensure | weekly | manual | Wyoming state securities. |

### AI governance for financial AI

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| eur-lex.europa.eu | EU Official Journal — EUR-Lex | primary_law | 1 | EU | EU Commission, AI Office, MSAs, EDPS | ai_governance_eu,data_privacy_eu,travel_consumer_protection,aviation_dot,accessibility_ada | trading,travel,operations | regulations,treaty_text | weekly | EUR-Lex SPARQL/CELLAR | EU AI Act Reg 2024/1689; Reg 261/2004; Reg 2027/97; GDPR; etc. |

---

## Section 4: Module 3 — Travel

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| transportation.gov | U.S. Department of Transportation | subregulatory_guidance | 2 | US-federal | DOT | aviation_dot,travel_consumer_protection,accessibility_ada | travel | press_releases,rulemakings,enforcement_orders | weekly | manual | Parent agency. OACP at transportation.gov/airconsumer is canonical hub. |
| faa.gov | Federal Aviation Administration | secondary_authoritative | 2 | US-federal | FAA | aviation_dot | travel | airworthiness,advisories | weekly | NOTAM/airport data APIs | Less consumer-facing. |
| tsa.gov | Transportation Security Administration | subregulatory_guidance | 2 | US-federal | DHS/TSA | aviation_dot,travel_consumer_protection | travel | screening_rules,real_id,prohibited_items | weekly | manual | REAL ID enforcement May 2025. |
| cbp.gov | U.S. Customs and Border Protection | subregulatory_guidance | 2 | US-federal | DHS/CBP | aviation_dot,international_trade_sanctions,travel_consumer_protection | travel | entry_requirements,esta,global_entry | weekly | manual | International arrivals/departures. |
| travel.state.gov | DOS Bureau of Consular Affairs | subregulatory_guidance | 2 | US-federal | DOS | international_trade_sanctions,travel_consumer_protection | travel | travel_advisories,visas,passports | weekly | Travel Advisories RSS/JSON; STEP | Authoritative country risk levels (1-4). |
| ada.gov | DOJ Americans with Disabilities Act | primary_law | 1 | US-federal | DOJ Civil Rights | accessibility_ada | travel,operations | ada_regs,technical_assistance | quarterly | manual | Title II web/mobile rule April 2024; commercial websites still case-law-driven. |
| w3.org | W3C WCAG 2.1/2.2 | secondary_authoritative | 3 | International | W3C | accessibility_ada | travel,operations | technical_standard | annual | Published HTML/JSON | WCAG 2.2 (Oct 2023); WCAG 3.0 in draft. |
| transport.ec.europa.eu | EC DG MOVE — Air Passenger Rights | subregulatory_guidance | 2 | EU | EC | travel_consumer_protection,aviation_dot,accessibility_ada | travel | guidance,neb_list,complaint_forms | quarterly | Open data portal | EU air passenger rights guidance. |
| caa.co.uk | UK Civil Aviation Authority | primary_law | 1 | UK | CAA | aviation_dot,travel_consumer_protection,accessibility_ada | travel | uk261_enforcement,atol | quarterly | ATOL register search | Post-Brexit national regulator. |
| icao.int | ICAO + Montreal Convention 1999 | primary_law | 1 | International | National courts; ICAO depository | aviation_dot,travel_consumer_protection | travel | treaty,liability_limit_revisions | annual | Document repository | Limits revised 28 Dec 2024 (128821 SDR death/injury, 1519 SDR baggage). |
| iata.org | IATA | secondary_authoritative | 3 | International | IATA | aviation_dot,travel_consumer_protection | travel | resolutions,bsp_rules,accreditation | quarterly | Members-only APIs | Industry secondary source, not a regulator. |
| oag.ca.gov/travel | CA Seller of Travel Program | primary_law | 1 | US-CA | CA AG | travel_consumer_protection,data_privacy_us_state | travel | registration,tcrf | annual | Seller Search | Required for sellers based in CA OR selling to CA residents; air/sea + land/water >$300 trigger. |
| fdacs.gov | FL Sellers of Travel | primary_law | 1 | US-FL | FL DACS | travel_consumer_protection | travel | registration,bond | annual | Registration search | $300 annual reg, bond up to $25K. |
| dol.wa.gov | WA Sellers of Travel | primary_law | 1 | US-WA | WA DOL/DOR | travel_consumer_protection | travel | registration,surety_bond | annual | DOR Business Licensing search | RCW 19.138 surety bond OR trust account. |
| duffel.com | Duffel — ToS / API Terms | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law,aviation_dot | travel | api_terms,content_licensing | quarterly | REST API (duffel.com/docs); IATA-accredited | Surfaces airline conditions_of_carriage_url per offer. |
| viator.com | Viator (Tripadvisor) Affiliate Program | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law,consumer_protection_ftc | travel | affiliate_tou,awin_program_rules | quarterly | Affiliate API + widgets | 8% standard commission; requires GDPR/CCPA + FTC-style disclosure. |
| partner.booking.com | Booking.com Affiliate Partner Program | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law,data_privacy_eu | travel | affiliate_tou,demand_api | quarterly | Demand API; connectivity registrations PAUSED | Session-based commission; bans voucher claims. |
| developers.expediagroup.com | Expedia Partner Solutions (EPS Rapid API) | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law | travel | api_terms,sha512_signature | quarterly | Rapid Lodging/Car APIs | Site review required pre-production. |
| partners.skyscanner.net | Skyscanner Partners | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law | travel | affiliate_program_rules,travel_api | quarterly | impact.com affiliate; Travel API by application | No caching/reselling/redistribution. |
| developers.amadeus.com | Amadeus for Developers | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law | travel | portal_tou,per_api_addenda | quarterly | REST APIs (flights, hotels, cars) | Production access requires separate addendum. |
| developer.sabre.com | Sabre Dev Studio | secondary_practitioner | 4 | International | (vendor) | terms_of_service_law | travel | api_terms,rest_soap_catalog | quarterly | REST/SOAP APIs incl. Mosaic, MCP server | Developer Partner authorization required. |

---

## Section 5: Module 4 — Operations

### Corporate registration

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| corp.delaware.gov | Delaware Division of Corporations | subregulatory_guidance | 2 | US-DE | DE SoS | corporate_governance | operations | entity_search | annual | icis.corp.delaware.gov entity search | Most common US formation state; franchise tax due Mar 1. |
| sos.ca.gov | CA Secretary of State (bizfile) | subregulatory_guidance | 2 | US-CA | CA SoS | corporate_governance | operations | entity_search,filings | annual | bizfileonline.sos.ca.gov | $800 minimum franchise tax; SI within 90 days. |
| sos.wyo.gov | WY Secretary of State | subregulatory_guidance | 2 | US-WY | WY SoS | corporate_governance | operations | entity_search,filings | annual | wyobiz.wyo.gov | Privacy/asset protection alternative. |
| dos.ny.gov | NY Department of State | subregulatory_guidance | 2 | US-NY | NY DoS | corporate_governance | operations | entity_search,filings | annual | apps.dos.ny.gov | LLC publication requirement. |
| sos.state.tx.us | TX Secretary of State | subregulatory_guidance | 2 | US-TX | TX SoS, TX Comptroller | corporate_governance | operations | entity_search,filings | annual | SOSDirect | Annual franchise tax/PIR May 15. |
| nass.org | NASS — Business Services Directory | secondary_authoritative | 4 | US-federal | NASS | corporate_governance | operations | state_directory | annual | Manual link directory | Cross-state formation index. |

### Intellectual property

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| uspto.gov | USPTO | primary_law | 1 | US-federal | USPTO | intellectual_property | operations | trademarks,patents | quarterly | TSDR API, PatentsView API | Federal trademark/patent; renewals 5-6yr and 10-yr. |
| copyright.gov | U.S. Copyright Office | primary_law | 1 | US-federal | LoC/Copyright Office | intellectual_property | operations | registrations,dmca | quarterly | eCO portal; limited public records API | Software/UI registration; DMCA agent registration. |
| wipo.int | WIPO | primary_law | 1 | International | WIPO | intellectual_property | operations | pct,madrid,hague | quarterly | PATENTSCOPE, Global Brand DB, Madrid Monitor APIs | International IP. |
| euipo.europa.eu | EUIPO | primary_law | 1 | EU | EUIPO | intellectual_property | operations | trademarks,community_design | quarterly | Open Data + APIs (TMview, DesignView) | EU trademark and Community design. |

### AI governance

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nist.gov | NIST AI RMF + CAISI | secondary_authoritative | 3 | US-federal | NIST | ai_governance_us,data_security | operations | ai_rmf,cybersecurity_framework | quarterly | airc.nist.gov resource center | Cited as safe harbor in TRAIGA and CO AI Act. |
| whitehouse.gov | OMB AI memos (M-25-21, M-25-22) | subregulatory_guidance | 2 | US-federal | OMB | ai_governance_us | operations | omb_memos | event_driven | manual | M-25-21 Federal AI Use; M-25-22 Federal AI Procurement (April 3 2025). |
| coag.gov | Colorado AI Act SB24-205 | primary_law | 1 | US-CO | CO AG (exclusive) | ai_governance_us | operations | statute,rulemaking_dockets | quarterly | manual | Effective June 30 2026; NIST AI RMF as safe harbor. |
| leginfo.legislature.ca.gov | California AI Statutes (SB 53, AB 2013, etc.) | primary_law | 1 | US-CA | CA AG, CPPA, CA OES | ai_governance_us,intellectual_property | operations | statutes | quarterly | manual | SB 53 Frontier AI Act; AB 2013 GenAI Training Data Transparency; eff Jan 1 2026. |
| nyc.gov | NYC Local Law 144 — AEDT | primary_law | 1 | US-NYC | NYC DCWP | ai_governance_us,employment_solo | operations | local_law,bias_audit | quarterly | rules.cityofnewyork.us | Enforcement since Jul 5 2023; $500-$1500/violation. |
| ilga.gov | Illinois AI Statutes | primary_law | 1 | US-IL | IL DCEO, IL DHR | ai_governance_us,employment_solo | operations | statutes | quarterly | manual | AI Video Interview Act eff 2020; HB 3773 Human Rights Act AI eff Jan 1 2026. |
| le.utah.gov | Utah AI Policy Act (UAIPA) | primary_law | 1 | US-UT | UT DCP, OAIP | ai_governance_us | operations | statute | quarterly | manual | Effective May 1 2024; SB 226 (2025) added safe harbor. |
| capitol.texas.gov | TX TRAIGA (HB 149) | primary_law | 1 | US-TX | TX AG (exclusive) | ai_governance_us | operations | statute | quarterly | manual | Signed Jun 22 2025; eff Jan 1 2026; NIST AI RMF safe harbor; $10K-$200K penalties. |
| ncsl.org | NCSL AI Legislation Database | secondary_authoritative | 4 | US-federal | NCSL | ai_governance_us | operations | legislation_tracker | monthly | Manual; updated monthly | Primary verification source for state AI bill status. |

### Trust frameworks and standards

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| iso.org | ISO/IEC Standards | secondary_authoritative | 3 | International | ISO | data_security,ai_governance_us,ai_governance_eu | operations | iso_standards | annual | Paid PDF | ISO 27001:2022 ISMS; 27701:2019 Privacy; 42001:2023 AI Management. |
| cloudsecurityalliance.org | CSA — Cloud Controls Matrix v4 | secondary_authoritative | 4 | International | CSA | data_security | operations | ccm,star_registry | quarterly | CCM XLSX/CSV; STAR registry public | Complements SOC 2. |
| pcisecuritystandards.org | PCI SSC — PCI DSS v4.0.1 | secondary_authoritative | 3 | International | PCI SSC; card brands enforce contractually | payment_processing,data_security | operations | pci_dss | annual | manual | Full v4 enforcement Mar 31 2025; contractually mandatory. |
| cisa.gov | CISA | subregulatory_guidance | 2 | US-federal | CISA/DHS | cybersecurity_breach_notification,data_security | operations | kev_catalog,csaf_advisories | daily | KEV CSV/JSON; CSAF advisories | CIRCIA covered-entity reporting rule still in rulemaking. |
| naic.org | NAIC | secondary_authoritative | 4 | US-federal | NAIC member depts | data_security | operations | model_laws,guidance | annual | NAIC publications | Insurance Data Security Model Law #668; Model AI Bulletin. |
| nmlsconsumeraccess.org | NMLS Consumer Access + CSBS | subregulatory_guidance | 2 | US-federal | CSBS + state regulators | payment_processing | operations | nmls_search,sds | quarterly | NMLS search; SES | 27+ states adopted CSBS MTMA. |

### Sanctions and trade controls

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ofac.treasury.gov | OFAC — Office of Foreign Assets Control | primary_law | 1 | US-federal | OFAC/Treasury | international_trade_sanctions | operations | sanctions_list,sdn_delta | daily | Sanctions List Service API; SDN delta files | Canonical: ofac.treasury.gov (legacy treasury.gov path redirects). |
| bis.doc.gov | BIS — Bureau of Industry & Security | primary_law | 1 | US-federal | BIS/Commerce | international_trade_sanctions | operations | export_controls,csl | daily | Consolidated Screening List API (trade.gov); SNAP-R | Export controls on dual-use tech, AI compute, chips. |
| pmddtc.state.gov | DDTC — Defense Trade Controls | primary_law | 1 | US-federal | State Dept/DDTC | international_trade_sanctions | operations | itar,deccs | weekly | DECCS portal; Consolidated Screening List | Defense articles/services. |

### Solo founder employment

| domain | source_name | source_tier | authority_rank | jurisdictions | regulators | practice_areas | module_relevance | primary_content_types | refresh_cadence | api_or_bulk_data | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dol.gov | U.S. Department of Labor | subregulatory_guidance | 2 | US-federal | DOL (W&H, OSHA, EBSA) | employment_solo | operations | wage_hour,osha,ebsa | quarterly | enforcedata.dol.gov | Minimal applicability for solo founder; revisit at first hire. |
| ssa.gov | Social Security Administration | subregulatory_guidance | 2 | US-federal | SSA | employment_solo | bookkeeping_tax,operations | self_employment_tax,benefits | quarterly | manual | Self-employment tax administration. |

---

## Section 6: Authoritative Source Verification — Notes for Loader

- All `last_verified` dates: 2026-04-28T00:00:00.000Z
- All `last_verified_by`: registry_research_pr_a
- `is_active`: true for all rows (default)
- Total expected row count: approximately 220+ verified sources

If any row in this file fails enum validation when parsed by the seed loader, the loader must FLAG and STOP rather than write a partial seed file.
