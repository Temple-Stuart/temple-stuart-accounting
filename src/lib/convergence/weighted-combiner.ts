/**
 * KILL-3: shared EDGE-2 combiner — sum weight×score over the PRESENT
 * (non-null) components only and divide by their summed weight. A missing
 * component is EXCLUDED and the remaining weights renormalize; it is never
 * imputed with a penalty or neutral value. Mirrors the array-based combiner
 * EDGE-2/EDGE-2b built in info-edge.ts (:1313-1334) and EDGE-4 in vol-edge.
 */

export interface WeightedComponent {
  key: string;
  weight: number;
  score: number | null; // null = source data absent → excluded
}

export interface CombineResult {
  /** Renormalized weighted score over present components; null when NONE present. */
  score: number | null;
  activeWeight: number;
  activeCount: number;
  totalCount: number;
  excludedKeys: string[];
}

export function combineWeighted(components: WeightedComponent[]): CombineResult {
  const active = components.filter((c): c is WeightedComponent & { score: number } => c.score !== null);
  const excludedKeys = components.filter(c => c.score === null).map(c => c.key);
  const activeWeight = active.reduce((s, c) => s + c.weight, 0);
  const score = active.length > 0 && activeWeight > 0
    ? Math.round((active.reduce((s, c) => s + c.weight * c.score, 0) / activeWeight) * 10) / 10
    : null;
  return { score, activeWeight, activeCount: active.length, totalCount: components.length, excludedKeys };
}
