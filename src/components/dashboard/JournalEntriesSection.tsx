'use client';

import { useState } from 'react';

export function JournalEntriesSection({ entityId }: { entityId: string }) {
  const [journalEntries] = useState<any[]>([]);
  
  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-terminal-lg font-medium mb-4">Journal Entries</h2>
      <p className="text-text-secondary">Create and manage journal entries with double-entry validation.</p>
      {/* Full implementation would go here */}
    </div>
  );
}
