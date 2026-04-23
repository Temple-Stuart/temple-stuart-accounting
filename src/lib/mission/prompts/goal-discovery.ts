import { StructureOutput, GoalDiscoveryOutput } from './types';

// ============================================
// INPUT
// ============================================

export interface GoalDiscoveryInput {
  structuredOutput: StructureOutput;
  missionTitle: string;
  missionDuration: number;
}

// ============================================
// MODEL
// ============================================

export const GOAL_DISCOVERY_MODEL = 'claude-sonnet-4-20250514';

// ============================================
// SYSTEM PROMPT
// ============================================

export const GOAL_DISCOVERY_SYSTEM_PROMPT = `You are a strategic analyst. Your job is to analyze a set of discovered projects from a founder's brain dump and propose 3 candidate mission goals — each representing a different strategy for how to spend the mission duration.

You are the analyst. The user is the strategist. You present options with honest tradeoffs. You do not recommend.

Rules:

CANDIDATE GOALS
- Present exactly 3 candidate goals. Do NOT recommend one over the others.
- rank (1, 2, 3) is for ordering only, not recommendation strength. Present them as equal-weight options.
- Each goal is a specific, measurable outcome achievable within the stated mission duration. Not a vague aspiration. Not "grow the business." Something like "launch paid bookkeeping tier with Stripe integration and 3 paying users."
- Each goal represents a different STRATEGY — a different combination of discovered projects to prioritize. If your three goals are variations of the same idea, you have failed.
- Each goal must have a distinctiveAngle — one sentence explaining what makes this goal fundamentally different from the other two.
- Each goal must include an executionProfile: what the user's days would actually look like if they chose this goal. What they would focus on, what they would deprioritize, what mode they would be operating in (e.g., "deep coding sprints + weekly demo recordings" or "bug triage + sales outreach + pricing experiments").

TRADEOFFS
- Every goal has real costs and real risks. Do not soften them.
- gains: what the user gets if this goal succeeds
- costs: which discovered projects get deprioritized — name them specifically
- risks: what could go wrong — be honest

SUPPORTING EVIDENCE
- Each goal must cite specific evidence from the structured data: discovered project names, individual items, themes, or contradictions.
- Use structured references with type ('project', 'item', 'theme', 'contradiction') and reference (the specific name or content).
- Do not fabricate evidence. If a goal is only weakly supported, say so.

TIMELINE FIT
- Honestly assess whether the goal is achievable in the stated duration given the scope of the discovered projects involved.
- If it is a stretch, say "this is aggressive." If it is comfortable, say so. Do not assume heroic productivity.
- Factor in any constraints the user stated in their brain dump (extracted in the Structure stage).

OPEN QUESTIONS
- Questions that MUST be answered before the user can confidently choose a goal.
- Each question must specify which goals it affects (by rank number) and why it matters.
- Not generic questions. Specific to the discovered projects and the candidate goals.

ASSUMPTIONS TO VALIDATE
- Beliefs embedded in the brain dump that may or may not be true.
- Each must be typed: product (will this feature work?), market (do users want this?), personal_capacity (can the user sustain this pace?), technical (is this technically feasible?), timeline (can this be done in time?).
- Include how to validate: a concrete step, not "do more research."

ITEMS TO IGNORE
- Real items from the structured data that should be explicitly deprioritized for THIS mission.
- Include sourceEntryId when traceable.
- Give a clear reason — this is permission to let go, not dismissal.

Do not add motivational language, affirmations, or coaching tone. Be direct and analytical.
Respond with valid JSON only. No markdown, no preamble, no explanation outside the JSON.`;

// ============================================
// USER PROMPT BUILDER
// ============================================

export function buildGoalDiscoveryPrompt(input: GoalDiscoveryInput): string {
  const structuredData = JSON.stringify(input.structuredOutput, null, 2);

  return `Mission: "${input.missionTitle}" (${input.missionDuration} days)

Approved structured data from brain dump analysis:
${structuredData}

Identify the top 3 candidate goals for this mission. Each goal should represent a different strategy for combining the discovered projects. Return JSON matching this exact schema:

{
  "candidateGoals": [
    {
      "rank": 1,
      "goalStatement": "string — specific, measurable outcome",
      "distinctiveAngle": "string — what makes this fundamentally different from the other goals",
      "rationale": "string",
      "executionProfile": {
        "primaryFocus": ["string — what the user's days center around"],
        "deprioritizedAreas": ["string — which discovered projects get pushed aside"],
        "likelyOperatingMode": "string — e.g. deep coding sprints + weekly demo recordings"
      },
      "tradeoffs": {
        "gains": ["string"],
        "costs": ["string — name specific discovered projects that get deprioritized"],
        "risks": ["string — be honest about what could go wrong"]
      },
      "timelineFit": "string — honest assessment for ${input.missionDuration} days",
      "supportingEvidence": [
        {
          "type": "project | item | theme | contradiction",
          "reference": "string — specific name or content from structured data"
        }
      ]
    }
  ],
  "openQuestions": [
    {
      "question": "string",
      "affectsGoals": [1, 2],
      "whyItMatters": "string"
    }
  ],
  "assumptionsToValidate": [
    {
      "assumption": "string",
      "type": "product | market | personal_capacity | technical | timeline",
      "whyItMatters": "string",
      "howToValidate": "string — concrete step"
    }
  ],
  "itemsToIgnoreForNow": [
    {
      "content": "string",
      "sourceEntryId": "string or omit if not traceable",
      "reason": "string"
    }
  ]
}`;
}

// ============================================
// RESPONSE PARSER
// ============================================

export function parseGoalDiscoveryResponse(raw: string): GoalDiscoveryOutput {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.candidateGoals) || parsed.candidateGoals.length !== 3) {
    throw new Error(
      `Goal discovery must return exactly 3 candidate goals, got ${parsed.candidateGoals?.length ?? 0}`,
    );
  }

  for (const goal of parsed.candidateGoals) {
    if (!goal.goalStatement)
      throw new Error(`Candidate goal rank ${goal.rank} missing goalStatement`);
    if (!goal.distinctiveAngle)
      throw new Error(`Candidate goal rank ${goal.rank} missing distinctiveAngle`);
    if (!goal.executionProfile)
      throw new Error(`Candidate goal rank ${goal.rank} missing executionProfile`);
    if (!goal.tradeoffs) throw new Error(`Candidate goal rank ${goal.rank} missing tradeoffs`);
    if (!Array.isArray(goal.supportingEvidence))
      throw new Error(`Candidate goal rank ${goal.rank} missing supportingEvidence array`);
  }

  if (!Array.isArray(parsed.openQuestions)) throw new Error('Missing openQuestions array');
  if (!Array.isArray(parsed.assumptionsToValidate))
    throw new Error('Missing assumptionsToValidate array');
  if (!Array.isArray(parsed.itemsToIgnoreForNow))
    throw new Error('Missing itemsToIgnoreForNow array');

  return parsed as GoalDiscoveryOutput;
}
