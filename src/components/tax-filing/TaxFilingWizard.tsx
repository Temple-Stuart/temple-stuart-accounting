'use client';

import { useState, useEffect, useCallback } from 'react';
// TAX-PIPE: the ratified Pipe Frame — StageStrip REPLACES the wizard's
// progress bar + step dots (control converted, never stacked). The wizard's
// OWN state stays the single source of truth: the strip renders
// currentStep/completedSteps and its onSelect calls the SAME goToStep,
// whose internal eligibility guard (:251-263) byte-preserves the existing
// navigation gating — an ineligible click no-ops exactly as before. Per
// the frame's ratified amendment, cells are never disabled (states are
// indicators; pending styling is affordance-only) — the gate is
// BEHAVIORAL in goToStep, unchanged.
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import ProofStrip from '@/components/ui/ProofStrip';
import { PIPE_PHASES, type PipePhase } from '@/lib/pipePhases';

// Widened to the interface (the Travel precedent). The seven rows are 1:1
// with STEPS below — same order, names verified against the step labels
// (the pipe-phases wizard-check).
const TAX_PIPE = PIPE_PHASES.tax as readonly PipePhase[];
// TAX-1: AppLayout chrome moved OUT to the /dashboard/tax-filing page so this wizard is
// bare and can also mount inside the homepage Tax tab (which supplies its own chrome).
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

// Default to the return the user is currently filing.
// IRS deadline is April 15; automatic extension runs to October 15.
// Before Oct 15, people are still filing the PRIOR calendar year.
// On/after Oct 15, filing season is over — start planning the CURRENT year.
function defaultTaxYear(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month < 10 || (month === 10 && day < 15)) {
    return year - 1;
  }
  return year;
}

// Years offered in the selector: current, prior 2, and next. Users filing
// early are usually in prior-year mode; offering next year supports
// forward-planning scenarios.
function availableTaxYears(): number[] {
  const current = new Date().getUTCFullYear();
  return [current + 1, current, current - 1, current - 2];
}

export default function TaxFilingWizard({ }: { } = {}) {
  const [state, setState] = useState<WizardState>({
    currentStep: 0,
    completedSteps: new Set<number>(),
    taxYear: defaultTaxYear(),
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
    <div className="px-4 py-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">File your taxes</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tax year {state.taxYear} · Step {state.currentStep + 1} of {STEPS.length} ·{' '}
              {step.label}
            </p>
          </div>
          <div className="shrink-0">
            <label
              htmlFor="wizard-tax-year"
              className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 text-right"
            >
              Tax year
            </label>
            <select
              id="wizard-tax-year"
              value={state.taxYear}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  taxYear: parseInt(e.target.value, 10),
                }))
              }
              className="px-3 py-1.5 text-sm font-mono font-semibold border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {availableTaxYears().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAX-PIPE: the strip — driven by the wizard's own state (no
            parallel state). done = completedSteps membership (the wizard's
            EXPLICIT completion set — not the implicit before-current model);
            active = currentStep; else pending. onSelect → the same goToStep
            (its guard preserves the gating). */}
        <div className="mb-6">
          <StageStrip
            phases={STEPS.map((s, i) => ({
              key: s.key,
              num: TAX_PIPE[i].num,
              label: TAX_PIPE[i].name,
              subLabel: TAX_PIPE[i].subLabel,
              state:
                s.id === state.currentStep
                  ? 'active'
                  : state.completedSteps.has(s.id)
                    ? 'done'
                    : 'pending',
            }) as StagePhase)}
            onSelect={(k) => {
              const target = STEPS.find((s) => s.key === k);
              if (target) goToStep(target.id);
            }}
          />
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

        {/* TAX-PIPE: the receipts rail — the wizard's own client state only,
            honest empties (auto-detect settles after its existing fetch). */}
        <div className="mt-4">
          <ProofStrip
            receipts={[
              { label: 'TAX YEAR', value: String(state.taxYear) },
              { label: 'STEPS COMPLETED', value: `${state.completedSteps.size}/${STEPS.length}` },
              { label: 'AUTO-DETECTED', value: autoDetectLoading ? undefined : String(Object.values(state.autoDetected).filter(Boolean).length), emptyLabel: 'detecting…' },
              { label: 'LIFE EVENTS SELECTED', value: String(Object.values(state.lifeEvents).filter(Boolean).length) },
            ]}
          />
        </div>
      </div>
  );
}
