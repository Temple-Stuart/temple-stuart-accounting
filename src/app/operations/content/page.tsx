import { redirect } from 'next/navigation';

// ROOM-02: this hop used to land on the cockpit tab /content, which is now a
// redirect of its own. It goes straight to the room's phase — one hop, not two.
export default function OperationsContentRedirect() {
  redirect('/operations?phase=narrative');
}
