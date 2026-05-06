/**
 * src/app/operations/audit-log/page.tsx
 *
 * Section K · Audit Tail — operations-filtered hash-chained audit log
 * with verify-chain control. The only Operations sub-tab in PR-Ops-2a
 * that ships with real, working content (besides the chrome itself).
 */

import SectionK_AuditTail from '@/components/workbench/operations/SectionK_AuditTail';

export default function OperationsAuditLogPage() {
  return <SectionK_AuditTail />;
}
