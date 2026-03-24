'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';

// Grok response format with sentiment analysis
interface GrokRecommendation {
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  googleRating: number;
  reviewCount: number;
  sentimentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  warnings: string[];
  trending: boolean;
  fitScore: number;
  valueRank: number;
  category: string;
}

interface ScheduledSelection {
  category: string;
  item: GrokRecommendation;
  days: number[];
  allDay: boolean;
  startTime: string;
  endTime: string;
  rateType: 'daily' | 'weekly' | 'monthly';
  customPrice: number;
  splitType: 'personal' | 'split';
}

interface TravelerProfile {
  tripType: string;
  budget: string;
  priorities: string[];
  vibe: string[];
  pace: string;
  groupSize: number;
}

const DEFAULT_PROFILE: TravelerProfile = {
  tripType: 'adventure',
  budget: '100to200',
  priorities: [],
  vibe: [],
  pace: 'balanced',
  groupSize: 1
};

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  activities?: string[];
  month: number;
  year: number;
  daysTravel: number;
  // TODO: Remove onBudgetChange once all budget flows through vendor-commit bridge
  onBudgetChange?: (total: number, items: ScheduledSelection[], groupSize: number) => void;
  committedBudget?: { category: string; amount: number; description: string; photoUrl?: string | null }[];
  participantId?: string;
  initialProfile?: Partial<TravelerProfile>;
  onVendorOptionCreated?: () => void;
  vendorRefreshKey?: number;
}

// Enhanced trip types with images/colors
const TRIP_TYPES = [
  { value: 'remote_work', label: 'Digital Nomad', icon: '💻', color: 'from-blue-500 to-cyan-500', desc: 'Work remotely with reliable wifi & coworking' },
  { value: 'adventure', label: 'Adventure', icon: '🏔️', color: 'from-orange-500 to-red-500', desc: 'Outdoor activities, hiking, extreme sports' },
  { value: 'romantic', label: 'Romantic Escape', icon: '💕', color: 'from-pink-500 to-rose-500', desc: 'Couples getaway, intimate experiences' },
  { value: 'friends', label: 'Squad Trip', icon: '🎊', color: 'from-purple-500 to-indigo-500', desc: 'Group fun, nightlife, shared memories' },
  { value: 'family', label: 'Family Fun', icon: '👨‍👩‍👧‍👦', color: 'from-green-500 to-emerald-500', desc: 'Kid-friendly, safe, educational' },
  { value: 'solo', label: 'Solo Explorer', icon: '🎒', color: 'from-amber-500 to-yellow-500', desc: 'Independent travel, meet locals' },
  { value: 'wellness', label: 'Wellness Retreat', icon: '🧘', color: 'from-teal-500 to-green-500', desc: 'Spa, yoga, meditation, healing' },
  { value: 'cultural', label: 'Culture Seeker', icon: '🏛️', color: 'from-violet-500 to-purple-500', desc: 'Museums, history, local traditions' },
  { value: 'foodie', label: 'Food & Wine', icon: '🍷', color: 'from-red-500 to-pink-500', desc: 'Culinary experiences, local cuisine' },
  { value: 'party', label: 'Party Mode', icon: '🎉', color: 'from-fuchsia-500 to-pink-500', desc: 'Nightlife, festivals, social scenes' },
  { value: 'luxury', label: 'Luxury Escape', icon: '✨', color: 'from-amber-400 to-yellow-300', desc: 'Premium experiences, 5-star service' },
  { value: 'budget', label: 'Budget Backpacker', icon: '🏕️', color: 'from-lime-500 to-green-500', desc: 'Hostels, street food, local transport' },
];

// Budget with context
const BUDGET_OPTIONS = [
  { value: 'backpacker', label: '$0-50', sublabel: '/night', desc: 'Hostels, street food', icon: '🎒', color: 'bg-green-100 border-green-300' },
  { value: 'budget', label: '$50-100', sublabel: '/night', desc: 'Budget hotels, local eats', icon: '💚', color: 'bg-emerald-100 border-emerald-300' },
  { value: 'midrange', label: '$100-200', sublabel: '/night', desc: '3-4 star comfort', icon: '⭐', color: 'bg-brand-purple-wash border-border' },
  { value: 'comfort', label: '$200-350', sublabel: '/night', desc: 'Nice hotels, good dining', icon: '🌟', color: 'bg-purple-100 border-purple-300' },
  { value: 'premium', label: '$350-500', sublabel: '/night', desc: 'Premium experiences', icon: '💫', color: 'bg-amber-100 border-amber-300' },
  { value: 'luxury', label: '$500+', sublabel: '/night', desc: 'Luxury & 5-star', icon: '👑', color: 'bg-yellow-100 border-yellow-300' },
];

// Expanded priorities organized by category
const PRIORITY_GROUPS = [
  {
    label: 'Accommodation',
    priorities: [
      { value: 'wifi', label: 'Fast WiFi', icon: '📶' },
      { value: 'pool', label: 'Pool', icon: '🏊' },
      { value: 'kitchen', label: 'Kitchen', icon: '🍳' },
      { value: 'workspace', label: 'Workspace', icon: '🖥️' },
      { value: 'ac', label: 'A/C', icon: '❄️' },
      { value: 'gym', label: 'Gym', icon: '💪' },
    ]
  },
  {
    label: 'Location',
    priorities: [
      { value: 'central', label: 'Central Location', icon: '📍' },
      { value: 'walkable', label: 'Walkable Area', icon: '🚶' },
      { value: 'beach', label: 'Near Beach', icon: '🏖️' },
      { value: 'nature', label: 'Near Nature', icon: '🌲' },
      { value: 'nightlife', label: 'Near Nightlife', icon: '🌃' },
      { value: 'transit', label: 'Public Transit', icon: '🚇' },
    ]
  },
  {
    label: 'Experience',
    priorities: [
      { value: 'quiet', label: 'Quiet & Peaceful', icon: '🤫' },
      { value: 'social', label: 'Social Scene', icon: '👥' },
      { value: 'authentic', label: 'Authentic Local', icon: '🏠' },
      { value: 'instagram', label: 'Instagrammable', icon: '📸' },
      { value: 'petfriendly', label: 'Pet Friendly', icon: '🐕' },
      { value: 'accessible', label: 'Accessible', icon: '♿' },
    ]
  },
];

// Travel vibe/style
const VIBE_OPTIONS = [
  { value: 'chill', label: 'Chill & Relaxed', icon: '😌', desc: 'No rushing, go with flow' },
  { value: 'active', label: 'Active & Energetic', icon: '⚡', desc: 'Pack in activities' },
  { value: 'spontaneous', label: 'Spontaneous', icon: '🎲', desc: 'Minimal planning' },
  { value: 'planned', label: 'Well Planned', icon: '📋', desc: 'Itinerary ready' },
  { value: 'offbeat', label: 'Off the Beaten Path', icon: '🗺️', desc: 'Hidden gems only' },
  { value: 'touristy', label: 'Hit the Highlights', icon: '🏆', desc: 'Must-see spots' },
  { value: 'local', label: 'Live Like a Local', icon: '🏘️', desc: 'Blend in' },
  { value: 'splurge', label: 'Treat Yourself', icon: '💎', desc: 'Special occasions' },
];

// Pace preference
const PACE_OPTIONS = [
  { value: 'slow', label: 'Slow & Savoring', icon: '🐢', desc: '1-2 activities per day' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️', desc: 'Mix of activity & rest' },
  { value: 'packed', label: 'Action-Packed', icon: '🚀', desc: 'Maximum experiences' },
];

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  lodging: { label: 'Lodging', icon: '🏨' },
  coworking: { label: 'Coworking', icon: '🏢' },
  motoRental: { label: 'Moto/Car Rental', icon: '🏍️' },
  equipmentRental: { label: 'Equipment Rental', icon: '🏄' },
  airportTransfers: { label: 'Airport Transfers', icon: '🚕' },
  brunchCoffee: { label: 'Brunch & Coffee', icon: '☕' },
  dinner: { label: 'Dinner', icon: '🍽️' },
  activities: { label: 'Activities/Tours', icon: '🎯' },
  nightlife: { label: 'Nightlife', icon: '🎉' },
  toiletries: { label: 'Toiletries/Supplies', icon: '🛒' },
  wellness: { label: 'Wellness/Gym', icon: '💆' },
};

// Maps scanner categories to vendor option API endpoints
const CATEGORY_TO_VENDOR_API: Record<string, string> = {
  lodging: 'lodging',
  airportTransfers: 'transfers',
  motoRental: 'vehicles',
  equipmentRental: 'vehicles',
  coworking: 'activities',
  brunchCoffee: 'activities',
  dinner: 'activities',
  activities: 'activities',
  nightlife: 'activities',
  toiletries: 'activities',
  wellness: 'activities',
};

export default function TripPlannerAI({ tripId, city, country, activity, activities = [], month, year, daysTravel, onBudgetChange, committedBudget, participantId, initialProfile, onVendorOptionCreated, vendorRefreshKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [recommendations, setRecommendations] = useState<GrokRecommendation[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, GrokRecommendation[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(50);

  const [selections, setSelections] = useState<ScheduledSelection[]>([]);
  const [editingSelection, setEditingSelection] = useState<ScheduledSelection | null>(null);
  const [editForm, setEditForm] = useState({ days: [] as number[], allDay: true, startTime: '09:00', endTime: '17:00', rateType: 'daily' as 'daily' | 'weekly' | 'monthly', customPrice: 0, splitType: 'personal' as 'personal' | 'split' });

  // Track which recommendations have been added to vendor options (prevents duplicates)
  const [addedToVendorOptions, setAddedToVendorOptions] = useState<Set<string>>(new Set());
  const [savingVendorOption, setSavingVendorOption] = useState(false);
  const [vendorAddCounts, setVendorAddCounts] = useState<Record<string, number>>({});

  // Scanner results metadata (who scanned, when)
  const [scannerMeta, setScannerMeta] = useState<{ scannedBy: string; updatedAt: string } | null>(null);
  const [scannerProfile, setScannerProfile] = useState<TravelerProfile | null>(null);

  // Clear "added" tracking when vendor options change externally (e.g. uncommit deletes the option)
  useEffect(() => {
    if (vendorRefreshKey !== undefined && vendorRefreshKey > 0) {
      setAddedToVendorOptions(new Set());
    }
  }, [vendorRefreshKey]);

  // Load saved scanner results from DB on mount
  useEffect(() => {
    const loadSavedResults = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/scanner-results`);
        if (!res.ok) return;
        const data = await res.json();
        const results = data.results || [];
        if (results.length === 0) return;

        const loaded: Record<string, GrokRecommendation[]> = {};
        let allRecs: GrokRecommendation[] = [];
        let latestMeta: { scannedBy: string; updatedAt: string } | null = null;
        let savedProfile: TravelerProfile | null = null;

        for (const r of results) {
          const recs = r.recommendations as GrokRecommendation[];
          if (recs && recs.length > 0) {
            loaded[r.category] = recs;
            allRecs = [...allRecs, ...recs];
          }
          if (!latestMeta || new Date(r.updatedAt) > new Date(latestMeta.updatedAt)) {
            latestMeta = { scannedBy: r.scannedBy, updatedAt: r.updatedAt };
            if (r.profileSnapshot) savedProfile = r.profileSnapshot as TravelerProfile;
          }
        }

        if (Object.keys(loaded).length > 0) {
          setByCategory(loaded);
          setRecommendations(allRecs.sort((a, b) => a.valueRank - b.valueRank));
          setExpandedCategory(Object.keys(loaded)[0]);
          setScannerMeta(latestMeta);
          setScannerProfile(savedProfile);
        }
      } catch (err) {
        console.error('Failed to load saved scanner results:', err);
      }
    };
    loadSavedResults();
  }, [tripId]);

  const [profile, setProfile] = useState<TravelerProfile>(() => {
    if (initialProfile && (initialProfile.tripType || initialProfile.budget)) {
      return { ...DEFAULT_PROFILE, ...initialProfile };
    }
    return DEFAULT_PROFILE;
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileStep, setProfileStep] = useState(1);

  // Persist profile to DB when modal closes
  const saveProfileToDb = async (profileToSave: TravelerProfile) => {
    if (!participantId) return;
    try {
      await fetch(`/api/trips/${tripId}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, profile: profileToSave }),
      });
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };


  // Custom add state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCategory, setCustomCategory] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ name: "", url: "", price: "", notes: "" });
  const [customLoading, setCustomLoading] = useState(false);
  const [customPreview, setCustomPreview] = useState<{ title: string; image: string | null; price: string | null } | null>(null);
  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);
  const tripActivities = activities.length > 0 ? activities : (activity ? [activity] : []);

  const analyzeDestination = async () => {
    if (!city || !country) { setError('Please select a destination first'); return; }
    setLoading(true);
    setError(null);
    setByCategory({});
    setRecommendations([]);
    setSelections([]);
    setAddedToVendorOptions(new Set());
    setVendorAddCounts({});
    setScannerMeta(null);
    setScannerProfile(null);
    setExpandedCategory(null);
    setCompletedCount(0);

    const categories = Object.keys(CATEGORY_INFO);
    setTotalCategories(categories.length);
    let firstExpanded = false;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      setLoadingCategory(CATEGORY_INFO[cat]?.label || cat);
      setCompletedCount(i);

      try {
        const res = await fetch('/api/trips/' + tripId + '/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city, country, activities: tripActivities, activity, month, year, daysTravel, minRating, minReviews, category: cat, profile })
        });

        // Guard against non-JSON responses (serverless timeout returns HTML)
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error(`[TripAI] ${cat}: non-JSON response — likely timeout`);
          continue;
        }

        if (!res.ok) {
          const d = await res.json();
          console.error(`[TripAI] ${cat} failed:`, d.error);
          continue;
        }

        const data = await res.json();
        const items: GrokRecommendation[] = data.recommendations || [];
        console.log(`[AI] ${cat}: ${items.length} results`);

        if (items.length > 0) {
          setByCategory(prev => ({ ...prev, [cat]: items }));
          setRecommendations(prev => [...prev, ...items].sort((a, b) => a.valueRank - b.valueRank));
          if (!firstExpanded) {
            setExpandedCategory(cat);
            firstExpanded = true;
          }
        }
      } catch (err) {
        console.error(`[TripAI] ${cat} error:`, err);
      }
    }

    setCompletedCount(categories.length);
    setLoadingCategory(null);
    setLoading(false);
  };

  const handleSelectItem = (item: GrokRecommendation) => {
    const newSel: ScheduledSelection = {
      category: item.category, item, days: [1],
      allDay: ['lodging', 'motoRental', 'equipmentRental'].includes(item.category),
      startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0, splitType: 'personal'
    };
    setEditingSelection(newSel);
    setEditForm({ days: [1], allDay: newSel.allDay, startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0, splitType: 'personal' });
  };

  // Build the request body for creating a vendor option based on scanner category
  const buildVendorBody = (sel: ScheduledSelection) => {
    const { category, item, customPrice, days, rateType, splitType } = sel;
    const vendorApi = CATEGORY_TO_VENDOR_API[category];
    const scheduleNote = `Days: ${days.join(', ')} | Rate: ${rateType} | Split: ${splitType}`;
    const aiNote = `AI Score: ${item.sentimentScore}/10 | Fit: ${item.fitScore}/10 | ${item.summary}`;
    const notes = `${scheduleNote}\n${aiNote}`;

    if (vendorApi === 'lodging') {
      return {
        title: item.name,
        url: item.website || null,
        image_url: item.photoUrl || null,
        location: item.address,
        price_per_night: customPrice || null,
        total_price: rateType === 'daily' ? (customPrice * days.length) || null : customPrice || null,
        notes,
      };
    }
    if (vendorApi === 'transfers') {
      return {
        title: item.name,
        url: item.website || null,
        transfer_type: 'private',
        direction: 'airport_to_hotel',
        vendor: item.name,
        price: customPrice || null,
        notes,
      };
    }
    if (vendorApi === 'vehicles') {
      return {
        title: item.name,
        url: item.website || null,
        vehicle_type: category === 'motoRental' ? 'motorbike' : 'equipment',
        vendor: item.name,
        price_per_day: customPrice || null,
        total_price: rateType === 'daily' ? (customPrice * days.length) || null : customPrice || null,
        notes,
      };
    }
    // activities (default for coworking, brunchCoffee, dinner, activities, nightlife, toiletries, wellness)
    return {
      category,
      title: item.name,
      url: item.website || null,
      vendor: item.name,
      price: customPrice || null,
      is_per_person: splitType === 'split',
      notes,
    };
  };

  const confirmSelection = async () => {
    if (!editingSelection || editForm.days.length === 0) return;
    const updated: ScheduledSelection = { ...editingSelection, ...editForm };
    const vendorApi = CATEGORY_TO_VENDOR_API[updated.category];
    if (!vendorApi) return;

    setSavingVendorOption(true);
    try {
      const body = buildVendorBody(updated);
      const res = await fetch(`/api/trips/${tripId}/${vendorApi}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create vendor option');
      }

      // Track as added
      const key = `${updated.category}:${updated.item.name}`;
      setAddedToVendorOptions(prev => new Set(prev).add(key));
      setVendorAddCounts(prev => ({ ...prev, [vendorApi]: (prev[vendorApi] || 0) + 1 }));

      // Still add to selections for onBudgetChange compatibility
      setSelections(prev => {
        const idx = prev.findIndex(s => s.category === updated.category && s.item.name === updated.item.name);
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
        return [...prev, updated];
      });

      // Tell parent to refresh vendor option components
      if (onVendorOptionCreated) onVendorOptionCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vendor option');
    } finally {
      setSavingVendorOption(false);
      setEditingSelection(null);
    }
  };

  const removeSelection = (category: string, name: string) => {
    setSelections(prev => prev.filter(s => !(s.category === category && s.item.name === name)));
  };

  const isAddedToVendor = (item: GrokRecommendation) => addedToVendorOptions.has(`${item.category}:${item.name}`);
  const isSelected = (item: GrokRecommendation) => isAddedToVendor(item) || selections.some(s => s.category === item.category && s.item.name === item.name);

  // Custom spot functions
  const fetchUrlPreview = async (url: string) => {
    if (!url) return;
    setCustomLoading(true);
    try {
      const res = await fetch("/api/fetch-og", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const data = await res.json();
        setCustomPreview({ title: data.title, image: data.image, price: data.price });
        if (data.title && !customForm.name) setCustomForm(f => ({ ...f, name: data.title }));
        if (data.price && !customForm.price) setCustomForm(f => ({ ...f, price: data.price }));
      }
    } catch (err) { console.error("URL fetch failed:", err); }
    finally { setCustomLoading(false); }
  };

  const openCustomModal = (category: string) => {
    setCustomCategory(category);
    setCustomForm({ name: "", url: "", price: "", notes: "" });
    setCustomPreview(null);
    setShowCustomModal(true);
  };

  const handleAddCustomItem = () => {
    if (!customCategory || !customForm.name) return;
    const customItem: GrokRecommendation = {
      name: customForm.name,
      address: customForm.notes || "Custom addition",
      website: customForm.url || null,
      photoUrl: customPreview?.image || null,
      googleRating: 0,
      reviewCount: 0,
      sentimentScore: 10,
      sentiment: "positive",
      summary: "Manually added by you",
      warnings: [],
      trending: false,
      fitScore: 10,
      valueRank: 0,
      category: customCategory
    };
    // Open the scheduling modal so user can set price before DB creation
    handleSelectItem(customItem);
    setShowCustomModal(false);
  };

  const calculateItemCost = (sel: ScheduledSelection): number => {
    const price = sel.customPrice || 0;
    const numDays = sel.days.length;
    switch (sel.rateType) {
      case 'monthly': return price;
      case 'weekly': return price * Math.ceil(numDays / 7);
      default: return price * numDays;
    }
  };

  const totalBudget = useMemo(() => selections.reduce((sum, sel) => sum + calculateItemCost(sel), 0), [selections]);

  useEffect(() => { if (onBudgetChange) onBudgetChange(totalBudget, selections, profile.groupSize); }, [totalBudget, selections, profile.groupSize]);

  const getProfileSummary = () => {
    const tripType = TRIP_TYPES.find(t => t.value === profile.tripType);
    const budget = BUDGET_OPTIONS.find(b => b.value === profile.budget);
    const pace = PACE_OPTIONS.find(p => p.value === profile.pace);
    const vibeLabels = (profile.vibe || []).slice(0, 2).map(v => VIBE_OPTIONS.find(vo => vo.value === v)?.label).filter(Boolean).join(', ');
    const acts = tripActivities.length > 0 ? tripActivities.slice(0, 2).join(', ') : '';
    return [
      tripType?.icon + ' ' + tripType?.label,
      (budget?.label || '') + (budget?.sublabel || ''),
      pace?.label,
      vibeLabels,
      acts
    ].filter(Boolean).join(' • ');
  };

  const formatScanProfile = (p: TravelerProfile) => {
    const tripType = TRIP_TYPES.find(t => t.value === p.tripType);
    const budget = BUDGET_OPTIONS.find(b => b.value === p.budget);
    const pace = PACE_OPTIONS.find(pa => pa.value === p.pace);
    const vibes = (p.vibe || []).map(v => VIBE_OPTIONS.find(vo => vo.value === v)?.label).filter(Boolean);
    const prios = (p.priorities || []).slice(0, 4).join(', ');
    const parts = [
      tripType ? `${tripType.icon} ${tripType.label}` : p.tripType,
      budget ? `${budget.label}${budget.sublabel}` : p.budget,
      prios ? `Priorities: ${prios}` : null,
      vibes.length > 0 ? `Vibe: ${vibes.join(', ')}` : null,
      pace ? pace.label : null,
    ].filter(Boolean);
    return parts.join(' · ');
  };

  const getSentimentColor = (s: string) => s === 'positive' ? 'bg-green-100 text-brand-green' : s === 'negative' ? 'bg-red-100 text-brand-red' : 'bg-bg-row text-text-secondary';
  const getScoreColor = (n: number) => n >= 8 ? 'text-brand-green' : n >= 5 ? 'text-yellow-600' : 'text-brand-red';

  const togglePriority = (value: string) => {
    setProfile(p => ({
      ...p,
      priorities: (p.priorities || []).includes(value) 
        ? (p.priorities || []).filter(x => x !== value)
        : (p.priorities || []).length < 6 ? [...(p.priorities || []), value] : p.priorities
    }));
  };

  const toggleVibe = (value: string) => {
    setProfile(p => ({
      ...p,
      vibe: (p.vibe || []).includes(value) 
        ? (p.vibe || []).filter(x => x !== value)
        : (p.vibe || []).length < 3 ? [...(p.vibe || []), value] : p.vibe
    }));
  };

  const renderSentimentTable = (items: GrokRecommendation[]) => {
    if (!items?.length) return <p className="text-text-faint text-sm py-4 px-4">No recommendations found</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-purple text-white">
              <th className="py-3 px-2 text-center w-10">+</th>
              <th className="py-3 px-2 text-center w-10">#</th>
              <th className="py-3 px-2 w-14">Photo</th>
              <th className="py-3 px-2 text-left">Vendor</th>
              <th className="py-3 px-2 text-center w-20">Sentiment</th>
              <th className="py-3 px-2 text-center w-14">Score</th>
              <th className="py-3 px-2 text-left max-w-[280px]">Summary</th>
              <th className="py-3 px-2 text-left max-w-[140px]">Warnings</th>
              <th className="py-3 px-2 text-center w-12">🔥</th>
              <th className="py-3 px-2 text-center w-14">Fit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec, idx) => {
              const selected = isSelected(rec);
              return (
                <tr key={idx} className={selected ? 'bg-green-50' : idx % 2 ? 'bg-bg-row' : 'bg-white'}>
                  <td className="py-2 px-2 text-center">
                    {isAddedToVendor(rec) ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold" title="Added to Vendor Options">✓</span>
                    ) : (
                      <button onClick={() => handleSelectItem(rec)} className={'w-7 h-7 rounded-full font-bold text-xs ' + (selected ? 'bg-green-500 text-white' : 'bg-border hover:bg-brand-purple hover:text-white')}>
                        {selected ? '✓' : '+'}
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ' + (rec.valueRank <= 3 ? 'bg-green-500 text-white' : rec.valueRank <= 6 ? 'bg-yellow-400 text-white' : 'bg-border')}>{rec.valueRank}</span>
                  </td>
                  <td className="py-2 px-2">
                    {rec.photoUrl ? <img src={rec.photoUrl} alt="" className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-border rounded flex items-center justify-center text-text-faint text-xs">📷</div>}
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-medium text-text-primary">{rec.name}</div>
                    <div className="text-xs text-text-muted">⭐ {rec.googleRating} ({rec.reviewCount}) {rec.website && <a href={rec.website} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline ml-1">Visit →</a>}</div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={'inline-block px-2 py-0.5 rounded-full text-xs font-medium ' + getSentimentColor(rec.sentiment)}>
                      {rec.sentiment === 'positive' ? '👍' : rec.sentiment === 'negative' ? '👎' : '😐'} {rec.sentiment}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={'text-terminal-lg font-bold ' + getScoreColor(rec.sentimentScore)}>{rec.sentimentScore}</span>
                    <span className="text-xs text-text-faint">/10</span>
                  </td>
                  <td className="py-2 px-2 text-xs text-text-secondary max-w-[280px]">
                    <div className="line-clamp-3">{rec.summary}</div>
                  </td>
                  <td className="py-2 px-2 text-xs max-w-[140px]">
                    {rec.warnings.length > 0 ? rec.warnings.slice(0, 2).map((w, i) => <div key={i} className="text-orange-600">⚠️ {w}</div>) : <span className="text-text-faint">—</span>}
                  </td>
                  <td className="py-2 px-2 text-center">{rec.trending ? <span title="Trending">🔥</span> : <span className="text-text-faint">—</span>}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={'inline-block px-2 py-0.5 rounded text-xs font-bold ' + (rec.fitScore >= 8 ? 'bg-green-100 text-brand-green' : rec.fitScore >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-brand-red')}>{rec.fitScore}/10</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Profile Summary - Polished Header */}
      <div className="relative overflow-hidden rounded bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 text-white shadow-sm">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
              <span className="animate-pulse">🤖</span> Powered by Grok AI
            </div>
            <h2 className="text-sm font-bold mb-1">Trip Intelligence</h2>
            <p className="text-white/80 text-sm">{getProfileSummary()}</p>
          </div>
          <button 
            onClick={() => { setShowProfileModal(true); setProfileStep(1); }} 
            className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded text-sm font-semibold transition-all border border-white/20"
          >
            ✏️ Customize Profile
          </button>
        </div>
      </div>

      {/* Search Controls */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-bg-row rounded border border-border">
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1.5">⭐ Min Rating</label>
          <select value={minRating} onChange={e => setMinRating(+e.target.value)} className="border border-border rounded px-3 py-2.5 text-sm bg-white">
            <option value={3.5}>3.5+</option><option value={4.0}>4.0+</option><option value={4.5}>4.5+</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1.5">📊 Min Reviews</label>
          <select value={minReviews} onChange={e => setMinReviews(+e.target.value)} className="border border-border rounded px-3 py-2.5 text-sm bg-white">
            <option value={10}>10+</option><option value={50}>50+</option><option value={100}>100+</option>
          </select>
        </div>
        <Button onClick={analyzeDestination} loading={loading} disabled={!city} className="flex-1 py-3 text-base">
          🔍 Analyze {city || 'Destination'} with AI
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-brand-red text-sm">{error}</div>}

      {loading && (
        <div className="text-center py-16 bg-gradient-to-b from-purple-50 to-white rounded border border-purple-100">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-semibold text-terminal-lg">Grok is analyzing {city}...</p>
          {loadingCategory && (
            <p className="text-purple-600 text-sm mt-2 font-medium">
              {loadingCategory} ({completedCount + 1}/{totalCategories})
            </p>
          )}
          <p className="text-text-faint text-xs mt-1">Each category takes ~30 seconds</p>
          {completedCount > 0 && (
            <div className="mt-4 mx-auto w-64 bg-border rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${(completedCount / totalCategories) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Enhanced Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-2xl w-full shadow-sm max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Tell Us About Your Trip</h3>
                  <p className="text-white/80 text-sm mt-1">So we can find the perfect spots for you</p>
                </div>
                <div className="flex items-center gap-2">
                  {[1,2,3,4].map(step => (
                    <div key={step} className={'w-2.5 h-2.5 rounded-full transition-all ' + (profileStep >= step ? 'bg-white' : 'bg-white/30')} />
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Step 1: Trip Type */}
              {profileStep === 1 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h4 className="font-semibold text-terminal-lg text-text-primary">What kind of trip is this?</h4>
                    <p className="text-text-muted text-sm">Choose the style that best describes your adventure</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {TRIP_TYPES.map(opt => (
                      <button key={opt.value} onClick={() => setProfile(p => ({ ...p, tripType: opt.value }))}
                        className={'relative p-4 rounded border-2 text-center transition-all hover:scale-[1.02] ' + (profile.tripType === opt.value ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-border hover:border-border')}>
                        <div className={'w-12 h-12 mx-auto mb-2 rounded bg-gradient-to-br ' + opt.color + ' flex items-center justify-center text-sm text-white shadow-sm'}>
                          {opt.icon}
                        </div>
                        <div className="font-semibold text-sm text-text-primary">{opt.label}</div>
                        <div className="text-xs text-text-muted mt-1 line-clamp-2">{opt.desc}</div>
                        {profile.tripType === opt.value && <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6">
                    <label className="text-sm font-medium text-text-secondary block mb-2">👥 Group Size</label>
                    <div className="flex gap-2">
                      {[1,2,3,4,5,6,'7+'].map(n => (
                        <button key={n} onClick={() => setProfile(p => ({ ...p, groupSize: typeof n === 'number' ? n : 7 }))}
                          className={'flex-1 py-3 rounded font-medium transition-all ' + (profile.groupSize === (typeof n === 'number' ? n : 7) ? 'bg-purple-500 text-white' : 'bg-bg-row hover:bg-border')}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Budget */}
              {profileStep === 2 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h4 className="font-semibold text-terminal-lg text-text-primary">What's your daily budget?</h4>
                    <p className="text-text-muted text-sm">Per person, including accommodation</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {BUDGET_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setProfile(p => ({ ...p, budget: opt.value }))}
                        className={'relative p-5 rounded border-2 text-left transition-all ' + (profile.budget === opt.value ? 'border-purple-500 bg-purple-50' : opt.color + ' hover:border-border')}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm">{opt.icon}</span>
                          <div>
                            <div className="font-bold text-terminal-lg text-text-primary">{opt.label}<span className="text-sm font-normal text-text-muted">{opt.sublabel}</span></div>
                            <div className="text-sm text-text-muted">{opt.desc}</div>
                          </div>
                        </div>
                        {profile.budget === opt.value && <div className="absolute top-3 right-3 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Priorities */}
              {profileStep === 3 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h4 className="font-semibold text-terminal-lg text-text-primary">What matters most to you?</h4>
                    <p className="text-text-muted text-sm">Select up to 6 priorities • {(profile.priorities || []).length}/6 selected</p>
                  </div>
                  {PRIORITY_GROUPS.map(group => (
                    <div key={group.label} className="mb-4">
                      <h5 className="text-xs font-semibold text-text-faint uppercase tracking-wider mb-2">{group.label}</h5>
                      <div className="flex flex-wrap gap-2">
                        {group.priorities.map(p => (
                          <button key={p.value} onClick={() => togglePriority(p.value)}
                            className={'px-3 py-2 rounded border-2 text-sm font-medium transition-all ' + ((profile.priorities || []).includes(p.value) ? 'border-purple-500 bg-purple-100 text-purple-700' : 'border-border hover:border-border')}>
                            {p.icon} {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4: Vibe & Pace */}
              {profileStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <h4 className="font-semibold text-terminal-lg text-text-primary">What's your travel style?</h4>
                    <p className="text-text-muted text-sm">Help us match the vibe</p>
                  </div>
                  
                  <div>
                    <h5 className="text-sm font-semibold text-text-secondary mb-3">🎭 Travel Vibe <span className="font-normal text-text-faint">(pick up to 3)</span></h5>
                    <div className="grid grid-cols-2 gap-2">
                      {VIBE_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => toggleVibe(opt.value)}
                          className={'p-3 rounded border-2 text-left transition-all ' + ((profile.vibe || []).includes(opt.value) ? 'border-purple-500 bg-purple-50' : 'border-border hover:border-border')}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{opt.icon}</span>
                            <div>
                              <div className="font-medium text-sm">{opt.label}</div>
                              <div className="text-xs text-text-muted">{opt.desc}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-semibold text-text-secondary mb-3">⏱️ Trip Pace</h5>
                    <div className="flex gap-3">
                      {PACE_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setProfile(p => ({ ...p, pace: opt.value }))}
                          className={'flex-1 p-4 rounded border-2 text-center transition-all ' + (profile.pace === opt.value ? 'border-purple-500 bg-purple-50' : 'border-border hover:border-border')}>
                          <div className="text-sm mb-1">{opt.icon}</div>
                          <div className="font-medium text-sm">{opt.label}</div>
                          <div className="text-xs text-text-muted">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border p-4 bg-bg-row flex gap-3">
              {profileStep > 1 && (
                <Button variant="secondary" onClick={() => setProfileStep(s => s - 1)} className="flex-1">
                  ← Back
                </Button>
              )}
              {profileStep < 4 ? (
                <Button onClick={() => setProfileStep(s => s + 1)} className="flex-1">
                  Next →
                </Button>
              ) : (
                <Button onClick={() => { setShowProfileModal(false); saveProfileToDb(profile); }} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600">
                  ✨ Save & Find Spots
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Selection Modal */}
      {editingSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-lg w-full p-6 shadow-sm">
            <h3 className="font-bold text-terminal-lg mb-1">{CATEGORY_INFO[editingSelection.category]?.icon} {editingSelection.item.name}</h3>
            <p className="text-sm text-text-muted mb-4">Sentiment: {editingSelection.item.sentiment} ({editingSelection.item.sentimentScore}/10)</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Rate Type</label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(r => (
                    <button key={r} onClick={() => setEditForm(p => ({...p, rateType: r}))} className={'px-4 py-2 rounded text-sm font-medium ' + (editForm.rateType === r ? 'bg-purple-500 text-white' : 'bg-bg-row')}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Days</label>
                  <div className="flex gap-2">
                    <button onClick={() => setEditForm(p => ({ ...p, days: [...tripDays] }))} className="text-xs px-2 py-1 bg-bg-row rounded">All</button>
                    <button onClick={() => setEditForm(p => ({ ...p, days: [] }))} className="text-xs px-2 py-1 bg-bg-row rounded">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tripDays.map(d => (
                    <button key={d} onClick={() => setEditForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d].sort((a,b) => a-b) }))}
                      className={'w-9 h-9 rounded text-sm font-medium ' + (editForm.days.includes(d) ? 'bg-purple-500 text-white' : 'bg-bg-row')}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="bg-purple-50 rounded p-4 border border-purple-200">
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Price ({editForm.rateType}):</span>
                  <input type="number" value={editForm.customPrice} onChange={e => setEditForm(f => ({ ...f, customPrice: +e.target.value }))} className="w-24 border rounded px-2 py-1 text-right" min={0} />
                </div>
                <div className="flex justify-between text-terminal-lg font-bold text-purple-700 border-t border-purple-200 pt-2 mt-2">
                  <span>Total:</span>
                  <span>${editForm.rateType === 'monthly' ? editForm.customPrice : editForm.rateType === 'weekly' ? editForm.customPrice * Math.ceil(editForm.days.length / 7) : editForm.customPrice * editForm.days.length}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingSelection(null)} className="flex-1">Cancel</Button>
              <Button onClick={confirmSelection} className="flex-1" disabled={editForm.days.length === 0 || savingVendorOption} loading={savingVendorOption}>
                {savingVendorOption ? 'Adding...' : '✓ Add to Vendor Options'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Add Modal */}
      {showCustomModal && customCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-lg w-full shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white">
              <h3 className="font-bold text-terminal-lg">➕ Add Custom {CATEGORY_INFO[customCategory]?.label}</h3>
              <p className="text-white/80 text-sm">Paste a URL or enter details manually</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">🔗 Paste URL (optional)</label>
                <div className="flex gap-2">
                  <input type="url" value={customForm.url} onChange={e => setCustomForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="flex-1 border border-border rounded px-3 py-2.5 text-sm" />
                  <button onClick={() => fetchUrlPreview(customForm.url)} disabled={!customForm.url || customLoading} className="px-4 py-2 bg-purple-500 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-purple-600">
                    {customLoading ? "..." : "Fetch"}
                  </button>
                </div>
              </div>
              {customPreview?.image && (
                <div className="rounded overflow-hidden border border-border">
                  <img src={customPreview.image} alt="Preview" className="w-full h-40 object-cover" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">📍 Name *</label>
                <input type="text" value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))} placeholder="Villa Sunset Paradise" className="w-full border border-border rounded px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">💰 Price</label>
                <input type="text" value={customForm.price} onChange={e => setCustomForm(f => ({ ...f, price: e.target.value }))} placeholder="$150/night" className="w-full border border-border rounded px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">📝 Notes (optional)</label>
                <input type="text" value={customForm.notes} onChange={e => setCustomForm(f => ({ ...f, notes: e.target.value }))} placeholder="Great reviews, close to beach" className="w-full border border-border rounded px-3 py-2.5 text-sm" />
              </div>
            </div>
            <div className="border-t border-border p-4 bg-bg-row flex gap-3">
              <Button variant="secondary" onClick={() => setShowCustomModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddCustomItem} className="flex-1" disabled={!customForm.name}>➕ Add to Plan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Options Added Summary */}
      {addedToVendorOptions.size > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-green-800 text-sm">✓ {addedToVendorOptions.size} vendor option{addedToVendorOptions.size !== 1 ? 's' : ''} added</h3>
              <p className="text-green-700 text-xs mt-1">
                {Object.entries(vendorAddCounts).map(([api, count]) => `${count} ${api}`).join(', ')}
                {' — scroll to Step 5 to review and commit'}
              </p>
            </div>
            <div className="text-green-600 text-xs font-medium">
              Step 5: Vendor Options ↓
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {Object.keys(byCategory).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-text-primary">📊 AI Analysis Results <span className="text-sm font-normal text-text-muted">({recommendations.length} places)</span></h3>
            {scannerMeta && !loading && (
              <span className="text-xs text-text-muted">
                Scanned by {scannerMeta.scannedBy.split('@')[0]} · {new Date(scannerMeta.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {scannerProfile && !loading && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-purple-50 border border-purple-200 rounded text-xs text-purple-800">
              <span>{formatScanProfile(scannerProfile)}</span>
              {!participantId && (
                <button onClick={() => setShowProfileModal(true)} className="text-purple-600 hover:text-purple-800 font-medium ml-3 whitespace-nowrap">Customize</button>
              )}
            </div>
          )}
          {!scannerProfile && Object.keys(byCategory).length > 0 && !loading && (
            <div className="px-4 py-2 bg-bg-row border border-border rounded text-xs text-text-muted">Default profile used</div>
          )}
          {Object.entries(byCategory).map(([cat, items]) => {
            const info = CATEGORY_INFO[cat] || { label: cat, icon: '📍' };
            const isOpen = expandedCategory === cat;
            return (
              <div key={cat} className="border border-border rounded overflow-hidden">
                <button onClick={() => setExpandedCategory(isOpen ? null : cat)} className="w-full flex justify-between items-center px-5 py-4 bg-bg-row hover:bg-bg-row transition-colors">
                  <span className="flex items-center gap-3"><span className="text-sm">{info.icon}</span><span className="font-semibold">{info.label}</span></span>
                  <span className="flex items-center gap-3"><span className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">{items.length}</span><span className={'transition-transform ' + (isOpen ? 'rotate-180' : '')}>▼</span></span>
                </button>
                {isOpen && (<>
                {renderSentimentTable(items)}
                <div className="px-5 py-3 bg-bg-row border-t border-border">
                  <button onClick={() => openCustomModal(cat)} className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">+</span>
                    Add Custom {info.label}
                  </button>
                </div>
              </>)}
              </div>
            );
          })}
        </div>
      )}

      {!loading && Object.keys(byCategory).length === 0 && !error && (
        <div className="text-center py-16 bg-gradient-to-b from-bg-row to-white rounded border border-border">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="font-bold text-sm text-text-primary mb-2">Grok AI Trip Analyzer</h3>
          <p className="text-text-muted">Customize your profile, pick a destination, and let AI find the perfect spots</p>
        </div>
      )}
    </div>
  );
}
