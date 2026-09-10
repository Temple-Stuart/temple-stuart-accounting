import { notFound } from 'next/navigation';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import AppLayout from '@/components/ui/AppLayout';
import { StatusChip } from '@/components/home/ToolChrome';
import { STEPS, stepBySlug, stepStatus, toolsOfStep } from '@/lib/steps';

/**
 * SHELL-01 — a step with no room. The rail walks every step, including the four
 * the product has not built; this page is what they open. It states the step's
 * jobs, each job's status and the registry citation that placed it, and says
 * plainly that it is not built — never a placeholder card, never a mock action,
 * never a redirect that pretends the step went somewhere.
 *
 * A step that HAS a room never renders here: its slug 404s, so the rail's own
 * door (the room) is the only way in and there is no second, emptier copy of a
 * built step.
 *
 * Auth: a protected path — middleware bounces an unverified visitor to '/'
 * before this renders; the verified cookie names the viewer for the shell bar
 * only, and nothing here touches the database (the /answers shape).
 */
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return STEPS.filter((s) => s.screen === null).map((s) => ({ slug: s.slug }));
}

export default async function StepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const step = stepBySlug(slug);
  // A built step's room IS its page; only the roomless steps have one here.
  if (!step || step.screen !== null) notFound();
  const viewer = await getVerifiedEmail();
  const tools = toolsOfStep(step);

  return (
    <AppLayout page>
      <header className="mb-5">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">
          Step {step.number} <span className="text-brand-gold">·</span> {step.family}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">{step.name}</h1>
          <StatusChip status={stepStatus(step, tools)} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          This step is not built. There is no screen, no route and no data behind it — the jobs it
          would hold are listed below with the census line for each, so what is missing is as legible
          as what is finished.
        </p>
      </header>

      <ul className="space-y-3" data-step-jobs={step.slug}>
        {tools.map((tool) => (
          <li key={tool.slug} className="rounded-lg border border-border bg-white p-3" data-job={tool.slug}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">{tool.name}</span>
              <StatusChip status={tool.status} />
            </div>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-text-muted">{tool.why?.trim() ? tool.why : tool.citation}</p>
          </li>
        ))}
      </ul>
    </AppLayout>
  );
}
