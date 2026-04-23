import { StructureOutput, GoalDiscoveryOutput, GoalConfirmationOutput } from './types';

// ============================================
// INPUT
// ============================================

export interface GoalConfirmationInput {
  selectedGoalRank: number;
  editedGoalStatement?: string;
  structuredOutput: StructureOutput;
  goalDiscoveryOutput: GoalDiscoveryOutput;
  answeredQuestions?: Array<{
    question: string;
    answer: string;
  }>;
}

// ============================================
// MODEL
// ============================================

export const GOAL_CONFIRMATION_MODEL = 'claude-sonnet-4-20250514';

// Reserved for future implementation — MVP uses manual goal selection without AI call

export const GOAL_CONFIRMATION_SYSTEM_PROMPT = '// TODO: implement in phase 2';

export function buildGoalConfirmationPrompt(_input: GoalConfirmationInput): string {
  throw new Error('Goal confirmation prompt not yet implemented — MVP uses manual selection');
}

export function parseGoalConfirmationResponse(_raw: string): GoalConfirmationOutput {
  throw new Error('Goal confirmation parser not yet implemented');
}
