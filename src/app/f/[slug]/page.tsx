import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { intakeFormOf, isFormSlug, publicFormOf } from '@/lib/crm/forms';
import IntakeFormClient from '@/components/crm/IntakeFormClient';

/**
 * /f/<slug> (CRM-02, Alex, 2026-11-07) — AN ACCOUNT'S OWN INTAKE FORM, at its own public link, and as an embed on their
 * own site (?embed=1 — the same page inside an iframe; next.config.ts's CSP sets no frame-ancestors, so it frames today).
 * PUBLIC BY RULING (src/middleware.ts PUBLIC_PATHS '/f'): a server page with no cookie and no auth — SAFE because it
 * reads ONE crm_forms row by its public slug (a slug outside the rule names no row; none → notFound()) and hands the
 * client nothing of the account beyond the form's title, line and the questions ASKED (src/lib/crm/forms.ts
 * publicFormOf — a hidden question never leaves the server; no id, no owner). No paid call, no write: the write is the
 * client's POST to /api/f/<slug>. force-dynamic: the questions are read per request, so an edit on /crm is live at the
 * link at once. Its door is the link on /crm (IntakeFormSetup.tsx); GUEST_ROUTES lists it. This is the ONLY file under
 * src/app/f (the middleware's '/f' entry says so); its client half is src/components/crm/IntakeFormClient.tsx.
 */

export const dynamic = 'force-dynamic';

export default async function IntakeFormPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  if (!isFormSlug(slug)) notFound();
  const row = await prisma.crm_forms.findUnique({ where: { slug }, select: { id: true, slug: true, title: true, line: true, questions: true } });
  if (row === null) notFound();
  return <IntakeFormClient form={publicFormOf(intakeFormOf(row))} embed={query.embed === '1'} />;
}
