'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button } from '@/components/ui';

const CATEGORY_GROUPS = [
  {
    label: 'Build (Temple Stuart)',
    category: 'build',
    icon: '🧱',
    color: 'bg-brand-purple-wash0',
    subcategories: [
      { value: 'product', label: 'Product Build', icon: '🧱', description: 'Code/features' },
      { value: 'qa', label: 'QA / Bug Fixing', icon: '🧪', description: 'Testing & fixes' },
      { value: 'bookkeeping', label: 'Bookkeeping / Admin', icon: '🧾', description: 'Invoices, banking, taxes' },
      { value: 'strategy', label: 'Strategy / Roadmap', icon: '🧠', description: 'Planning & direction' },
      { value: 'marketing', label: 'Marketing / Content', icon: '📣', description: 'Distribution' },
      { value: 'sales', label: 'Sales / Outreach', icon: '☎️', description: 'Revenue generation' },
      { value: 'discovery', label: 'Customer Discovery', icon: '🎧', description: 'Calls/interviews' },
      { value: 'partnerships', label: 'Partnerships', icon: '🤝', description: 'APIs, affiliates, collabs' },
    ],
    intensities: ['Deep Work', 'Admin', 'Creative', 'Calls'],
    definitionOfDone: [
      'One shippable commit/PR',
      'One user-facing improvement deployed',
      'Notes logged (what/why/next)'
    ]
  },
  {
    label: 'Fitness (1 hour daily)',
    category: 'fitness',
    icon: '💪',
    color: 'bg-green-500',
    subcategories: [
      { value: 'yoga', label: 'Yoga', icon: '🧘', description: 'Flexibility & mindfulness' },
      { value: 'gym', label: 'Gym / Weights', icon: '🏋️', description: 'Strength training' },
      { value: 'fight', label: 'Fight Class', icon: '🥊', description: 'Boxing, BJJ, etc.' },
      { value: 'tennis', label: 'Tennis', icon: '🎾', description: 'Court sports' },
      { value: 'pickleball', label: 'Pickleball', icon: '🏓', description: 'Social sport' },
      { value: 'golf', label: 'Golf', icon: '⛳', description: '18 holes' },
      { value: 'swim', label: 'Swim', icon: '🏊', description: 'Laps or open water' },
      { value: 'surf', label: 'Surf', icon: '🏄', description: 'Catch waves' },
      { value: 'kite', label: 'Kite Surf', icon: '🪁', description: 'Wind sports' },
      { value: 'bike', label: 'Bike', icon: '🚴', description: 'Road or trail' },
    ],
    intensities: ['Light', 'Moderate', 'Hard'],
    definitionOfDone: [
      '60 min completed',
      'Recovery note (sleep/soreness) optional'
    ]
  },
  {
    label: 'Trading (system + execution)',
    category: 'trading',
    icon: '📊',
    color: 'bg-purple-500',
    subcategories: [
      { value: 'market_prep', label: 'Market Prep', icon: '📊', description: 'Scan/news/watchlist' },
      { value: 'research', label: 'Research / Thesis', icon: '🧪', description: 'Deep analysis' },
      { value: 'strategy', label: 'Strategy Design', icon: '🧠', description: 'New approaches' },
      { value: 'backtest', label: 'Backtesting', icon: '💻', description: 'Historical testing' },
      { value: 'build_algo', label: 'Build / Code Algo', icon: '🧰', description: 'Automation' },
      { value: 'paper_trade', label: 'Paper Trade', icon: '✅', description: 'Forward test' },
      { value: 'journal', label: 'Journal + Review', icon: '📝', description: 'Learn from trades' },
      { value: 'risk_review', label: 'Risk Review', icon: '🧯', description: 'Limits, exposure, rules' },
    ],
    intensities: ['Research', 'Build', 'Execute', 'Review'],
    definitionOfDone: [
      'Scan completed',
      'Plan written before entries',
      'Journal updated after'
    ]
  },
  {
    label: 'Community (anti-introvert mode)',
    category: 'community',
    icon: '🤝',
    color: 'bg-orange-500',
    subcategories: [
      { value: 'coffee', label: 'Founder Coffee / 1:1', icon: '☕', description: 'Deep conversation' },
      { value: 'meetup', label: 'Meetup / Event', icon: '🎤', description: 'Group gathering' },
      { value: 'coworking', label: 'Coworking / Work Session', icon: '🤝', description: 'Meet people' },
      { value: 'host', label: 'Host Something', icon: '🧩', description: 'Dinner, mastermind, beach' },
      { value: 'outreach', label: 'Outreach', icon: '📥', description: 'DMs / invites' },
      { value: 'building', label: 'Community Building', icon: '🧑‍🤝‍🧑', description: 'Group chat, follow-ups' },
    ],
    intensities: ['Low-pressure', 'Social', 'Host mode'],
    definitionOfDone: [
      'Spoke to X new people',
      'Follow-up sent',
      'Next hang/event created'
    ]
  },
  {
    label: 'Shopping',
    category: 'shopping',
    icon: '🛒',
    color: 'bg-pink-500',
    subcategories: [
      { value: 'groceries', label: 'Groceries', icon: '🥑', description: 'Food shopping' },
      { value: 'household', label: 'Household Items', icon: '🏠', description: 'Home supplies' },
      { value: 'personal', label: 'Personal Items', icon: '🧴', description: 'Self-care, clothes' },
      { value: 'electronics', label: 'Electronics', icon: '💻', description: 'Tech gear' },
    ],
    intensities: ['Quick run', 'Big haul', 'Research mode'],
    definitionOfDone: [
      'List completed',
      'Budget tracked'
    ]
  },
  {
    label: 'Vehicle',
    category: 'vehicle',
    icon: '🚗',
    color: 'bg-bg-row0',
    subcategories: [
      { value: 'maintenance', label: 'Maintenance', icon: '🔧', description: 'Oil, tires, etc.' },
      { value: 'wash', label: 'Car Wash', icon: '🧽', description: 'Clean inside/out' },
      { value: 'gas', label: 'Gas / Charging', icon: '⛽', description: 'Fuel up' },
      { value: 'insurance', label: 'Insurance / Registration', icon: '📋', description: 'Paperwork' },
    ],
    intensities: ['Quick stop', 'Full service', 'DIY'],
    definitionOfDone: [
      'Task completed',
      'Receipt logged'
    ]
  },
];

const CADENCES = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'custom', label: 'Custom (choose days)' },
];

const TIME_BLOCKS = [
  { value: 'morning', label: '🌅 Morning' },
  { value: 'midday', label: '☀️ Midday' },
  { value: 'afternoon', label: '🌤️ Afternoon' },
  { value: 'evening', label: '🌙 Evening' },
  { value: 'flexible', label: '🔄 Flexible' },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

const COA_CODES: Record<string, { code: string; name: string }[]> = {
  build: [{ code: 'B-6100', name: 'Software & Tools' }],
  fitness: [
    { code: 'P-6700', name: 'Fitness & Wellness' },
    { code: 'P-6710', name: 'Gym Membership' },
  ],
  trading: [{ code: 'P-5200', name: 'Market Data' }],
  community: [{ code: 'P-6100', name: 'Meals & Dining' }],
  shopping: [
    { code: 'P-6200', name: 'Travel Expense' },
    { code: 'P-6300', name: 'Groceries' },
  ],
  vehicle: [
    { code: 'P-8120', name: 'Auto Payment' },
    { code: 'P-8130', name: 'Auto Insurance' },
    { code: 'P-8140', name: 'Auto Gas' },
  ],
};

export default function NewAgendaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [cadence, setCadence] = useState('once');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeBlock, setTimeBlock] = useState('flexible');
  const [durationMins, setDurationMins] = useState(60);
  const [intensity, setIntensity] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedDOD, setSelectedDOD] = useState<string[]>([]);
  const [coaCode, setCoaCode] = useState('');
  const [budgetAmount, setBudgetAmount] = useState(0);

  const categoryConfig = CATEGORY_GROUPS.find(g => g.category === selectedCategory);

  const handleSubmit = async () => {
    if (!name || !selectedCategory) {
      setError('Name and category are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: selectedCategory,
          subcategory: selectedSubcategory || null,
          cadence,
          startDate: startDate || null,
          endDate: endDate || null,
          timeBlock,
          durationMins,
          intensity: intensity || null,
          goal: goal || null,
          definitionOfDone: selectedDOD.length > 0 ? selectedDOD : null,
          coaCode: coaCode || null,
          budgetAmount: budgetAmount || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create agenda item');
      }

      const { item } = await res.json();
      router.push(`/agenda/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/agenda')} className="text-text-faint hover:text-text-secondary">
            ← Back
          </button>
          <div>
            <h1 className="text-sm font-bold text-text-primary">New Agenda Item</h1>
            <p className="text-text-muted">Plan your routine block</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-brand-red">
            {error}
          </div>
        )}

        {/* Step 1: Category Selection */}
        {step === 1 && (
          <div>
            <h2 className="text-terminal-lg font-semibold text-text-primary mb-4">Select Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CATEGORY_GROUPS.map(group => (
                <div
                  key={group.category}
                  className={`p-4 cursor-pointer transition-all hover:shadow-sm ${
                    selectedCategory === group.category 
                      ? 'ring-2 ring-brand-accent border-brand-accent' 
                      : 'hover:border-border'
                  }`}
                  onClick={() => {
                    setSelectedCategory(group.category);
                    setSelectedSubcategory('');
                    setIntensity('');
                    setSelectedDOD([]);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-12 h-12 ${group.color} rounded flex items-center justify-center text-sm text-white`}>
                      {group.icon}
                    </span>
                    <div>
                      <div className="font-semibold text-text-primary">{group.label}</div>
                      <div className="text-sm text-text-muted">{group.subcategories.length} types</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedCategory && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-text-primary mb-3">Select Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {categoryConfig?.subcategories.map(sub => (
                    <button
                      key={sub.value}
                      onClick={() => setSelectedSubcategory(sub.value)}
                      className={`p-3 rounded border text-left transition-all ${
                        selectedSubcategory === sub.value
                          ? 'border-brand-accent bg-brand-accent/10'
                          : 'border-border hover:border-border'
                      }`}
                    >
                      <span className="text-sm">{sub.icon}</span>
                      <div className="font-medium text-text-primary text-sm mt-1">{sub.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedCategory && (
              <Button
                onClick={() => setStep(2)}
                className="mt-6 bg-brand-accent hover:bg-brand-accent-dark text-white"
              >
                Next: Details →
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="text-text-faint hover:text-text-secondary mb-4">
              ← Back to Category
            </button>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Agenda Item Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g., ${categoryConfig?.subcategories[0]?.description || 'Daily task'}`}
                  className="w-full px-4 py-3 border border-border rounded focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>

              {/* Cadence */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Cadence</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {CADENCES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setCadence(c.value)}
                      className={`p-3 rounded border text-center transition-all ${
                        cadence === c.value
                          ? 'border-brand-accent bg-brand-accent/10'
                          : 'border-border hover:border-border'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded"
                  />
                </div>
              </div>

              {/* Time Block */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Preferred Time</label>
                <div className="flex flex-wrap gap-2">
                  {TIME_BLOCKS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTimeBlock(t.value)}
                      className={`px-4 py-2 rounded border transition-all ${
                        timeBlock === t.value
                          ? 'border-brand-accent bg-brand-accent/10'
                          : 'border-border hover:border-border'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Duration (minutes)</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDurationMins(d)}
                      className={`px-4 py-2 rounded border transition-all ${
                        durationMins === d
                          ? 'border-brand-accent bg-brand-accent/10'
                          : 'border-border hover:border-border'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity */}
              {categoryConfig?.intensities && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Intensity / Mode</label>
                  <div className="flex flex-wrap gap-2">
                    {categoryConfig.intensities.map(i => (
                      <button
                        key={i}
                        onClick={() => setIntensity(i)}
                        className={`px-4 py-2 rounded border transition-all ${
                          intensity === i
                            ? 'border-brand-accent bg-brand-accent/10'
                            : 'border-border hover:border-border'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={() => setStep(3)} className="bg-brand-accent hover:bg-brand-accent-dark text-white">
                Next: Goal & Budget →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Goal & Budget */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} className="text-text-faint hover:text-text-secondary mb-4">
              ← Back to Details
            </button>

            <div className="space-y-6">
              {/* Goal */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Goal (1-liner)</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Merge Plaid mapping refactor"
                  className="w-full px-4 py-3 border border-border rounded"
                />
              </div>

              {/* Definition of Done */}
              {categoryConfig?.definitionOfDone && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Definition of Done</label>
                  <div className="space-y-2">
                    {categoryConfig.definitionOfDone.map(item => (
                      <label key={item} className="flex items-center gap-3 p-3 border border-border rounded cursor-pointer hover:bg-bg-row">
                        <input
                          type="checkbox"
                          checked={selectedDOD.includes(item)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDOD([...selectedDOD, item]);
                            } else {
                              setSelectedDOD(selectedDOD.filter(d => d !== item));
                            }
                          }}
                          className="w-5 h-5 rounded border-border text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-text-secondary">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget */}
              <div className="p-6 bg-bg-row">
                <h3 className="font-semibold text-text-primary mb-4">Budget (optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">COA Code</label>
                    <select
                      value={coaCode}
                      onChange={(e) => setCoaCode(e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded"
                    >
                      <option value="">Select...</option>
                      {COA_CODES[selectedCategory]?.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Monthly Budget ($)</label>
                    <input
                      type="number"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-4 py-3 border border-border rounded"
                    />
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="p-4 bg-brand-purple-wash border-blue-200">
                <div className="flex items-start gap-3">
                  <span className="text-sm">💡</span>
                  <div className="text-sm text-blue-800">
                    <strong>How it works:</strong> Add agenda items to your routine. 
                    The app can auto-suggest a daily stack (Build + Fitness + Trading + Community) 
                    and track streaks, time spent, and outcomes.
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-6">
                <h3 className="font-semibold text-text-primary mb-4">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Category:</span>
                    <span className="font-medium">{categoryConfig?.label}</span>
                  </div>
                  {selectedSubcategory && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Type:</span>
                      <span className="font-medium">{categoryConfig?.subcategories.find(s => s.value === selectedSubcategory)?.label}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-muted">Cadence:</span>
                    <span className="font-medium">{CADENCES.find(c => c.value === cadence)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Duration:</span>
                    <span className="font-medium">{durationMins} min</span>
                  </div>
                  {budgetAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Monthly Budget:</span>
                      <span className="font-medium text-brand-accent-dark">${budgetAmount}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={saving || !name}
                className="w-full bg-brand-accent hover:bg-brand-accent-dark text-white py-4"
              >
                {saving ? 'Creating...' : 'Create Agenda Item'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
