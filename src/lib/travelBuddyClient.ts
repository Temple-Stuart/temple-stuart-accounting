// ─── Travel Buddy — Visa Requirements client (via RapidAPI) ──────────────────
// Thin client for the Travel Buddy Visa Requirements API. ONE call:
// getVisaRequirement(passportIso2, destinationIso2) → POST /v2/visa/check →
// normalized VisaRequirement. DATA + an affiliate handoff (not bookable
// inventory). Mirrors the viatorClient/liteapiClient structure: key from env →
// base/host → fetch → normalizer → typed errors. Fail-loud: missing key throws
// MissingVisaKeyError; any non-2xx (or unexpected body) throws TravelBuddyApiError.
//
// NOT wired into any route — PR-V2 adds the public guarded route.
//
// CONFIRMED CONTRACT (verified live):
//   POST https://visa-requirement.p.rapidapi.com/v2/visa/check
//   Headers: X-RapidAPI-Key, X-RapidAPI-Host, Content-Type: x-www-form-urlencoded
//   Body (form): passport=<ISO2>&destination=<ISO2>
//   Response: data.{passport, destination, mandatory_registration?, visa_rules.
//     {primary_rule, secondary_rule?, exception_rule?}}, meta.{generated_at}

import { MissingVisaKeyError, TravelBuddyApiError } from './travelErrors';

const DEFAULT_HOST = 'visa-requirement.p.rapidapi.com';
const ENDPOINT = '/v2/visa/check';

// ─── Normalized shape (maps ONLY confirmed real response fields) ─────────────

/** One visa rule (primary / secondary / exception). `name` + `color` come from
 *  the rule; `duration` and `link` may be absent depending on the rule. */
export interface VisaRule {
  name: string;
  duration?: string;
  color?: string;
  link?: string;
}

export interface VisaRequirement {
  passport: { code: string; name: string };
  destination: {
    code: string;
    name: string;
    capital?: string;
    currency?: string;
    phoneCode?: string;
    passportValidity?: string;
    embassyUrl?: string;
  };
  /** Present only when the destination mandates a registration/authorization. */
  mandatoryRegistration?: { name: string; color?: string; link?: string };
  /** The headline rule (always present on a valid lookup). */
  primary: VisaRule;
  secondary?: VisaRule;
  exception?: VisaRule;
  /** meta.generated_at, when provided. */
  generatedAt?: string;
}

// ─── Raw response (loose — only the fields we read are typed) ─────────────────

interface RawRule {
  name?: string;
  duration?: string;
  color?: string;
  link?: string;
}

interface RawVisaResponse {
  data?: {
    passport?: { code?: string; name?: string };
    destination?: {
      code?: string;
      name?: string;
      capital?: string;
      currency?: string;
      phone_code?: string;
      passport_validity?: string;
      embassy_url?: string;
    };
    mandatory_registration?: { name?: string; color?: string; link?: string };
    visa_rules?: {
      primary_rule?: RawRule;
      secondary_rule?: RawRule;
      exception_rule?: RawRule;
    };
  };
  meta?: { generated_at?: string };
}

/** Normalize one raw rule → VisaRule, keeping `duration`/`color`/`link` only when
 *  present (they're optional in the contract). `name` is required. */
function normalizeRule(raw: RawRule): VisaRule {
  return {
    name: raw.name ?? '',
    ...(raw.duration != null ? { duration: raw.duration } : {}),
    ...(raw.color != null ? { color: raw.color } : {}),
    ...(raw.link != null ? { link: raw.link } : {}),
  };
}

/** Fetch + normalize the visa requirement for a (passport, destination) ISO-2
 *  pair. Throws MissingVisaKeyError if the key is unset, TravelBuddyApiError on
 *  any non-2xx or an unexpected/empty body. No silent fallback. */
export async function getVisaRequirement(
  passportIso2: string,
  destinationIso2: string,
): Promise<VisaRequirement> {
  const key = process.env.RAPIDAPI_VISA_KEY;
  if (!key) throw new MissingVisaKeyError();
  const host = process.env.RAPIDAPI_VISA_HOST || DEFAULT_HOST;

  const body = new URLSearchParams({
    passport: passportIso2.trim().toUpperCase(),
    destination: destinationIso2.trim().toUpperCase(),
  }).toString();

  const res = await fetch(`https://${host}${ENDPOINT}`, {
    method: 'POST',
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': host,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    // Fail-loud: surface the provider's status (401 auth/quota, 404 no data,
    // 422 validation, 429 rate) + truncated body — never a "no result" default.
    throw new TravelBuddyApiError(ENDPOINT, res.status, await res.text().catch(() => undefined));
  }

  const json = (await res.json().catch(() => null)) as RawVisaResponse | null;
  const data = json?.data;
  const rawPrimary = data?.visa_rules?.primary_rule;

  // A valid lookup must carry passport, destination, and a primary rule. A 200
  // missing these is a malformed response → fail loud, don't synthesize.
  if (!data?.passport?.code || !data?.destination?.code || !rawPrimary?.name) {
    throw new TravelBuddyApiError(ENDPOINT, res.status, 'unexpected response: missing passport/destination/primary rule');
  }

  const d = data.destination!;
  const mr = data.mandatory_registration;
  const secondary = data.visa_rules?.secondary_rule;
  const exception = data.visa_rules?.exception_rule;

  return {
    passport: { code: data.passport.code!, name: data.passport.name ?? '' },
    destination: {
      code: d.code!,
      name: d.name ?? '',
      ...(d.capital != null ? { capital: d.capital } : {}),
      ...(d.currency != null ? { currency: d.currency } : {}),
      ...(d.phone_code != null ? { phoneCode: d.phone_code } : {}),
      ...(d.passport_validity != null ? { passportValidity: d.passport_validity } : {}),
      ...(d.embassy_url != null ? { embassyUrl: d.embassy_url } : {}),
    },
    ...(mr?.name != null
      ? {
          mandatoryRegistration: {
            name: mr.name,
            ...(mr.color != null ? { color: mr.color } : {}),
            ...(mr.link != null ? { link: mr.link } : {}),
          },
        }
      : {}),
    primary: normalizeRule(rawPrimary),
    ...(secondary?.name != null ? { secondary: normalizeRule(secondary) } : {}),
    ...(exception?.name != null ? { exception: normalizeRule(exception) } : {}),
    ...(json?.meta?.generated_at != null ? { generatedAt: json.meta.generated_at } : {}),
  };
}
