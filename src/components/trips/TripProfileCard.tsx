'use client';

import { useState, useCallback } from 'react';
import { ACTIVITY_GROUPS, ACTIVITY_LABELS } from '@/lib/activities';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isOwner: boolean;
  rsvpStatus: string;
  profileTripType?: string | null;
  profileBudget?: string | null;
  profilePriorities?: string[];
  profileVibe?: string[];
  profilePace?: string | null;
  profileActivities?: string[];
}

interface TripProfileCardProps {
  participant: Participant;
  isCurrentUser: boolean;
  tripId: string;
  onProfileSaved: () => void;
}

const TRIP_TYPES = [
  { value: 'remote_work', label: 'Digital Nomad', icon: '💻' },
  { value: 'adventure', label: 'Adventure', icon: '🏔️' },
  { value: 'romantic', label: 'Romantic Escape', icon: '💕' },
  { value: 'friends', label: 'Squad Trip', icon: '🎊' },
  { value: 'family', label: 'Family Fun', icon: '👨‍👩‍👧‍👦' },
  { value: 'solo', label: 'Solo Explorer', icon: '🎒' },
  { value: 'wellness', label: 'Wellness Retreat', icon: '🧘' },
  { value: 'cultural', label: 'Culture Seeker', icon: '🏛️' },
  { value: 'foodie', label: 'Food & Wine', icon: '🍷' },
  { value: 'party', label: 'Party Mode', icon: '🎉' },
  { value: 'luxury', label: 'Luxury Escape', icon: '✨' },
  { value: 'budget', label: 'Budget Backpacker', icon: '🏕️' },
];

const BUDGET_OPTIONS = [
  { value: 'backpacker', label: '$0-50/night' },
  { value: 'budget', label: '$50-100/night' },
  { value: 'midrange', label: '$100-200/night' },
  { value: 'comfort', label: '$200-350/night' },
  { value: 'premium', label: '$350-500/night' },
  { value: 'luxury', label: '$500+/night' },
];

const VIBE_OPTIONS = [
  { value: 'chill', label: 'Chill & Relaxed', icon: '😌' },
  { value: 'active', label: 'Active & Energetic', icon: '⚡' },
  { value: 'spontaneous', label: 'Spontaneous', icon: '🎲' },
  { value: 'planned', label: 'Well Planned', icon: '📋' },
  { value: 'offbeat', label: 'Off the Beaten Path', icon: '🗺️' },
  { value: 'touristy', label: 'Hit the Highlights', icon: '🏆' },
  { value: 'local', label: 'Live Like a Local', icon: '🏘️' },
  { value: 'splurge', label: 'Treat Yourself', icon: '💎' },
];

const PACE_OPTIONS = [
  { value: 'slow', label: 'Slow & Savoring', icon: '🐢' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️' },
  { value: 'packed', label: 'Action-Packed', icon: '🚀' },
];

export default function TripProfileCard({ participant, isCurrentUser, tripId, onProfileSaved }: TripProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const isComplete = !!participant.profileTripType;

  const patchField = useCallback(async (field: string, value: any) => {
    setSaving(true);
    try {
      const profilePayload: Record<string, any> = {};
      // Map field names to profile keys
      const fieldMap: Record<string, string> = {
        profileTripType: 'tripType',
        profileBudget: 'budget',
        profilePriorities: 'priorities',
        profileVibe: 'vibe',
        profilePace: 'pace',
        profileActivities: 'activities',
      };
      profilePayload[fieldMap[field] || field] = value;

      await fetch(`/api/trips/${tripId}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id, profile: profilePayload }),
      });
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 1500);
      onProfileSaved();
    } catch (err) {
      console.error('Failed to save profile field:', err);
    } finally {
      setSaving(false);
    }
  }, [tripId, participant.id, onProfileSaved]);

  const toggleActivity = useCallback((actValue: string) => {
    const current = participant.profileActivities || [];
    const updated = current.includes(actValue)
      ? current.filter(a => a !== actValue)
      : [...current, actValue];
    patchField('profileActivities', updated);
  }, [participant.profileActivities, patchField]);

  const toggleVibe = useCallback((vibeValue: string) => {
    const current = participant.profileVibe || [];
    if (current.includes(vibeValue)) {
      patchField('profileVibe', current.filter(v => v !== vibeValue));
    } else if (current.length < 3) {
      patchField('profileVibe', [...current, vibeValue]);
    }
  }, [participant.profileVibe, patchField]);

  // Build compact summary
  const getSummary = () => {
    const parts: string[] = [];
    const tt = TRIP_TYPES.find(t => t.value === participant.profileTripType);
    if (tt) parts.push(`${tt.icon} ${tt.label}`);
    const b = BUDGET_OPTIONS.find(bo => bo.value === participant.profileBudget);
    if (b) parts.push(b.label);
    const acts = (participant.profileActivities || []).slice(0, 4).map(a => ACTIVITY_LABELS[a] || a);
    if (acts.length > 0) parts.push(acts.join(', '));
    const vibes = (participant.profileVibe || []).map(v => VIBE_OPTIONS.find(vo => vo.value === v)?.label).filter(Boolean);
    if (vibes.length > 0) parts.push(vibes.join(', '));
    const p = PACE_OPTIONS.find(po => po.value === participant.profilePace);
    if (p) parts.push(p.label);
    return parts.join(' · ');
  };

  // Progress: which sections are done
  const sections = [
    !!participant.profileTripType,
    !!participant.profileBudget,
    (participant.profileActivities || []).length > 0,
    (participant.profileVibe || []).length > 0 || !!participant.profilePace,
  ];
  const completedSections = sections.filter(Boolean).length;

  return (
    <div className={`border rounded-lg overflow-hidden ${isComplete ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
            participant.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : participant.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {participant.firstName[0]}
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {participant.firstName} {participant.lastName}
              {participant.isOwner && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-brand-purple-wash text-brand-purple rounded">Organizer</span>}
            </div>
            <div className="text-[10px] text-text-muted">{participant.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedIndicator && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
          {/* Progress dots */}
          <div className="flex gap-1">
            {sections.map((done, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {!isComplete && !editing && isCurrentUser && (
          <div>
            <p className="text-sm text-amber-700 mb-2">Complete your travel profile to personalize trip recommendations.</p>
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-brand-purple text-white text-xs font-medium rounded hover:bg-brand-purple-hover">
              Fill Out Profile
            </button>
          </div>
        )}

        {!isComplete && !isCurrentUser && (
          <p className="text-xs text-text-muted italic">Waiting for {participant.firstName} to fill out their profile</p>
        )}

        {isComplete && !editing && (
          <div>
            <p className="text-xs text-text-secondary leading-relaxed">{getSummary()}</p>
            {isCurrentUser && (
              <button onClick={() => setEditing(true)} className="mt-2 text-xs text-brand-purple hover:underline font-medium">
                Edit
              </button>
            )}
          </div>
        )}

        {/* Inline form */}
        {editing && isCurrentUser && (
          <div className="space-y-5">
            {/* A. Interests from canonical activities */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Your Interests</h4>
              {ACTIVITY_GROUPS.map(group => (
                <div key={group.label} className="mb-3">
                  <div className="text-[11px] font-medium text-text-muted mb-1">{group.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.activities.map(act => {
                      const selected = (participant.profileActivities || []).includes(act.value);
                      return (
                        <button
                          key={act.value}
                          onClick={() => toggleActivity(act.value)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            selected
                              ? 'bg-brand-purple text-white'
                              : 'bg-bg-row text-text-secondary hover:bg-border'
                          }`}
                        >
                          {act.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* B. Travel Style */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Travel Style</h4>
              <div className="mb-3">
                <div className="text-[11px] font-medium text-text-muted mb-1">Trip Type</div>
                <div className="flex flex-wrap gap-1.5">
                  {TRIP_TYPES.map(tt => (
                    <button
                      key={tt.value}
                      onClick={() => patchField('profileTripType', tt.value)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        participant.profileTripType === tt.value
                          ? 'bg-brand-purple text-white'
                          : 'bg-bg-row text-text-secondary hover:bg-border'
                      }`}
                    >
                      {tt.icon} {tt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-text-muted mb-1">Budget per Night</div>
                <div className="flex flex-wrap gap-1.5">
                  {BUDGET_OPTIONS.map(bo => (
                    <button
                      key={bo.value}
                      onClick={() => patchField('profileBudget', bo.value)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        participant.profileBudget === bo.value
                          ? 'bg-brand-purple text-white'
                          : 'bg-bg-row text-text-secondary hover:bg-border'
                      }`}
                    >
                      {bo.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* C. Vibe & Pace */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Vibe & Pace</h4>
              <div className="mb-3">
                <div className="text-[11px] font-medium text-text-muted mb-1">Vibe (up to 3)</div>
                <div className="flex flex-wrap gap-1.5">
                  {VIBE_OPTIONS.map(vo => {
                    const selected = (participant.profileVibe || []).includes(vo.value);
                    return (
                      <button
                        key={vo.value}
                        onClick={() => toggleVibe(vo.value)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          selected
                            ? 'bg-brand-purple text-white'
                            : 'bg-bg-row text-text-secondary hover:bg-border'
                        }`}
                      >
                        {vo.icon} {vo.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-text-muted mb-1">Pace</div>
                <div className="flex flex-wrap gap-1.5">
                  {PACE_OPTIONS.map(po => (
                    <button
                      key={po.value}
                      onClick={() => patchField('profilePace', po.value)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        participant.profilePace === po.value
                          ? 'bg-brand-purple text-white'
                          : 'bg-bg-row text-text-secondary hover:bg-border'
                      }`}
                    >
                      {po.icon} {po.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* D. Done editing */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-[10px] text-text-muted">{completedSections}/4 sections complete</span>
              <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-xs font-medium bg-brand-purple text-white rounded hover:bg-brand-purple-hover">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
