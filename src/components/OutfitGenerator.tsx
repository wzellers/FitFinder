"use client";

import React, { useEffect, useState } from 'react';
import { Lock, Unlock, Sparkles, Save, CloudSun, CalendarPlus, CloudOff, X, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { typeToSection } from '@/lib/constants';
import { fetchWeather, getTemperatureCategory, getWeatherIconUrl, TEMPERATURE_THRESHOLDS } from '@/lib/weatherApi';
import { generateScoredOutfits } from '@/lib/outfitScoring';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonOutfitSlots } from '@/components/ui/Skeleton';
import type { ClothingItem, ColorCombination, SavedOutfit, OutfitWear, UserWeatherPreferences } from '@/lib/types';
import type { WeatherData, TemperatureCategory } from '@/lib/weatherApi';
import type { OutfitCandidate } from '@/lib/outfitScoring';

interface OutfitGeneratorProps {
  onNavigateToCalendar?: () => void;
}

export default function OutfitGenerator({ onNavigateToCalendar }: OutfitGeneratorProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Data
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [liked, setLiked] = useState<ColorCombination[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [recentWears, setRecentWears] = useState<OutfitWear[]>([]);
  const [ratedOutfits, setRatedOutfits] = useState<OutfitWear[]>([]);

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tempCategory, setTempCategory] = useState<TemperatureCategory | null>(null);
  const [ignoreWeather, setIgnoreWeather] = useState(false);
  const [userWeatherPrefs, setUserWeatherPrefs] = useState<UserWeatherPreferences | null>(null);

  // Current outfit display
  const [top, setTop] = useState<ClothingItem | null>(null);
  const [bottom, setBottom] = useState<ClothingItem | null>(null);
  const [shoes, setShoes] = useState<ClothingItem | null>(null);

  // Scored results (not displayed to user — just used internally)
  const scoredResultsRef = React.useRef<OutfitCandidate[]>([]);
  const resultIndexRef = React.useRef(0);

  // Locks
  const [lockedTop, setLockedTop] = useState(false);
  const [lockedBottom, setLockedBottom] = useState(false);
  const [lockedShoes, setLockedShoes] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'generator' | 'saved'>('generator');

  // Item picker modal
  const [pickerSlot, setPickerSlot] = useState<'top' | 'bottom' | 'shoes' | null>(null);

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveName, setPendingSaveName] = useState('');

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [
          { data: itemsData },
          { data: prefsData },
          { data: outfitsData },
          { data: wearsData },
          { data: ratedData },
          { data: profileData },
          { data: weatherPrefsData },
        ] = await Promise.all([
          supabase.from('clothing_items').select('*').eq('user_id', user.id).eq('is_dirty', false),
          supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('saved_outfits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('outfit_wears').select('*').eq('user_id', user.id).gte('worn_date', weekAgo.toISOString().split('T')[0]),
          supabase.from('outfit_wears').select('*').eq('user_id', user.id).not('rating', 'is', null).order('worn_date', { ascending: false }).limit(50),
          supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
          supabase.from('weather_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        ]);

        setItems(itemsData || []);
        setLiked((prefsData?.liked_combinations ?? []) as ColorCombination[]);
        setSavedOutfits(outfitsData || []);
        setRecentWears(wearsData || []);
        setRatedOutfits(ratedData || []);

        const userWP: UserWeatherPreferences | null = weatherPrefsData ? {
          thresholds: weatherPrefsData.thresholds ?? { cold: TEMPERATURE_THRESHOLDS.COLD, cool: TEMPERATURE_THRESHOLDS.COOL, warm: TEMPERATURE_THRESHOLDS.WARM },
          clothingRules: weatherPrefsData.clothing_rules ?? null,
        } : null;
        setUserWeatherPrefs(userWP);

        // Fetch weather
        if (profileData?.zip_code) {
          setWeatherLoading(true);
          const wd = await fetchWeather(profileData.zip_code);
          setWeather(wd);
          if (wd) setTempCategory(getTemperatureCategory(wd.highTemperature, userWP?.thresholds));
          setWeatherLoading(false);
        }
      } catch {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  // Generate outfit
  const pickOutfit = () => {
    setError('');

    // If we have cached results, cycle to the next one
    if (scoredResultsRef.current.length > 0) {
      const next = (resultIndexRef.current + 1) % scoredResultsRef.current.length;
      resultIndexRef.current = next;

      // If we've cycled through all, regenerate fresh results
      if (next === 0) {
        scoredResultsRef.current = [];
      } else {
        applyOutfit(scoredResultsRef.current[next]);
        return;
      }
    }

    const results = generateScoredOutfits(items, {
      likedCombinations: liked,
      weather: ignoreWeather ? null : tempCategory,
      recentWears,
      occasion: null,
      ratedOutfits,
      weatherRules: userWeatherPrefs?.clothingRules ?? undefined,
    }, 10);

    if (results.length === 0) {
      setError('No valid outfits found. Try adding more items or adjusting your preferences.');
      return;
    }

    scoredResultsRef.current = results;
    resultIndexRef.current = 0;
    applyOutfit(results[0]);
  };

  const applyOutfit = (candidate: OutfitCandidate) => {
    if (!lockedTop) setTop(candidate.top);
    if (!lockedBottom) setBottom(candidate.bottom);
    if (!lockedShoes) setShoes(candidate.shoes);
  };

  // Save outfit with name
  const openSaveModal = () => {
    if (!top || !bottom || !shoes || !user) { setError('Cannot save incomplete outfit'); return; }
    setPendingSaveName(`Outfit #${savedOutfits.length + 1}`);
    setShowSaveModal(true);
  };

  const confirmSaveOutfit = async () => {
    if (!top || !bottom || !shoes || !user) return;
    setShowSaveModal(false);
    setLoading(true);
    try {
      const { error: err } = await supabase.from('saved_outfits').insert({
        user_id: user.id,
        name: pendingSaveName.trim() || null,
        outfit_items: { top_id: top.id, bottom_id: bottom.id, shoes_id: shoes.id },
      }).select().single();
      if (err) throw err;
      showToast('Outfit saved!', 'success');
      const { data } = await supabase.from('saved_outfits').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setSavedOutfits(data || []);
    } catch {
      showToast('Failed to save outfit', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Wear today
  const wearToday = async () => {
    if (!user || !top || !bottom || !shoes) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data: existing } = await supabase
        .from('outfit_wears')
        .select('id')
        .eq('user_id', user.id)
        .eq('worn_date', today)
        .maybeSingle();
      if (existing) {
        showToast('Already logged an outfit for today', 'warning');
        return;
      }
      await supabase.from('outfit_wears').insert({
        user_id: user.id,
        worn_date: today,
        top_id: top.id,
        bottom_id: bottom.id,
        shoes_id: shoes.id,
      });
      showToast('Logged as today\'s outfit!', 'success');
    } catch {
      showToast('Failed to log outfit', 'error');
    }
  };

  // Delete saved outfit
  const requestDeleteOutfit = (outfitId: string) => {
    setPendingDeleteId(outfitId);
    setConfirmOpen(true);
  };

  const confirmDeleteOutfit = async () => {
    if (!user || !pendingDeleteId) return;
    setConfirmOpen(false);
    try {
      await supabase.from('saved_outfits').delete().eq('id', pendingDeleteId).eq('user_id', user.id);
      setSavedOutfits((prev) => prev.filter((o) => o.id !== pendingDeleteId));
      showToast('Outfit deleted', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  // Load saved outfit
  const loadSavedOutfit = (outfit: SavedOutfit) => {
    setTop(items.find((i) => i.id === outfit.outfit_items.top_id) ?? null);
    setBottom(items.find((i) => i.id === outfit.outfit_items.bottom_id) ?? null);
    setShoes(items.find((i) => i.id === outfit.outfit_items.shoes_id) ?? null);
    setLockedTop(false); setLockedBottom(false); setLockedShoes(false);
    setActiveTab('generator');
  };

  // Picker helpers
  const getPickerSection = (slot: typeof pickerSlot): string[] => {
    if (!slot) return [];
    if (slot === 'top') return ['Tops'];
    if (slot === 'bottom') return ['Bottoms'];
    return ['Shoes'];
  };

  const pickerItems = pickerSlot
    ? items.filter((i) => getPickerSection(pickerSlot).includes(typeToSection[i.type] ?? ''))
    : [];

  const handlePickItem = (item: ClothingItem) => {
    if (!pickerSlot) return;
    switch (pickerSlot) {
      case 'top': setTop(item); setLockedTop(true); break;
      case 'bottom': setBottom(item); setLockedBottom(true); break;
      case 'shoes': setShoes(item); setLockedShoes(true); break;
    }
    setPickerSlot(null);
  };

  const hasOutfit = top && bottom && shoes;

  // Item slot renderer
  const ItemSlot = ({ item, label, locked, onToggleLock, onClickSlot }: {
    item: ClothingItem | null; label: string; locked: boolean;
    onToggleLock: () => void; onClickSlot: () => void;
  }) => (
    <div className="flex items-center gap-3 w-full">
      <button
        type="button"
        onClick={onClickSlot}
        className={`w-32 h-32 sm:w-36 sm:h-36 rounded-xl border bg-white flex items-center justify-center overflow-hidden cursor-pointer hover:border-[var(--accent)] transition-colors shrink-0 ${
          item ? 'border-[var(--border)]' : 'border-2 border-dashed border-gray-300'
        }`}
        title={`Click to choose ${label.toLowerCase()}`}
      >
        {item ? (
          <img src={item.image_url} alt={item.type} className="w-full h-full object-contain p-2" />
        ) : (
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        )}
      </button>
      <div className="flex flex-col items-start gap-1 min-h-[3.5rem]">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        <span className="text-xs text-[var(--text-secondary)]">{item ? item.type : '\u00A0'}</span>
        <button
          onClick={onToggleLock}
          className={`p-1.5 rounded-md border transition-colors ${locked ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'}`}
          title={locked ? `Unlock ${label}` : `Lock ${label}`}
        >
          {locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
      </div>
    </div>
  );

  // Skeleton loading state
  if (loading && items.length === 0) {
    return (
      <div className="w-full">
        <SkeletonOutfitSlots />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Error */}
      {error && <div className="bg-amber-50 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {/* Tab toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('generator')} className={activeTab === 'generator' ? 'btn-primary' : 'btn-secondary'}>
          Generator
        </button>
        <button onClick={() => setActiveTab('saved')} className={activeTab === 'saved' ? 'btn-primary' : 'btn-secondary'}>
          Saved ({savedOutfits.length})
        </button>
      </div>

      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_240px] gap-6">
          {/* ====== LEFT PANEL — Weather ====== */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Weather</h3>

            {weatherLoading && (
              <div className="card p-4 animate-pulse">
                <div className="h-12 bg-[var(--muted)] rounded-lg" />
              </div>
            )}

            {weather && !weatherLoading && (
              <div className="card p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={getWeatherIconUrl(weather.icon)} alt={weather.condition} className="w-14 h-14" />
                  <div>
                    <div className="text-2xl font-bold text-[var(--text)]">{weather.temperature}°F</div>
                    <div className="text-xs text-[var(--text-secondary)]">{weather.condition}</div>
                  </div>
                </div>

                <div className="text-sm text-[var(--text-secondary)]">
                  High: <span className="font-medium text-[var(--text)]">{weather.highTemperature}°F</span>
                </div>

                <div className={`text-xs font-medium px-3 py-1.5 rounded-full text-center ${
                  ignoreWeather ? 'opacity-50' : ''
                } ${
                  tempCategory === 'cold' ? 'bg-blue-100 text-blue-700' :
                  tempCategory === 'cool' ? 'bg-sky-100 text-sky-700' :
                  tempCategory === 'warm' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {(() => {
                    const t = userWeatherPrefs?.thresholds ?? { cold: TEMPERATURE_THRESHOLDS.COLD, cool: TEMPERATURE_THRESHOLDS.COOL, warm: TEMPERATURE_THRESHOLDS.WARM };
                    return tempCategory === 'cold' ? `Cold (<${t.cold}°F)` :
                           tempCategory === 'cool' ? `Cool (${t.cold}-${t.cool}°F)` :
                           tempCategory === 'warm' ? `Warm (${t.cool}-${t.warm}°F)` :
                           `Hot (>${t.warm}°F)`;
                  })()}
                </div>

                <button
                  onClick={() => setIgnoreWeather(!ignoreWeather)}
                  className={`w-full text-sm px-3 py-2 rounded-lg border font-medium transition-colors flex items-center justify-center gap-2 ${
                    ignoreWeather
                      ? 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
                      : 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  }`}
                >
                  {ignoreWeather ? <><CloudOff size={14} />Weather Off</> : <><CloudSun size={14} />Using Weather</>}
                </button>
              </div>
            )}

            {!weather && !weatherLoading && (
              <div className="card p-4 text-sm text-[var(--text-secondary)] flex items-start gap-2">
                <CloudSun size={18} className="shrink-0 mt-0.5" />
                <span>Set your zip code in Preferences to enable weather-aware suggestions.</span>
              </div>
            )}
          </div>

          {/* ====== CENTER PANEL — Outfit Display ====== */}
          <div className="flex flex-col items-center">
            {/* Outfit slots — 3 boxes stacked */}
            <div className="flex flex-col items-start gap-3 mb-6 mx-auto">
              <ItemSlot item={top} label="Top" locked={lockedTop} onToggleLock={() => setLockedTop(!lockedTop)} onClickSlot={() => setPickerSlot('top')} />
              <ItemSlot item={bottom} label="Bottom" locked={lockedBottom} onToggleLock={() => setLockedBottom(!lockedBottom)} onClickSlot={() => setPickerSlot('bottom')} />
              <ItemSlot item={shoes} label="Shoes" locked={lockedShoes} onToggleLock={() => setLockedShoes(!lockedShoes)} onClickSlot={() => setPickerSlot('shoes')} />
            </div>

            {/* Generate button — centered under outfit display */}
            <button onClick={pickOutfit} disabled={loading} className="btn-primary text-base px-6 py-2.5 mx-auto">
              <Sparkles size={18} /> Generate
            </button>
          </div>

          {/* ====== RIGHT PANEL — Actions ====== */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Actions</h3>

            <button
              onClick={openSaveModal}
              disabled={!hasOutfit}
              className="btn-secondary w-full disabled:opacity-50"
            >
              <Save size={16} /> Save Outfit
            </button>

            <button
              onClick={wearToday}
              disabled={!hasOutfit}
              className="btn-secondary w-full disabled:opacity-50"
            >
              <CalendarPlus size={16} /> Wear Today
            </button>

            <div className="border-t border-[var(--border)] my-2" />

            <button
              onClick={onNavigateToCalendar}
              className="btn-ghost w-full"
            >
              <Calendar size={16} /> View Calendar
            </button>
          </div>
        </div>
      )}

      {/* Saved outfits tab */}
      {activeTab === 'saved' && (
        <div>
          {savedOutfits.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
              No saved outfits yet. Generate and save some outfits!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {savedOutfits.map((outfit, idx) => {
                const topItem = items.find((i) => i.id === outfit.outfit_items.top_id);
                const bottomItem = items.find((i) => i.id === outfit.outfit_items.bottom_id);
                const shoesItem = items.find((i) => i.id === outfit.outfit_items.shoes_id);
                return (
                  <div key={outfit.id ?? idx} className="card p-3 flex flex-col items-center gap-2">
                    <div className="text-xs font-medium text-[var(--text)] truncate w-full text-center">
                      {outfit.name || `Outfit #${idx + 1}`}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {outfit.created_at ? new Date(outfit.created_at).toLocaleDateString() : ''}
                    </div>
                    {[topItem, bottomItem, shoesItem].map((item, i) =>
                      item ? (
                        <div key={i} className="w-20 h-20 rounded-lg border border-[var(--border)] bg-white overflow-hidden">
                          <img src={item.image_url} alt={item.type} className="w-full h-full object-contain p-1" />
                        </div>
                      ) : (
                        <div key={i} className="w-20 h-20 rounded-lg bg-[var(--muted)]" />
                      ),
                    )}
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => loadSavedOutfit(outfit)} className="btn-primary text-xs py-1 px-2">Load</button>
                      <button onClick={() => requestDeleteOutfit(outfit.id!)} className="btn-danger text-xs py-1 px-2">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save name modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text)] mb-4">Save Outfit</h3>
            <label className="text-xs font-medium text-[var(--text)] mb-1 block">Outfit Name</label>
            <input
              type="text"
              value={pendingSaveName}
              onChange={(e) => setPendingSaveName(e.target.value)}
              placeholder="e.g. Casual Friday"
              className="w-full mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveOutfit(); }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={confirmSaveOutfit} className="btn-primary text-xs">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Item picker modal */}
      {pickerSlot && (
        <div className="modal-overlay" onClick={() => setPickerSlot(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text)]">
                Choose {pickerSlot.charAt(0).toUpperCase() + pickerSlot.slice(1)}
              </h3>
              <button onClick={() => setPickerSlot(null)} className="p-1 rounded-md hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            {pickerItems.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-6">No items in this category.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
                {pickerItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handlePickItem(item)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-lg bg-white overflow-hidden border border-[var(--border)]">
                      <img src={item.image_url} alt={item.type} className="w-full h-full object-contain p-1" />
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] truncate w-full text-center">{item.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Delete this saved outfit?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteOutfit}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </div>
  );
}
