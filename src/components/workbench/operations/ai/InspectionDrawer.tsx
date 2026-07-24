/**
 * InspectionDrawer — reusable AI inference inspection panel.
 *
 * Used by three surfaces:
 *   1. ProjectRow edit-mode preview pane (real-time after generate)
 *   2. SectionD create-form preview pane (real-time after generate)
 *   3. SectionK audit tail row expansion (retrospective lookup)
 *
 * Renders the full institutional context of an AI inference:
 *   - Model + temperature + max_tokens (operational parameters)
 *   - System prompt (collapsible, monospace, full text)
 *   - User message (collapsible, monospace, full text)
 *   - Raw response (collapsible, monospace, full text)
 *   - Cost breakdown (input tokens × rate + output tokens × rate)
 *   - Audit trail metadata (usage_id, audit_log_id if known)
 *
 * Truth-first: every field is rendered verbatim. No truncation, no
 * summarization. The operator sees exactly what the AI saw and
 * exactly what it returned.
 *
 * Default state: drawer is CLOSED. One-click expansion is a deliberate
 * trust act — most of the time the operator just wants to read the
 * generated output. When they want to verify the AI's reasoning,
 * they expand.
 */

'use client';

import { useState } from 'react';
import { themed, type Surface } from '@/lib/ds';

export interface InspectionData {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  usageId?: string;
}

interface Props {
  data: InspectionData | null;
  /**
   * When data is null, the drawer renders a "predates PR-Ops-3.6 —
   * prompts not captured" message. This handles the legacy case for
   * audit tail expansion of pre-PR-Ops-3.6 rows.
   */
  legacyReason?: string;
}

export default function InspectionDrawer({ surface = 'light', data, legacyReason }: Props & { surface?: Surface }) {
  const dk = surface === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);

  if (!data && legacyReason) {
    return (
      <div className="mt-2 px-3 py-2 rounded border bg-amber-50 border-amber-200 text-amber-900 text-xs font-mono">
        {legacyReason}
      </div>
    );
  }

  if (!data) return null;

  const labelClass = themed('text-text-faint uppercase tracking-wide text-xs font-mono', dk);
  const blockClass =
    themed('whitespace-pre-wrap font-mono text-xs p-3 bg-white border border-border-light rounded max-h-96 overflow-y-auto', dk);

  return (
    <div className={themed('mt-2 border border-border rounded', dk)}>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className={themed('w-full px-3 py-2 flex items-center justify-between text-xs font-mono text-text-primary hover:bg-bg-row', dk)}
      >
        <span className="flex items-center gap-2">
          <span className={themed('text-text-faint', dk)}>{expanded ? '▾' : '▸'}</span>
          <span>🔍 inspect this inference</span>
        </span>
        <span className={themed('text-text-muted', dk)}>
          {data.model} · ${data.costUsd} · {data.inputTokens} in · {data.outputTokens} out
        </span>
      </button>

      {expanded && (
        <div className={themed('px-4 py-3 border-t border-border-light space-y-3 text-xs font-mono', dk)}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className={labelClass}>model</div>
              <div className={themed('text-text-primary', dk)}>{data.model}</div>
            </div>
            <div>
              <div className={labelClass}>temperature</div>
              <div className={themed('text-text-primary', dk)}>{data.temperature}</div>
            </div>
            <div>
              <div className={labelClass}>max tokens</div>
              <div className={themed('text-text-primary', dk)}>{data.maxTokens}</div>
            </div>
          </div>

          <div className={themed('grid grid-cols-3 gap-3 pt-2 border-t border-border-light', dk)}>
            <div>
              <div className={labelClass}>input tokens</div>
              <div className={themed('text-text-primary', dk)}>{data.inputTokens}</div>
            </div>
            <div>
              <div className={labelClass}>output tokens</div>
              <div className={themed('text-text-primary', dk)}>{data.outputTokens}</div>
            </div>
            <div>
              <div className={labelClass}>cost (usd)</div>
              <div className={themed('text-text-primary', dk)}>${data.costUsd}</div>
            </div>
          </div>

          {data.usageId && (
            <div className={themed('pt-2 border-t border-border-light', dk)}>
              <div className={labelClass}>operations_ai_usage row id</div>
              <div className={themed('text-text-primary break-all', dk)}>{data.usageId}</div>
            </div>
          )}

          <div className={themed('pt-2 border-t border-border-light', dk)}>
            <button
              type="button"
              onClick={() => setSystemOpen((x) => !x)}
              className={themed('text-xs font-mono text-text-primary hover:bg-bg-row px-2 py-1 rounded flex items-center gap-2', dk)}
            >
              <span className={themed('text-text-faint', dk)}>{systemOpen ? '▾' : '▸'}</span>
              <span className={labelClass}>system prompt ({data.systemPrompt.length.toLocaleString()} chars)</span>
            </button>
            {systemOpen && <div className={blockClass + themed(' mt-1 text-text-primary', dk)}>{data.systemPrompt}</div>}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setUserOpen((x) => !x)}
              className={themed('text-xs font-mono text-text-primary hover:bg-bg-row px-2 py-1 rounded flex items-center gap-2', dk)}
            >
              <span className={themed('text-text-faint', dk)}>{userOpen ? '▾' : '▸'}</span>
              <span className={labelClass}>user message ({data.userMessage.length.toLocaleString()} chars)</span>
            </button>
            {userOpen && <div className={blockClass + themed(' mt-1 text-text-primary', dk)}>{data.userMessage}</div>}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setResponseOpen((x) => !x)}
              className={themed('text-xs font-mono text-text-primary hover:bg-bg-row px-2 py-1 rounded flex items-center gap-2', dk)}
            >
              <span className={themed('text-text-faint', dk)}>{responseOpen ? '▾' : '▸'}</span>
              <span className={labelClass}>raw response ({data.rawResponse.length.toLocaleString()} chars)</span>
            </button>
            {responseOpen && <div className={blockClass + themed(' mt-1 text-text-primary', dk)}>{data.rawResponse}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
