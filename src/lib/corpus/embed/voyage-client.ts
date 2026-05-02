/**
 * src/lib/corpus/embed/voyage-client.ts
 *
 * HTTP client for the Voyage AI embeddings API.
 *
 * Endpoint: POST https://api.voyageai.com/v1/embeddings
 *
 * Auth via Authorization: Bearer <key>. Key sourced from
 * VOYAGE_API_KEY environment variable.
 *
 * Retry behavior:
 *   - 429: exponential backoff (1s, 2s, 4s, 8s), max 4 retries
 *   - 5xx: single retry after 1s (per existing PR-G/H/I/J convention)
 *   - 4xx (other than 429): fail loud, no retry
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.2
 */

const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const USER_AGENT =
  'TempleStuart-Compliance/1.0 (+https://templestuart.com; institutional-grade-corpus)';

const MAX_RATE_LIMIT_RETRIES = 4;
const SERVER_ERROR_RETRIES = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface VoyageEmbeddingRequest {
  /** Inputs to embed. 1-1000 strings per request, 32K tokens max each. */
  input: string[];
  /** Model name, e.g. "voyage-3.5". Per architecture doc § 1.2. */
  model: string;
  /** "document" for ingestion, "query" for retrieval-time. */
  input_type: 'document' | 'query';
  /** Output vector dimension. Voyage supports 256, 512, 1024, 2048. */
  output_dimension: number;
}

export interface VoyageEmbeddingData {
  object: 'embedding';
  index: number;
  embedding: number[];
  /** Voyage-specific: echoes the input text. We ignore it. */
  text?: string;
}

export interface VoyageEmbeddingResponse {
  object: 'list';
  model: string;
  data: VoyageEmbeddingData[];
  usage: { total_tokens: number };
}

/**
 * Custom error class so callers can distinguish Voyage failures from
 * generic network errors. All Voyage 4xx/5xx responses raise this.
 */
export class VoyageApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Voyage API ${status}: ${detail}`);
    this.name = 'VoyageApiError';
    this.status = status;
    this.detail = detail;
  }
}

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      'VOYAGE_API_KEY environment variable is not set. ' +
        'Add it to Vercel Production+Preview env vars and redeploy.'
    );
  }
  return key;
}

/**
 * Make one POST to /embeddings with retry logic.
 *
 * Retries on 429 with exponential backoff, retries once on 5xx,
 * fails loud on 4xx.
 */
export async function embedBatch(
  request: VoyageEmbeddingRequest
): Promise<VoyageEmbeddingResponse> {
  const apiKey = getApiKey();
  const url = `${VOYAGE_API_BASE}/embeddings`;

  let rateLimitRetries = 0;
  let serverErrorRetries = 0;

  while (true) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });

    // Success path
    if (response.ok) {
      const body = (await response.json()) as VoyageEmbeddingResponse;
      // Sanity check the shape — fail loud if Voyage changes the contract.
      if (
        !body ||
        !Array.isArray(body.data) ||
        body.data.length === 0 ||
        !Array.isArray(body.data[0].embedding)
      ) {
        throw new VoyageApiError(
          response.status,
          'unexpected response shape: missing data[].embedding'
        );
      }
      // Verify dimension matches request.
      if (body.data[0].embedding.length !== request.output_dimension) {
        throw new VoyageApiError(
          response.status,
          `dimension mismatch: requested ${request.output_dimension}, got ${body.data[0].embedding.length}`
        );
      }
      return body;
    }

    // Read error body for diagnostics
    let detail = 'no response body';
    try {
      const errBody = (await response.json()) as { detail?: string };
      detail = errBody.detail ?? JSON.stringify(errBody);
    } catch {
      detail = await response.text().catch(() => 'response not readable');
    }

    // 429: exponential backoff
    if (response.status === 429) {
      if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
        throw new VoyageApiError(
          429,
          `rate limit exceeded after ${MAX_RATE_LIMIT_RETRIES} retries: ${detail}`
        );
      }
      const backoffMs = 1000 * Math.pow(2, rateLimitRetries);
      await sleep(backoffMs);
      rateLimitRetries++;
      continue;
    }

    // 5xx: single retry
    if (response.status >= 500) {
      if (serverErrorRetries >= SERVER_ERROR_RETRIES) {
        throw new VoyageApiError(
          response.status,
          `server error after retry: ${detail}`
        );
      }
      await sleep(1000);
      serverErrorRetries++;
      continue;
    }

    // 4xx (not 429): permanent failure, fail loud
    throw new VoyageApiError(response.status, detail);
  }
}

/**
 * Estimate cost in USD for a batch given token count.
 *
 * voyage-3.5 pricing per Voyage published rate: $0.06 per 1M input tokens.
 *
 * Renaissance principle: never trust vendor's reported count. Caller
 * should also compute a length-based estimate and take the max for
 * cost ledger entries.
 */
export function estimateCostUsd(
  modelName: string,
  totalTokens: number
): number {
  const ratesPerMillion: Record<string, number> = {
    'voyage-3.5': 0.06,
    'voyage-3.5-lite': 0.02,
    'voyage-3-large': 0.12,
    'voyage-3': 0.06,
    'voyage-3-lite': 0.02,
  };
  const rate = ratesPerMillion[modelName] ?? 0.12; // conservative default
  return (totalTokens / 1_000_000) * rate;
}

/**
 * Conservative token estimate: ~4 chars per token. Used as a floor
 * when Voyage reports suspiciously low totals (we observed
 * total_tokens=0 for short inputs in recon).
 */
export function estimateTokensFromText(texts: string[]): number {
  return Math.ceil(texts.reduce((sum, t) => sum + t.length, 0) / 4);
}
