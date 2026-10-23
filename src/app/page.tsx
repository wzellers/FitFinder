'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CalendarDays, LogOut, Shirt, SlidersHorizontal, Sparkles } from 'lucide-react';
import Wordmark from '@/components/ui/Wordmark';
import LiveClock from '@/components/ui/LiveClock';
import PillNav from '@/components/ui/PillNav';
import { OutfitThemeProvider } from '@/components/OutfitTheme';
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
import { toLocalDateString } from '@/lib/dates';
import { syncWearLearning } from '@/lib/outfitLearning';
import { SkeletonFullScreen } from '@/components/ui/Skeleton';
import type { DashboardTab, ClothingItem, PendingRating } from '@/lib/types';

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
  const [generatorOpened, setGeneratorOpened] = useState(false);
  useEffect(() => {
    if (activeTab === 'generator') setGeneratorOpened(true);
  }, [activeTab]);
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

    // Learn from the rating, using the outfit as it was when worn. Best-effort:
    // never block the rating flow.
    if (user) {
      void syncWearLearning(user.id, wearId).catch((err) =>
        console.warn('Could not update outfit model', err),
      );
    }

    setPendingRating(null);
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
    <OutfitThemeProvider>
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
        <PillNav items={tabs} active={activeTab} onChange={setActiveTab} />

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
          {/* Kept mounted once opened, so the generated outfit survives tab switches. */}
          {generatorOpened && (
            <div hidden={activeTab !== 'generator'}>
              <OutfitGenerator
                onNavigateToCalendar={() => setActiveTab('calendar')}
                refreshKey={closetRefreshKey}
              />
            </div>
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
    </OutfitThemeProvider>
  );
}
