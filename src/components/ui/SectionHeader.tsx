/**
 * SectionHeader (PIPE-FRAME-1) — the numbered kicker row of the Pipe Frame:
 * the landing's section-eyebrow grammar ("NN / NAME" mono left, optional
 * mono right slot), lifted verbatim from the Landing.tsx eyebrow idiom
 * (the 01/02/03 rows: font-mono text-[10px] font-semibold uppercase
 * tracking-wider text-text-faint, right slot in the plain mono tier).
 */

import type { ReactNode } from 'react';

export default function SectionHeader({ kicker, right }: { kicker: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">{kicker}</p>
      {right != null && (
        <p className="font-mono text-[10px] tracking-wider text-text-faint">{right}</p>
      )}
    </div>
  );
}
