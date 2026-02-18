"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Lock, Unlock, Sparkles, Save, CloudSun, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { typeToSection, occasions } from '@/lib/constants';
import { fetchWeather, getTemperatureCategory, getWeatherIconUrl, TEMPERATURE_THRESHOLDS } from '@/lib/weatherApi';
import { generateScoredOutfits } from '@/lib/outfitScoring';
import type { ClothingItem, ColorCombination, SavedOutfit, OutfitWear } from '@/lib/types';
import type { WeatherData, TemperatureCategory } from '@/lib/weatherApi';
import type { Occasion } from '@/lib/constants';
import type { OutfitCandidate } from '@/lib/outfitScoring';

export default function OutfitGenerator() {
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

  // Occasion
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);

  // Current outfit display
  const [top, setTop] = useState<ClothingItem | null>(null);
  const [outerwear, setOuterwear] = useState<ClothingItem | null>(null);
  const [bottom, setBottom] = useState<ClothingItem | null>(null);
  const [shoes, setShoes] = useState<ClothingItem | null>(null);

  // Scored results
  const [scoredResults, setScoredResults] = useState<OutfitCandidate[]>([]);
  const [resultIndex, setResultIndex] = useState(0);

  // Locks
  const [lockedTop, setLockedTop] = useState(false);
  const [lockedBottom, setLockedBottom] = useState(false);
  const [lockedShoes, setLockedShoes] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'generator' | 'saved'>('generator');

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
        ] = await Promise.all([
          supabase.from('clothing_items').select('*').eq('user_id', user.id).eq('is_dirty', false),
          supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('saved_outfits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('outfit_wears').select('*').eq('user_id', user.id).gte('worn_date', weekAgo.toISOString().split('T')[0]),
          supabase.from('outfit_wears').select('*').eq('user_id', user.id).not('rating', 'is', null).order('worn_date', { ascending: false }).limit(50),
          supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
        ]);

        setItems(itemsData || []);
        setLiked((prefsData?.liked_combinations ?? []) as ColorCombination[]);
        setSavedOutfits(outfitsData || []);
        setRecentWears(wearsData || []);
        setRatedOutfits(ratedData || []);

        // Fetch weather
        if (profileData?.zip_code) {
          setWeatherLoading(true);
          const wd = await fetchWeather(profileData.zip_code);
          setWeather(wd);
          if (wd) setTempCategory(getTemperatureCategory(wd.highTemperature));
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
  const pickOutfit = useCallback(() => {
    setError('');
    const results = generateScoredOutfits(items, {
      likedCombinations: liked,
      weather: tempCategory,
      recentWears,
      occasion: selectedOccasion,
      ratedOutfits,
    }, 10);

    if (results.length === 0) {
      setError('No valid outfits found. Try adding more items or adjusting your preferences.');
      return;
    }

    setScoredResults(results);
    setResultIndex(0);
    applyOutfit(results[0]);
  }, [items, liked, tempCategory, recentWears, selectedOccasion, ratedOutfits]);

  const cycleNext = () => {
    if (scoredResults.length === 0) return;
    const next = (resultIndex + 1) % scoredResults.length;
    setResultIndex(next);
    applyOutfit(scoredResults[next]);
  };

  const applyOutfit = (candidate: OutfitCandidate) => {
    if (!lockedTop) {
      setTop(candidate.top);
      setOuterwear(candidate.outerwear);
    }
    if (!lockedBottom) setBottom(candidate.bottom);
    if (!lockedShoes) setShoes(candidate.shoes);
  };

  // Save outfit
  const saveOutfit = async () => {
    if (!top || !bottom || !shoes || !user) { setError('Cannot save incomplete outfit'); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.from('saved_outfits').insert({
        user_id: user.id,
        outfit_items: { top_id: top.id, outerwear_id: outerwear?.id, bottom_id: bottom.id, shoes_id: shoes.id },
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
    if (!user || (!top && !outerwear) || !bottom || !shoes) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await supabase.from('outfit_wears').insert({
        user_id: user.id,
        worn_date: today,
        top_id: top?.id ?? null,
        bottom_id: bottom.id,
        shoes_id: shoes.id,
        outerwear_id: outerwear?.id ?? null,
      });
      showToast('Logged as today\'s outfit!', 'success');
    } catch {
      showToast('Failed to log outfit', 'error');
    }
  };

  // Delete saved outfit
  const deleteOutfit = async (outfitId: string) => {
    if (!user || !confirm('Delete this saved outfit?')) return;
    try {
      await supabase.from('saved_outfits').delete().eq('id', outfitId).eq('user_id', user.id);
      setSavedOutfits((prev) => prev.filter((o) => o.id !== outfitId));
      showToast('Outfit deleted', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  // Load saved outfit
  const loadSavedOutfit = (outfit: SavedOutfit) => {
    setTop(items.find((i) => i.id === outfit.outfit_items.top_id) ?? null);
    setBottom(items.find((i) => i.id === outfit.outfit_items.bottom_id) ?? null);
    setShoes(items.find((i) => i.id === outfit.outfit_items.shoes_id) ?? null);
    setOuterwear(items.find((i) => i.id === outfit.outfit_items.outerwear_id) ?? null);
    setLockedTop(false); setLockedBottom(false); setLockedShoes(false);
    setActiveTab('generator');
  };

  // Item card renderer
  const ItemSlot = ({ item, label, locked, onToggleLock }: { item: ClothingItem | null; label: string; locked: boolean; onToggleLock: () => void }) => (
    <div className="flex items-center gap-3">
      <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl border border-[var(--border)] bg-white flex items-center justify-center overflow-hidden">
        {item ? (
          <img src={item.image_url} alt={item.type} className="w-full h-full object-contain p-2" />
        ) : (
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        )}
      </div>
      <button
        onClick={onToggleLock}
        className={`p-2 rounded-lg border transition-colors ${locked ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'}`}
        title={locked ? `Unlock ${label}` : `Lock ${label}`}
      >
        {locked ? <Lock size={16} /> : <Unlock size={16} />}
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Error */}
      {error && <div className="bg-amber-50 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {/* Weather widget */}
      {weather && (
        <div className="card p-4 mb-6 flex items-center gap-4">
          <img src={getWeatherIconUrl(weather.icon)} alt={weather.condition} className="w-12 h-12" />
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">{weather.temperature}°F</div>
            <div className="text-xs text-[var(--text-secondary)]">
              High {weather.highTemperature}°F · {weather.condition}
            </div>
          </div>
          <div className={`ml-auto text-xs font-medium px-3 py-1 rounded-full ${
            tempCategory === 'cold' ? 'bg-blue-100 text-blue-700' :
            tempCategory === 'cool' ? 'bg-sky-100 text-sky-700' :
            tempCategory === 'warm' ? 'bg-orange-100 text-orange-700' :
            'bg-red-100 text-red-700'
          }`}>
            {tempCategory === 'cold' ? `Cold (<${TEMPERATURE_THRESHOLDS.COLD}°F)` :
             tempCategory === 'cool' ? `Cool (${TEMPERATURE_THRESHOLDS.COLD}-${TEMPERATURE_THRESHOLDS.COOL}°F)` :
             tempCategory === 'warm' ? `Warm (${TEMPERATURE_THRESHOLDS.COOL}-${TEMPERATURE_THRESHOLDS.WARM}°F)` :
             `Hot (>${TEMPERATURE_THRESHOLDS.WARM}°F)`}
          </div>
        </div>
      )}
      {!weather && !weatherLoading && (
        <div className="card p-3 mb-6 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <CloudSun size={16} /> Set your zip code in Preferences to enable weather-aware suggestions.
        </div>
      )}

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
        <>
          {/* Occasion chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedOccasion(null)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                !selectedOccasion ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              Any Occasion
            </button>
            {occasions.map((occ) => (
              <button
                key={occ}
                onClick={() => setSelectedOccasion(occ)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  selectedOccasion === occ ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
                }`}
              >
                {occ}
              </button>
            ))}
          </div>

          {/* Outfit display */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <ItemSlot item={top || outerwear} label="Top" locked={lockedTop} onToggleLock={() => setLockedTop(!lockedTop)} />
            <ItemSlot item={bottom} label="Bottom" locked={lockedBottom} onToggleLock={() => setLockedBottom(!lockedBottom)} />
            <ItemSlot item={shoes} label="Shoes" locked={lockedShoes} onToggleLock={() => setLockedShoes(!lockedShoes)} />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-2">
            <button onClick={pickOutfit} disabled={loading} className="btn-primary">
              <Sparkles size={16} /> Generate
            </button>
            {scoredResults.length > 1 && (
              <button onClick={cycleNext} className="btn-secondary">
                Next ({resultIndex + 1}/{scoredResults.length})
              </button>
            )}
            <button
              onClick={saveOutfit}
              disabled={!top && !outerwear || !bottom || !shoes}
              className="btn-secondary disabled:opacity-50"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={wearToday}
              disabled={(!top && !outerwear) || !bottom || !shoes}
              className="btn-secondary disabled:opacity-50"
            >
              <CalendarPlus size={16} /> Wear Today
            </button>
          </div>
        </>
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
                    <div className="text-xs text-[var(--text-secondary)]">
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
                      <button onClick={() => deleteOutfit(outfit.id!)} className="btn-danger text-xs py-1 px-2">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
