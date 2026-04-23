// ============================================
// BRAIN DUMP INPUT (shared across stages)
// ============================================

export interface BrainDumpItem {
  id: string;
  content: string;
  source: 'typed' | 'voice';
  triggerQuestion: string | null;
  triggerGroupId: string | null;
}

// ============================================
// STAGE 1: STRUCTURE — Output Contract
// ============================================

export interface StructureOutput {
  discoveredProjects: Array<{
    projectName: string;
    description: string;
    relatedEntries: Array<{
      content: string;
      sourceEntryId: string;
    }>;
    estimatedScope: 'small' | 'medium' | 'large';
    dependencies: string[];
    blockers: string[];
  }>;

  unassignedItems: Array<{
    content: string;
    sourceEntryId: string;
    possibleProject: string;
  }>;

  emergentThemes: Array<{
    theme: string;
    evidence: string[];
    confidence: 'high' | 'medium' | 'low';
    basis: 'explicit' | 'pattern_inference';
  }>;

  contradictions: Array<{
    itemA: { content: string; sourceEntryId: string };
    itemB: { content: string; sourceEntryId: string };
    nature: string;
    severity: 'high' | 'medium' | 'low';
  }>;

  constraints: Array<{
    constraint: string;
    sourceEntryId: string;
    impact: string;
  }>;

  missingInputs: Array<{
    area: string;
    whyMissingMatters: string;
    suggestedQuestion: string;
  }>;

  latentDependencies: Array<{
    item: string;
    dependsOn: string[];
    why: string;
  }>;

  logicGaps: Array<{
    statement: string;
    gap: string;
    whyItMatters: string;
  }>;
}

// ============================================
// STAGE 2: GOAL DISCOVERY — Output Contract
// ============================================

export interface GoalDiscoveryOutput {
  candidateGoals: Array<{
    rank: number;
    goalStatement: string;
    distinctiveAngle: string;
    rationale: string;
    executionProfile: {
      primaryFocus: string[];
      deprioritizedAreas: string[];
      likelyOperatingMode: string;
    };
    tradeoffs: {
      gains: string[];
      costs: string[];
      risks: string[];
    };
    timelineFit: string;
    supportingEvidence: Array<{
      type: 'project' | 'item' | 'theme' | 'contradiction';
      reference: string;
    }>;
  }>;

  openQuestions: Array<{
    question: string;
    affectsGoals: number[];
    whyItMatters: string;
  }>;

  assumptionsToValidate: Array<{
    assumption: string;
    type: 'product' | 'market' | 'personal_capacity' | 'technical' | 'timeline';
    whyItMatters: string;
    howToValidate: string;
  }>;

  itemsToIgnoreForNow: Array<{
    content: string;
    sourceEntryId?: string;
    reason: string;
  }>;
}

// ============================================
// STAGE 3: GOAL CONFIRMATION — Output Contract (reserved, not built in MVP)
// ============================================

export interface GoalConfirmationOutput {
  refinedGoalStatement: string;
  selectedRank: number;
  rejectedGoals: Array<{
    rank: number;
    goalStatement: string;
    rejectionReason: string;
  }>;
  validationPlan: Array<{
    item: string;
    type: 'assumption' | 'open_question' | 'dependency';
    priority: 'must_resolve' | 'should_resolve' | 'nice_to_know';
    howToValidate: string;
  }>;
  researchPriorities: string[];
  remainingRisks: string[];
}

// ============================================
// STAGE 4: REALITY AUDIT — Output Contract
// ============================================

export interface RealityAuditOutput {
  productReality: {
    alreadyBuilt: Array<{ item: string; status: 'working' | 'partial' | 'broken' }>;
    reusableAssets: string[];
    missingComponents: string[];
    brokenOrRisky: Array<{ item: string; risk: string; severity: 'high' | 'medium' | 'low' }>;
  };
  operationalReality: {
    timeAvailable: { hoursPerWeek: number; constraints: string[] };
    budget: { available: string; burnRate: string; runway: string };
    personalConstraints: string[];
    energyBlockers: string[];
  };
  gapAnalysis: {
    desiredState: string;
    currentState: string;
    gapItems: Array<{
      gap: string;
      effort: 'small' | 'medium' | 'large';
      priority: 'critical' | 'important' | 'nice_to_have';
    }>;
  };
  scopeCreepWarnings: string[];
  fastWins: string[];
  criticalPath: string[];
  recommendedFocus: string;
}

// ============================================
// STAGE 5: ROADMAP — Output Contract
// ============================================

export interface RoadmapOutput {
  weeklyPlan: Array<{
    weekNumber: number;
    theme: string;
    milestones: Array<{
      title: string;
      description: string;
      successCriteria: string;
    }>;
    focusAreas: string[];
  }>;
  firstWeekDailyTasks: Array<{
    day: number;
    tasks: Array<{
      title: string;
      description: string;
      priority: number;
      estimatedMinutes: number;
    }>;
  }>;
  kpiTargets: Array<{
    metric: string;
    target: string;
    measurementMethod: string;
  }>;
  riskWatchlist: Array<{
    risk: string;
    trigger: string;
    mitigation: string;
  }>;
  whatToIgnore: string[];
  definitionOfWinning: string;
}
