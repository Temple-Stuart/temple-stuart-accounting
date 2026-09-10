import { redirect } from 'next/navigation';

// TOOL-LAW-01: the room this hop pointed into is gone. One hop, to the owner.
export default function OperationsRoutinesRedirect() {
  redirect('/calendar');
}
