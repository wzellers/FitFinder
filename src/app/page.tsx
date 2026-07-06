"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import Closet from '@/components/Closet';
import ColorPreferences from '@/components/ColorPreferences';
import OutfitGenerator from '@/components/OutfitGenerator';
import OutfitCalendar from '@/components/OutfitCalendar';
import WardrobeStats from '@/components/WardrobeStats';
import RatingPrompt from '@/components/RatingPrompt';
import Onboarding from '@/components/Onboarding';
import ImageUpload from '@/components/ImageUpload';
import EditItem from '@/components/EditItem';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { SkeletonFullScreen } from '@/components/ui/Skeleton';
import { featureVector } from '@/lib/outfitScoring';
import { getUserClothingWeatherRules } from '@/lib/weatherApi';
import { getUserOccasionRules } from '@/lib/occasionRules';
import type { OccasionRules } from '@/lib/outfitScoring';
import { deserializeModel, serializeModel, updateWeights, computeReward } from '@/lib/banditModel';
import type { DashboardTab, ClothingItem, PendingRating, ColorCombination } from '@/lib/types';

const tabs: { key: DashboardTab; label: string }[] = [
  { key: 'closet', label: 'Closet' },
  { key: 'generator', label: 'Generator' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'stats', label: 'Stats' },
  { key: 'preferences', label: 'Preferences' },
];

export default function Page() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('closet');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [closetRefreshKey, setClosetRefreshKey] = useState(0);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Rating prompt
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [ratingMinimized, setRatingMinimized] = useState(false);

  // Check if user needs onboarding
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: items } = await supabase
        .from('clothing_items')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if ((!items || items.length === 0) && !profile?.onboarding_completed) {
        setShowOnboarding(true);
      }
      setOnboardingChecked(true);
    };
    check();
  }, [user]);

  // Check for unrated outfits from yesterday
  const checkPendingRatings = useCallback(async () => {
    if (!user) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const { data } = await supabase
      .from('outfit_wears')
      .select('*')
      .eq('user_id', user.id)
      .eq('worn_date', yStr)
      .is('rating', null)
      .limit(1);

    if (data && data.length > 0) {
      const wear = data[0];
      setPendingRating({
        wear_id: wear.id,
        worn_date: wear.worn_date,
        occasion: wear.occasion ?? null,
        outfit_items: {
          top_id: wear.top_id ?? undefined,
          bottom_id: wear.bottom_id ?? undefined,
          shoes_id: wear.shoes_id ?? undefined,
        },
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && onboardingChecked && !showOnboarding) checkPendingRatings();
  }, [user, onboardingChecked, showOnboarding, checkPendingRatings]);

  const handleRatingSubmit = async (wearId: string, rating: number) => {
    await supabase
      .from('outfit_wears')
      .update({ rating })
      .eq('id', wearId);

    // Online learning: turn the rating into a reward and nudge the user's model.
    if (user && pendingRating) {
      void applyRatingReward(user.id, pendingRating, rating);
    }

    setPendingRating(null);
  };

  // Recompute the rated outfit's feature vector and apply an online weight update.
  // Weather defaults to neutral (not stored on the wear); occasion is read back
  // from the wear so the model learns occasion fit; color/variety/rating
  // reconstruct from current data.
  const applyRatingReward = async (
    userId: string,
    rating: PendingRating,
    score: number,
  ) => {
    const itemIds = [
      rating.outfit_items.top_id,
      rating.outfit_items.bottom_id,
      rating.outfit_items.shoes_id,
    ].filter(Boolean) as string[];
    if (itemIds.length < 3) return;

    try {
      const [{ data: itemsData }, { data: prefsData }, { data: modelData }, { data: occPrefsData }] = await Promise.all([
        supabase.from('clothing_items').select('*').in('id', itemIds),
        supabase.from('color_preferences').select('liked_combinations').eq('user_id', userId).maybeSingle(),
        supabase.from('outfit_model_weights').select('weights, feature_meta').eq('user_id', userId).maybeSingle(),
        supabase.from('occasion_preferences').select('rules').eq('user_id', userId).maybeSingle(),
      ]);

      const byId = new Map((itemsData ?? []).map((i: ClothingItem) => [i.id, i]));
      const top = byId.get(rating.outfit_items.top_id ?? '');
      const bottom = byId.get(rating.outfit_items.bottom_id ?? '');
      const shoes = byId.get(rating.outfit_items.shoes_id ?? '');
      if (!top || !bottom || !shoes) return;

      const userOccasionRules = (occPrefsData?.rules ?? null) as OccasionRules | null;
      const features = featureVector(
        { top, bottom, shoes },
        {
          likedCombinations: (prefsData?.liked_combinations ?? []) as ColorCombination[],
          weather: null,
          recentWears: [],
          ratedOutfits: [],
          occasion: rating.occasion ?? null,
          occasionRules: userOccasionRules ?? undefined,
        },
        getUserClothingWeatherRules(null),
        getUserOccasionRules(userOccasionRules),
      );

      const updated = updateWeights(deserializeModel(modelData), features, computeReward(score));
      const serialized = serializeModel(updated);
      await supabase.from('outfit_model_weights').upsert({
        user_id: userId,
        weights: serialized.weights,
        feature_meta: serialized.feature_meta,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Learning is best-effort; never block the rating flow.
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4">
        <h1 className="text-4xl font-bold text-[var(--text)] mb-2 tracking-tight">
          Fit<span className="text-[var(--accent)]">Finder</span>
        </h1>
        <p className="text-[var(--text-secondary)] mb-8 text-sm">
          Your smart wardrobe assistant
        </p>
        <AuthForm />
      </div>
    );
  }

  if (!onboardingChecked) {
    return <SkeletonFullScreen />;
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          setShowOnboarding(false);
          setClosetRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ===== TOP NAV BAR ===== */}
      <header className="sticky top-0 z-40 bg-white border-b border-[var(--border)] px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
          {/* Logo */}
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Fit<span className="text-[var(--accent)]">Finder</span>
          </h1>

          {/* Tab navigation */}
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={activeTab === key ? 'nav-tab-active' : 'nav-tab'}
              >
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Sign out */}
          <button onClick={signOut} className="btn-ghost text-xs gap-1">
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Mobile tab bar */}
        <nav className="sm:hidden flex items-center justify-around py-1 -mx-4 px-2 border-t border-[var(--border)]">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                activeTab === key
                  ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {activeTab === 'closet' && (
          <Closet
            key={closetRefreshKey}
            onAddItem={() => setShowImageUpload(true)}
            onEditItem={(item) => {
              setSelectedItem(item);
              setShowEditItem(true);
            }}
          />
        )}
        {activeTab === 'preferences' && <ColorPreferences />}
        {activeTab === 'generator' && <OutfitGenerator onNavigateToCalendar={() => setActiveTab('calendar')} />}
        {activeTab === 'calendar' && <OutfitCalendar />}
        {activeTab === 'stats' && <WardrobeStats />}
      </main>

      {/* ===== MODALS ===== */}
      <ImageUpload
        isOpen={showImageUpload}
        onClose={() => setShowImageUpload(false)}
        onItemUploaded={() => setClosetRefreshKey((k) => k + 1)}
      />
      <EditItem
        isOpen={showEditItem}
        onClose={() => setShowEditItem(false)}
        item={selectedItem}
        onItemUpdated={() => setClosetRefreshKey((k) => k + 1)}
        onItemDeleted={() => setClosetRefreshKey((k) => k + 1)}
      />

      {/* Rating prompt */}
      {pendingRating && !ratingMinimized && (
        <RatingPrompt
          pendingRating={pendingRating}
          onSubmit={handleRatingSubmit}
          onSkip={() => setPendingRating(null)}
          onMinimize={() => setRatingMinimized(true)}
        />
      )}
      {pendingRating && ratingMinimized && (
        <button
          onClick={() => setRatingMinimized(false)}
          className="fixed bottom-4 right-4 z-50 btn-primary shadow-lg"
        >
          Rate Yesterday&apos;s Outfit
        </button>
      )}
    </div>
  );
}
