'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { ACTIVITY_LABELS } from '@/lib/activities';
import { TRAVEL_COA, getActiveScanCategories } from '@/lib/travelCOA';

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
  activities: { label: 'Activities/Tours', icon: '' },
  nightlife: { label: 'Nightlife', icon: '' },
  toiletries: { label: 'Toiletries/Supplies', icon: '' },
  wellness: { label: 'Wellness/Gym', icon: '' },
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
          setExpandedCategory(Object.keys(loaded)[0]);
          setScannerMeta(latestMeta);
        }
      } catch (err) {
        console.error('Failed to load saved scanner results:', err);
      }
    };
    loadSavedResults();
  }, [tripId]);

  // Custom add state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCategory, setCustomCategory] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ name: "", url: "", price: "", notes: "" });
  const [customLoading, setCustomLoading] = useState(false);
  const [customPreview, setCustomPreview] = useState<{ title: string; image: string | null; price: string | null } | null>(null);
  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);
  const tripActivities = activities.length > 0 ? activities : (activity ? [activity] : []);

  const searchDestination = async () => {
    if (!city || !country) { setError('Please select a destination first'); return; }
    setLoading(true);
    setError(null);
    setByCategory({});
    setRecommendations([]);
    setSelections([]);
    setScannerMeta(null);
    setExpandedCategory(null);
    setCompletedCount(0);

    // Standard travel category set — no traveler profile. getActiveScanCategories
    // with no interests/tripType returns the full scannable set.
    type ScanCategory = { key: string; label: string; maxResults: number };
    const activeCoaKeys = getActiveScanCategories([], '');
    const categoriesToScan: ScanCategory[] = activeCoaKeys.map(key => ({
      key,
      label: TRAVEL_COA[key]?.label || key,
      maxResults: 33,
    }));

    setTotalCategories(categoriesToScan.length);
    let firstExpanded = false;

    for (let i = 0; i < categoriesToScan.length; i++) {
      const { key: cat, label: catLabel, maxResults: catMaxResults } = categoriesToScan[i];
      setLoadingCategory(catLabel);
      setCompletedCount(i);

      try {
        const res = await fetch('/api/trips/' + tripId + '/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city, country, activities: tripActivities, activity, month, year, daysTravel, minRating, minReviews, maxPriceLevel: maxPriceLevel || undefined, category: cat, maxResults: catMaxResults })
        });

        // Guard against non-JSON responses (serverless timeout returns HTML).
        // Fail loud — break the loop so the user sees a real banner instead
        // of "0 results" with no explanation.
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setError(`Couldn't load ${catLabel} — request timed out. Try again.`);
          break;
        }

        if (!res.ok) {
          // Surface the upstream error verbatim and stop. Continuing would
          // hammer the same broken config (Google billing/key/quota or Viator
          // auth) for every remaining category and waste quota.
          const d = await res.json().catch(() => ({}));
          const upstream = d.error || `HTTP ${res.status}`;
          setError(`Couldn't load ${catLabel} — ${upstream}`);
          break;
        }

        const data = await res.json();
        const items: GrokRecommendation[] = data.recommendations || [];
        console.log(`[Search] ${cat}: ${items.length} results`);

        // Empty array is a legitimate ZERO_RESULTS — show no banner, just no
        // items. Real errors took the !res.ok branch above.
        if (items.length > 0) {
          setByCategory(prev => ({ ...prev, [cat]: items }));
          setRecommendations(prev => [...prev, ...items].sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0)));
          if (!firstExpanded) {
            setExpandedCategory(cat);
            firstExpanded = true;
          }
        }
      } catch (err) {
        // Network error or JSON parse failure — fail loud, break the loop.
        setError(`Couldn't load ${catLabel} — ${err instanceof Error ? err.message : 'unknown error'}`);
        break;
      }
    }

    setCompletedCount(categoriesToScan.length);
    setLoadingCategory(null);
    setLoading(false);
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
      {/* Search Controls — filters + sort + search (no profile, no AI) */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-bg-row rounded border border-border">
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1.5">Min Rating</label>
          <select value={minRating} onChange={e => setMinRating(+e.target.value)} className="border border-border rounded px-3 py-2.5 text-sm bg-white">
            <option value={3.5}>3.5+</option><option value={4.0}>4.0+</option><option value={4.5}>4.5+</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1.5">Min Reviews</label>
          <select value={minReviews} onChange={e => setMinReviews(+e.target.value)} className="border border-border rounded px-3 py-2.5 text-sm bg-white">
            <option value={10}>10+</option><option value={50}>50+</option><option value={100}>100+</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1.5">Max Price</label>
          <select value={maxPriceLevel} onChange={e => setMaxPriceLevel(+e.target.value)} className="border border-border rounded px-3 py-2.5 text-sm bg-white">
            <option value={0}>Any</option><option value={1}>$</option><option value={2}>$$</option><option value={3}>$$$</option><option value={4}>$$$$</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1.5">Sort by</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className="border border-border rounded px-3 py-2.5 text-sm bg-white">
            <option value="rating">Rating</option>
            <option value="price">Price</option>
            <option value="reviews">Reviews</option>
            <option value="name">Name</option>
          </select>
        </div>
        <Button onClick={searchDestination} loading={loading} disabled={!city} className="flex-1 py-3 text-base">
          Search {city || 'Destination'}
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-brand-red text-sm">{error}</div>}

      {loading && (
        <div className="text-center py-16 bg-gradient-to-b from-bg-row to-white rounded border border-border">
          <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-semibold text-terminal-lg">Searching {city}...</p>
          {loadingCategory && (
            <p className="text-brand-purple text-sm mt-2 font-medium">
              {loadingCategory} ({completedCount + 1}/{totalCategories})
            </p>
          )}
          {completedCount > 0 && (
            <div className="mt-4 mx-auto w-64 bg-border rounded-full h-2">
              <div className="bg-brand-purple h-2 rounded-full transition-all" style={{ width: `${(completedCount / totalCategories) * 100}%` }} />
            </div>
          )}
        </div>
      )}

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

      {/* Results — Card Grid grouped by scanner category */}
      {Object.keys(byCategory).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-text-primary">Results <span className="text-sm font-normal text-text-muted">({recommendations.length} places)</span></h3>
            {scannerMeta && !loading && (
              <span className="text-xs text-text-muted">
                Searched by {scannerMeta.scannedBy.split('@')[0]} · {new Date(scannerMeta.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Category order: accommodation first, brunch_coffee second, dinner third, rest alphabetical */}
          {Object.keys(byCategory).sort((a, b) => {
            const order: Record<string, number> = { accommodation: 0, brunch_coffee: 1, dinner: 2 };
            const oa = order[a] ?? 99;
            const ob = order[b] ?? 99;
            if (oa !== ob) return oa - ob;
            return a.localeCompare(b);
          }).map(cat => {
            const items = byCategory[cat];
            if (!items || items.length === 0) return null;
            const coaCat = TRAVEL_COA[cat];
            const info = CATEGORY_INFO[cat] || (coaCat ? { label: coaCat.label, icon: '' } : { label: ACTIVITY_LABELS[cat] || cat, icon: '' });
            const coaVendor = TRAVEL_COA[cat];
            const catVendor = CATEGORY_VENDOR_INFO[cat] || (coaVendor ? { vendorApi: coaVendor.vendorApi, optionType: coaVendor.optionType, multiDay: coaVendor.multiDay } : { vendorApi: 'activities', optionType: 'activity', multiDay: false });
            const isExpanded = expandedCategory === cat;
            const committedCount = items.filter(r => committedCards[`${r.category}:${r.name}`]).length;
            return (
              <div key={cat} className="border border-border rounded overflow-hidden">
                <button type="button" onClick={() => setExpandedCategory(isExpanded ? null : cat)} className="w-full flex justify-between items-center px-5 py-3 bg-bg-row border-b border-border hover:bg-gray-100 transition-colors cursor-pointer">
                  <span className="flex items-center gap-2">
                    {info.icon ? <span>{info.icon}</span> : <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />}
                    <span className="font-semibold text-sm">{info.label}</span>
                    {committedCount > 0 && !isExpanded && (
                      <span className="text-[11px] text-emerald-700 font-medium">&middot; {committedCount} committed</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">{items.length}</span>
                    <span className="text-xs text-text-muted">{isExpanded ? '▲' : '▼'}</span>
                  </span>
                </button>
                {isExpanded && (
                  <>
                <div className="max-h-[780px] overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortItems(items).map((rec, idx) => {
                    const cardKey = `${rec.category}:${rec.name}`;
                    const committed = committedCards[cardKey];
                    const isCommitting = committingCard === cardKey;
                    const showPanel = commitCardKey === cardKey;
                    const photoShown = rec.photoUrl && (loadedPhotos.has(cardKey) || showPanel);
                    return (
                      <div key={`${rec.category}-${idx}`} className={`border rounded overflow-hidden ${committed ? 'border-emerald-400 bg-emerald-50/30' : 'border-border'}`}>
                        {/* Lazy photo: only fetched (billed) when the user clicks to view or opens the commit panel. */}
                        {photoShown ? (
                          <img src={rec.photoUrl!} alt={rec.name} className="w-full h-40 object-cover" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { if (rec.photoUrl) setLoadedPhotos(s => new Set(s).add(cardKey)); }}
                            disabled={!rec.photoUrl}
                            className="w-full h-40 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-text-muted text-xs"
                          >
                            {rec.photoUrl ? 'Show photo' : <span className="text-4xl">{info.icon}</span>}
                          </button>
                        )}
                        <div className="p-3 space-y-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-text-primary truncate">{rec.name}</h4>
                            <div className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                              <span>{'★'.repeat(Math.round(rec.googleRating))} {rec.googleRating} ({rec.reviewCount})</span>
                              {rec.priceLevelDisplay ? (
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                                  rec.priceLevel === 1 ? 'bg-green-100 text-green-700' :
                                  rec.priceLevel === 2 ? 'bg-blue-100 text-blue-700' :
                                  rec.priceLevel === 3 ? 'bg-orange-100 text-orange-700' :
                                  rec.priceLevel === 4 ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-500'
                                }`}>{rec.priceLevelDisplay}</span>
                              ) : (
                                <span className="px-1 py-0.5 rounded text-[9px] bg-gray-100 text-gray-400">N/A</span>
                              )}
                            </div>
                            {rec.address && <p className="text-[11px] text-text-faint truncate mt-0.5">{rec.address}</p>}
                          </div>

                          {rec.viatorProductCode && (
                            <div className="flex items-center gap-2 text-[11px]">
                              {rec.price != null && <span className="font-semibold text-emerald-700">From ${rec.price}</span>}
                              {rec.durationMinutes != null && (
                                <span className="text-text-muted">
                                  {rec.durationMinutes >= 60
                                    ? `${Math.floor(rec.durationMinutes / 60)}h${rec.durationMinutes % 60 ? ` ${rec.durationMinutes % 60}m` : ''}`
                                    : `${rec.durationMinutes}m`}
                                </span>
                              )}
                              <span className="text-[9px] text-gray-400 ml-auto">via Viator</span>
                            </div>
                          )}

                          {committed ? (
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded">Committed</span>
                              <button onClick={() => handleUncommitCard(cardKey, committed.optionType, committed.optionId)} className="text-xs text-text-muted hover:text-brand-red">Uncommit</button>
                            </div>
                          ) : showPanel ? (
                            <div className="pt-2 border-t border-border space-y-2">
                              <div className="font-medium text-[11px] text-gray-700 truncate">{rec.name}</div>
                              <div>
                                <label className="text-[10px] text-text-muted block mb-0.5">Price *</label>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-text-muted">$</span>
                                  <input type="number" min={0} placeholder="0" value={cardPrices[cardKey] || ''} onChange={e => setCardPrices(p => ({ ...p, [cardKey]: e.target.value }))}
                                    className="flex-1 min-w-0 border border-border rounded px-2 py-1.5 text-xs" />
                                  <select value={cardFrequency[cardKey] || CATEGORY_DEFAULT_FREQ[rec.category] || 'total'} onChange={e => setCardFrequency(p => ({ ...p, [cardKey]: e.target.value }))}
                                    className="border border-border rounded px-1 py-1.5 text-xs bg-white">
                                    {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                  </select>
                                </div>
                              </div>
                              {(() => {
                                const up = parseFloat(cardPrices[cardKey] || '0');
                                const fr = cardFrequency[cardKey] || CATEGORY_DEFAULT_FREQ[rec.category] || 'total';
                                const d = cardDates[cardKey];
                                if (!up) return null;
                                const tot = calcTotal(up, fr, d?.start || '', d?.end);
                                const nDays = calcDaysBetween(d?.start || '', d?.end);
                                if (fr === 'total' || fr === 'per_visit' || fr === 'per_trip') return <div className="text-[11px] text-emerald-700 font-medium">${up} {formatFreqLabel(fr)} = ${tot} total</div>;
                                return <div className="text-[11px] text-emerald-700 font-medium">${up}{formatFreqLabel(fr)} × {nDays} {fr === 'per_night' ? 'nights' : 'days'} = ${tot} total</div>;
                              })()}
                              {/* Quick date pills */}
                              {tripDates?.departure && (
                                <div className="flex flex-wrap gap-1">
                                  {Array.from({ length: Math.min(7, daysTravel) }, (_, i) => {
                                    const d = new Date(tripDates.departure + 'T12:00:00');
                                    d.setDate(d.getDate() + i);
                                    const val = d.toISOString().split('T')[0];
                                    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    const isSelected = cardDates[cardKey]?.start === val;
                                    return (
                                      <button key={val} type="button" onClick={() => setCardDates(p => ({ ...p, [cardKey]: { ...p[cardKey], start: val } }))}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Date inputs */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-text-muted block mb-0.5">{catVendor.multiDay ? 'Check-in' : 'Date'} *</label>
                                  <input type="date" value={cardDates[cardKey]?.start || ''}
                                    min={tripDates?.departure || ''} max={tripDates?.return || ''}
                                    onChange={e => setCardDates(p => ({ ...p, [cardKey]: { ...p[cardKey], start: e.target.value } }))}
                                    className="w-full border border-border rounded px-2 py-1.5 text-xs" />
                                </div>
                                {catVendor.multiDay && (
                                  <div>
                                    <label className="text-[10px] text-text-muted block mb-0.5">Check-out</label>
                                    <input type="date" value={cardDates[cardKey]?.end || ''}
                                      min={cardDates[cardKey]?.start || tripDates?.departure || ''} max={tripDates?.return || ''}
                                      onChange={e => setCardDates(p => ({ ...p, [cardKey]: { ...p[cardKey], end: e.target.value } }))}
                                      className="w-full border border-border rounded px-2 py-1.5 text-xs" />
                                  </div>
                                )}
                              </div>
                              {/* Time inputs */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-text-muted block mb-0.5">From</label>
                                  <input type="time" value={cardTimes[cardKey]?.startTime || ''}
                                    onChange={e => setCardTimes(p => ({ ...p, [cardKey]: { ...(p[cardKey] || { startTime: '', endTime: '' }), startTime: e.target.value } }))}
                                    className="w-full border border-border rounded px-2 py-1.5 text-xs" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-text-muted block mb-0.5">To</label>
                                  <input type="time" value={cardTimes[cardKey]?.endTime || ''}
                                    onChange={e => setCardTimes(p => ({ ...p, [cardKey]: { ...(p[cardKey] || { startTime: '', endTime: '' }), endTime: e.target.value } }))}
                                    className="w-full border border-border rounded px-2 py-1.5 text-xs" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleCommitCard(rec)} disabled={!cardPrices[cardKey] || !cardDates[cardKey]?.start || isCommitting}
                                  className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50">
                                  {isCommitting ? 'Committing...' : 'Confirm'}
                                </button>
                                <button onClick={() => setCommitCardKey(null)} className="px-3 py-1.5 text-xs border border-border rounded">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                              <button onClick={() => { setCommitCardKey(cardKey); if (!cardDates[cardKey]) setCardDates(p => ({ ...p, [cardKey]: { start: tripDates?.departure || '', end: catVendor.multiDay ? (tripDates?.return || '') : '' } })); if (!cardFrequency[cardKey]) setCardFrequency(p => ({ ...p, [cardKey]: CATEGORY_DEFAULT_FREQ[rec.category] || TRAVEL_COA[rec.category]?.defaultFrequency || 'total' })); if (!cardTimes[cardKey]) { const defaults = CATEGORY_DEFAULT_TIMES[rec.category] || { startTime: '10:00', endTime: '12:00' }; setCardTimes(p => ({ ...p, [cardKey]: defaults })); } if (!cardPrices[cardKey] && rec.price) setCardPrices(p => ({ ...p, [cardKey]: String(rec.price) })); }}
                                className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700">Commit</button>
                              {/* LiteAPI Reserve — only on accommodation cards that came back with a bookable offer. */}
                              {rec.liteapiOfferId && (
                                reservedKeys[cardKey] ? (
                                  <span className="px-2 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-medium rounded" title={`Booking ID: ${reservedKeys[cardKey].bookingId}`}>
                                    Reserved{reservedKeys[cardKey].confirmationCode ? ` · ${reservedKeys[cardKey].confirmationCode}` : ''}
                                  </span>
                                ) : (
                                  <button onClick={() => handleLiteApiReserve(rec, cardKey)} disabled={reservingKey === cardKey}
                                    className="px-3 py-1.5 bg-brand-purple text-white text-xs font-medium rounded hover:bg-brand-purple-hover disabled:opacity-50">
                                    {reservingKey === cardKey ? 'Reserving…' : 'Reserve'}
                                  </button>
                                )
                              )}
                              {rec.website && <a href={rec.website} target="_blank" rel="noopener noreferrer" className="px-2 py-1.5 text-xs border border-border rounded hover:bg-bg-row">Visit</a>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
                <div className="px-5 py-3 bg-bg-row border-t border-border">
                  <button onClick={() => openCustomModal(cat)} className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs">+</span>
                    Add Custom {info.label || ACTIVITY_LABELS[cat] || cat}
                  </button>
                </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && Object.keys(byCategory).length === 0 && !error && (
        <div className="text-center py-16 bg-gradient-to-b from-bg-row to-white rounded border border-border">
          <h3 className="font-bold text-sm text-text-primary mb-2">Search a destination</h3>
          <p className="text-text-muted">Pick a destination and search to see places to stay, eat, and explore.</p>
        </div>
      )}
    </div>
  );
}
