'use client';

import { useEffect } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ResponsiveViewControllerProps {
  userPickedView: boolean;
  defaultView: 'week' | 'month' | 'day';
  setCalendarView: (v: 'week' | 'month' | 'day') => void;
  /**
   * Optional (PR-Ops-Hub-Mobile-Header-1): surfaces the `<768px` signal back to
   * the parent so the Hub toolbar can stack on mobile WITHOUT the parent calling
   * a second `useMediaQuery`. Only passed (defined) by callers that want it —
   * when undefined this controller behaves exactly as in Cal-4.
   */
  onMobileChange?: (isMobile: boolean) => void;
}

/**
 * Behavior-only child (PR-Ops-Cal-4). Mounted by CalendarGrid ONLY when
 * `enableDayView` is true, so the responsive `useMediaQuery` subscription and
 * auto-default effect run exclusively for opting callers — non-opting callers
 * mount nothing and subscribe no listener. Renders null.
 *
 * Below 768px it forces Day view, reverting to `defaultView` when widened, but
 * only until the user taps a view button (`userPickedView` one-way latch lives
 * in the parent and is passed in here).
 *
 * It also OWNS the single `<768px` detection for the whole grid: when
 * `onMobileChange` is supplied it mirrors that signal up to the parent
 * (PR-Ops-Hub-Mobile-Header-1), so there is exactly one `useMediaQuery` in the
 * tree and it only ever runs for callers that mount this child.
 */
export default function ResponsiveViewController({
  userPickedView,
  defaultView,
  setCalendarView,
  onMobileChange,
}: ResponsiveViewControllerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  useEffect(() => {
    if (userPickedView) return;
    setCalendarView(isMobile ? 'day' : defaultView);
  }, [userPickedView, isMobile, defaultView, setCalendarView]);
  useEffect(() => {
    onMobileChange?.(isMobile);
  }, [isMobile, onMobileChange]);

  return null;
}
