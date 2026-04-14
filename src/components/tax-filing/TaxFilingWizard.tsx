'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/ui';
import LifeEventsStep from './steps/LifeEventsStep';
import DocumentsStep from './steps/DocumentsStep';
import IncomeReviewStep from './steps/IncomeReviewStep';
import DeductionsStep from './steps/DeductionsStep';
import TradingStep from './steps/TradingStep';
import ReviewStep from './steps/ReviewStep';
import FileStep from './steps/FileStep';

// ═══════════════════════════════════════════════════════════════════
// Tax Filing Wizard — 7-step guided flow from life events to filing.
// This file owns the stepper UI, navigation, state, and auto-detection.
// Each step's actual content lives in a separate component and is built
// out in follow-up PRs.
// ═══════════════════════════════════════════════════════════════════

export interface LifeEvents {
  hasW2: boolean;
  hasBusiness: boolean;
  hasTrading: boolean;
  hasRetirement: boolean;
  hasStudentLoan: boolean;
  hasEducation: boolean;
  hasInterestDividends: boolean;
  hasRental: boolean;
}

export interface WizardState {
  currentStep: number;
  completedSteps: Set<number>;
  taxYear: number;
  lifeEvents: LifeEvents;
  autoDetected: Partial<Record<keyof LifeEvents, boolean>>;
}

export interface StepProps {
  taxYear: number;
  onComplete: () => void;
  onBack: () => void;
  lifeEvents: LifeEvents;
  setLifeEvents: (events: LifeEvents) => void;
  autoDetected: Partial<Record<keyof LifeEvents, boolean>>;
}

interface StepDefinition {
  id: number;
  key: string;
  label: string;
  description: string;
  Component: React.ComponentType<StepProps>;
}

const STEPS: StepDefinition[] = [
  {
    id: 0,
    key: 'life-events',
    label: 'Life events',
    description: 'What happened this year',
    Component: LifeEventsStep,
  },
  {
    id: 1,
    key: 'documents',
    label: 'Documents',
    description: 'Upload or enter your tax documents',
    Component: DocumentsStep,
  },
  {
    id: 2,
    key: 'income',
    label: 'Income',
    description: 'Review your income sources',
    Component: IncomeReviewStep,
  },
  {
    id: 3,
    key: 'deductions',
    label: 'Deductions',
    description: 'Business expenses (Schedule C)',
    Component: DeductionsStep,
  },
  {
    id: 4,
    key: 'trading',
    label: 'Trading',
    description: 'Capital gains and losses (Schedule D + 8949)',
    Component: TradingStep,
  },
  {
    id: 5,
    key: 'review',
    label: 'Review',
    description: 'Form 1040 complete return review',
    Component: ReviewStep,
  },
  {
    id: 6,
    key: 'file',
    label: 'File',
    description: 'Export and filing options',
    Component: FileStep,
  },
];

const DEFAULT_LIFE_EVENTS: LifeEvents = {
  hasW2: false,
  hasBusiness: false,
  hasTrading: false,
  hasRetirement: false,
  hasStudentLoan: false,
  hasEducation: false,
  hasInterestDividends: false,
  hasRental: false,
};

export default function TaxFilingWizard() {
  const [state, setState] = useState<WizardState>({
    currentStep: 0,
    completedSteps: new Set<number>(),
    taxYear: new Date().getFullYear(),
    lifeEvents: DEFAULT_LIFE_EVENTS,
    autoDetected: {},
  });
  const [autoDetectLoading, setAutoDetectLoading] = useState(true);

  // ── Auto-detect life events from existing user data ──────────────
  //
  // We don't persist anything yet — this just reads from existing APIs
  // to pre-check the life-events checklist. The user can still toggle
  // anything. "autoDetected" drives the badge shown next to pre-checked
  // items so users know which items came from their data.

  const runAutoDetect = useCallback(async () => {
    const detected: Partial<LifeEvents> = {};
    const autoDetected: Partial<Record<keyof LifeEvents, boolean>> = {};

    try {
      const [entitiesRes, tradingRes, investRes] = await Promise.all([
        fetch('/api/entities').catch(() => null),
        fetch('/api/trading-positions/open').catch(() => null),
        fetch('/api/investment-transactions').catch(() => null),
      ]);

      // Business — any sole_prop entity
      if (entitiesRes?.ok) {
        const data = await entitiesRes.json();
        const entities: Array<{ entity_type: string }> = data.entities || [];
        if (entities.some((e) => e.entity_type === 'sole_prop')) {
          detected.hasBusiness = true;
          autoDetected.hasBusiness = true;
        }
      }

      // Trading — any open trading position (or closed positions, if the
      // endpoint returns an aggregate). For the skeleton we treat ANY open
      // position as a signal; future work can also scan closed positions.
      if (tradingRes?.ok) {
        const data = await tradingRes.json();
        const hasPositions =
          (Array.isArray(data?.trades) && data.trades.length > 0) ||
          (Array.isArray(data?.positions) && data.positions.length > 0);
        if (hasPositions) {
          detected.hasTrading = true;
          autoDetected.hasTrading = true;
        }
      }

      // Retirement — look at investment_transactions subtypes. Plaid
      // reports retirement contributions/rollovers/distributions via
      // subtypes like "contribution", "rollover", "distribution",
      // and types like "retirement". If any exist, flag it.
      if (investRes?.ok) {
        const data = await investRes.json();
        const txns: Array<{ subtype?: string | null; type?: string | null }> =
          data.investmentTxns || data.transactions || [];
        const RETIREMENT_KEYWORDS = [
          'retirement',
          'contribution',
          'rollover',
          'distribution',
          'ira',
          '401k',
          '403b',
        ];
        const hit = txns.some((t) => {
          const s = (t.subtype || '').toLowerCase();
          const ty = (t.type || '').toLowerCase();
          return RETIREMENT_KEYWORDS.some(
            (kw) => s.includes(kw) || ty.includes(kw)
          );
        });
        if (hit) {
          detected.hasRetirement = true;
          autoDetected.hasRetirement = true;
        }

        // Also treat any investment transaction as a signal of trading,
        // in case the user has closed positions but no open ones.
        if (txns.length > 0 && !detected.hasTrading) {
          detected.hasTrading = true;
          autoDetected.hasTrading = true;
        }
      }
    } catch (e) {
      // Auto-detect is best-effort. Don't block the wizard on failure.
      console.warn('[TaxFilingWizard] Auto-detect failed:', e);
    }

    setState((prev) => ({
      ...prev,
      lifeEvents: { ...prev.lifeEvents, ...detected },
      autoDetected,
    }));
    setAutoDetectLoading(false);
  }, []);

  useEffect(() => {
    runAutoDetect();
  }, [runAutoDetect]);

  // ── Navigation handlers ──────────────────────────────────────────

  const goToStep = (stepId: number) => {
    // Allow navigating to any completed step OR the current step's
    // immediate neighbor (next/back). Don't allow skipping ahead to
    // uncompleted future steps.
    const canNavigate =
      state.completedSteps.has(stepId) ||
      stepId === state.currentStep ||
      stepId === state.currentStep - 1 ||
      (stepId === state.currentStep + 1 &&
        state.completedSteps.has(state.currentStep));
    if (!canNavigate) return;

    setState((prev) => ({ ...prev, currentStep: stepId }));
  };

  const onStepComplete = () => {
    setState((prev) => {
      const nextCompleted = new Set(prev.completedSteps);
      nextCompleted.add(prev.currentStep);
      const nextStep = Math.min(prev.currentStep + 1, STEPS.length - 1);
      return {
        ...prev,
        completedSteps: nextCompleted,
        currentStep: nextStep,
      };
    });
  };

  const onStepBack = () => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  };

  const setLifeEvents = (lifeEvents: LifeEvents) => {
    setState((prev) => ({ ...prev, lifeEvents }));
  };

  // ── Render ───────────────────────────────────────────────────────

  const step = STEPS[state.currentStep];
  const StepComponent = step.Component;

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">File your taxes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tax year {state.taxYear} · Step {state.currentStep + 1} of {STEPS.length} ·{' '}
            {step.label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex gap-1.5">
            {STEPS.map((s) => {
              const isDone = state.completedSteps.has(s.id);
              const isCurrent = s.id === state.currentStep;
              const color = isDone
                ? 'bg-emerald-500'
                : isCurrent
                  ? 'bg-blue-500'
                  : 'bg-gray-200';
              return (
                <div
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${color}`}
                  aria-hidden
                />
              );
            })}
          </div>
        </div>

        {/* Step dots with labels */}
        <div className="mb-6">
          <ol className="grid grid-cols-7 gap-2">
            {STEPS.map((s) => {
              const isDone = state.completedSteps.has(s.id);
              const isCurrent = s.id === state.currentStep;
              const clickable =
                isDone ||
                isCurrent ||
                s.id === state.currentStep - 1 ||
                (s.id === state.currentStep + 1 &&
                  state.completedSteps.has(state.currentStep));

              const dotColor = isDone
                ? 'bg-emerald-500 text-white border-emerald-500'
                : isCurrent
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-400 border-gray-300';

              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.id)}
                    disabled={!clickable}
                    className={`w-full flex flex-col items-center gap-1.5 ${
                      clickable
                        ? 'cursor-pointer'
                        : 'cursor-not-allowed opacity-60'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors ${dotColor}`}
                    >
                      {isDone ? '✓' : s.id + 1}
                    </span>
                    <span
                      className={`text-[11px] text-center leading-tight ${
                        isCurrent
                          ? 'text-gray-900 font-medium'
                          : isDone
                            ? 'text-emerald-700'
                            : 'text-gray-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Auto-detect banner */}
        {autoDetectLoading && (
          <div className="mb-4 px-3 py-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
            Detecting your existing data…
          </div>
        )}

        {/* Current step content */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {step.id + 1}. {step.label}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
          </div>
          <div className="p-5">
            <StepComponent
              taxYear={state.taxYear}
              onComplete={onStepComplete}
              onBack={onStepBack}
              lifeEvents={state.lifeEvents}
              setLifeEvents={setLifeEvents}
              autoDetected={state.autoDetected}
            />
          </div>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between rounded-b-lg">
            <button
              type="button"
              onClick={onStepBack}
              disabled={state.currentStep === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={onStepComplete}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {state.currentStep === STEPS.length - 1
                ? 'Finish'
                : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
