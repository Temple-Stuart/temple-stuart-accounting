import { BrainDumpItem, StructureOutput } from './types';

// ============================================
// INPUT
// ============================================

export interface StructureInput {
  brainDumpEntries: BrainDumpItem[];
  missionTitle: string;
  missionDuration: number;
}

// ============================================
// MODEL
// ============================================

export const STRUCTURE_MODEL = 'claude-haiku-4-5-20241022';

// ============================================
// SYSTEM PROMPT
// ============================================

export const STRUCTURE_SYSTEM_PROMPT = `You are a structured thinking analyst. Your job is to take raw, unorganized thoughts from a founder's brain dump and organize them into clear clusters — while also surfacing contradictions, dependencies, logic gaps, and missing information.

You are ORGANIZING and ANALYZING, not advising. Do not recommend, prioritize, or suggest goals.

Rules:

CLUSTERING
- Produce between 4 and 8 clusters unless the data is genuinely too sparse for 4.
- Each cluster must contain at least 2 items unless a single item is truly unique and cannot fit elsewhere.
- Cluster names must be concrete noun phrases specific to the content. Not "General", "Planning", "Important Things", or other vague labels.
- Each cluster gets a one-sentence summary describing what it contains.
- Do not force items into the 6 input buckets (business, technical, constraints, growth, life, open). Those are capture scaffolding, not analytical categories. Create clusters that reflect the actual content.
- Do not collapse materially different ideas into one item for neatness. If two thoughts are distinct, keep them separate.

LINEAGE
- Every output item must reference the sourceEntryId of the original brain dump entry it came from. No orphaned items.
- If an item contains multiple distinct thoughts, split them into separate items under appropriate clusters — each split item still references the original sourceEntryId.

MISSION RELEVANCE
- missionRelevance measures fit to the stated mission title and duration only. Not urgency, not impact, not priority. Just: does this item relate to what this mission is about?

EMERGENT THEMES
- Themes are patterns detected ACROSS clusters — recurring concerns, repeated phrases, underlying anxieties, or implicit priorities.
- Each theme must cite evidence (specific items or cluster names).
- Mark whether the theme is explicit (user stated it directly, multiple times) or pattern_inference (you detected it from patterns they did not state).
- Rate confidence: high (clear repeated signal), medium (probable pattern), low (possible but uncertain).

CONTRADICTIONS
- If two items contradict each other, flag them with both sourceEntryIds. Do not resolve contradictions — that is the user's job.
- Rate severity: high (these cannot both be true and it blocks planning), medium (tension that needs resolution), low (minor inconsistency).

MISSING INPUTS
- If important categories have zero entries, or the user references things without explanation, flag them.
- Each missing input must explain why it matters and provide a specific question the user could answer.

LATENT DEPENDENCIES
- Identify items that cannot happen without another unstated step or prerequisite.
- This is dependency surfacing, not advice. You are saying "if you want X, you need A, B, C" — not "you should do A, B, C."

LOGIC GAPS
- Identify places where the user jumps from desire to outcome without an intermediate mechanism.
- Example: "I want to launch in 30 days" combined with no mention of what is already built equals a logic gap.
- This is gap identification, not criticism.

Prefer traceability over elegance.
Respond with valid JSON only. No markdown, no preamble, no explanation outside the JSON.`;

// ============================================
// USER PROMPT BUILDER
// ============================================

export function buildStructurePrompt(input: StructureInput): string {
  const entriesFormatted = input.brainDumpEntries
    .map((e) => `[${e.id}] (${e.bucket}${e.category ? '/' + e.category : ''}): ${e.content}`)
    .join('\n');

  return `Mission: "${input.missionTitle}" (${input.missionDuration} days)

Brain dump entries (${input.brainDumpEntries.length} total):
${entriesFormatted}

Organize these entries into clusters and analyze for themes, contradictions, dependencies, logic gaps, and missing information.

Return JSON matching this exact schema:

{
  "clusters": [
    {
      "clusterName": "string — concrete noun phrase",
      "summary": "string — one sentence describing this cluster",
      "items": [
        {
          "content": "string — item content, may be lightly rephrased for clarity but preserve meaning",
          "sourceEntryId": "string — the [id] from the brain dump entry",
          "missionRelevance": "high | medium | low"
        }
      ]
    }
  ],
  "uncategorizedItems": [
    {
      "content": "string",
      "sourceEntryId": "string",
      "suggestedCluster": "string"
    }
  ],
  "emergentThemes": [
    {
      "theme": "string",
      "evidence": ["string — specific items or cluster names"],
      "confidence": "high | medium | low",
      "basis": "explicit | pattern_inference"
    }
  ],
  "contradictions": [
    {
      "itemA": { "content": "string", "sourceEntryId": "string" },
      "itemB": { "content": "string", "sourceEntryId": "string" },
      "nature": "string — what the contradiction is",
      "severity": "high | medium | low"
    }
  ],
  "missingInputs": [
    {
      "area": "string — what category of information is missing",
      "whyMissingMatters": "string",
      "suggestedQuestion": "string — exact question to ask the user"
    }
  ],
  "latentDependencies": [
    {
      "item": "string — the brain dump item",
      "dependsOn": ["string — unstated prerequisites"],
      "why": "string"
    }
  ],
  "logicGaps": [
    {
      "statement": "string — what the user said",
      "gap": "string — what is missing between desire and outcome",
      "whyItMatters": "string"
    }
  ]
}`;
}

// ============================================
// RESPONSE PARSER
// ============================================

export function parseStructureResponse(raw: string): StructureOutput {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  const requiredFields = [
    'clusters',
    'uncategorizedItems',
    'emergentThemes',
    'contradictions',
    'missingInputs',
    'latentDependencies',
    'logicGaps',
  ];
  for (const field of requiredFields) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`Structure response missing required array field: ${field}`);
    }
  }

  for (const cluster of parsed.clusters) {
    if (!cluster.clusterName || typeof cluster.clusterName !== 'string') {
      throw new Error('Cluster missing clusterName');
    }
    if (!Array.isArray(cluster.items)) {
      throw new Error(`Cluster "${cluster.clusterName}" missing items array`);
    }
    for (const item of cluster.items) {
      if (!item.sourceEntryId) {
        throw new Error(
          `Item in cluster "${cluster.clusterName}" missing sourceEntryId: ${item.content?.substring(0, 50)}`,
        );
      }
    }
  }

  return parsed as StructureOutput;
}
