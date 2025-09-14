'use client';

interface TimeframeFilterProps {
  onSync: (months: number) => void;
  syncing: boolean;
}

export default function TimeframeFilter({ onSync, syncing }: TimeframeFilterProps) {
  const timeframes = [
    { label: '3 months', value: 3 },
    { label: '6 months', value: 6 },
    { label: '9 months', value: 9 },
    { label: '12 months', value: 12 },
    { label: '15 months', value: 15 },
    { label: '18 months', value: 18 },
    { label: '21 months', value: 21 },
    { label: '24 months', value: 24 },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-purple-200 mb-6">
      <h3 className="text-lg font-bold text-purple-700 mb-4">Sync Transaction History</h3>
      <div className="grid grid-cols-4 gap-3">
        {timeframes.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onSync(tf.value)}
            disabled={syncing}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-amber-500 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {syncing ? 'Syncing...' : tf.label}
          </button>
        ))}
      </div>
      {syncing && (
        <div className="mt-4">
          <div className="animate-pulse text-purple-600 text-sm">
            Fetching your transaction history... This may take a moment for large datasets.
          </div>
        </div>
      )}
    </div>
  );
}
