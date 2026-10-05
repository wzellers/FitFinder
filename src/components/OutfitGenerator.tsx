'use client';

import Modal from '@/components/ui/Modal';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock,
  Unlock,
  Sparkles,
  Save,
  CloudSun,
  CalendarPlus,
  CloudOff,
  X,
  Calendar,
  Trash2,
} from 'lucide-react';
import { describeItem } from '@/lib/itemLabels';
import { useAuth } from '@/hooks/useAuth';
import ClothingImage from '@/components/ui/ClothingImage';
import ScrambleText from '@/components/ui/ScrambleText';
import { supabase } from '@/lib/supabaseClient';
import { isUniqueViolation, throwIfAnyError } from '@/lib/supabaseResult';
import { toLocalDateString } from '@/lib/dates';
import { useToast } from '@/components/ToastProvider';
import { typeToSection } from '@/lib/constants';
import {
  fetchWeather,
  getTemperatureCategory,
  getWeatherIconUrl,
  TEMPERATURE_THRESHOLDS,
} from '@/lib/weatherApi';
import { buildCandidates, featureVector } from '@/lib/outfitScoring';
import type { OccasionRules } from '@/lib/outfitScoring';
import { getUserClothingWeatherRules } from '@/lib/weatherApi';
import { getUserOccasionRules } from '@/lib/occasionRules';
import { occasions } from '@/lib/constants';
import type { Occasion } from '@/lib/constants';
import {
  deserializeModel,
  serializeModel,
  selectOutfits,
  updateWeights,
  SAVED_OUTFIT_REWARD,
  type BanditModel,
} from '@/lib/banditModel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonOutfitSlots } from '@/components/ui/Skeleton';
import type {
  ClothingItem,
  ColorCombination,
  SavedOutfit,
  UserWeatherPreferences,
  OutfitWear,
} from '@/lib/types';
import type { WeatherData, TemperatureCategory } from '@/lib/weatherApi';

interface OutfitGeneratorProps {
  onNavigateToCalendar?: () => void;
}

export default function OutfitGenerator({ onNavigateToCalendar }: OutfitGeneratorProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Data
  // Every item, including dirty ones (needed to show saved outfits); only clean
  // items are used to generate outfits.
  const [allItems, setAllItems] = useState<ClothingItem[]>([]);
  const items = useMemo(() => allItems.filter((i) => !i.is_dirty), [allItems]);
  const [liked, setLiked] = useState<ColorCombination[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [recentWears, setRecentWears] = useState<OutfitWear[]>([]);
  const [ratedOutfits, setRatedOutfits] = useState<OutfitWear[]>([]);
  const [model, setModel] = useState<BanditModel | null>(null);

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tempCategory, setTempCategory] = useState<TemperatureCategory | null>(null);
  const [ignoreWeather, setIgnoreWeather] = useState(false);
  const [userWeatherPrefs, setUserWeatherPrefs] = useState<UserWeatherPreferences | null>(null);

  // Occasion — null means "Any" (no occasion filter).
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [userOccasionRules, setUserOccasionRules] = useState<OccasionRules | null>(null);

  // Current outfit display
  const [top, setTop] = useState<ClothingItem | null>(null);
  const [bottom, setBottom] = useState<ClothingItem | null>(null);
  const [shoes, setShoes] = useState<ClothingItem | null>(null);

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
        // Recent wears for the variety feature: last RECENCY_WINDOW_DAYS days.
        const recencyCutoff = toLocalDateString(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

        const [
          { data: itemsData },
          { data: prefsData },
          { data: outfitsData },
          { data: profileData },
          { data: weatherPrefsData },
          { data: recentWearsData },
          { data: ratedOutfitsData },
          { data: modelData },
          { data: occPrefsData },
        ] = throwIfAnyError(
          await Promise.all([
            supabase.from('clothing_items').select('*').eq('user_id', user.id),
            supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
            supabase
              .from('saved_outfits')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
            supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
            supabase.from('weather_preferences').select('*').eq('user_id', user.id).maybeSingle(),
            supabase
              .from('outfit_wears')
              .select('*')
              .eq('user_id', user.id)
              .gte('worn_date', recencyCutoff),
            supabase
              .from('outfit_wears')
              .select('*')
              .eq('user_id', user.id)
              .not('rating', 'is', null)
              .order('worn_date', { ascending: false })
              .limit(100),
            supabase
              .from('outfit_model_weights')
              .select('weights, feature_meta')
              .eq('user_id', user.id)
              .maybeSingle(),
            supabase
              .from('occasion_preferences')
              .select('rules')
              .eq('user_id', user.id)
              .maybeSingle(),
          ]),
        );

        setAllItems(itemsData || []);
        setLiked((prefsData?.liked_combinations ?? []) as ColorCombination[]);
        setSavedOutfits(outfitsData || []);
        setRecentWears((recentWearsData ?? []) as OutfitWear[]);
        setRatedOutfits((ratedOutfitsData ?? []) as OutfitWear[]);
        setModel(deserializeModel(modelData));
        setUserOccasionRules((occPrefsData?.rules ?? null) as OccasionRules | null);

        const userWP: UserWeatherPreferences | null = weatherPrefsData
          ? {
              thresholds: weatherPrefsData.thresholds ?? {
                cold: TEMPERATURE_THRESHOLDS.COLD,
                cool: TEMPERATURE_THRESHOLDS.COOL,
                warm: TEMPERATURE_THRESHOLDS.WARM,
              },
              clothingRules: weatherPrefsData.clothing_rules ?? null,
            }
          : null;
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
        setError("Couldn't load your closet. Refresh to try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  // Generate outfit — featurize candidates, then let the bandit select via
  // ε-greedy (explore/exploit) using the user's learned weights. Locked slots
  // constrain the candidate pool to the frozen item before scoring.
  const pickOutfit = () => {
    setError('');

    let candidates = buildCandidates(items, {
      likedCombinations: liked,
      weather: ignoreWeather ? null : tempCategory,
      weatherRules: userWeatherPrefs?.clothingRules ?? undefined,
      recentWears,
      ratedOutfits,
      occasion,
      occasionRules: userOccasionRules ?? undefined,
    });

    // Respect locked slots: only consider candidates that keep the frozen items.
    if (lockedTop && top) candidates = candidates.filter((c) => c.top.id === top.id);
    if (lockedBottom && bottom) candidates = candidates.filter((c) => c.bottom.id === bottom.id);
    if (lockedShoes && shoes) candidates = candidates.filter((c) => c.shoes.id === shoes.id);

    if (candidates.length === 0) {
      setError(
        occasion
          ? `Nothing clean in your closet suits ${occasion.toLowerCase()} right now. Try another occasion, or change what fits in Settings.`
          : 'No outfit fits right now. You need at least one clean top, bottom and pair of shoes that suit the weather.',
      );
      return;
    }

    const params = (model ?? deserializeModel(null)).params;
    const selected = selectOutfits(
      candidates.map((c) => ({ candidate: c, features: c.features })),
      params,
      { count: 5 },
    );

    // selectOutfits already explores/exploits; sample among its returned best so
    // repeated clicks stay fresh.
    const pick = selected[Math.floor(Math.random() * selected.length)].candidate;
    if (!lockedTop) setTop(pick.top);
    if (!lockedBottom) setBottom(pick.bottom);
    if (!lockedShoes) setShoes(pick.shoes);
  };

  // Apply an online learning update for a given outfit + reward, then persist the
  // new weights. Features are recomputed from the current context (weather and
  // occasion default to neutral, matching the rating-time path).
  const applyReward = async (
    outfit: {
      top: ClothingItem;
      bottom: ClothingItem;
      shoes: ClothingItem;
    },
    reward: number,
  ) => {
    if (!user) return;
    const rules = getUserClothingWeatherRules(userWeatherPrefs?.clothingRules ?? undefined);
    const features = featureVector(
      outfit,
      {
        likedCombinations: liked,
        weather: ignoreWeather ? null : tempCategory,
        weatherRules: userWeatherPrefs?.clothingRules ?? undefined,
        recentWears,
        ratedOutfits,
        occasion,
        occasionRules: userOccasionRules ?? undefined,
      },
      rules,
      getUserOccasionRules(userOccasionRules),
    );
    const updated = updateWeights(model ?? deserializeModel(null), features, reward);
    setModel(updated);
    const serialized = serializeModel(updated);
    const { error: weightsError } = await supabase.from('outfit_model_weights').upsert({
      user_id: user.id,
      weights: serialized.weights,
      feature_meta: serialized.feature_meta,
      updated_at: new Date().toISOString(),
    });
    // Learning is best-effort; the in-memory model still updated.
    if (weightsError) console.warn('Could not save outfit model', weightsError);
  };

  // Save outfit with name
  const openSaveModal = () => {
    if (!top || !bottom || !shoes || !user) {
      setError('Pick a top, bottom and shoes before saving.');
      return;
    }
    setPendingSaveName(`Outfit ${savedOutfits.length + 1}`);
    setShowSaveModal(true);
  };

  const confirmSaveOutfit = async () => {
    if (!top || !bottom || !shoes || !user) return;
    setShowSaveModal(false);
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('saved_outfits')
        .insert({
          user_id: user.id,
          name: pendingSaveName.trim() || null,
          outfit_items: {
            top_id: top.id,
            bottom_id: bottom.id,
            shoes_id: shoes.id,
          },
        })
        .select()
        .single();
      if (err) throw err;
      showToast('Outfit saved.', 'success');
      // Saving signals mild approval — nudge the model toward this outfit.
      void applyReward({ top, bottom, shoes }, SAVED_OUTFIT_REWARD);
      const { data } = await supabase
        .from('saved_outfits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setSavedOutfits(data || []);
    } catch {
      showToast("Couldn't save this outfit. Try again.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Wear today
  const wearToday = async () => {
    if (!user || !top || !bottom || !shoes) return;
    const today = toLocalDateString();
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('outfit_wears')
        .select('id')
        .eq('user_id', user.id)
        .eq('worn_date', today)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        showToast('Already logged an outfit for today', 'warning');
        return;
      }
      const { error: insertError } = await supabase.from('outfit_wears').insert({
        user_id: user.id,
        worn_date: today,
        top_id: top.id,
        bottom_id: bottom.id,
        shoes_id: shoes.id,
        occasion,
      });
      if (isUniqueViolation(insertError)) {
        showToast("You've already logged today's outfit. Edit it in Calendar.", 'warning');
        return;
      }
      if (insertError) throw insertError;
      showToast("Logged as today's outfit.", 'success');
    } catch {
      showToast("Couldn't log today's outfit. Try again.", 'error');
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
      const { error: deleteError } = await supabase
        .from('saved_outfits')
        .delete()
        .eq('id', pendingDeleteId)
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;
      setSavedOutfits((prev) => prev.filter((o) => o.id !== pendingDeleteId));
      showToast('Outfit deleted', 'success');
    } catch {
      showToast("Couldn't delete that outfit. Try again.", 'error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  // A saved outfit stores item ids in JSON (no foreign key), so an item can be
  // deleted out from under it. Missing pieces come back as undefined.
  const savedOutfitPieces = (outfit: SavedOutfit) =>
    [outfit.outfit_items.top_id, outfit.outfit_items.bottom_id, outfit.outfit_items.shoes_id].map(
      (id) => allItems.find((i) => i.id === id),
    );

  // Load saved outfit
  const loadSavedOutfit = (outfit: SavedOutfit) => {
    const pieces = savedOutfitPieces(outfit);
    setTop(pieces[0] ?? null);
    setBottom(pieces[1] ?? null);
    setShoes(pieces[2] ?? null);
    if (pieces.some((p) => !p)) {
      showToast('Part of this outfit was deleted from your closet. Pick a replacement.', 'info');
    }
    setLockedTop(false);
    setLockedBottom(false);
    setLockedShoes(false);
    setActiveTab('generator');
  };

  const pickerItems = (() => {
    if (!pickerSlot) return [];
    const section = pickerSlot === 'top' ? 'Tops' : pickerSlot === 'bottom' ? 'Bottoms' : 'Shoes';
    return items.filter((i) => typeToSection[i.type] === section);
  })();

  const handlePickItem = (item: ClothingItem) => {
    if (!pickerSlot) return;
    switch (pickerSlot) {
      case 'top':
        setTop(item);
        setLockedTop(true);
        break;
      case 'bottom':
        setBottom(item);
        setLockedBottom(true);
        break;
      case 'shoes':
        setShoes(item);
        setLockedShoes(true);
        break;
    }
    setPickerSlot(null);
  };

  const hasOutfit = Boolean(top && bottom && shoes);

  const thresholds = userWeatherPrefs?.thresholds ?? {
    cold: TEMPERATURE_THRESHOLDS.COLD,
    cool: TEMPERATURE_THRESHOLDS.COOL,
    warm: TEMPERATURE_THRESHOLDS.WARM,
  };
  const tempLabel =
    tempCategory === 'cold'
      ? `Cold, under ${thresholds.cold}°F`
      : tempCategory === 'cool'
        ? `Cool, ${thresholds.cold}–${thresholds.cool}°F`
        : tempCategory === 'warm'
          ? `Warm, ${thresholds.cool}–${thresholds.warm}°F`
          : `Hot, over ${thresholds.warm}°F`;

  // What the panel's "special instructions" line says about today's conditions.
  const instructions = [
    occasion ? `${occasion} outfit` : 'Any occasion',
    weather && !ignoreWeather
      ? `${weather.highTemperature}°F high, ${weather.condition.toLowerCase()}`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  const slots = [
    {
      key: 'top' as const,
      label: 'Top',
      item: top,
      locked: lockedTop,
      toggle: () => setLockedTop(!lockedTop),
    },
    {
      key: 'bottom' as const,
      label: 'Bottom',
      item: bottom,
      locked: lockedBottom,
      toggle: () => setLockedBottom(!lockedBottom),
    },
    {
      key: 'shoes' as const,
      label: 'Shoes',
      item: shoes,
      locked: lockedShoes,
      toggle: () => setLockedShoes(!lockedShoes),
    },
  ];

  const chip = (active: boolean) =>
    `min-h-[36px] px-3 rounded-full border text-sm font-semibold transition-colors ${
      active
        ? 'bg-[var(--sky)] text-[var(--burgundy)] border-[var(--sky)]'
        : 'bg-white text-[var(--text-secondary)] border-[var(--line-strong)] hover:text-[var(--text)]'
    }`;

  if (loading && items.length === 0) {
    return (
      <div className="w-full">
        <SkeletonOutfitSlots />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h2 className="text-3xl">Outfits</h2>
        <div className="inline-flex rounded-full border border-[var(--line-strong)] bg-white p-1">
          <button
            onClick={() => setActiveTab('generator')}
            aria-pressed={activeTab === 'generator'}
            className={`min-h-[36px] px-4 rounded-full text-sm font-medium ${
              activeTab === 'generator'
                ? 'bg-[var(--sky)] text-[var(--burgundy)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            New outfit
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            aria-pressed={activeTab === 'saved'}
            className={`min-h-[36px] px-4 rounded-full text-sm font-medium ${
              activeTab === 'saved' ? 'bg-[var(--sky)] text-[var(--burgundy)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            Saved <span className="tabular">({savedOutfits.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,36rem)_320px] lg:justify-center gap-8 lg:gap-14 items-start">
          {/* ====== The outfit ====== */}
          <div className="panel w-full max-w-xl mx-auto px-5 sm:px-7 pt-8 pb-7">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg">Your outfit</h3>
            </div>
            <p className="readout mt-1.5">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {instructions && <> · {instructions}</>}
            </p>

            <ul className="mt-5">
              {slots.map(({ key, label, item, locked, toggle }) => (
                <li key={key} className="divider flex items-center gap-4 py-3">
                  <button
                    type="button"
                    onClick={() => setPickerSlot(key)}
                    aria-label={
                      item
                        ? `Change ${label.toLowerCase()}: ${describeItem(item)}`
                        : `Choose a ${label.toLowerCase()}`
                    }
                    className={`w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-md overflow-hidden flex items-center justify-center ${
                      item
                        ? 'bg-white border border-[var(--border)] hover:border-[var(--line-strong)]'
                        : 'border-2 border-dashed border-[var(--line-strong)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    {item ? (
                      <ClothingImage
                        src={item.image_url}
                        alt=""
                        className="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <span className="text-sm font-semibold">Choose</span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="panel-label">{label}</div>
                    <div className="text-lg font-semibold tracking-tight truncate">
                      {item ? <ScrambleText text={item.type} /> : 'Not picked yet'}
                    </div>
                    {item && (
                      <div className="readout truncate mt-0.5">
                        <ScrambleText
                          text={describeItem(item).slice(0, -item.type.length).trim()}
                          frames={10}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={toggle}
                    disabled={!item}
                    aria-pressed={locked}
                    aria-label={`${locked ? 'Unlock' : 'Lock'} ${label.toLowerCase()}`}
                    className={`min-h-[44px] px-3 rounded-md border text-sm font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-40 ${
                      locked
                        ? 'bg-[var(--sky)] text-[var(--burgundy)] border-[var(--sky)]'
                        : 'bg-white text-[var(--text-secondary)] border-[var(--line-strong)] hover:text-[var(--text)]'
                    }`}
                  >
                    {locked ? (
                      <Lock size={14} aria-hidden="true" />
                    ) : (
                      <Unlock size={14} aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">{locked ? 'Kept' : 'Keep'}</span>
                  </button>
                </li>
              ))}
            </ul>

            {error && (
              <p
                role="status"
                className="text-sm text-[var(--warning)] bg-[#fdf4e3] rounded-md px-3 py-2 mt-2"
              >
                {error}
              </p>
            )}

            <div className="divider pt-5 flex flex-col gap-3">
              <button
                onClick={pickOutfit}
                disabled={loading}
                className="btn-primary w-full text-base min-h-[52px]"
              >
                <Sparkles size={18} aria-hidden="true" />
                {hasOutfit ? 'Try another outfit' : 'Generate outfit'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={openSaveModal} disabled={!hasOutfit} className="btn-secondary">
                  <Save size={16} aria-hidden="true" /> Save outfit
                </button>
                <button onClick={wearToday} disabled={!hasOutfit} className="btn-secondary">
                  <CalendarPlus size={16} aria-hidden="true" /> Wear today
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] text-center">
                Keep a piece to build the rest of the outfit around it.
              </p>
            </div>
          </div>

          {/* ====== Conditions ====== */}
          <div className="space-y-6">
            <section aria-labelledby="occasion-heading">
              <h3 id="occasion-heading" className="text-lg mb-2">
                Occasion
              </h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Occasion">
                <button
                  onClick={() => setOccasion(null)}
                  aria-pressed={occasion === null}
                  className={chip(occasion === null)}
                >
                  Any
                </button>
                {occasions.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccasion(o)}
                    aria-pressed={occasion === o}
                    className={chip(occasion === o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Only items that suit the occasion are used. Change what fits in Settings.
              </p>
            </section>

            <section aria-labelledby="weather-heading">
              <h3 id="weather-heading" className="text-lg mb-2">
                Weather
              </h3>
              {weatherLoading && <div className="card h-28 animate-pulse" />}

              {weather && !weatherLoading && (
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <img src={getWeatherIconUrl(weather.icon)} alt="" className="w-12 h-12 -my-1" />
                    <div>
                      <div className="tabular font-semibold text-3xl font-bold">
                        {weather.temperature}°F
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {weather.condition}, high of {weather.highTemperature}°F
                      </div>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold mt-3 ${ignoreWeather ? 'text-[var(--text-secondary)] line-through' : ''}`}
                  >
                    {tempLabel}
                  </p>
                  <label className="mt-3 flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      {ignoreWeather ? (
                        <CloudOff size={16} aria-hidden="true" />
                      ) : (
                        <CloudSun size={16} aria-hidden="true" />
                      )}
                      Dress for the weather
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={!ignoreWeather}
                      onChange={() => setIgnoreWeather(!ignoreWeather)}
                      className="w-5 h-5 accent-[var(--carbon)]"
                    />
                  </label>
                </div>
              )}

              {!weather && !weatherLoading && (
                <div className="card p-4 text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <CloudSun size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Add your ZIP code in Settings to get outfits picked for the weather.</span>
                </div>
              )}
            </section>

            <button onClick={onNavigateToCalendar} className="btn-ghost w-full justify-start">
              <Calendar size={16} aria-hidden="true" /> See what you&apos;ve worn
            </button>
          </div>
        </div>
      )}

      {/* Saved outfits */}
      {activeTab === 'saved' && (
        <div>
          {savedOutfits.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-lg font-semibold mb-1">No saved outfits yet</p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Generate an outfit you like and tap Save outfit to keep it here.
              </p>
              <button onClick={() => setActiveTab('generator')} className="btn-primary">
                <Sparkles size={16} aria-hidden="true" /> Generate an outfit
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedOutfits.map((outfit, idx) => {
                const pieces = savedOutfitPieces(outfit);
                const name = outfit.name || `Outfit ${idx + 1}`;
                return (
                  <li key={outfit.id ?? idx} className="panel px-5 pt-7 pb-5 flex flex-col">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-lg font-bold truncate">{name}</span>
                      <span className="tabular text-xs text-[var(--text-secondary)] shrink-0">
                        {outfit.created_at
                          ? new Date(outfit.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 my-4">
                      {pieces.map((item, i) =>
                        item ? (
                          <div
                            key={i}
                            className="relative aspect-square rounded-md border border-[var(--border)] bg-white overflow-hidden"
                          >
                            <ClothingImage
                              src={item.image_url}
                              alt={describeItem(item)}
                              className="w-full h-full object-contain p-1"
                            />
                            {item.is_dirty && (
                              <span className="badge-dirty absolute bottom-1 right-1 bg-white/80">
                                Dirty
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            key={i}
                            className="aspect-square rounded-md border border-dashed border-[var(--line-strong)] flex items-center justify-center text-xs text-center text-[var(--text-secondary)] p-1"
                          >
                            Deleted item
                          </div>
                        ),
                      )}
                    </div>
                    <div className="divider pt-3 mt-auto flex gap-2">
                      <button
                        onClick={() => loadSavedOutfit(outfit)}
                        className="btn-secondary flex-1"
                        aria-label={`Wear ${name} again`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => requestDeleteOutfit(outfit.id!)}
                        className="btn-ghost text-[var(--danger)] hover:text-[var(--danger)]"
                        aria-label={`Delete ${name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Save name modal */}
      {showSaveModal && (
        <Modal label="Save outfit" onClose={() => setShowSaveModal(false)} className="max-w-sm">
          <h3 className="text-xl mb-4">Save outfit</h3>
          <label htmlFor="save-outfit-name" className="text-sm font-semibold mb-1.5 block">
            Name
          </label>
          <input
            id="save-outfit-name"
            type="text"
            value={pendingSaveName}
            onChange={(e) => setPendingSaveName(e.target.value)}
            placeholder="e.g. Casual Friday"
            className="w-full mb-4"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSaveOutfit();
            }}
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={confirmSaveOutfit} className="btn-primary">
              Save outfit
            </button>
          </div>
        </Modal>
      )}

      {/* Item picker modal */}
      {pickerSlot && (
        <Modal
          label={`Choose a ${pickerSlot}`}
          onClose={() => setPickerSlot(null)}
          className="max-w-md"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl">Choose a {pickerSlot}</h3>
            <button
              onClick={() => setPickerSlot(null)}
              className="btn-ghost px-2"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          {pickerItems.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-6">
              No clean {pickerSlot === 'shoes' ? 'shoes' : `${pickerSlot}s`} in your closet. Add
              some in the Closet, or mark a few clean.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
              {pickerItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePickItem(item)}
                  aria-label={describeItem(item)}
                  className="flex flex-col items-center gap-1 p-2 rounded-md border border-[var(--border)] hover:border-[var(--line-strong)] bg-white transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg bg-white overflow-hidden">
                    <ClothingImage
                      src={item.image_url}
                      alt=""
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] truncate w-full text-center">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Delete this saved outfit?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteOutfit}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
