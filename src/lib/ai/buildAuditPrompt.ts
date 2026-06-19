/**
 * buildAuditPrompt (PROMPT-2) — the institutional "diagnose the machine" CODEBASE AUDIT
 * prompt: map what exists, assertion-test every output, check controls/evidence, find root
 * cause (not symptom), map failure modes/blast radius, and state the honest delta vs the
 * research standard. This is the prompt the user copies into Claude Code (read-only) to
 * produce the audit findings they paste into `claude_code_audit_input`. Phase 3 will
 * automate running it; until then it is copy-ready text.
 *
 * Pure string builder — no DB, no network, no Anthropic call (NOT a web_search call, so no
 * injection guard needed). Rendered by the read-only prompts-preview endpoint + shown in the
 * Truth Machine's audit panel. The interpolated inputs (shown RED) are: Project title, Goals,
 * and the Research findings (Prompt #1 results) — the standard the audit measures against.
 *
 * NO-DRIFT: the string builder and buildAuditSegments build from the SAME constants +
 * interpolation, so joinSegments(buildAuditSegments(x)) === buildAuditPrompt(x) byte-for-byte
 * (the preview route verifies; on any mismatch it falls back to the plain string — never a lie).
 */

import type { PromptSegment } from './promptSegments';

export interface AuditPromptInput {
  projectTitle: string;
  goalItems: string[];
  /** PROMPT-2: the research findings (deep_research_input) — the standard to audit against.
   *  Empty → "(none provided)" (graceful, never fabricated). */
  deepResearchInput?: string | null;
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '(none provided)';
  return items.map((item) => `- ${item}`).join('\n');
}

// Shared template chunks — the single source for both the string and the segments.
const AUDIT_HEAD = `AUDIT — diagnose what exists before designing any change. Read-only. Cite file + line. State only what you've verified.

Project: `;
const AUDIT_GOALS_LABEL = `
Goals:
`;
const AUDIT_RESEARCH_LABEL = `
Research findings (the standard to measure against):
`;
const AUDIT_BODY = `

Treat the existing system as a machine that produces outcomes. Diagnose which parts work and which fail.

1 · What exists
- Map the code, data models, routes touching these goals — file + line
- Label each: correct / partial / broken
- Name what's reusable (reuse over rebuild)

2 · Assertion test — for each number/output the code produces:
- Existence/occurrence — is it real
- Completeness — nothing missing
- Accuracy — the math is right
- Cutoff — right period
- Classification — right category/COA
- Valuation — valued correctly
- Rights — correct user owns it (user-scoped)
- Name where any assertion fails

3 · Controls & evidence
- Auth gate present
- User-scoping present
- Audit log written
- Any paid-API or user-data route missing a control — file + line

4 · Root cause, not symptom
- For each gap vs goals/standard, ask "why" until a fixable design flaw
- Diagnosis only — no solutions yet

5 · Failure modes & blast radius
- Edge cases, scale limits, missing validation, silent fallbacks
- The downside of each
- Mapped before anything changes

6 · Traceability & the honest delta
- Single source of truth, or competing copies
- Can each output trace to source
- Where this project actually stands vs the standard — plainly, no flattery
- The uncomfortable truth that's easy to avoid

Output
- Rank the diagnosis by severity
- Do NOT design the fix — that's the next stage`;

/** The research findings text, trimmed; empty → "(none provided)". Computed identically in
 *  the string + the segments so the two can't drift. */
function researchText(input: AuditPromptInput): string {
  return input.deepResearchInput?.trim() || '(none provided)';
}

export function buildAuditPrompt(input: AuditPromptInput): string {
  return `${AUDIT_HEAD}${input.projectTitle}${AUDIT_GOALS_LABEL}${bulletList(input.goalItems)}${AUDIT_RESEARCH_LABEL}${researchText(input)}${AUDIT_BODY}`;
}

/**
 * The SAME audit prompt as ordered segments, so the UI colors the user-injected spans red:
 * Project title, Goals, and the Research findings. joinSegments(...) === buildAuditPrompt(input)
 * by construction (same constants + interpolation).
 */
export function buildAuditSegments(input: AuditPromptInput): PromptSegment[] {
  return [
    { kind: 'template', text: AUDIT_HEAD },
    { kind: 'input', text: input.projectTitle },
    { kind: 'template', text: AUDIT_GOALS_LABEL },
    { kind: 'input', text: bulletList(input.goalItems) },
    { kind: 'template', text: AUDIT_RESEARCH_LABEL },
    { kind: 'input', text: researchText(input) },
    { kind: 'template', text: AUDIT_BODY },
  ];
}
