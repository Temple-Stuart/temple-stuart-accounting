/**
 * buildAuditPrompt (PR-TM-2) — the canonical Truth-First CODEBASE AUDIT prompt, with the
 * project's goal/problem/diagnosis interpolated. This is "Template B": the prompt the user
 * copies into Claude Code (read-only) to produce the audit findings they paste back into
 * the project's `claude_code_audit_input` field. Phase 3 will automate running it; until
 * then it is copy-ready text.
 *
 * Pure string builder — no DB, no network, no Anthropic call. It is rendered by the
 * read-only prompts-preview endpoint and shown in the Truth Machine's audit panel.
 *
 * The template encodes the house audit discipline: truth-first, read-only, every claim
 * cites file:line, EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK labels, a
 * git branch/commit/push block, and a deliverable under audit-reports/.
 */

export interface AuditPromptInput {
  projectTitle: string;
  goalItems: string[];
  problemItems: string[];
  diagnosisItems: string[];
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '(none provided)';
  return items.map((item) => `- ${item}`).join('\n');
}

/** Slugify the project title into a safe branch suffix (lowercase, hyphenated). */
function branchSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug.length > 0 ? slug : 'project';
}

export function buildAuditPrompt(input: AuditPromptInput): string {
  const slug = branchSlug(input.projectTitle);
  return `TEMPLE STUART — AUDIT: "${input.projectTitle}" — what's actually shipped vs what this goal needs (READ-ONLY)

MANDATE: Truth-First. Read-only. NO fixes. EVERY claim cites file + line. Label each finding EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK. This audit grounds a task plan — be precise about what's already built, what's stale, what's gone, and what's reusable, so the plan closes the real gap (not an imagined one).

THE PROJECT (what the plan is trying to achieve):
Title: "${input.projectTitle}"

GOAL items (the target end states):
${bulletList(input.goalItems)}

PROBLEM items (the current gaps / recurring obstacles):
${bulletList(input.problemItems)}

DIAGNOSIS items (the root causes):
${bulletList(input.diagnosisItems)}

GIT (FIRST):
  git fetch origin --prune
  git checkout -b claude/audit-${slug}
DELIVERABLE: audit-reports/${slug}-audit.md  (write all findings here)
END: commit + push + git log --oneline -1

INVESTIGATE (cite file:line for every claim):
1. For EACH goal item above: what in the codebase ALREADY does this (or part of it)? Quote the file:line and label EXISTS / EXISTS-BUT-UNUSED / MISSING. Don't assume greenfield — search first.
2. For EACH problem item: is the gap real in the code today? What's the current behavior at file:line, and why does it fall short (the diagnosis, confirmed against the code)?
3. REUSABLE assets: existing routes, components, libs, schema, or patterns the plan can build ON instead of rebuilding. Cite each.
4. STALE / RETIRED: anything that LOOKS like it does the job but is dead, half-wired, or superseded — flag it so the plan doesn't lean on it. Cite file:line.
5. RISK: data-bearing tables, auth gates, migrations, or shared surfaces the work would touch. Flag explicitly.
6. THE HONEST GAP: in 2-4 sentences, what is genuinely missing vs already there — the real distance between today's code and the goal.

ANSWER EXPLICITLY (each with file:line):
  (a) Per goal: already-built vs missing.
  (b) Reusable assets to build on.
  (c) Stale/retired traps to avoid.
  (d) Risks (data/auth/migration/shared surfaces).
  (e) The honest gap — what the task plan actually has to close.

Do not implement. Read-only. Cite everything. Then paste this audit's findings back into the project's audit input so the task plan is grounded in what's real.`;
}
