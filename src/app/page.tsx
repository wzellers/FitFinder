"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Shirt, Palette, Sparkles, Calendar, BarChart3, LogOut, Plus } from 'lucide-react';
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
import type { DashboardTab, ClothingItem, PendingRating } from '@/lib/types';

const tabs: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: 'closet', label: 'Closet', icon: Shirt },
  { key: 'generator', label: 'Generator', icon: Sparkles },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'preferences', label: 'Preferences', icon: Palette },
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
        outfit_items: {
          top_id: wear.top_id ?? undefined,
          bottom_id: wear.bottom_id ?? undefined,
          shoes_id: wear.shoes_id ?? undefined,
          outerwear_id: wear.outerwear_id ?? undefined,
        },
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && onboardingChecked && !showOnboarding) checkPendingRatings();
  }, [user, onboardingChecked, showOnboarding, checkPendingRatings]);

  const handleRatingSubmit = async (wearId: string, rating: number, comfortRating?: number) => {
    await supabase
      .from('outfit_wears')
      .update({ rating, comfort_rating: comfortRating ?? null })
      .eq('id', wearId);
    setPendingRating(null);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--text-secondary)] text-sm">Loading...</div>
      </div>
    );
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
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={activeTab === key ? 'nav-tab-active' : 'nav-tab'}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{label}</span>
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
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                activeTab === key
                  ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={18} />
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
        {activeTab === 'generator' && <OutfitGenerator />}
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
