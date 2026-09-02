import { getVerifiedEmail } from '@/lib/cookie-auth';
import AnswersClient from '@/components/answers/AnswersClient';

/**
 * NAV-01c — /answers, THE ANSWERS: the app's front page and the post-login
 * front door (LoginBox, /login and /hub all land here). The deck's step 11 on
 * the viewer's own lines — four cards in ANSWER_ROWS order, then Net worth as
 * a read (src/lib/answers.ts).
 *
 * Auth: a protected path — middleware (src/middleware.ts) bounces an
 * unverified visitor to '/' before this renders; every read a card makes is
 * user-scoped and cookie-gated in its own route (401/403 print as the card's
 * declared state, never a number). The verified cookie names the viewer for
 * the shell bar; nothing here touches the database, so the page renders for a
 * signed cookie alone — the NAV-01c verification shape.
 */
export const dynamic = 'force-dynamic';

export default async function AnswersPage() {
  const viewer = await getVerifiedEmail();
  return <AnswersClient viewer={viewer ?? ''} />;
}
