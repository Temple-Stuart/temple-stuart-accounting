import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the Operations shell's Content page mounted the same ContentPipeline the
// cockpit's Content section mounts (Time's home).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function OperationsContentRedirect() {
  redirect('/content');
}
