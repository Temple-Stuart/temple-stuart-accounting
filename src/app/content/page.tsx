import { redirect } from 'next/navigation';

// ROOM-02: step 12 is ONE room at /operations, read top down. The room called
// Content is phase 05 NARRATIVE (the label changed, the routes did not).
export default function ContentRedirect() {
  redirect('/operations?phase=narrative');
}
