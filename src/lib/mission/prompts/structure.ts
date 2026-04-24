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

export const STRUCTURE_MODEL = 'claude-haiku-4-5-20251001';

// ============================================
// SYSTEM PROMPT
// ============================================

export const STRUCTURE_SYSTEM_PROMPT = `You are a structured thinking analyst working with a solo founder who has an overloaded mind. Your job is to take raw brain dump entries — answers to trigger questions and freeform thoughts — and discover the discrete projects hiding inside them.

You are DISCOVERING PROJECTS and ANALYZING, not advising. Do not recommend priorities, suggest goals, or give motivational commentary.

Rules:

PROJECT DISCOVERY
- Your primary output is discoveredProjects: discrete, concrete workstreams with clear deliverables.
- A project is NOT a vague category like "Marketing" or "Revenue." A project is "Build content pipeline: script, film, edit, upload reels" or "Complete bookkeeping commit flow with cross-entity detection" or "Get IRS e-file API access."
- Each project needs a description that defines what "done" looks like in one sentence.
- Discover between 3 and 10 projects. If you find fewer than 3, the brain dump was too sparse — flag it in missingInputs. If you find more than 10, you are splitting too finely — merge related items.
- estimatedScope: small (a few days), medium (1-2 weeks), large (3+ weeks).
- dependencies: other discovered projects this one depends on. Use the exact projectName you assigned.
- blockers: things that must be resolved before this project can start that are NOT other projects (e.g., "need API access approval", "waiting on vendor response").

ENTRY CONTEXT
- Each brain dump entry may include a triggerQuestion — the question that prompted the user to write it. Use this context to understand WHY the user mentioned something. An entry triggered by "What's broken or blocked?" means the user sees it as a problem. An entry triggered by "What makes money?" means the user sees revenue potential. An entry with no trigger question is freeform thought.
- Multiple entries may point to the same project. Group them.
- A single entry may contain multiple distinct thoughts. Split them into the appropriate projects, keeping sourceEntryId on each.

LINEAGE
- Every output item must reference the sourceEntryId of the original brain dump entry it came from. No orphaned items.
- Items that do not clearly belong to any project go in unassignedItems with your best guess for possibleProject.

CONSTRAINTS EXTRACTION
- If the user stated constraints in their brain dump (time limits, budget, energy, fears, skill gaps), extract them into the constraints array. These are facts the user stated, not your inferences.
- Each constraint must reference the sourceEntryId it came from.

EMERGENT THEMES
- Themes are patterns detected ACROSS projects — recurring concerns, repeated phrases, underlying anxieties, or implicit priorities.
- Each theme must cite evidence (specific entries or project names).
- Mark whether the theme is explicit (user stated it directly, multiple times) or pattern_inference (you detected it from patterns they did not state).
- Rate confidence: high (clear repeated signal), medium (probable pattern), low (possible but uncertain).

CONTRADICTIONS
- If two entries contradict each other, flag them with both sourceEntryIds. Do not resolve contradictions — that is the user's job.
- Rate severity: high (these cannot both be true and it blocks planning), medium (tension that needs resolution), low (minor inconsistency).

MISSING INPUTS
- If important areas have zero entries, or the user references things without explanation, flag them.
- Each missing input must explain why it matters and provide a specific question the user could answer.

LATENT DEPENDENCIES
- Identify items that cannot happen without another unstated step or prerequisite.
- This is dependency surfacing, not advice. You are saying "if you want X, you need A, B, C."

LOGIC GAPS
- Identify places where the user jumps from desire to outcome without an intermediate mechanism.
- This is gap identification, not criticism.

Do not collapse materially different ideas into one item for neatness.
Prefer traceability over elegance.
Respond with valid JSON only. No markdown, no preamble, no explanation outside the JSON.`;

// ============================================
// USER PROMPT BUILDER
// ============================================

export function buildStructurePrompt(input: StructureInput): string {
  const entriesFormatted = input.brainDumpEntries
    .map((e) => {
      const context = e.triggerQuestion ? `(triggered by: "${e.triggerQuestion}")` : '(open dump)';
      return `[${e.id}] ${context}: ${e.content}`;
    })
    .join('\n');

  return `Mission: "${input.missionTitle}" (${input.missionDuration} days)

Brain dump entries (${input.brainDumpEntries.length} total):
${entriesFormatted}

Discover the discrete projects in these entries. Analyze for themes, contradictions, constraints, dependencies, logic gaps, and missing information.

Return JSON matching this exact schema:

{
  "discoveredProjects": [
    {
      "projectName": "string — concrete, specific project name",
      "description": "string — what done looks like, one sentence",
      "relatedEntries": [
        {
          "content": "string — the entry content",
          "sourceEntryId": "string — the [id] from the brain dump entry"
        }
      ],
      "estimatedScope": "small | medium | large",
      "dependencies": ["string — other discovered project names this depends on"],
      "blockers": ["string — non-project blockers"]
    }
  ],
  "unassignedItems": [
    {
      "content": "string",
      "sourceEntryId": "string",
      "possibleProject": "string — best guess"
    }
  ],
  "emergentThemes": [
    {
      "theme": "string",
      "evidence": ["string — specific entries or project names"],
      "confidence": "high | medium | low",
      "basis": "explicit | pattern_inference"
    }
  ],
  "contradictions": [
    {
      "itemA": { "content": "string", "sourceEntryId": "string" },
      "itemB": { "content": "string", "sourceEntryId": "string" },
      "nature": "string",
      "severity": "high | medium | low"
    }
  ],
  "constraints": [
    {
      "constraint": "string — what the user stated",
      "sourceEntryId": "string",
      "impact": "string — how this affects planning"
    }
  ],
  "missingInputs": [
    {
      "area": "string",
      "whyMissingMatters": "string",
      "suggestedQuestion": "string"
    }
  ],
  "latentDependencies": [
    {
      "item": "string",
      "dependsOn": ["string"],
      "why": "string"
    }
  ],
  "logicGaps": [
    {
      "statement": "string",
      "gap": "string",
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
    'discoveredProjects',
    'unassignedItems',
    'emergentThemes',
    'contradictions',
    'constraints',
    'missingInputs',
    'latentDependencies',
    'logicGaps',
  ];
  for (const field of requiredFields) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`Structure response missing required array field: ${field}`);
    }
  }

  if (parsed.discoveredProjects.length === 0) {
    throw new Error('Structure response contains zero discovered projects');
  }

  for (const project of parsed.discoveredProjects) {
    if (!project.projectName || typeof project.projectName !== 'string') {
      throw new Error('Discovered project missing projectName');
    }
    if (!project.description || typeof project.description !== 'string') {
      throw new Error(`Project "${project.projectName}" missing description`);
    }
    if (!Array.isArray(project.relatedEntries)) {
      throw new Error(`Project "${project.projectName}" missing relatedEntries array`);
    }
    for (const entry of project.relatedEntries) {
      if (!entry.sourceEntryId) {
        throw new Error(
          `Entry in project "${project.projectName}" missing sourceEntryId: ${entry.content?.substring(0, 50)}`,
        );
      }
    }
  }

  return parsed as StructureOutput;
}
