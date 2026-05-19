/**
 * /operations/content
 *
 * Section G · Content page. The OperationsEntityProvider is wired in the
 * parent /operations/layout.tsx, so this page just mounts SectionG_Content
 * directly — same shape as routines/page.tsx.
 */

import SectionG_Content from '@/components/workbench/operations/content/SectionG_Content';

export default function OperationsContentPage() {
  return <SectionG_Content />;
}
