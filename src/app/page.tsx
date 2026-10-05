'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CalendarDays, LogOut, Shirt, SlidersHorizontal, Sparkles } from 'lucide-react';
import Wordmark from '@/components/ui/Wordmark';
import LiveClock from '@/components/ui/LiveClock';
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
import { useToast } from '@/components/ToastProvider';
import { supabase } from '@/lib/supabaseClient';
import { throwIfAnyError } from '@/lib/supabaseResult';
import { toLocalDateString } from '@/lib/dates';
import { SkeletonFullScreen } from '@/components/ui/Skeleton';
import { featureVector } from '@/lib/outfitScoring';
import { getUserClothingWeatherRules } from '@/lib/weatherApi';
import { getUserOccasionRules } from '@/lib/occasionRules';
import type { OccasionRules } from '@/lib/outfitScoring';
import { deserializeModel, serializeModel, updateWeights, computeReward } from '@/lib/banditModel';
import type { DashboardTab, ClothingItem, PendingRating, ColorCombination } from '@/lib/types';

const tabs: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: 'closet', label: 'Closet', icon: Shirt },
  { key: 'generator', label: 'Outfits', icon: Sparkles },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'preferences', label: 'Settings', icon: SlidersHorizontal },
];

export default function Page() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { showToast } = useToast();
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
      const [itemsRes, profileRes] = await Promise.all([
        supabase.from('clothing_items').select('id').eq('user_id', user.id).limit(1),
        supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle(),
      ]);
      const items = itemsRes.data;
      const profile = profileRes.data;

      // If either check failed we can't tell, so don't push a returning user
      // back through onboarding.
      const checkFailed = Boolean(itemsRes.error || profileRes.error);
      if (!checkFailed && (!items || items.length === 0) && !profile?.onboarding_completed) {
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
    const yStr = toLocalDateString(yesterday);

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
    const { error } = await supabase.from('outfit_wears').update({ rating }).eq('id', wearId);
    if (error) {
      showToast("Couldn't save your rating. Try again.", 'error');
      return;
    }

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
  const applyRatingReward = async (userId: string, rating: PendingRating, score: number) => {
    const itemIds = [
      rating.outfit_items.top_id,
      rating.outfit_items.bottom_id,
      rating.outfit_items.shoes_id,
    ].filter(Boolean) as string[];
    if (itemIds.length < 3) return;

    try {
      const [
        { data: itemsData },
        { data: prefsData },
        { data: modelData },
        { data: occPrefsData },
      ] = throwIfAnyError(
        await Promise.all([
          supabase.from('clothing_items').select('*').in('id', itemIds),
          supabase
            .from('color_preferences')
            .select('liked_combinations')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('outfit_model_weights')
            .select('weights, feature_meta')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase.from('occasion_preferences').select('rules').eq('user_id', userId).maybeSingle(),
        ]),
      );

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
      const { error } = await supabase.from('outfit_model_weights').upsert({
        user_id: userId,
        weights: serialized.weights,
        feature_meta: serialized.feature_meta,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (err) {
      console.warn('Could not update outfit model', err);
      // Learning is best-effort; never block the rating flow.
    }
  };

  if (authLoading) {
    return <SkeletonFullScreen />;
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
        <h1 className="mb-2">
          <Wordmark size="lg" />
        </h1>
        <p className="text-[var(--text-secondary)] mb-8 text-center">
          Your wardrobe and outfit planner.
        </p>
        <AuthForm />
      </main>
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
      {/* ===== TOP BAR ===== */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-[var(--border)] px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <h1>
            <Wordmark />
          </h1>
          <div className="flex items-center gap-4">
            <LiveClock className="hidden sm:inline" />
            <button onClick={signOut} className="btn-ghost px-3" aria-label="Sign out">
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating pill navigation, bottom-centre on every screen size */}
      <nav
        aria-label="Main"
        className="fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 rounded-full bg-[var(--burgundy)] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] grid grid-cols-5 sm:flex sm:gap-1"
      >
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 min-h-[52px] sm:min-h-[44px] sm:px-5 rounded-full text-[11px] sm:text-sm font-medium transition-colors ${
                active ? 'bg-[var(--sky)] text-[var(--burgundy)]' : 'text-[#e3cfd3] hover:text-white'
              }`}
            >
              <Icon size={18} aria-hidden="true" className="sm:hidden" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8 pb-32">
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
        {activeTab === 'generator' && (
          <OutfitGenerator onNavigateToCalendar={() => setActiveTab('calendar')} />
        )}
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
          className="fixed bottom-28 right-4 z-50 btn-primary shadow-lg"
        >
          Rate yesterday&apos;s outfit
        </button>
      )}
    </div>
  );
}
