'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { ACTIVITY_LABELS } from '@/lib/activities';
import { TRAVEL_COA, getActiveScanCategories } from '@/lib/travelCOA';
import { getSource, type Source } from '@/lib/travelSourceRegistry';
import { Waves, Wifi, Coffee, Dumbbell, Flower2, Car, type LucideIcon } from 'lucide-react';

// Grok response format with sentiment analysis
interface GrokRecommendation {
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
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
  compositeScore?: number;
  // Viator-specific fields (present when result is from Viator API)
  viatorProductCode?: string;
  bookingUrl?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
  // LiteAPI-specific fields (present when result is from LiteAPI / accommodation)
  liteapiHotelId?: string;
  liteapiOfferId?: string | null;
  // LiteAPI richness (PR-13 mapper output; PR-14 renders these — all optional,
  // Viator/Google leave them undefined). Present at runtime in the JSON column
  // since PR-13; typed here so the card can read them.
  city?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  reviewScore?: number;
  chain?: string;
  images?: string[];
  facilities?: string[];
  currency?: string;
  priceTotal?: number;
  nights?: number;
  pricePerNight?: number; // PR-15: priceTotal / nights (per-night display + bucketing)
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

type SortBy = 'rating' | 'price' | 'reviews' | 'name';

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  activities?: string[];
  month: number;
  year: number;
  daysTravel: number;
  tripDates?: { departure: string; return: string } | null;
  onCommitted?: () => void;
}

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  lodging: { label: 'Lodging', icon: '' },
  coworking: { label: 'Coworking', icon: '' },
  motoRental: { label: 'Moto/Car Rental', icon: '' },
  equipmentRental: { label: 'Equipment Rental', icon: '' },
  airportTransfers: { label: 'Airport Transfers', icon: '' },
  brunchCoffee: { label: 'Brunch & Coffee', icon: '' },
  dinner: { label: 'Dinner', icon: '' },
  // PR-11: 'activities' is the unified Viator carousel — label rendered as
  // the carousel header next to the "via Viator" source attribution.
  // Pre-PR-11 this entry read 'Activities/Tours' (legacy CATEGORY_SEARCHES
  // key); now it doubles as the canonical label for the unified bucket.
  activities: { label: 'Activities', icon: '' },
  nightlife: { label: 'Nightlife', icon: '' },
  toiletries: { label: 'Toiletries/Supplies', icon: '' },
  wellness: { label: 'Wellness/Gym', icon: '' },
  // PR-10 Fix 3: defensive label entry so any stale client bundle / cache
  // path still resolves to "Adventure" instead of falling through to a
  // pre-PR-9 TRAVEL_COA snapshot that still says "Sports & Fitness".
  adventure: { label: 'Adventure', icon: '' },
};

const FREQUENCY_OPTIONS = [
  { value: 'per_night', label: '/night' },
  { value: 'per_day', label: '/day' },
  { value: 'per_visit', label: '/visit' },
  { value: 'per_trip', label: '/trip' },
  { value: 'total', label: 'total' },
] as const;

const CATEGORY_DEFAULT_FREQ: Record<string, string> = {
  lodging: 'per_night',
  brunchCoffee: 'per_visit',
  dinner: 'per_visit',
  activities: 'per_visit',
  coworking: 'per_day',
  wellness: 'per_visit',
  nightlife: 'per_visit',
  airportTransfers: 'per_trip',
  motoRental: 'per_day',
  equipmentRental: 'per_day',
  toiletries: 'total',
};

const CATEGORY_VENDOR_INFO: Record<string, { vendorApi: string; optionType: string; multiDay: boolean }> = {
  lodging: { vendorApi: 'lodging', optionType: 'lodging', multiDay: true },
  brunchCoffee: { vendorApi: 'activities', optionType: 'activity', multiDay: false },
  dinner: { vendorApi: 'activities', optionType: 'activity', multiDay: false },
  activities: { vendorApi: 'activities', optionType: 'activity', multiDay: false },
  coworking: { vendorApi: 'activities', optionType: 'activity', multiDay: true },
  wellness: { vendorApi: 'activities', optionType: 'activity', multiDay: false },
  nightlife: { vendorApi: 'activities', optionType: 'activity', multiDay: false },
  airportTransfers: { vendorApi: 'transfers', optionType: 'transfer', multiDay: false },
  motoRental: { vendorApi: 'vehicles', optionType: 'vehicle', multiDay: true },
  equipmentRental: { vendorApi: 'vehicles', optionType: 'vehicle', multiDay: true },
  toiletries: { vendorApi: 'activities', optionType: 'activity', multiDay: false },
};

function calcDaysBetween(start: string, end?: string): number {
  if (!start || !end) return 1;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(ms / 86400000);
  return days > 0 ? days : 1;
}

function calcTotal(unitPrice: number, frequency: string, start: string, end?: string): number {
  if (frequency === 'per_night' || frequency === 'per_day') {
    return unitPrice * calcDaysBetween(start, end);
  }
  return unitPrice;
}

function formatFreqLabel(frequency: string): string {
  return FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label || frequency;
}

// Default start/end times by category
const CATEGORY_DEFAULT_TIMES: Record<string, { startTime: string; endTime: string }> = {
  lodging: { startTime: '15:00', endTime: '11:00' },
  dinner: { startTime: '19:00', endTime: '21:00' },
  brunchCoffee: { startTime: '09:00', endTime: '10:30' },
  activities: { startTime: '10:00', endTime: '12:00' },
  nightlife: { startTime: '21:00', endTime: '00:00' },
  coworking: { startTime: '09:00', endTime: '17:00' },
  wellness: { startTime: '10:00', endTime: '11:30' },
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

export default function TripPlannerAI({ tripId, city, country, activity, activities = [], month, year, daysTravel, tripDates, onCommitted }: Props) {
  const router = useRouter();
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
  const [maxPriceLevel, setMaxPriceLevel] = useState(0); // 0 = any
  const [sortBy, setSortBy] = useState<SortBy>('rating'); // Expedia-style result sort
  // Photos are lazy: only fetched (and billed) when the user opens a result.
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set());

  const [selections, setSelections] = useState<ScheduledSelection[]>([]);
  const [editingSelection, setEditingSelection] = useState<ScheduledSelection | null>(null);
  const [editForm, setEditForm] = useState({ days: [] as number[], allDay: true, startTime: '09:00', endTime: '17:00', rateType: 'daily' as 'daily' | 'weekly' | 'monthly', customPrice: 0, splitType: 'personal' as 'personal' | 'split' });

  const [savingVendorOption, setSavingVendorOption] = useState(false);

  // Scanner results metadata (who scanned, when)
  const [scannerMeta, setScannerMeta] = useState<{ scannedBy: string; updatedAt: string } | null>(null);

  // Card commit state
  const [commitCardKey, setCommitCardKey] = useState<string | null>(null);
  const [committingCard, setCommittingCard] = useState<string | null>(null);
  const [committedCards, setCommittedCards] = useState<Record<string, { optionType: string; optionId: string }>>({});
  const [cardPrices, setCardPrices] = useState<Record<string, string>>({});
  const [cardDates, setCardDates] = useState<Record<string, { start: string; end?: string }>>({});
  const [cardFrequency, setCardFrequency] = useState<Record<string, string>>({});
  const [cardTimes, setCardTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});

  // LiteAPI Reserve flow (PR-3b) — tracks the in-flight reserve + each card's
  // confirmation result. Intentionally minimal UI per scope; PR-4 rebuilds
  // the booking UX with proper checkout panels.
  const [reservingKey, setReservingKey] = useState<string | null>(null);
  const [reservedKeys, setReservedKeys] = useState<Record<string, { confirmationCode: string | null; bookingId: string }>>({});

  // PR-4: per-category loading + error state for the auto-load carousels.
  // `loadingCategories` is the Set of category keys still in-flight;
  // `categoryErrors` is the inline banner per category. Independent of the
  // global `error` + `loading` flags so one bad category doesn't blank the page.
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set());
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});

  // Load saved scanner results from DB on mount
  useEffect(() => {
    const loadSavedThenAutoScan = async () => {
      // 1. Hydrate from persisted scanner_results — repeat opens see content
      // immediately, no Google/Viator/LiteAPI calls needed.
      const loaded: Record<string, GrokRecommendation[]> = {};
      try {
        const res = await fetch(`/api/trips/${tripId}/scanner-results`);
        if (res.ok) {
          const data = await res.json();
          const results = data.results || [];
          let allRecs: GrokRecommendation[] = [];
          let latestMeta: { scannedBy: string; updatedAt: string } | null = null;

          for (const r of results) {
            const recs = r.recommendations as GrokRecommendation[];
            if (recs && recs.length > 0) {
              loaded[r.category] = recs;
              allRecs = [...allRecs, ...recs];
            }
            if (!latestMeta || new Date(r.updatedAt) > new Date(latestMeta.updatedAt)) {
              latestMeta = { scannedBy: r.scannedBy, updatedAt: r.updatedAt };
            }
          }
          if (Object.keys(loaded).length > 0) {
            setByCategory(loaded);
            setRecommendations(allRecs.sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0) || a.valueRank - b.valueRank));
            setScannerMeta(latestMeta);
          }
        }
      } catch (err) {
        console.error('Failed to load saved scanner results:', err);
      }

      // 2. Auto-scan ONLY the categories not already cached. Per-category
      // isolation (Promise.allSettled inside autoScanCategoriesFor) so a
      // single failure doesn't block the rest.
      if (!city || !country) return;
      const activeCoaKeys = getActiveScanCategories([], '');
      const missing = activeCoaKeys.filter(k => !(k in loaded));
      if (missing.length === 0) return;
      await autoScanCategoriesFor(missing);
    };
    loadSavedThenAutoScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, city, country]);

  // Custom add state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCategory, setCustomCategory] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ name: "", url: "", price: "", notes: "" });
  const [customLoading, setCustomLoading] = useState(false);
  const [customPreview, setCustomPreview] = useState<{ title: string; image: string | null; price: string | null } | null>(null);
  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);
  const tripActivities = activities.length > 0 ? activities : (activity ? [activity] : []);

  // ─── PR-4 auto-load orchestrator ─────────────────────────────────────────
  // Replaces the old "Search" button. Fires every active category in PARALLEL
  // via Promise.allSettled so one category's failure (e.g. Brunch's
  // INVALID_REQUEST, or LiteAPI's missing key) does NOT block the others.
  // Failed categories surface as inline banners in their carousel slot
  // (categoryErrors map); other categories continue to load + display.
  const scanSingleCategory = async (catKey: string, catLabel: string, catMaxResults: number) => {
    const res = await fetch(`/api/trips/${tripId}/ai-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, country, activities: tripActivities, activity, month, year, daysTravel, minRating, minReviews, maxPriceLevel: maxPriceLevel || undefined, category: catKey, maxResults: catMaxResults }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Couldn't load ${catLabel} — request timed out. Try again.`);
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const upstream = d.error || `HTTP ${res.status}`;
      throw new Error(`Couldn't load ${catLabel} — ${upstream}`);
    }
    const data = await res.json();
    return (data.recommendations || []) as GrokRecommendation[];
  };

  // Scan a specific set of category keys in parallel. Leaves byCategory keys
  // that aren't in the list untouched (so cached categories stay rendered
  // while missing ones load).
  const autoScanCategoriesFor = async (catKeys: string[]) => {
    if (!city || !country || catKeys.length === 0) return;
    setError(null);

    type ScanCategory = { key: string; label: string; maxResults: number };
    const categoriesToScan: ScanCategory[] = catKeys.map(key => ({
      key,
      label: TRAVEL_COA[key]?.label || key,
      maxResults: 33,
    }));

    setLoading(true);
    setTotalCategories(categoriesToScan.length);
    setLoadingCategories(new Set(categoriesToScan.map(c => c.key)));

    await Promise.allSettled(
      categoriesToScan.map(async ({ key: cat, label: catLabel, maxResults: catMaxResults }) => {
        try {
          const items = await scanSingleCategory(cat, catLabel, catMaxResults);
          setByCategory(prev => ({ ...prev, [cat]: items }));
          setRecommendations(prev => [...prev, ...items].sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0)));
          setCategoryErrors(prev => {
            if (!(cat in prev)) return prev;
            const next = { ...prev };
            delete next[cat];
            return next;
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Scan] ${cat} failed:`, msg);
          setCategoryErrors(prev => ({ ...prev, [cat]: msg }));
        } finally {
          setLoadingCategories(prev => {
            const next = new Set(prev);
            next.delete(cat);
            return next;
          });
          setCompletedCount(c => c + 1);
        }
      })
    );

    setLoadingCategory(null);
    setLoading(false);
  };

  // Full re-scan trigger — clears state and scans every active category.
  // Used by the "Refresh" button at the top of the planner section.
  const rescanAll = async () => {
    setByCategory({});
    setRecommendations([]);
    setSelections([]);
    setScannerMeta(null);
    setCategoryErrors({});
    setCompletedCount(0);
    const activeCoaKeys = getActiveScanCategories([], '');
    await autoScanCategoriesFor(activeCoaKeys);
  };

  // Expedia-style client-side sort of results within a category.
  const sortItems = (items: GrokRecommendation[]): GrokRecommendation[] => {
    const copy = [...items];
    switch (sortBy) {
      case 'price':
        return copy.sort((a, b) => (a.priceLevel ?? 99) - (b.priceLevel ?? 99));
      case 'reviews':
        return copy.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      case 'name':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'rating':
      default:
        return copy.sort((a, b) => (b.googleRating || 0) - (a.googleRating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    }
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
    const vendorApi = CATEGORY_TO_VENDOR_API[category] || 'activities';
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
        direction: 'arrival',
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
      image_url: item.photoUrl || null,
      vendor: item.name,
      price: customPrice || null,
      is_per_person: splitType === 'split',
      notes,
    };
  };

  const confirmSelection = async () => {
    if (!editingSelection || editForm.days.length === 0) return;
    const updated: ScheduledSelection = { ...editingSelection, ...editForm };
    const vendorApi = CATEGORY_TO_VENDOR_API[updated.category] || 'activities';
    if (!vendorApi) return;

    setSavingVendorOption(true);
    try {
      // For airport transfers, create both arrival and departure records
      if (vendorApi === 'transfers') {
        const arrivalBody = { ...buildVendorBody(updated), direction: 'arrival' };
        const departureBody = { ...buildVendorBody(updated), direction: 'departure' };

        const arrRes = await fetch(`/api/trips/${tripId}/transfers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(arrivalBody),
        });
        if (!arrRes.ok) {
          const data = await arrRes.json();
          throw new Error(data.error || 'Failed to create arrival transfer');
        }

        const depRes = await fetch(`/api/trips/${tripId}/transfers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(departureBody),
        });
        if (!depRes.ok) {
          const data = await depRes.json();
          throw new Error(data.error || 'Failed to create departure transfer');
        }
      } else {
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
      }

      // Still add to selections for onBudgetChange compatibility
      setSelections(prev => {
        const idx = prev.findIndex(s => s.category === updated.category && s.item.name === updated.item.name);
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
        return [...prev, updated];
      });

      if (onCommitted) onCommitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vendor option');
    } finally {
      setSavingVendorOption(false);
      setEditingSelection(null);
    }
  };

  // Direct commit from scanner card: create vendor option then commit it
  const handleCommitCard = async (rec: GrokRecommendation) => {
    const cardKey = `${rec.category}:${rec.name}`;
    const coaInfo = TRAVEL_COA[rec.category];
    const catInfo = CATEGORY_VENDOR_INFO[rec.category] || (coaInfo ? { vendorApi: coaInfo.vendorApi, optionType: coaInfo.optionType, multiDay: coaInfo.multiDay } : { vendorApi: 'activities', optionType: 'activity', multiDay: false });
    const unitPrice = parseFloat(cardPrices[cardKey] || '0');
    const dates = cardDates[cardKey];
    const freq = cardFrequency[cardKey] || CATEGORY_DEFAULT_FREQ[rec.category] || 'total';
    if (!unitPrice || !dates?.start) return;

    const totalPrice = calcTotal(unitPrice, freq, dates.start, dates.end);
    const days = calcDaysBetween(dates.start, dates.end);
    const rateNote = freq === 'total' ? `Rate: $${unitPrice} total` : `Rate: $${unitPrice}${formatFreqLabel(freq)} × ${days} ${freq === 'per_night' ? 'nights' : 'days'} = $${totalPrice}`;

    setCommittingCard(cardKey);
    try {
      // Step 1: Create the vendor option record
      const aiNote = `${rec.googleRating} stars (${rec.reviewCount} reviews)\n${rateNote}`;
      let body: Record<string, any> = {};
      const vendorApi = catInfo.vendorApi;

      if (vendorApi === 'lodging') {
        body = { title: rec.name, url: rec.website || null, image_url: rec.photoUrl || null, location: rec.address, price_per_night: unitPrice, total_price: totalPrice, notes: aiNote };
      } else if (vendorApi === 'transfers') {
        body = { title: rec.name, url: rec.website || null, transfer_type: 'private', direction: 'arrival', vendor: rec.name, price: totalPrice, notes: aiNote };
      } else if (vendorApi === 'vehicles') {
        body = { title: rec.name, url: rec.website || null, vehicle_type: rec.category === 'motoRental' ? 'motorbike' : 'equipment', vendor: rec.name, price_per_day: unitPrice, total_price: totalPrice, notes: aiNote };
      } else {
        body = { category: rec.category, title: rec.name, url: rec.website || null, image_url: rec.photoUrl || null, vendor: rec.name, price: totalPrice, is_per_person: true, notes: aiNote };
      }

      const createRes = await fetch(`/api/trips/${tripId}/${vendorApi}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!createRes.ok) { const d = await createRes.json(); throw new Error(d.error || 'Failed to create option'); }
      const created = await createRes.json();
      const optionId = created.option?.id;
      if (!optionId) throw new Error('No option ID returned');

      // For transfers, also create departure
      let depOptionId: string | null = null;
      if (vendorApi === 'transfers') {
        const depRes = await fetch(`/api/trips/${tripId}/transfers`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, direction: 'departure' }),
        });
        if (depRes.ok) { const dep = await depRes.json(); depOptionId = dep.option?.id; }
      }

      // Step 2: Commit via vendor-commit endpoint (with times and location)
      const times = cardTimes[cardKey];
      const commitRes = await fetch(`/api/trips/${tripId}/vendor-commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: catInfo.optionType, optionId,
          startDate: dates.start, endDate: dates.end || null,
          startTime: times?.startTime || null,
          endTime: times?.endTime || null,
          location: rec.address || null,
        }),
      });
      if (!commitRes.ok) { const d = await commitRes.json(); throw new Error(d.error || 'Commit failed'); }

      // Commit departure transfer too
      if (depOptionId) {
        await fetch(`/api/trips/${tripId}/vendor-commit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionType: 'transfer', optionId: depOptionId, startDate: dates.start, endDate: dates.end || dates.start }),
        });
      }

      setCommittedCards(prev => ({ ...prev, [cardKey]: { optionType: catInfo.optionType, optionId } }));
      setCommitCardKey(null);
      if (onCommitted) onCommitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setCommittingCard(null);
    }
  };

  const handleUncommitCard = async (cardKey: string, optionType: string, optionId: string) => {
    if (!confirm('Uncommit this option?')) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/vendor-commit`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionType, optionId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setCommittedCards(prev => { const n = { ...prev }; delete n[cardKey]; return n; });
      if (onCommitted) onCommitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uncommit failed');
    }
  };

  // ─── LiteAPI Reserve flow (PR-3b) ────────────────────────────────────────
  // Minimal: prebook → book in one click. Sandbox-only this PR — LiteAPI's
  // sandbox accepts the prebook's transactionId without real card capture, so
  // this proves the end-to-end pipe without integrating the payment SDK yet.
  // PR-4 adds the proper checkout panel + LiteAPI's hosted payment SDK.
  const handleLiteApiReserve = async (rec: GrokRecommendation, cardKey: string) => {
    if (!rec.liteapiOfferId) {
      setError(`Reserve unavailable — no bookable offer for ${rec.name}`);
      return;
    }
    if (!tripDates?.departure || !tripDates?.return) {
      setError('Reserve unavailable — set trip Start/End dates first');
      return;
    }
    setReservingKey(cardKey);
    setError(null);
    try {
      // 1. Prebook — get the SDK transactionId + final price.
      const prebookRes = await fetch('/api/travel/liteapi/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, offerId: rec.liteapiOfferId }),
      });
      const prebookBody = await prebookRes.json().catch(() => ({}));
      if (!prebookRes.ok) {
        throw new Error(prebookBody.error || `Prebook failed (HTTP ${prebookRes.status})`);
      }
      const prebook = prebookBody.prebook;
      if (!prebook?.prebookId || !prebook?.transactionId) {
        throw new Error('Prebook response missing prebookId or transactionId');
      }

      // 2. Book — sandbox accepts the prebook's transactionId directly. The
      // booking PR will replace this with real card capture via LiteAPI's SDK.
      const ownerName = 'Trip Owner';
      const [firstName, ...rest] = ownerName.split(' ');
      const lastName = rest.join(' ') || 'Guest';
      const ownerEmail = 'guest@example.com';
      const bookRes = await fetch('/api/travel/liteapi/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          prebookId: prebook.prebookId,
          paymentTransactionId: prebook.transactionId,
          holder: { firstName, lastName, email: ownerEmail },
          guests: [{ occupancyNumber: 1, firstName, lastName, email: ownerEmail }],
          checkinDate: tripDates.departure,
          checkoutDate: tripDates.return,
          hotelName: rec.name,
          guestCount: 1,
          finalPriceCents: Math.round((prebook.price || 0) * 100),
          currency: prebook.currency || 'USD',
          commissionAmountCents: Math.round((prebook.commission || 0) * 100),
        }),
      });
      const bookBody = await bookRes.json().catch(() => ({}));
      if (!bookRes.ok) {
        throw new Error(bookBody.error || `Book failed (HTTP ${bookRes.status})`);
      }
      const r = bookBody.reservation;
      setReservedKeys(prev => ({
        ...prev,
        [cardKey]: { confirmationCode: r?.confirmationCode || null, bookingId: r?.bookingId || prebook.prebookId },
      }));
    } catch (err) {
      setError(`Couldn't reserve ${rec.name} — ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setReservingKey(null);
    }
  };

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
      priceLevel: null,
      priceLevelDisplay: null,
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

  return (
    <div className="space-y-6">
      {/* Compact trip-context header — replaces the old Search Controls.
          Carousels auto-load on mount; user only needs Refresh + optional dates. */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-bg-row rounded border border-border text-sm">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="font-semibold text-text-primary truncate">{city || 'Pick a destination'}{country ? `, ${country}` : ''}</span>
          {tripDates?.departure && tripDates?.return ? (
            <span className="text-text-muted">{tripDates.departure} → {tripDates.return} · {daysTravel} nights</span>
          ) : (
            <span className="text-orange-600 text-xs">⚠ Set trip dates above to enable Stays & Reserve</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loadingCategories.size > 0 && (
            <span className="text-xs text-brand-purple">
              Loading {loadingCategories.size} of {totalCategories}…
            </span>
          )}
          <button onClick={rescanAll} disabled={loading || !city}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-white disabled:opacity-50">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Top-level error banner only for global problems (network out, etc.).
          Per-category errors render inline in their carousel slot. */}
      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-brand-red text-sm">{error}</div>}

      {/* Edit Selection Modal */}
      {editingSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-lg w-full p-6 shadow-sm">
            <h3 className="font-bold text-terminal-lg mb-1">{CATEGORY_INFO[editingSelection.category]?.icon || ''} {editingSelection.item.name}</h3>
            <p className="text-sm text-text-muted mb-4">{editingSelection.item.googleRating} stars ({editingSelection.item.reviewCount} reviews)</p>
            
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
              <h3 className="font-bold text-terminal-lg">+ Add Custom {CATEGORY_INFO[customCategory]?.label || ACTIVITY_LABELS[customCategory] || customCategory}</h3>
              <p className="text-white/80 text-sm">Paste a URL or enter details manually</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">Paste URL (optional)</label>
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
                <label className="text-sm font-medium text-text-secondary block mb-2">Name *</label>
                <input type="text" value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))} placeholder="Villa Sunset Paradise" className="w-full border border-border rounded px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">Price</label>
                <input type="text" value={customForm.price} onChange={e => setCustomForm(f => ({ ...f, price: e.target.value }))} placeholder="$150/night" className="w-full border border-border rounded px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">Notes (optional)</label>
                <input type="text" value={customForm.notes} onChange={e => setCustomForm(f => ({ ...f, notes: e.target.value }))} placeholder="Great reviews, close to beach" className="w-full border border-border rounded px-3 py-2.5 text-sm" />
              </div>
            </div>
            <div className="border-t border-border p-4 bg-bg-row flex gap-3">
              <Button variant="secondary" onClick={() => setShowCustomModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddCustomItem} className="flex-1" disabled={!customForm.name}>Add to Plan</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PR-4 carousels: one row per active category, ordered by the curated
            layout (Stays first → Things to do → Where to eat → discovery).
            Each row independently shows items / skeleton / error banner so a
            single failing category never blanks the rest of the page. ── */}
      <div className="space-y-6 pt-2">
        {CAROUSEL_ORDER
          .filter(catKey => ACTIVE_SCAN_SET.has(catKey))
          .map(catKey => {
            const isLoading = loadingCategories.has(catKey);
            const items = byCategory[catKey] || [];
            const err = categoryErrors[catKey];
            const coa = TRAVEL_COA[catKey];
            const info = CATEGORY_INFO[catKey];
            const label = info?.label || coa?.label || catKey;
            const { source } = getSource(catKey);
            return (
              <TravelCarousel
                key={catKey}
                catKey={catKey}
                label={label}
                source={source}
                isLoading={isLoading}
                items={items}
                error={err}
                onCardClick={(rec) => {
                  const idForRoute = String(rec.valueRank ?? 0);
                  router.push(`/budgets/trips/${tripId}/discover/${encodeURIComponent(catKey)}/${idForRoute}`);
                }}
              />
            );
          })}
      </div>

    </div>
  );
}

// ─── Carousel layout order (PR-4 locked design) ─────────────────────────────
// Stays first (highest commission). Things to do second (Viator bookable).
// Discovery (Google) last so eyes land on bookable rows before browsable ones.
const CAROUSEL_ORDER = [
  'accommodation',     // Stays (LiteAPI)
  // PR-11: single "Activities" row replaces the four Viator carousels
  // (adventure / arts_culture / wellness / bucket_list). The carousel
  // surfaces every Viator product for the active destination. COA-level
  // budget categories are preserved in TRAVEL_COA for manual entries +
  // historic data; only the visual + scanned surface collapses.
  'activities',        // Things to do — Activities (Viator, unified)
  'brunch_coffee',     // Where to eat — Brunch & coffee (Google)
  'dinner',            // Dinner (Google)
  'nightlife',         // Nightlife (Google)
  'coworking',         // Coworking (Google)
  'shopping',          // Shopping (Google)
  // PR-10 Fix 6: Conferences removed — Google returns venues, not actual
  // upcoming conferences. Queued for a future PR with a real conference
  // API (Eventbrite / 10times / Bizzabo).
  'ground_transport',  // Transfers (Mozio — fails loud "not connected" today)
] as const;

const ACTIVE_SCAN_SET = new Set(getActiveScanCategories([], ''));

// Source attribution label shown in each carousel header.
function sourceAttribution(source: Source): string {
  switch (source) {
    case 'liteapi':     return 'via LiteAPI';
    case 'viator':      return 'via Viator';
    case 'google':      return 'Google · discovery';
    case 'mozio':       return 'Mozio (coming soon)';
    case 'duffel':      return 'via Duffel';
    case 'airalo':      return 'Airalo (coming soon)';
    case 'covergenius': return 'Cover Genius (coming soon)';
  }
}

// PR-14: maps PR-13's six standard facility strings to lucide-react icons.
// All six names verified present in lucide-react ^0.544.0. Keyed lowercase so
// matching is case-insensitive.
const FACILITY_ICONS: Record<string, LucideIcon> = {
  pool: Waves,
  wifi: Wifi,
  breakfast: Coffee,
  gym: Dumbbell,
  spa: Flower2,
  parking: Car,
};

interface TravelCarouselProps {
  catKey: string;
  label: string;
  source: Source;
  isLoading: boolean;
  items: GrokRecommendation[];
  error?: string;
  onCardClick: (rec: GrokRecommendation) => void;
}

// One horizontal-scroll row. Mobile-first: cards are 200px wide with
// scroll-snap; desktop fits ~4-up. The header carries the source attribution
// so the per-card chrome stays clean.
function TravelCarousel({ catKey, label, source, isLoading, items, error, onCardClick }: TravelCarouselProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h3 className="text-base font-semibold text-text-primary">{label}</h3>
        <span className={`text-[10px] font-medium ${source === 'google' ? 'text-text-faint' : 'text-brand-purple'}`}>
          {sourceAttribution(source)}
        </span>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-brand-red text-xs">
          {error}
        </div>
      ) : isLoading ? (
        <div className="overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollSnapType: 'x mandatory' }}>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-[200px] sm:w-[220px] flex-shrink-0 border border-border rounded overflow-hidden bg-bg-row animate-pulse" style={{ scrollSnapAlign: 'start' }}>
                <div className="w-full h-32 bg-gray-200" />
                <div className="p-3 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-text-muted py-4 px-3 border border-dashed border-border rounded">
          No {label.toLowerCase()} found for this destination.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollSnapType: 'x mandatory' }}>
          <div className="flex gap-3">
            {items.slice(0, 12).map((rec, idx) => (
              source === 'liteapi' ? (
                // ── PR-14: rich LiteAPI hotel card ───────────────────────────
                <button
                  key={`${catKey}-${rec.valueRank ?? idx}`}
                  type="button"
                  onClick={() => onCardClick(rec)}
                  className="w-[260px] flex-shrink-0 border border-border rounded overflow-hidden bg-white hover:shadow-md transition-shadow text-left"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {/* Single static hero — photo carousel deferred to a later
                      cross-source PR. */}
                  {rec.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rec.photoUrl} alt={rec.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center text-text-muted text-xs">
                      {label}
                    </div>
                  )}
                  <div className="p-3 space-y-1.5">
                    {/* Name + optional chain pill */}
                    <div className="flex items-start gap-1.5">
                      <div className="text-xs font-semibold text-text-primary line-clamp-2 leading-tight flex-1">{rec.name}</div>
                      {rec.chain ? (
                        <span className="shrink-0 text-[9px] font-medium text-brand-purple bg-brand-purple-wash rounded px-1.5 py-0.5 leading-tight">
                          {rec.chain}
                        </span>
                      ) : null}
                    </div>
                    {/* City subtitle */}
                    {rec.city ? (
                      <div className="text-[11px] text-text-muted leading-tight">{rec.city}</div>
                    ) : null}
                    {/* Facility icon row */}
                    {rec.facilities && rec.facilities.length > 0 ? (
                      <div className="flex items-center gap-2 pt-0.5" aria-label={`Amenities: ${rec.facilities.join(', ')}`}>
                        {rec.facilities.map(f => {
                          const Icon = FACILITY_ICONS[f.toLowerCase()];
                          return Icon ? <Icon key={f} className="w-3.5 h-3.5 text-brand-purple" aria-label={f} /> : null;
                        })}
                      </div>
                    ) : null}
                    {/* Rating (primary) + reviewScore (secondary) + price */}
                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-0.5">
                      <span className="flex items-center gap-1.5">
                        <span aria-label={`Rated ${rec.googleRating || 0} out of 5${rec.reviewCount ? `, ${rec.reviewCount} reviews` : ''}`}>
                          <span className="text-brand-gold">★</span> <span className="text-text-primary">{rec.googleRating || '—'}</span>{rec.reviewCount ? ` (${rec.reviewCount})` : ''}
                        </span>
                        {rec.reviewScore != null ? (
                          <span
                            className="text-brand-purple bg-brand-purple-wash rounded px-1 py-0.5 font-semibold leading-none"
                            aria-label={`Guest review score ${rec.reviewScore} out of 10`}
                          >
                            {rec.reviewScore}
                          </span>
                        ) : null}
                      </span>
                      {rec.pricePerNight != null && rec.nights != null ? (
                        /* PR-15: per-night leads, then nights, then the honest
                           whole-stay total — "$200/night · 7 nights · $1,400". */
                        <span className="font-semibold text-brand-gold-bright">
                          {rec.currency || '$'}{rec.pricePerNight}/night · {rec.nights} nights
                          {rec.priceTotal != null ? ` · ${rec.currency || '$'}${rec.priceTotal}` : ''}
                        </span>
                      ) : (
                        /* PR-14 (Step 5, decided) + PR-15: per-night absent (only
                           when nights<1 — a fail-loud date bug, never in normal
                           operation) → render NO price element. The absence of a
                           fallback, not a fallback branch. We deliberately do NOT
                           synthesize a $-band from priceLevelDisplay (reuses the
                           old per-night bucketing bug) nor reuse rec.price (the
                           whole-stay total). Honors the no-silent-fallback mandate. */
                        null
                      )}
                    </div>
                  </div>
                </button>
              ) : (
                // ── Non-LiteAPI (Viator / Google): byte-identical to main ────
                <button
                  key={`${catKey}-${rec.valueRank ?? idx}`}
                  type="button"
                  onClick={() => onCardClick(rec)}
                  className="w-[200px] sm:w-[220px] flex-shrink-0 border border-border rounded overflow-hidden bg-white hover:shadow-md transition-shadow text-left"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {rec.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rec.photoUrl} alt={rec.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center text-text-muted text-xs">
                      {label}
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <div className="text-xs font-semibold text-text-primary line-clamp-2 leading-tight">{rec.name}</div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>★ {rec.googleRating || '—'}{rec.reviewCount ? ` (${rec.reviewCount})` : ''}</span>
                      {rec.price != null ? (
                        <span className="font-semibold text-emerald-700">${rec.price}</span>
                      ) : rec.priceLevelDisplay ? (
                        <span className="font-semibold text-text-secondary">{rec.priceLevelDisplay}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
