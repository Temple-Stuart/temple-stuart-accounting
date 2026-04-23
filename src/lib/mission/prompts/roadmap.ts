import { RealityAuditOutput, RoadmapOutput } from './types';

// ============================================
// INPUT
// ============================================

export interface RoadmapInput {
  confirmedGoal: string;
  realityAuditOutput: RealityAuditOutput;
  missionDuration: number;
  startDate: string;
}

// ============================================
// MODEL
// ============================================

export const ROADMAP_MODEL = 'claude-sonnet-4-20250514';

export const ROADMAP_SYSTEM_PROMPT = '// TODO: implement in phase 2';

export function buildRoadmapPrompt(_input: RoadmapInput): string {
  throw new Error('Roadmap prompt not yet implemented');
}

export function parseRoadmapResponse(_raw: string): RoadmapOutput {
  throw new Error('Roadmap parser not yet implemented');
}
