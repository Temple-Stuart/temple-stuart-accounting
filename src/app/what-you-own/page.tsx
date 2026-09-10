import { redirect } from 'next/navigation';

// SHELL-01: the six family pages are retired. HOME (/answers) carries the whole
// sheet — every job in its step, with its true status — and the rail walks the
// steps in flow order. WHAT YOU OWN's map lives there now; the URL keeps resolving.
export default function WhatYouOwnPage() {
  redirect('/home');
}
