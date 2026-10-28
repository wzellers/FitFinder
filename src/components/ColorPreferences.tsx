'use client';

import PosterHeader from '@/components/ui/PosterHeader';
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Thermometer,
  RotateCcw,
  Sun,
  Palette,
  Briefcase,
  Mail,
  Shirt,
  Heart,
  X,
} from 'lucide-react';
import SettingsCard from '@/components/ui/SettingsCard';
import Dropdown from '@/components/ui/Dropdown';
import DailyEmailSettings from '@/components/DailyEmailSettings';
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
import { getColorStyle, getColorName } from '@/lib/colorUtils';
import { clearWeatherCache, TEMPERATURE_THRESHOLDS, clothingWeatherRules } from '@/lib/weatherApi';
import type { OccasionRules } from '@/lib/outfitScoring';
import type { ColorCombination, ClothingWeatherRules } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';

export default function ColorPreferences() {
  const { user } = useAuth();
  const [selectedTopColor, setSelectedTopColor] = useState('');
  const [selectedBottomColor, setSelectedBottomColor] = useState('');
  const [likedCombinations, setLikedCombinations] = useState<ColorCombination[]>([]);
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
  const [activeSection, setActiveSection] = useState<'weather' | 'colors' | 'occasions' | 'email'>(
    'weather',
  );
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
  const [editingOccasion, setEditingOccasion] = useState<Occasion>(occasions[0]);

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
      const defaults = clothingWeatherRules[clothingType] || { blockedIn: [] };
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
    const defaults = clothingWeatherRules[clothingType] || { blockedIn: [] };
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

  const sections = [
    { key: 'weather' as const, label: 'Weather', icon: Sun },
    { key: 'occasions' as const, label: 'Occasions', icon: Briefcase },
    { key: 'colors' as const, label: 'Colors', icon: Palette },
    { key: 'email' as const, label: 'Email', icon: Mail },
  ];

  // Temperature ranges, shown as a scale from cold to hot.
  const ranges: { key: TemperatureCategory; label: string; color: string; text: string }[] = [
    { key: 'cold', label: 'Cold', color: '#a9c8e8', text: `under ${thresholds.cold}°` },
    {
      key: 'cool',
      label: 'Cool',
      color: '#bcd9c6',
      text: `${thresholds.cold}–${thresholds.cool}°`,
    },
    {
      key: 'warm',
      label: 'Warm',
      color: '#f2d39b',
      text: `${thresholds.cool}–${thresholds.warm}°`,
    },
    { key: 'hot', label: 'Hot', color: '#eea68a', text: `over ${thresholds.warm}°` },
  ];

  /* ─── Weather Section ─── */
  const weatherContent = (
    <>
      <SettingsCard
        icon={MapPin}
        title="Your location"
        description="Used to pick outfits for today's weather."
      >
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
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className="w-44 min-h-[44px]"
            maxLength={5}
          />
          <button onClick={saveZipCode} disabled={savingZip} className="btn-primary">
            {savingZip ? 'Saving…' : 'Save'}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Thermometer}
        title="Temperature ranges"
        description="Where cold, cool, warm and hot begin, by the day's high."
      >
        <div className="flex h-3 rounded-full overflow-hidden" aria-hidden="true">
          {ranges.map((r) => (
            <span key={r.key} className="flex-1" style={{ backgroundColor: r.color }} />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {ranges.map((r) => (
            <div key={r.key} className="text-center">
              <div className="text-sm font-semibold">{r.label}</div>
              <div className="readout normal-case">{r.text}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-5">
          {(['cold', 'cool', 'warm'] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <label
                htmlFor={`pref-threshold-${key}`}
                className="text-xs font-semibold text-[var(--text-secondary)] capitalize"
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
                className="w-24 min-h-[40px]"
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Shirt}
        title="What to wear in each range"
        description="Add a clothing type, then tap the weather it's fine for. Types you don't add use sensible defaults."
        actions={
          <>
            <button onClick={saveWeatherPrefs} disabled={savingWeather} className="btn-primary">
              {savingWeather ? 'Saving…' : 'Save weather rules'}
            </button>
            <button onClick={resetWeatherDefaults} disabled={savingWeather} className="btn-ghost">
              <RotateCcw size={14} aria-hidden="true" /> Reset to defaults
            </button>
          </>
        }
      >
        {availableTypes.length > 0 && (
          <Dropdown
            label="Add a clothing type"
            value=""
            onChange={(type) => type && addClothingTypeRule(type)}
            options={[
              { value: '', label: 'Add a clothing type…' },
              ...availableTypes.map((t) => ({ value: t, label: t })),
            ]}
          />
        )}

        {customizedTypes.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] mt-4">
            No custom weather rules set. Add a clothing type to choose when it can be worn.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col">
            {customizedTypes.map((type) => {
              const rules = clothingRulesState[type] || { blockedIn: [] };
              return (
                <li
                  key={type}
                  className="divider first:border-t-0 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
                >
                  <span className="text-sm font-semibold w-36 shrink-0">{type}</span>
                  <div
                    className="flex flex-wrap gap-1.5 flex-1"
                    role="group"
                    aria-label={`${type} weather`}
                  >
                    {tempCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleClothingRule(type, cat)}
                        aria-pressed={!rules.blockedIn.includes(cat)}
                        aria-label={`${type} in ${cat} weather`}
                        className="toggle-pill capitalize"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeClothingTypeRule(type)}
                    aria-label={`Stop customizing ${type}`}
                    className="btn-ghost px-2"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
    </>
  );

  /* ─── Colors Section ─── */
  const colorRow = (label: string, selected: string, onSelect: (c: string) => void) => (
    <div className="mb-4">
      <div className="text-sm font-semibold mb-2">{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {colorPalette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            aria-pressed={selected === color}
            aria-label={getColorName(color)}
            title={getColorName(color)}
            className={`w-10 h-10 rounded-full border-2 transition-transform ${
              selected === color
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 scale-105'
                : 'border-black/10 hover:scale-105'
            }`}
            style={{ backgroundColor: getColorStyle(color).backgroundColor }}
          />
        ))}
      </div>
    </div>
  );

  const colorsContent = (
    <>
      <SettingsCard
        icon={Palette}
        title="Add a colour pairing you like"
        description="Outfits with a liked top and bottom colour pairing score higher."
      >
        {colorRow('Top color', selectedTopColor, setSelectedTopColor)}
        {colorRow('Bottom color', selectedBottomColor, setSelectedBottomColor)}
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <div
            className="w-14 h-14 rounded-xl overflow-hidden border border-[var(--border)]"
            aria-hidden="true"
          >
            <div
              className="h-1/2"
              style={{
                backgroundColor: selectedTopColor
                  ? getColorStyle(selectedTopColor).backgroundColor
                  : 'var(--muted)',
              }}
            />
            <div
              className="h-1/2"
              style={{
                backgroundColor: selectedBottomColor
                  ? getColorStyle(selectedBottomColor).backgroundColor
                  : 'var(--muted)',
              }}
            />
          </div>
          <p className="text-sm text-[var(--text-secondary)] flex-1 min-w-[10rem]">
            {selectedTopColor && selectedBottomColor
              ? `${getColorName(selectedTopColor)} top with ${getColorName(selectedBottomColor)} bottom`
              : 'Pick a top and a bottom colour.'}
          </p>
          <button
            onClick={addCombination}
            disabled={!selectedTopColor || !selectedBottomColor || busy}
            className="btn-primary"
          >
            Add to liked
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Heart}
        title="Liked pairings"
        description="Tap one to change or remove it."
      >
        {likedCombinations.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            No liked combinations yet. Add one above.
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
                aria-label={`Edit ${getColorName(combo.topColor)} top with ${getColorName(combo.bottomColor)} bottom`}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-[var(--border)] bg-white hover:border-[var(--accent)] transition-colors"
              >
                <span className="flex -space-x-1.5" aria-hidden="true">
                  <span
                    className="w-6 h-6 rounded-full border-2 border-white"
                    style={getColorStyle(combo.topColor)}
                  />
                  <span
                    className="w-6 h-6 rounded-full border-2 border-white"
                    style={getColorStyle(combo.bottomColor)}
                  />
                </span>
                <span className="text-sm font-medium">
                  {getColorName(combo.topColor)} + {getColorName(combo.bottomColor)}
                </span>
              </button>
            ))}
          </div>
        )}
      </SettingsCard>
    </>
  );

  /* ─── Occasions Section ─── */
  const occasionsContent = (
    <SettingsCard
      icon={Briefcase}
      title="What suits each occasion"
      description="Pick an occasion, then tap the pieces that fit it. The generator only uses these when you choose that occasion."
      actions={
        <>
          <button onClick={saveOccasionPrefs} disabled={savingOccasion} className="btn-primary">
            {savingOccasion ? 'Saving…' : 'Save occasion rules'}
          </button>
          <button onClick={resetOccasionDefaults} disabled={savingOccasion} className="btn-ghost">
            <RotateCcw size={14} aria-hidden="true" /> Reset to defaults
          </button>
        </>
      }
    >
      <div role="group" aria-label="Occasion to edit" className="flex flex-wrap gap-2 mb-5">
        {occasions.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setEditingOccasion(o)}
            aria-pressed={editingOccasion === o}
            className="toggle-pill"
          >
            {o}
          </button>
        ))}
      </div>
      {(['Tops', 'Bottoms', 'Shoes'] as const).map((section) => (
        <div key={section} className="mb-4">
          <div className="panel-label mb-2">{section}</div>
          <div className="flex flex-wrap gap-1.5">
            {allOccasionTypes
              .filter((t) => typeToSection[t] === section)
              .map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleOccasionType(editingOccasion, type)}
                  aria-pressed={isTypeValidForOccasion(editingOccasion, type)}
                  aria-label={`${type} for ${editingOccasion}`}
                  className="toggle-pill"
                >
                  {type}
                </button>
              ))}
          </div>
        </div>
      ))}
    </SettingsCard>
  );

  const sectionContent =
    activeSection === 'weather' ? (
      weatherContent
    ) : activeSection === 'occasions' ? (
      occasionsContent
    ) : activeSection === 'email' ? (
      <DailyEmailSettings />
    ) : (
      colorsContent
    );

  return (
    <div className="w-full max-w-4xl mx-auto">
      <PosterHeader
        title="Settings"
        script="your rules"
        readout="{ weather · occasions · colors · email }"
      />

      {/* Sections across the top, the active one highlighted. */}
      <nav aria-label="Preference sections" className="mb-6 -mx-1 px-1 overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-full border border-[var(--border)] bg-white">
          {sections.map((item) => {
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--muted)]'
                }`}
              >
                <item.icon size={16} aria-hidden="true" className="hidden sm:block" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div key={activeSection} className="page-in flex flex-col gap-5">
        {sectionContent}
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
