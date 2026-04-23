import { StructureOutput, GoalDiscoveryOutput, RealityAuditOutput } from './types';

// ============================================
// INPUT
// ============================================

export interface RealityAuditInput {
  confirmedGoal: string;
  structuredOutput: StructureOutput;
  goalDiscoveryOutput: GoalDiscoveryOutput;
  constraints: {
    product: Array<{
      category: string;
      description: string;
      value: string | null;
      source: string;
    }>;
    operational: Array<{
      category: string;
      description: string;
      value: string | null;
      source: string;
    }>;
  };
}

// ============================================
// MODEL
// ============================================

export const REALITY_AUDIT_MODEL = 'claude-sonnet-4-20250514';

export const REALITY_AUDIT_SYSTEM_PROMPT = '// TODO: implement in phase 2';

export function buildRealityAuditPrompt(_input: RealityAuditInput): string {
  throw new Error('Reality audit prompt not yet implemented');
}

export function parseRealityAuditResponse(_raw: string): RealityAuditOutput {
  throw new Error('Reality audit parser not yet implemented');
}
