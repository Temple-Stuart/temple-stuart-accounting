'use client';

/**
 * NAV-01c — THE ANSWERS, the app's front page: the deck's step 11 on the
 * viewer's own lines. Four cards in ANSWER_ROWS order — the question and the
 * math line verbatim from the deck (money words ink gold, as there) — and the
 * NUMBER when a computation exists in the code today, with its SOURCE LINE
 * beside it (ANSWER_READS, src/lib/answers.ts; a number with no source fails
 * the build). Below the four: Net worth as a READ, sourced the same way.
 *
 * Fail loud (HYG-01): a read that fails prints its HTTP status and the
 * route's own error, never a number; an empty ledger prints the empty state in
 * words, never $0 as if it were a sum. No retry, no fallback, no placeholder.
 *
 * The shell is the one shell (NAV-01b): ShellBar + the family navigation in
 * link mode (THE ANSWERS is its first entry). Mobile: cards stack; ≥10px.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ShellBar from '@/components/ui/ShellBar';
import FamilyNav from '@/components/home/FamilyNav';
import { deriveRunwayReceipts } from '@/components/hub/RunwayBudgetPanel';
import { ANSWER_ROWS, ANSWER_READS, NET_WORTH_READ, type AnswerRead, type ComputedRead } from '@/lib/answers';

type Read<T> = { status: 'reading' } | { status: 'failed'; message: string } | { status: 'ok'; data: T };

/** One cookie-gated GET. A non-2xx answer or a network failure is a declared failure — never retried, never defaulted. */
async function readJson<T>(endpoint: string): Promise<Read<T>> {
  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body.error === 'string') detail = body.error;
      } catch {
        detail = 'no error body';
      }
      return { status: 'failed', message: `HTTP ${res.status}${detail ? ` · ${detail}` : ''}` };
    }
    return { status: 'ok', data: (await res.json()) as T };
  } catch (e) {
    return { status: 'failed', message: `network — ${e instanceof Error ? e.message : String(e)}` };
  }
}

function useRead<T>(endpoint: string): Read<T> {
  const [read, setRead] = useState<Read<T>>({ status: 'reading' });
  useEffect(() => {
    let live = true;
    readJson<T>(endpoint).then((r) => { if (live) setRead(r); });
    return () => { live = false; };
  }, [endpoint]);
  return read;
}

const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const signed = (n: number) => `${n < 0 ? '−' : '+'}${usd(n)}`;
const niceDate = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const YEAR = new Date().getFullYear();

/** What a card shows once its read resolved: a number (with its detail), or the declared state in words. */
type Figure = { kind: 'number'; value: string; tone: 'pos' | 'neg' | 'flat'; detail: string; note?: string } | { kind: 'state'; text: string; detail?: string };

// ── the four lenses + the read, each a pure map from the route's own answer to a Figure ──

interface TaxAnswer {
  tax_year: number;
  disclaimer: string;
  form_1040_full: { line9: number; totalTax: number; totalPayments: number; amountOwed: number; filingStatus: string };
}
function taxFigure(d: TaxAnswer): Figure {
  const f = d.form_1040_full;
  if (f.line9 === 0) return { kind: 'state', text: `No income on the lines for ${d.tax_year} — nothing to tax yet.`, detail: `${f.filingStatus} · ${d.disclaimer}` };
  return {
    kind: 'number',
    value: `${f.amountOwed < 0 ? 'refund ' : 'owe '}${usd(f.amountOwed)}`,
    tone: f.amountOwed > 0 ? 'neg' : 'pos',
    detail: `tax year ${d.tax_year} · income ${usd(f.line9)} · total tax ${usd(f.totalTax)} · paid or withheld ${usd(f.totalPayments)} · ${f.filingStatus}`,
    note: d.disclaimer,
  };
}

type RunwayAnswer = Parameters<typeof deriveRunwayReceipts>[0];
function runwayFigure(d: RunwayAnswer): Figure {
  const r = deriveRunwayReceipts(d);
  const w = d.windows[0];
  const basis = `cash ${r.cash ?? 'no bank linked'} (${r.accountsLinked} linked account${r.accountsLinked === 1 ? '' : 's'}) · burn ${r.burnLine ?? '—'} over the trailing ${w.months} full months · as of ${d.asOf}`;
  if (r.runwayValue === null || w.state !== 'ok') return { kind: 'state', text: r.runwayEmpty, detail: basis };
  return { kind: 'number', value: r.runwayValue, tone: 'flat', detail: `zero date ${niceDate(w.zeroDate as string)} · ${basis}` };
}

interface TradingAnswer { summary: { totalRealizedPL: number; openPositions: number; closedPositions: number; winRate: number } }
function tradingFigure(d: TradingAnswer): Figure {
  const s = d.summary;
  if (s.closedPositions === 0 && s.openPositions === 0) return { kind: 'state', text: 'No trades committed yet — nothing to score.' };
  return {
    kind: 'number',
    value: `${signed(s.totalRealizedPL)} realized`,
    tone: s.totalRealizedPL < 0 ? 'neg' : 'pos',
    detail: `${s.closedPositions} closed · win rate ${s.winRate}% · ${s.openPositions} open (counted, not priced)`,
  };
}

interface EntitiesAnswer { entities: Array<{ id: string; name: string; entity_type: string }> }
interface StatementsAnswer { accounts: Array<{ accountType: string; debits: number; credits: number; entityName: string | null }> }
/** Money in minus money out for the sole-prop entity, from the statements read (ledger cents → dollars). */
function businessFigure(entities: EntitiesAnswer['entities'], statements: ReadonlyArray<StatementsAnswer>): Figure {
  if (entities.length === 0) return { kind: 'state', text: 'No business (sole-prop) entity on your books — nothing to sum.' };
  const rows = statements.flatMap((s) => s.accounts);
  if (rows.length === 0) return { kind: 'state', text: `No journal entries committed for ${YEAR} on ${entities.map((e) => e.name).join(', ')}.` };
  let moneyIn = 0;
  let moneyOut = 0;
  for (const a of rows) {
    if (a.accountType === 'revenue') moneyIn += (a.credits - a.debits) / 100;
    else if (a.accountType === 'expense') moneyOut += (a.debits - a.credits) / 100;
  }
  const net = moneyIn - moneyOut;
  return {
    kind: 'number',
    value: `${signed(net)} net`,
    tone: net < 0 ? 'neg' : 'pos',
    detail: `money in ${usd(moneyIn)} − money out ${usd(moneyOut)} · ${YEAR} · ${entities.map((e) => e.name).join(', ')}`,
  };
}

interface NetWorthAnswer { summary: { totalAssets: number; totalDebt: number; netWorth: number }; assets: unknown[]; debt: unknown[] }
function netWorthFigure(d: NetWorthAnswer): Figure {
  if (d.assets.length === 0 && d.debt.length === 0) return { kind: 'state', text: 'No asset or debt lines from your linked accounts yet.' };
  return {
    kind: 'number',
    value: `${d.summary.netWorth < 0 ? '−' : ''}${usd(d.summary.netWorth)}`,
    tone: d.summary.netWorth < 0 ? 'neg' : 'pos',
    detail: `assets ${usd(d.summary.totalAssets)} − debt ${usd(d.summary.totalDebt)}`,
  };
}

// ── rendering ──

const TONE: Record<'pos' | 'neg' | 'flat', string> = { pos: 'text-emerald-700', neg: 'text-rose-700', flat: 'text-text-primary' };

function FigureBlock({ read, figure }: { read: Read<unknown>; figure: (d: never) => Figure }) {
  if (read.status === 'reading') return <p className="font-mono text-xs text-text-faint" data-read="reading">Reading…</p>;
  if (read.status === 'failed') return <p role="alert" className="font-mono text-xs text-rose-700" data-read="failed">Could not read — {read.message}</p>;
  const f = figure(read.data as never);
  if (f.kind === 'state') {
    return (
      <div data-read="state">
        <p className="font-mono text-sm text-text-secondary">{f.text}</p>
        {f.detail && <p className="mt-1 text-[10px] text-text-faint">{f.detail}</p>}
      </div>
    );
  }
  return (
    <div data-read="number">
      <p className={`font-mono text-2xl sm:text-3xl tracking-tight tabular-nums ${TONE[f.tone]}`}>{f.value}</p>
      <p className="mt-1 text-[10px] text-text-faint">{f.detail}</p>
      {f.note && <p className="mt-1 text-[10px] text-text-faint italic">{f.note}</p>}
    </div>
  );
}

/** The card frame: the question, the math line, the read (number or state), and — for a computed read — its source line. */
function AnswerCard({ question, math, read, children }: { question: string; math: ReadonlyArray<readonly [string, boolean]>; read: AnswerRead; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-2 rounded border border-border bg-white p-4 sm:p-5" data-answer={question}>
      <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text-primary">{question}</h2>
      <p className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-text-secondary" data-math>
        {math.map(([text, gold], i) => (gold ? <span key={i} className="text-brand-gold">{text}</span> : <span key={i}>{text}</span>))}
      </p>
      <div className="mt-1 min-h-[3rem]">{children}</div>
      {read.computed ? (
        <>
          <p className="text-[10px] leading-relaxed text-text-muted" data-source>
            <span className="font-mono uppercase tracking-wider text-text-faint">Source · </span>
            {read.source}
          </p>
          <Link href={read.home} className="self-start rounded border border-brand-purple px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-purple hover:bg-brand-purple-wash">
            Open · {read.home}
          </Link>
        </>
      ) : (
        <p className="text-[10px] leading-relaxed text-text-muted" data-honest>{read.honest}</p>
      )}
    </article>
  );
}

function TaxCard({ question, math, read }: { question: string; math: ReadonlyArray<readonly [string, boolean]>; read: ComputedRead }) {
  const r = useRead<TaxAnswer>(`${read.endpoint}?year=${YEAR}`);
  return <AnswerCard question={question} math={math} read={read}><FigureBlock read={r} figure={taxFigure} /></AnswerCard>;
}
function RunwayCard({ question, math, read }: { question: string; math: ReadonlyArray<readonly [string, boolean]>; read: ComputedRead }) {
  const r = useRead<RunwayAnswer>(read.endpoint);
  return <AnswerCard question={question} math={math} read={read}><FigureBlock read={r} figure={runwayFigure} /></AnswerCard>;
}
function TradingCard({ question, math, read }: { question: string; math: ReadonlyArray<readonly [string, boolean]>; read: ComputedRead }) {
  const r = useRead<TradingAnswer>(read.endpoint);
  return <AnswerCard question={question} math={math} read={read}><FigureBlock read={r} figure={tradingFigure} /></AnswerCard>;
}
function BusinessCard({ question, math, read }: { question: string; math: ReadonlyArray<readonly [string, boolean]>; read: ComputedRead }) {
  // Two reads, one source: the sole-prop entity (entities), then its statements for the year.
  const [r, setR] = useState<Read<{ entities: EntitiesAnswer['entities']; statements: StatementsAnswer[] }>>({ status: 'reading' });
  useEffect(() => {
    let live = true;
    (async () => {
      const ents = await readJson<EntitiesAnswer>('/api/entities');
      if (ents.status !== 'ok') { if (live) setR(ents); return; }
      const business = ents.data.entities.filter((e) => e.entity_type === 'sole_prop');
      const statements: StatementsAnswer[] = [];
      for (const e of business) {
        const s = await readJson<StatementsAnswer>(`${read.endpoint}?year=${YEAR}&entityId=${encodeURIComponent(e.id)}`);
        if (s.status !== 'ok') { if (live) setR(s); return; }
        statements.push(s.data);
      }
      if (live) setR({ status: 'ok', data: { entities: business, statements } });
    })();
    return () => { live = false; };
  }, [read.endpoint]);
  return (
    <AnswerCard question={question} math={math} read={read}>
      <FigureBlock read={r} figure={(d: { entities: EntitiesAnswer['entities']; statements: StatementsAnswer[] }) => businessFigure(d.entities, d.statements)} />
    </AnswerCard>
  );
}

/** Which card renders which lens — keyed by the read's endpoint, so the questions themselves come from ANSWER_ROWS only. */
const CARD_BY_ENDPOINT: Record<string, typeof TaxCard> = {
  '/api/tax/calculate': TaxCard,
  '/api/runway': RunwayCard,
  '/api/positions/summary': TradingCard,
  '/api/statements': BusinessCard,
};

export default function AnswersClient({ viewer }: { viewer: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // The utilities menu is admin-only (the same /api/auth/me flag both headers read). A failed
  // profile read is declared, never swallowed: no menu, and the failure printed under the bar.
  useEffect(() => {
    let live = true;
    readJson<{ user: { isAdmin?: boolean } }>('/api/auth/me').then((r) => {
      if (!live) return;
      if (r.status === 'ok') setIsAdmin(Boolean(r.data.user.isAdmin));
      else if (r.status === 'failed') setProfileError(r.message);
    });
    return () => { live = false; };
  }, []);

  const handleSignOut = async () => {
    document.cookie = 'userEmail=; path=/; max-age=0';
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  };

  const netWorth = useRead<NetWorthAnswer>(NET_WORTH_READ.endpoint);

  return (
    <div className="min-h-screen bg-bg-terminal flex flex-col">
      <ShellBar userLabel={viewer.split('@')[0]} isAdmin={isAdmin} onSignOut={handleSignOut} />
      <FamilyNav />
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 sm:py-8">
        {profileError && (
          <p role="alert" className="mb-4 font-mono text-[10px] text-rose-700">Profile read failed — {profileError}. Utilities hidden.</p>
        )}
        <header className="mb-5 sm:mb-6">
          <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">The answers</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">Every answer is math on the lines.</h1>
          <p className="mt-1 text-xs text-text-muted">Four questions, each a number with its source, or the honest state in words.</p>
        </header>

        {/* The four, ANSWER_ROWS order. Cards stack on a phone, two-up from sm. */}
        <section aria-label="The four answers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4" data-answers>
          {ANSWER_ROWS.map(([question, math]) => {
            const read = ANSWER_READS[question];
            if (!read.computed) return <AnswerCard key={question} question={question} math={math} read={read}><p className="font-mono text-sm text-text-secondary">{read.honest}</p></AnswerCard>;
            const Card = CARD_BY_ENDPOINT[read.endpoint];
            if (!Card) throw new Error(`THE ANSWERS: no card renders ${read.endpoint} ("${question}")`);
            return <Card key={question} question={question} math={math} read={read} />;
          })}
        </section>

        {/* Below the four: Net worth as a read. */}
        <section aria-label="Net worth" className="mt-5 sm:mt-6" data-net-worth>
          <AnswerCard question="Net worth" math={[['Assets', true], [' minus ', false], ['debt', true], ['; a read.', false]]} read={NET_WORTH_READ}>
            <FigureBlock read={netWorth} figure={netWorthFigure} />
          </AnswerCard>
        </section>
      </main>
    </div>
  );
}
