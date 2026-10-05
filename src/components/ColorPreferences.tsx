'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Thermometer, RotateCcw, Sun, Palette, Briefcase } from 'lucide-react';
import ColorCombinationModal from '@/components/ColorCombinationModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import {
  colorPalette,
  occasions,
  occasionRules as defaultOccasionRules,
  typeToSection,
} from '@/lib/constants';
import type { Occasion } from '@/lib/constants';
import { getColorStyle, getColorName, getContrastTextColor } from '@/lib/colorUtils';
import { clearWeatherCache, TEMPERATURE_THRESHOLDS, clothingWeatherRules } from '@/lib/weatherApi';
import type { OccasionRules } from '@/lib/outfitScoring';
import type { ColorCombination, ClothingWeatherRules } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';

export default function ColorPreferences() {
  const { user } = useAuth();
  const [selectedTopColor, setSelectedTopColor] = useState('');
  const [selectedBottomColor, setSelectedBottomColor] = useState('');
  const [likedCombinations, setLikedCombinations] = useState<ColorCombination[]>([]);
  const [selectionMode, setSelectionMode] = useState<'top' | 'bottom'>('top');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCombination, setSelectedCombination] = useState<ColorCombination | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  // Zip code
  const [zipCode, setZipCode] = useState('');
  const [savingZip, setSavingZip] = useState(false);

  // Weather preferences
  const [thresholds, setThresholds] = useState({
    cold: TEMPERATURE_THRESHOLDS.COLD,
    cool: TEMPERATURE_THRESHOLDS.COOL,
    warm: TEMPERATURE_THRESHOLDS.WARM,
  });
  const [activeSection, setActiveSection] = useState<'weather' | 'colors' | 'occasions'>('weather');
  const [clothingRulesState, setClothingRulesState] = useState<
    Record<string, ClothingWeatherRules>
  >({});
  const [savingWeather, setSavingWeather] = useState(false);

  // Occasion preferences — valid clothing types per occasion.
  const cloneDefaultOccasionRules = (): OccasionRules =>
    JSON.parse(JSON.stringify(defaultOccasionRules)) as OccasionRules;
  const [occasionRulesState, setOccasionRulesState] =
    useState<OccasionRules>(cloneDefaultOccasionRules);
  const [savingOccasion, setSavingOccasion] = useState(false);

  const tempCategories: TemperatureCategory[] = ['cold', 'cool', 'warm', 'hot'];
  const allClothingTypes = Object.keys(clothingWeatherRules);
  const allOccasionTypes = Object.keys(typeToSection);

  const normalizedKey = (combo: { topColor: string; bottomColor: string }) =>
    `${combo.topColor.toLowerCase()}__${combo.bottomColor.toLowerCase()}`;

  const likedKeys = useMemo(
    () => new Set(likedCombinations.map((c) => normalizedKey(c))),
    [likedCombinations],
  );

  // Load prefs + zip + weather prefs
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const results = await Promise.all([
        supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
        supabase.from('weather_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('occasion_preferences').select('rules').eq('user_id', user.id).maybeSingle(),
      ]);
      // Don't show defaults on a failed load: saving them would overwrite
      // the user's real preferences.
      if (results.some((r) => r.error)) {
        showToast("Couldn't load your preferences. Refresh to try again.", 'error');
        return;
      }
      const [{ data: prefs }, { data: profile }, { data: weatherPrefs }, { data: occasionPrefs }] =
        results;

      if (prefs) {
        const liked = (prefs.liked_combinations ?? []).map(
          (c: { topColor: string; bottomColor: string; id?: string }) => ({
            id: c.id ?? `${c.topColor}-${c.bottomColor}`,
            topColor: c.topColor,
            bottomColor: c.bottomColor,
          }),
        );
        setLikedCombinations(liked);
      }
      if (profile?.zip_code) setZipCode(profile.zip_code);
      if (weatherPrefs) {
        if (weatherPrefs.thresholds) setThresholds(weatherPrefs.thresholds);
        if (weatherPrefs.clothing_rules) {
          setClothingRulesState(
            JSON.parse(JSON.stringify(weatherPrefs.clothing_rules)) as Record<
              string,
              ClothingWeatherRules
            >,
          );
        }
      }
      if (occasionPrefs?.rules) {
        // Merge saved rules over defaults so newly-added occasions/types still appear.
        const saved = occasionPrefs.rules as OccasionRules;
        setOccasionRulesState({ ...cloneDefaultOccasionRules(), ...saved });
      }
    };
    load();
  }, [user, showToast]);

  // Helper to persist color_preferences (liked top/bottom combinations).
  const persistColorPrefs = async (nextLiked: ColorCombination[]) => {
    if (!user) return false;
    const { error } = await supabase.from('color_preferences').upsert(
      {
        user_id: user.id,
        liked_combinations: nextLiked.map((c) => ({
          topColor: c.topColor,
          bottomColor: c.bottomColor,
        })),
        disliked_combinations: [],
      },
      { onConflict: 'user_id' },
    );
    return !error;
  };

  const addCombination = async () => {
    if (!user || !selectedTopColor || !selectedBottomColor) return;
    const newCombo: ColorCombination = {
      id: Date.now().toString(),
      topColor: selectedTopColor,
      bottomColor: selectedBottomColor,
    };

    if (likedKeys.has(normalizedKey(newCombo))) {
      showToast('This combination already exists', 'warning');
      return;
    }

    setBusy(true);
    try {
      const nextLiked = [...likedCombinations, newCombo];
      if (!(await persistColorPrefs(nextLiked))) throw new Error();
      setLikedCombinations(nextLiked);
      showToast('Combination added', 'success');
      setSelectedTopColor('');
      setSelectedBottomColor('');
    } catch {
      showToast("Couldn't save. Try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteCombination = async (id: string) => {
    if (!user) return;
    const nextLiked = likedCombinations.filter((c) => c.id !== id);
    if (!(await persistColorPrefs(nextLiked))) {
      showToast("Couldn't delete. Try again.", 'error');
      return;
    }
    setLikedCombinations(nextLiked);
    showToast('Deleted', 'success');
  };

  const handleUpdateCombination = async (updated: ColorCombination) => {
    if (!user) return false;
    const key = normalizedKey(updated);
    const dup = likedCombinations.some((c) => normalizedKey(c) === key && c.id !== updated.id);
    if (dup) {
      showToast('This combination already exists', 'warning');
      return false;
    }

    const nextLiked = likedCombinations.map((c) => (c.id === updated.id ? updated : c));
    if (!(await persistColorPrefs(nextLiked))) {
      showToast("Couldn't update. Try again.", 'error');
      return false;
    }
    setLikedCombinations(nextLiked);
    showToast('Updated', 'success');
    return true;
  };

  const handleDeleteCombination = async () => {
    if (selectedCombination) {
      await deleteCombination(selectedCombination.id!);
      return true;
    }
    return false;
  };

  const handleColorClick = (color: string) => {
    if (selectionMode === 'top') setSelectedTopColor(color);
    else setSelectedBottomColor(color);
  };

  const saveZipCode = async () => {
    if (!user) return;
    setSavingZip(true);
    const { error } = await supabase
      .from('profiles')
      .update({ zip_code: zipCode || null })
      .eq('id', user.id);
    if (error) showToast("Couldn't save your ZIP code. Try again.", 'error');
    else {
      clearWeatherCache();
      showToast('ZIP code saved.', 'success');
    }
    setSavingZip(false);
  };

  const saveWeatherPrefs = async () => {
    if (!user) return;
    setSavingWeather(true);
    try {
      const { error } = await supabase.from('weather_preferences').upsert(
        {
          user_id: user.id,
          thresholds,
          clothing_rules: Object.keys(clothingRulesState).length > 0 ? clothingRulesState : null,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      showToast('Weather preferences saved', 'success');
    } catch (err) {
      const msg =
        err instanceof Error && err.message?.includes('relation')
          ? 'Weather preferences table not found — run migration 004'
          : "Couldn't save your weather rules. Try again.";
      showToast(msg, 'error');
    } finally {
      setSavingWeather(false);
    }
  };

  const resetWeatherDefaults = async () => {
    setThresholds({
      cold: TEMPERATURE_THRESHOLDS.COLD,
      cool: TEMPERATURE_THRESHOLDS.COOL,
      warm: TEMPERATURE_THRESHOLDS.WARM,
    });
    setClothingRulesState({});
    if (!user) return;
    setSavingWeather(true);
    try {
      const { error } = await supabase.from('weather_preferences').upsert(
        {
          user_id: user.id,
          thresholds: {
            cold: TEMPERATURE_THRESHOLDS.COLD,
            cool: TEMPERATURE_THRESHOLDS.COOL,
            warm: TEMPERATURE_THRESHOLDS.WARM,
          },
          clothing_rules: null,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      showToast('Reset to defaults', 'success');
    } catch {
      showToast("Couldn't reset. Try again.", 'error');
    } finally {
      setSavingWeather(false);
    }
  };

  const toggleClothingRule = (clothingType: string, category: TemperatureCategory) => {
    setClothingRulesState((prev) => {
      const defaults = clothingWeatherRules[clothingType] || { blockedIn: [], suggestedIn: [] };
      const current = prev[clothingType] || { ...defaults };
      const isBlocked = current.blockedIn.includes(category);
      return {
        ...prev,
        [clothingType]: {
          ...current,
          blockedIn: isBlocked
            ? current.blockedIn.filter((c) => c !== category)
            : [...current.blockedIn, category],
        },
      };
    });
  };

  // Check if a clothing type has custom rules set (different from defaults or explicitly added)
  const hasCustomRule = (clothingType: string): boolean => {
    return clothingType in clothingRulesState;
  };

  // Add a clothing type to the custom rules
  const addClothingTypeRule = (clothingType: string) => {
    const defaults = clothingWeatherRules[clothingType] || { blockedIn: [], suggestedIn: [] };
    setClothingRulesState((prev) => ({
      ...prev,
      [clothingType]: { ...defaults },
    }));
  };

  // Remove a clothing type from custom rules (revert to default)
  const removeClothingTypeRule = (clothingType: string) => {
    setClothingRulesState((prev) => {
      const next = { ...prev };
      delete next[clothingType];
      return next;
    });
  };

  const customizedTypes = allClothingTypes.filter((t) => hasCustomRule(t));
  const availableTypes = allClothingTypes.filter((t) => !hasCustomRule(t));

  // ─── Occasion rule helpers ───

  // Is `type` currently valid for `occasion`? Routes to the right sub-array.
  const isTypeValidForOccasion = (occasion: Occasion, type: string): boolean => {
    const rule = occasionRulesState[occasion];
    if (!rule) return false;
    const section = typeToSection[type];
    if (section === 'Tops') return rule.tops.includes(type);
    if (section === 'Bottoms') return rule.bottoms.includes(type);
    return rule.shoes.includes(type);
  };

  // Toggle whether `type` is valid for `occasion`.
  const toggleOccasionType = (occasion: Occasion, type: string) => {
    const section = typeToSection[type];
    const key = section === 'Tops' ? 'tops' : section === 'Bottoms' ? 'bottoms' : 'shoes';
    setOccasionRulesState((prev) => {
      const rule = prev[occasion] ?? { tops: [], bottoms: [], shoes: [] };
      const list = rule[key];
      const next = list.includes(type) ? list.filter((t) => t !== type) : [...list, type];
      return { ...prev, [occasion]: { ...rule, [key]: next } };
    });
  };

  const saveOccasionPrefs = async () => {
    if (!user) return;
    setSavingOccasion(true);
    try {
      const { error } = await supabase.from('occasion_preferences').upsert(
        {
          user_id: user.id,
          rules: occasionRulesState,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      showToast('Occasion preferences saved', 'success');
    } catch (err) {
      const msg =
        err instanceof Error && err.message?.includes('relation')
          ? 'Occasion preferences table not found — run migration 005'
          : "Couldn't save your occasion rules. Try again.";
      showToast(msg, 'error');
    } finally {
      setSavingOccasion(false);
    }
  };

  const resetOccasionDefaults = async () => {
    setOccasionRulesState(cloneDefaultOccasionRules());
    if (!user) return;
    setSavingOccasion(true);
    try {
      const { error } = await supabase.from('occasion_preferences').upsert(
        {
          user_id: user.id,
          rules: null,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      showToast('Reset to defaults', 'success');
    } catch {
      showToast("Couldn't reset. Try again.", 'error');
    } finally {
      setSavingOccasion(false);
    }
  };

  const sidebarItems = [
    { key: 'weather' as const, label: 'Weather', icon: Sun },
    { key: 'occasions' as const, label: 'Occasions', icon: Briefcase },
    { key: 'colors' as const, label: 'Colors', icon: Palette },
  ];

  /* ─── Weather Section ─── */
  const weatherContent = (
    <>
      {/* Zip code */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-[var(--accent)]" aria-hidden="true" /> Weather location
        </h3>
        <label htmlFor="pref-zip" className="text-sm font-semibold block mb-1.5">
          US ZIP code
        </label>
        <div className="flex items-center gap-2">
          <input
            id="pref-zip"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="e.g. 10001"
            aria-describedby="pref-zip-hint"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className="w-44 min-h-[44px]"
            maxLength={5}
          />
          <button onClick={saveZipCode} disabled={savingZip} className="btn-primary">
            {savingZip ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p id="pref-zip-hint" className="text-xs text-[var(--text-secondary)] mt-2">
          Used to pick outfits for today&apos;s weather.
        </p>
      </div>

      {/* Temperature thresholds */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
          <Thermometer size={16} className="text-[var(--accent)]" aria-hidden="true" /> Temperature
          ranges
        </h3>
        <div className="flex flex-wrap gap-4 mb-3">
          {(['cold', 'cool', 'warm'] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <label
                htmlFor={`pref-threshold-${key}`}
                className="text-xs font-medium text-[var(--text-secondary)] capitalize"
              >
                {key} below (&deg;F)
              </label>
              <input
                id={`pref-threshold-${key}`}
                type="number"
                value={thresholds[key]}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="w-20 text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Cold: &lt;{thresholds.cold}&deg;F &middot; Cool: {thresholds.cold}&ndash;{thresholds.cool}
          &deg;F &middot; Warm: {thresholds.cool}&ndash;{thresholds.warm}&deg;F &middot; Hot: &gt;
          {thresholds.warm}&deg;F
        </p>
      </div>

      {/* Clothing Weather Rules */}
      <div className="card p-5 mb-6">
        <h4 className="text-sm font-semibold text-[var(--text)] mb-2">
          What to wear in each range
        </h4>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Add clothing types you want to customize weather rules for. Types not listed here will use
          sensible defaults.
        </p>

        {/* Add clothing type */}
        {availableTypes.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <select
              aria-label="Add a clothing type"
              onChange={(e) => {
                if (e.target.value) {
                  addClothingTypeRule(e.target.value);
                  e.target.value = '';
                }
              }}
              className="text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Add a clothing type…
              </option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}

        {customizedTypes.length > 0 && (
          <>
            <p className="text-xs text-[var(--text-secondary)] mb-3 flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded bg-[#e6f2ec] text-[var(--success)] text-center leading-4 text-[10px] font-bold">
                &#10003;
              </span>
              = allowed in that weather &nbsp;&middot;&nbsp;
              <span className="inline-block w-4 h-4 rounded bg-[#fbeceb] text-[var(--danger)] text-center leading-4 text-[10px] font-bold">
                &#10005;
              </span>
              = blocked
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1.5 pr-4 font-medium text-[var(--text-secondary)]">
                      Type
                    </th>
                    {tempCategories.map((cat) => (
                      <th
                        key={cat}
                        className="text-center py-1.5 px-2 font-medium text-[var(--text-secondary)] capitalize"
                      >
                        {cat}
                      </th>
                    ))}
                    <th className="text-center py-1.5 px-2 font-medium text-[var(--text-secondary)]"></th>
                  </tr>
                </thead>
                <tbody>
                  {customizedTypes.map((type) => {
                    const rules = clothingRulesState[type] || { blockedIn: [], suggestedIn: [] };
                    return (
                      <tr key={type} className="border-t border-[var(--border)]">
                        <td className="py-1.5 pr-4 text-[var(--text)]">{type}</td>
                        {tempCategories.map((cat) => {
                          const allowed = !rules.blockedIn.includes(cat);
                          return (
                            <td key={cat} className="text-center py-1.5 px-2">
                              <button
                                type="button"
                                onClick={() => toggleClothingRule(type, cat)}
                                className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                                  allowed
                                    ? 'bg-[#e6f2ec] text-[var(--success)] hover:bg-[#d3e8dd]'
                                    : 'bg-[#fbeceb] text-[var(--danger)] hover:bg-[#f5d6d4]'
                                }`}
                              >
                                {allowed ? '\u2713' : '\u2715'}
                              </button>
                            </td>
                          );
                        })}
                        <td className="text-center py-1.5 px-2">
                          <button
                            type="button"
                            onClick={() => removeClothingTypeRule(type)}
                            className="text-xs text-[var(--danger)] hover:text-[var(--danger)] transition-colors"
                            title="Remove custom rule"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {customizedTypes.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] italic">
            No custom weather rules set. Add clothing types above to customize when they can be
            worn.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={saveWeatherPrefs}
            disabled={savingWeather}
            className="btn-primary text-xs"
          >
            {savingWeather ? 'Saving…' : 'Save weather rules'}
          </button>
          <button
            onClick={resetWeatherDefaults}
            disabled={savingWeather}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <RotateCcw size={12} /> Reset to Defaults
          </button>
        </div>
      </div>
    </>
  );

  /* ─── Colors Section ─── */
  const colorsContent = (
    <>
      {/* Color selection — Top+Bottom */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Add Color Combination</h3>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex md:flex-col gap-2">
            <button
              onClick={() => setSelectionMode('top')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectionMode === 'top'
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              Top Color
            </button>
            <button
              onClick={() => setSelectionMode('bottom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectionMode === 'bottom'
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              Bottom Color
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                onClick={() => handleColorClick(color)}
                className={`w-14 h-14 rounded-lg border-2 transition-all ${
                  selectedTopColor === color || selectedBottomColor === color
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105'
                    : 'border-[var(--line-strong)] hover:border-[var(--text-secondary)] shadow-sm'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>

          <div className="flex md:flex-col gap-3 items-center">
            <div
              className="w-20 h-14 rounded-lg border-2 border-[var(--line-strong)] flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: selectedTopColor
                  ? getColorStyle(selectedTopColor).backgroundColor
                  : '#fff',
                color: selectedTopColor
                  ? getContrastTextColor(selectedTopColor)
                  : 'var(--text-secondary)',
              }}
            >
              {selectedTopColor ? getColorName(selectedTopColor) : 'Top'}
            </div>
            <div
              className="w-20 h-14 rounded-lg border-2 border-[var(--line-strong)] flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: selectedBottomColor
                  ? getColorStyle(selectedBottomColor).backgroundColor
                  : '#fff',
                color: selectedBottomColor
                  ? getContrastTextColor(selectedBottomColor)
                  : 'var(--text-secondary)',
              }}
            >
              {selectedBottomColor ? getColorName(selectedBottomColor) : 'Bottom'}
            </div>
          </div>
        </div>

        {(selectedTopColor || selectedBottomColor) && (
          <div className="flex justify-center mt-4">
            <button
              onClick={addCombination}
              disabled={!selectedTopColor || !selectedBottomColor || busy}
              className="btn-primary disabled:opacity-50"
            >
              Add to Liked
            </button>
          </div>
        )}
      </div>

      {/* Liked Combinations */}
      <section className="mb-6">
        <h2 className="section-header">Liked Combinations</h2>
        {likedCombinations.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] italic">
            No liked combinations yet — add some above!
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {likedCombinations.map((combo) => (
              <button
                key={combo.id}
                onClick={() => {
                  setSelectedCombination(combo);
                  setShowEditModal(true);
                }}
                className="w-14 h-14 rounded-lg border-2 border-[var(--line-strong)] overflow-hidden hover:border-[var(--accent)] hover:scale-105 transition-all"
              >
                <div className="w-full h-1/2" style={getColorStyle(combo.topColor)} />
                <div className="w-full h-1/2" style={getColorStyle(combo.bottomColor)} />
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );

  /* ─── Occasions Section ─── */
  const occasionsContent = (
    <div className="card p-5 mb-6">
      <h3 className="text-sm font-semibold text-[var(--text)] mb-2 flex items-center gap-2">
        <Briefcase size={16} className="text-[var(--accent)]" /> Valid Items per Occasion
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-3">
        Choose which clothing types are allowed for each occasion. When you pick an occasion in the
        Generator, only its allowed types are used.
      </p>
      <p className="text-xs text-[var(--text-secondary)] mb-4 flex items-center gap-1">
        <span className="inline-block w-4 h-4 rounded bg-[#e6f2ec] text-[var(--success)] text-center leading-4 text-[10px] font-bold">
          &#10003;
        </span>
        = allowed &nbsp;&middot;&nbsp;
        <span className="inline-block w-4 h-4 rounded bg-[var(--muted)] text-[var(--text-secondary)] text-center leading-4 text-[10px] font-bold">
          &#10005;
        </span>
        = not allowed
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-1.5 pr-4 font-medium text-[var(--text-secondary)]">
                Type
              </th>
              {occasions.map((o) => (
                <th
                  key={o}
                  className="text-center py-1.5 px-2 font-medium text-[var(--text-secondary)]"
                >
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allOccasionTypes.map((type) => (
              <tr key={type} className="border-t border-[var(--border)]">
                <td className="py-1.5 pr-4 text-[var(--text)] whitespace-nowrap">{type}</td>
                {occasions.map((o) => {
                  const valid = isTypeValidForOccasion(o, type);
                  return (
                    <td key={o} className="text-center py-1.5 px-2">
                      <button
                        type="button"
                        onClick={() => toggleOccasionType(o, type)}
                        className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                          valid
                            ? 'bg-[#e6f2ec] text-[var(--success)] hover:bg-[#d3e8dd]'
                            : 'bg-[var(--muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                        }`}
                      >
                        {valid ? '\u2713' : '\u2715'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={saveOccasionPrefs}
          disabled={savingOccasion}
          className="btn-primary text-xs"
        >
          {savingOccasion ? 'Saving…' : 'Save occasion rules'}
        </button>
        <button
          onClick={resetOccasionDefaults}
          disabled={savingOccasion}
          className="btn-secondary text-xs flex items-center gap-1"
        >
          <RotateCcw size={12} /> Reset to Defaults
        </button>
      </div>
    </div>
  );

  const sectionContent =
    activeSection === 'weather'
      ? weatherContent
      : activeSection === 'occasions'
        ? occasionsContent
        : colorsContent;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Mobile tabs */}
      <h2 className="text-3xl mb-5">Preferences</h2>
      <div className="flex md:hidden gap-1 mb-4" role="group" aria-label="Preference section">
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            aria-pressed={activeSection === item.key}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 min-h-[44px] rounded-md text-sm font-semibold transition-colors ${
              activeSection === item.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] text-[var(--text-secondary)] border border-[var(--border)]'
            }`}
          >
            <item.icon size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop sidebar + content */}
      <div className="flex gap-0">
        {/* Sidebar — desktop only */}
        <nav
          aria-label="Preference sections"
          className="hidden md:flex flex-col w-44 shrink-0 border-r border-[var(--border)] pr-4 mr-6 gap-1"
        >
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              aria-current={activeSection === item.key ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeSection === item.key
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--card)] hover:text-[var(--text)]'
              }`}
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0">{sectionContent}</div>
      </div>

      <ColorCombinationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        combination={selectedCombination}
        onUpdate={handleUpdateCombination}
        onDelete={handleDeleteCombination}
      />
    </div>
  );
}
