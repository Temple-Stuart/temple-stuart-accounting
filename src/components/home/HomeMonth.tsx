'use client';

/**
 * HomeMonth — HOME LEDGER · MONTH on /home (HOME-LEDGER-02a, Alex, 2026-11-07, rulings A, B, D).
 *
 * THE HOST of Budget's own report on the home page: it prints the heading, then renders budget/BudgetReport.tsx — the
 * ONE component /budget renders, never a second model, never a copy; every figure drills through /api/budget/report/cell
 * exactly as on /budget; the BANK row per currency and the #1886 gap line sit under its tables on both pages — and then
 * THE TRAVEL PLAN (home/TravelPlan.tsx): the trip budget lines, one row each, never summed, which Budget's files may
 * not read.
 *
 * ONE PICKER ON /home (ruling A, HOME-LEDGER-01's ruling A): the day is the DAY CARD's — the same `date` in the URL the
 * card reads (DAY_CARD_PATH '/home'; DayCard.tsx — ?date= when it is a day, else the browser's today, localToday, read
 * on mount), by the card's own expression — and this host hands BudgetReport that day's YEAR as { from: 'host', year }:
 * no year step, no second picker, no second today. ‹ › on the card moves the day; the month table and the travel plan
 * follow its year. Nothing is defaulted here.
 *
 * The month table is Budget's, the travel plan the shell's, as the DAY table is: no registry row.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BudgetReport from '@/components/budget/BudgetReport';
import TravelPlan from '@/components/home/TravelPlan';
import { isIsoDay } from '@/lib/budget/days';
import { HOME_LEDGER_KICKER_WORDS, HOME_LEDGER_MONTH_HEADING, HOME_LEDGER_MONTH_LINE_WORDS } from '@/lib/home/homeLedger';
import { localToday } from '@/lib/localToday';

export default function HomeMonth() {
  const search = useSearchParams();
  const [today, setToday] = useState<string | null>(null);

  // The browser's today, read on mount — never during the server render (the card's own rule, DayCard.tsx).
  useEffect(() => {
    setToday(localToday());
  }, []);

  // Ruling A — the card's day, by the card's own expression: ?date= when it is a day, else today (a bad ?date= is named by the card).
  const dateParam = search.get('date');
  const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;
  // The card's year — the first four characters of its 'YYYY-MM-DD' day.
  const year = day === null ? null : day.slice(0, 4);

  return (
    <section aria-label="Home ledger — month" data-home-month className="mt-5 sm:mt-6">
      <header className="mb-3">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">{HOME_LEDGER_KICKER_WORDS}</p>
        <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-text-primary" data-home-month-heading>{HOME_LEDGER_MONTH_HEADING}</h2>
        <p className="mt-1 text-xs text-text-muted">{HOME_LEDGER_MONTH_LINE_WORDS}</p>
        {year !== null && <p className="mt-1 font-mono text-xs text-text-secondary" data-home-month-year={year}>year {year}</p>}
      </header>

      {year !== null && (
        <div className="rounded-lg border border-border bg-white p-4" data-home-month-report>
          {/* Ruling A: Budget's own report, on the card's year — no step. */}
          <BudgetReport year={{ from: 'host', year }} />
        </div>
      )}

      {/* Ruling B: the trip budget lines, their own table, never summed — under the month table. */}
      {year !== null && <TravelPlan year={year} />}
    </section>
  );
}
