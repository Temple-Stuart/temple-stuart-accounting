'use client';

import { useState } from 'react';

/**
 * EXPORT-1b: the shared one-click export behavior — busy state, inline error,
 * success = the browser downloads the dated zip from GET /api/export
 * (EXPORT-1's route: NEVER paywalled — verified email + user scoping only;
 * see the route's constitutional header). One hook, two mounts: the Books
 * tab's CPA-context button (BooksPipeline) and the authed header chip
 * (HomeClient) — identical behavior by construction, no duplicated fetch
 * logic. Fail-loud: any non-OK response (including the 413 oversize refusal)
 * renders the server's honest message verbatim.
 */
export function useExportDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Export failed (status ${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `temple-stuart-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}
