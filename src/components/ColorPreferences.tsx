"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Thermometer, RotateCcw, Sun, Palette } from 'lucide-react';
import ColorCombinationModal from '@/components/ColorCombinationModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { colorPalette } from '@/lib/constants';
import { getColorStyle, getColorName, getContrastTextColor } from '@/lib/colorUtils';
import { clearWeatherCache, TEMPERATURE_THRESHOLDS, clothingWeatherRules } from '@/lib/weatherApi';
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
  const [thresholds, setThresholds] = useState({ cold: TEMPERATURE_THRESHOLDS.COLD, cool: TEMPERATURE_THRESHOLDS.COOL, warm: TEMPERATURE_THRESHOLDS.WARM });
  const [activeSection, setActiveSection] = useState<'weather' | 'colors'>('weather');
  const [clothingRulesState, setClothingRulesState] = useState<Record<string, ClothingWeatherRules>>({});
  const [savingWeather, setSavingWeather] = useState(false);

  const tempCategories: TemperatureCategory[] = ['cold', 'cool', 'warm', 'hot'];
  const allClothingTypes = Object.keys(clothingWeatherRules);

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
      const [{ data: prefs }, { data: profile }, { data: weatherPrefs }] = await Promise.all([
        supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
        supabase.from('weather_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (prefs) {
        const liked = (prefs.liked_combinations ?? []).map((c: { topColor: string; bottomColor: string; id?: string }) => ({
          id: c.id ?? `${c.topColor}-${c.bottomColor}`,
          topColor: c.topColor,
          bottomColor: c.bottomColor,
        }));
        setLikedCombinations(liked);
      }
      if (profile?.zip_code) setZipCode(profile.zip_code);
      if (weatherPrefs) {
        if (weatherPrefs.thresholds) setThresholds(weatherPrefs.thresholds);
        if (weatherPrefs.clothing_rules) {
          setClothingRulesState(JSON.parse(JSON.stringify(weatherPrefs.clothing_rules)) as Record<string, ClothingWeatherRules>);
        }
      }
    };
    load();
  }, [user]);

  // Helper to persist color_preferences (liked combos only)
  const persistColorPrefs = async (nextLiked: ColorCombination[]) => {
    if (!user) return false;
    const { error } = await supabase.from('color_preferences').upsert(
      {
        user_id: user.id,
        liked_combinations: nextLiked.map((c) => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
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
      showToast('Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteCombination = async (id: string) => {
    if (!user) return;
    const nextLiked = likedCombinations.filter((c) => c.id !== id);
    if (!(await persistColorPrefs(nextLiked))) {
      showToast('Failed to delete', 'error');
      return;
    }
    setLikedCombinations(nextLiked);
    showToast('Deleted', 'success');
  };

  const handleUpdateCombination = async (updated: ColorCombination) => {
    if (!user) return false;
    const key = normalizedKey(updated);
    const dup = likedCombinations.some((c) => normalizedKey(c) === key && c.id !== updated.id);
    if (dup) { showToast('This combination already exists', 'warning'); return false; }

    const nextLiked = likedCombinations.map((c) => (c.id === updated.id ? updated : c));
    if (!(await persistColorPrefs(nextLiked))) { showToast('Failed to update', 'error'); return false; }
    setLikedCombinations(nextLiked);
    showToast('Updated', 'success');
    return true;
  };

  const handleDeleteCombination = async () => {
    if (selectedCombination) { await deleteCombination(selectedCombination.id!); return true; }
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
    if (error) showToast('Failed to save zip code', 'error');
    else {
      clearWeatherCache();
      showToast('Zip code saved', 'success');
    }
    setSavingZip(false);
  };

  const saveWeatherPrefs = async () => {
    if (!user) return;
    setSavingWeather(true);
    try {
      const { error } = await supabase.from('weather_preferences').upsert({
        user_id: user.id,
        thresholds,
        clothing_rules: Object.keys(clothingRulesState).length > 0 ? clothingRulesState : null,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      showToast('Weather preferences saved', 'success');
    } catch (err) {
      const msg = err instanceof Error && err.message?.includes('relation')
        ? 'Weather preferences table not found — run migration 004'
        : 'Failed to save weather preferences';
      showToast(msg, 'error');
    } finally {
      setSavingWeather(false);
    }
  };

  const resetWeatherDefaults = async () => {
    setThresholds({ cold: TEMPERATURE_THRESHOLDS.COLD, cool: TEMPERATURE_THRESHOLDS.COOL, warm: TEMPERATURE_THRESHOLDS.WARM });
    setClothingRulesState({});
    if (!user) return;
    setSavingWeather(true);
    try {
      const { error } = await supabase.from('weather_preferences').upsert({
        user_id: user.id,
        thresholds: { cold: TEMPERATURE_THRESHOLDS.COLD, cool: TEMPERATURE_THRESHOLDS.COOL, warm: TEMPERATURE_THRESHOLDS.WARM },
        clothing_rules: null,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      showToast('Reset to defaults', 'success');
    } catch {
      showToast('Failed to reset', 'error');
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

  const sidebarItems = [
    { key: 'weather' as const, label: 'Weather', icon: Sun },
    { key: 'colors' as const, label: 'Colors', icon: Palette },
  ];

  /* ─── Weather Section ─── */
  const weatherContent = (
    <>
      {/* Zip code */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-[var(--accent)]" /> Weather Location
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Enter zip code (e.g. 10001)"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className="w-44"
            maxLength={5}
          />
          <button onClick={saveZipCode} disabled={savingZip} className="btn-primary text-xs">
            {savingZip ? 'Saving...' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          Used for weather-aware outfit suggestions in the Generator tab.
        </p>
      </div>

      {/* Temperature thresholds */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
          <Thermometer size={16} className="text-[var(--accent)]" /> Temperature Thresholds
        </h3>
        <div className="flex flex-wrap gap-4 mb-3">
          {(['cold', 'cool', 'warm'] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--text-secondary)] capitalize">{key} below (&deg;F)</label>
              <input
                type="number"
                value={thresholds[key]}
                onChange={(e) => setThresholds((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-20 text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Cold: &lt;{thresholds.cold}&deg;F &middot; Cool: {thresholds.cold}&ndash;{thresholds.cool}&deg;F &middot; Warm: {thresholds.cool}&ndash;{thresholds.warm}&deg;F &middot; Hot: &gt;{thresholds.warm}&deg;F
        </p>
      </div>

      {/* Clothing Weather Rules */}
      <div className="card p-5 mb-6">
        <h4 className="text-sm font-semibold text-[var(--text)] mb-2">Clothing Rules per Temperature</h4>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Add clothing types you want to customize weather rules for. Types not listed here will use sensible defaults.
        </p>

        {/* Add clothing type */}
        {availableTypes.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <select
              onChange={(e) => { if (e.target.value) { addClothingTypeRule(e.target.value); e.target.value = ''; } }}
              className="text-sm"
              defaultValue=""
            >
              <option value="" disabled>Add clothing type...</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}

        {customizedTypes.length > 0 && (
          <>
            <p className="text-xs text-[var(--text-secondary)] mb-3 flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded bg-emerald-100 text-emerald-600 text-center leading-4 text-[10px] font-bold">&#10003;</span>
              = allowed in that weather &nbsp;&middot;&nbsp;
              <span className="inline-block w-4 h-4 rounded bg-red-100 text-red-500 text-center leading-4 text-[10px] font-bold">&#10005;</span>
              = blocked
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1.5 pr-4 font-medium text-[var(--text-secondary)]">Type</th>
                    {tempCategories.map((cat) => (
                      <th key={cat} className="text-center py-1.5 px-2 font-medium text-[var(--text-secondary)] capitalize">{cat}</th>
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
                                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                    : 'bg-red-100 text-red-500 hover:bg-red-200'
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
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
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
            No custom weather rules set. Add clothing types above to customize when they can be worn.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={saveWeatherPrefs} disabled={savingWeather} className="btn-primary text-xs">
            {savingWeather ? 'Saving...' : 'Save Weather Rules'}
          </button>
          <button onClick={resetWeatherDefaults} disabled={savingWeather} className="btn-secondary text-xs flex items-center gap-1">
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
                    : 'border-gray-300 hover:border-gray-400 shadow-sm'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>

          <div className="flex md:flex-col gap-3 items-center">
            <div
              className="w-20 h-14 rounded-lg border-2 border-gray-300 flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: selectedTopColor ? getColorStyle(selectedTopColor).backgroundColor : '#fff',
                color: selectedTopColor ? getContrastTextColor(selectedTopColor) : 'var(--text-secondary)',
              }}
            >
              {selectedTopColor ? getColorName(selectedTopColor) : 'Top'}
            </div>
            <div
              className="w-20 h-14 rounded-lg border-2 border-gray-300 flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: selectedBottomColor ? getColorStyle(selectedBottomColor).backgroundColor : '#fff',
                color: selectedBottomColor ? getContrastTextColor(selectedBottomColor) : 'var(--text-secondary)',
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
          <p className="text-sm text-[var(--text-secondary)] italic">No liked combinations yet — add some above!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {likedCombinations.map((combo) => (
              <button
                key={combo.id}
                onClick={() => { setSelectedCombination(combo); setShowEditModal(true); }}
                className="w-14 h-14 rounded-lg border-2 border-gray-300 overflow-hidden hover:border-[var(--accent)] hover:scale-105 transition-all"
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

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Mobile tabs */}
      <div className="flex md:hidden gap-1 mb-4">
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeSection === item.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] text-[var(--text-secondary)] border border-[var(--border)]'
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Desktop sidebar + content */}
      <div className="flex gap-0">
        {/* Sidebar — desktop only */}
        <nav className="hidden md:flex flex-col w-44 shrink-0 border-r border-[var(--border)] pr-4 mr-6 gap-1">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeSection === item.key
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--card)] hover:text-[var(--text)]'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          {activeSection === 'weather' ? weatherContent : colorsContent}
        </div>
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
