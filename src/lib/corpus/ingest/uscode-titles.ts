/**
 * src/lib/corpus/ingest/uscode-titles.ts
 *
 * Hardcoded list of all 54 U.S. Code titles. Source-of-truth:
 * https://uscode.house.gov/download/download.shtml
 *
 * The U.S. Code title list has been stable since 2014 (when titles
 * 53 and 54 were added). Adding a new title is a major federal
 * legislative event. If a 55th title is ever enacted, this list
 * MUST be updated in a dedicated PR with audit-log evidence of the
 * Public Law adding the title.
 *
 * Positive-law status matters for citation precedence:
 *   - Positive-law titles ARE the law (Bluebook prefers these)
 *   - Non-positive-law titles are PRIMA FACIE evidence of the law,
 *     with the underlying Statutes at Large being controlling.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.1
 * (USC source row, regulatory_sources, primary_law tier)
 */

export interface UscodeTitle {
  /** Title number (1-54) */
  number: number;

  /** Title name as it appears at the top of the USLM document */
  name: string;

  /**
   * Whether this title has been enacted as positive law.
   * Positive-law titles are the controlling text of federal law.
   * Non-positive titles are prima facie evidence; the Statutes at
   * Large remain controlling.
   */
  positive_law: boolean;
}

/**
 * Stable list of all 54 U.S. Code titles. Last verified 2026-04-28
 * against uscode.house.gov/download/download.shtml.
 *
 * Source for positive-law status: 1 U.S.C. § 204 enacting clauses
 * and the OLRC's positive-law table.
 */
export const USCODE_TITLES: UscodeTitle[] = [
  { number: 1, name: 'General Provisions', positive_law: true },
  { number: 2, name: 'The Congress', positive_law: false },
  { number: 3, name: 'The President', positive_law: true },
  { number: 4, name: 'Flag and Seal, Seat of Government, and the States', positive_law: true },
  { number: 5, name: 'Government Organization and Employees', positive_law: true },
  { number: 6, name: 'Domestic Security', positive_law: false },
  { number: 7, name: 'Agriculture', positive_law: false },
  { number: 8, name: 'Aliens and Nationality', positive_law: false },
  { number: 9, name: 'Arbitration', positive_law: true },
  { number: 10, name: 'Armed Forces', positive_law: true },
  { number: 11, name: 'Bankruptcy', positive_law: true },
  { number: 12, name: 'Banks and Banking', positive_law: false },
  { number: 13, name: 'Census', positive_law: true },
  { number: 14, name: 'Coast Guard', positive_law: true },
  { number: 15, name: 'Commerce and Trade', positive_law: false },
  { number: 16, name: 'Conservation', positive_law: false },
  { number: 17, name: 'Copyrights', positive_law: true },
  { number: 18, name: 'Crimes and Criminal Procedure', positive_law: true },
  { number: 19, name: 'Customs Duties', positive_law: false },
  { number: 20, name: 'Education', positive_law: false },
  { number: 21, name: 'Food and Drugs', positive_law: false },
  { number: 22, name: 'Foreign Relations and Intercourse', positive_law: false },
  { number: 23, name: 'Highways', positive_law: true },
  { number: 24, name: 'Hospitals and Asylums', positive_law: false },
  { number: 25, name: 'Indians', positive_law: false },
  { number: 26, name: 'Internal Revenue Code', positive_law: false },
  { number: 27, name: 'Intoxicating Liquors', positive_law: false },
  { number: 28, name: 'Judiciary and Judicial Procedure', positive_law: true },
  { number: 29, name: 'Labor', positive_law: false },
  { number: 30, name: 'Mineral Lands and Mining', positive_law: false },
  { number: 31, name: 'Money and Finance', positive_law: true },
  { number: 32, name: 'National Guard', positive_law: true },
  { number: 33, name: 'Navigation and Navigable Waters', positive_law: false },
  { number: 34, name: 'Crime Control and Law Enforcement', positive_law: false },
  { number: 35, name: 'Patents', positive_law: true },
  { number: 36, name: 'Patriotic and National Observances, Ceremonies, and Organizations', positive_law: true },
  { number: 37, name: 'Pay and Allowances of the Uniformed Services', positive_law: true },
  { number: 38, name: 'Veterans Benefits', positive_law: true },
  { number: 39, name: 'Postal Service', positive_law: true },
  { number: 40, name: 'Public Buildings, Property, and Works', positive_law: true },
  { number: 41, name: 'Public Contracts', positive_law: true },
  { number: 42, name: 'The Public Health and Welfare', positive_law: false },
  { number: 43, name: 'Public Lands', positive_law: false },
  { number: 44, name: 'Public Printing and Documents', positive_law: true },
  { number: 45, name: 'Railroads', positive_law: false },
  { number: 46, name: 'Shipping', positive_law: true },
  { number: 47, name: 'Telecommunications', positive_law: false },
  { number: 48, name: 'Territories and Insular Possessions', positive_law: false },
  { number: 49, name: 'Transportation', positive_law: true },
  { number: 50, name: 'War and National Defense', positive_law: false },
  { number: 51, name: 'National and Commercial Space Programs', positive_law: true },
  { number: 52, name: 'Voting and Elections', positive_law: true },
  { number: 53, name: 'Small Business', positive_law: true },
  { number: 54, name: 'National Park Service and Related Programs', positive_law: true },
  // Title 5 Appendix — published separately by OLRC at usc05a.xml.
  // Cited as "5 U.S.C. App." per Bluebook. Treated as its own corpus
  // entry to preserve source granularity (Renaissance principle:
  // distinct legal documents are not collapsed). Number 55 is an
  // internal sentinel; the canonical filename suffix is "5A".
  { number: 55, name: 'Title 5 Appendix', positive_law: false },
];

/**
 * Build the canonical ZIP download URL for one USC title at one
 * release point.
 *
 * URL pattern (verified 2026-05 via reconnaissance against the OLRC
 * download.shtml index):
 *   https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{plno}/xml_usc{NN}@{congress}-{plno}.zip
 *
 * Filename convention (from recon):
 *   - Titles 1-54: zero-padded number (usc01, usc02, ..., usc54)
 *   - Title 5 Appendix: usc05a (special case — internal sentinel
 *     number is 55, but the URL uses '5a')
 *
 * @param congress Congress number (e.g. 119)
 * @param plno Public Law number within that Congress (e.g. 84)
 * @param titleNumber USC title number (1-55, where 55 is Title 5 Appendix)
 * @returns the full ZIP URL
 */
export function xmlUrlForTitle(
  congress: number,
  plno: number,
  titleNumber: number
): string {
  const fileSuffix = titleNumber === 55 ? '5a' : String(titleNumber).padStart(2, '0');
  return (
    `https://uscode.house.gov/download/releasepoints/us/pl/` +
    `${congress}/${plno}/xml_usc${fileSuffix}@${congress}-${plno}.zip`
  );
}

/**
 * Build the URL for the OLRC download index page. This is the page
 * we scrape to discover the latest release point (congress, plno).
 *
 * The index is a static HTML page (despite the JSF chrome wrapper)
 * and contains <a href> links pointing to release-point ZIPs. The
 * highest (congress, plno) pair in the link set is the latest
 * release point.
 */
export function downloadIndexUrl(): string {
  return 'https://uscode.house.gov/download/download.shtml';
}
