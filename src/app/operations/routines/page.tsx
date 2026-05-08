/**
 * /operations/routines
 *
 * Section E · Routines page. The OperationsEntityProvider is wired in the
 * parent /operations/layout.tsx (PR-Ops-2a precedent), so this page just
 * mounts SectionE_Routines directly — same shape as projects/page.tsx.
 */

import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';

export default function OperationsRoutinesPage() {
  return <SectionE_Routines />;
}
