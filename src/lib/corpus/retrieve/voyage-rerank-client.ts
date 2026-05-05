/**
 * src/lib/corpus/retrieve/voyage-rerank-client.ts
 *
 * HTTP client for the Voyage AI rerank endpoint.
 *
 * Endpoint: POST https://api.voyageai.com/v1/rerank
 * Model: rerank-2 (architecture doc § 1.6)
 * Auth: Bearer VOYAGE_API_KEY (same key as embedding endpoint)
 *
 * Retry behavior mirrors voyage-client.ts exactly:
 *   - 429: exponential backoff (1s, 2s, 4s, 8s), max 4 retries
 *   - 5xx: single retry after 1s
 *   - 4xx (other): fail loud
 */

const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const USER_AGENT =
  'TempleStuart-Compliance/1.0 (+https://templestuart.com; institutional-grade-corpus)';

const MAX_RATE_LIMIT_RETRIES = 4;
const SERVER_ERROR_RETRIES = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface VoyageRerankRequest {
  query: string;
  documents: string[];
  model: string;
  top_k?: number;
}

export interface VoyageRerankItem {
  relevance_score: number;
  index: number;
}

export interface VoyageRerankResponse {
  object: 'list';
  model: string;
  data: VoyageRerankItem[];
  usage: { total_tokens: number };
}

export class VoyageRerankError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Voyage Rerank ${status}: ${detail}`);
    this.name = 'VoyageRerankError';
    this.status = status;
    this.detail = detail;
  }
}

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      'VOYAGE_API_KEY environment variable is not set. ' +
        'Required for rerank endpoint.'
    );
  }
  return key;
}

/**
 * Rerank a list of documents against a query using Voyage rerank-2.
 * Returns relevance-sorted indices into the original documents array.
 */
export async function rerankDocuments(
  request: VoyageRerankRequest
): Promise<VoyageRerankResponse> {
  const apiKey = getApiKey();
  const url = `${VOYAGE_API_BASE}/rerank`;

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

    if (response.ok) {
      const body = (await response.json()) as VoyageRerankResponse;
      if (!body || !Array.isArray(body.data)) {
        throw new VoyageRerankError(
          response.status,
          'unexpected response shape: missing data[]'
        );
      }
      return body;
    }

    let detail = 'no response body';
    try {
      const errBody = (await response.json()) as { detail?: string };
      detail = errBody.detail ?? JSON.stringify(errBody);
    } catch {
      detail = await response.text().catch(() => 'response not readable');
    }

    if (response.status === 429) {
      if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
        throw new VoyageRerankError(429, `rate limit after retries: ${detail}`);
      }
      const backoffMs = 1000 * Math.pow(2, rateLimitRetries);
      await sleep(backoffMs);
      rateLimitRetries++;
      continue;
    }

    if (response.status >= 500) {
      if (serverErrorRetries >= SERVER_ERROR_RETRIES) {
        throw new VoyageRerankError(
          response.status,
          `server error after retry: ${detail}`
        );
      }
      await sleep(1000);
      serverErrorRetries++;
      continue;
    }

    throw new VoyageRerankError(response.status, detail);
  }
}
