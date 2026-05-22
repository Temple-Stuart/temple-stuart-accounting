'use client';

import { useEffect } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ResponsiveViewControllerProps {
  userPickedView: boolean;
  defaultView: 'week' | 'month' | 'day';
  setCalendarView: (v: 'week' | 'month' | 'day') => void;
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
 */
export default function ResponsiveViewController({
  userPickedView,
  defaultView,
  setCalendarView,
}: ResponsiveViewControllerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  useEffect(() => {
    if (userPickedView) return;
    setCalendarView(isMobile ? 'day' : defaultView);
  }, [userPickedView, isMobile, defaultView, setCalendarView]);

  return null;
}
