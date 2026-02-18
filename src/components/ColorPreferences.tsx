"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import ColorCombinationModal from '@/components/ColorCombinationModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { colorPalette } from '@/lib/constants';
import { getColorStyle, getColorName, getContrastTextColor } from '@/lib/colorUtils';
import { clearWeatherCache } from '@/lib/weatherApi';
import type { ColorCombination } from '@/lib/types';

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

  const normalizedKey = (combo: { topColor: string; bottomColor: string }) =>
    `${combo.topColor.toLowerCase()}__${combo.bottomColor.toLowerCase()}`;

  const likedKeys = useMemo(
    () => new Set(likedCombinations.map((c) => normalizedKey(c))),
    [likedCombinations],
  );

  // Load prefs + zip
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: prefs }, { data: profile }] = await Promise.all([
        supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
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
    };
    load();
  }, [user]);

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
      const { error } = await supabase.from('color_preferences').upsert(
        {
          user_id: user.id,
          liked_combinations: nextLiked.map((c) => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
          disliked_combinations: [],
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
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
    const { error } = await supabase.from('color_preferences').upsert(
      {
        user_id: user.id,
        liked_combinations: nextLiked.map((c) => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
        disliked_combinations: [],
      },
      { onConflict: 'user_id' },
    );
    if (error) {
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
    const { error } = await supabase.from('color_preferences').upsert(
      {
        user_id: user.id,
        liked_combinations: nextLiked.map((c) => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
        disliked_combinations: [],
      },
      { onConflict: 'user_id' },
    );
    if (error) { showToast('Failed to update', 'error'); return false; }
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

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Zip code section */}
      <div className="card p-5 mb-8">
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

      {/* Color selection */}
      <div className="card p-5 mb-8">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Add Color Combination</h3>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Mode toggle */}
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

          {/* Palette grid */}
          <div className="grid grid-cols-4 gap-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                onClick={() => handleColorClick(color)}
                className={`w-14 h-14 rounded-lg border-2 transition-all ${
                  selectedTopColor === color || selectedBottomColor === color
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>

          {/* Preview */}
          <div className="flex md:flex-col gap-3 items-center">
            <div
              className="w-20 h-14 rounded-lg border-2 border-gray-200 flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: selectedTopColor ? getColorStyle(selectedTopColor).backgroundColor : '#fff',
                color: selectedTopColor ? getContrastTextColor(selectedTopColor) : 'var(--text-secondary)',
              }}
            >
              {selectedTopColor ? getColorName(selectedTopColor) : 'Top'}
            </div>
            <div
              className="w-20 h-14 rounded-lg border-2 border-gray-200 flex items-center justify-center text-xs font-medium"
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
      <section className="mb-8">
        <h2 className="section-header">Liked Combinations</h2>
        {likedCombinations.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] italic">No liked combinations yet — add some above!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {likedCombinations.map((combo) => (
              <button
                key={combo.id}
                onClick={() => { setSelectedCombination(combo); setShowEditModal(true); }}
                className="w-14 h-14 rounded-lg border-2 border-gray-200 overflow-hidden hover:border-[var(--accent)] hover:scale-105 transition-all"
              >
                <div className="w-full h-1/2" style={getColorStyle(combo.topColor)} />
                <div className="w-full h-1/2" style={getColorStyle(combo.bottomColor)} />
              </button>
            ))}
          </div>
        )}
      </section>

      <ColorCombinationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        combination={selectedCombination}
        isLiked={true}
        onUpdate={handleUpdateCombination}
        onDelete={handleDeleteCombination}
      />
    </div>
  );
}
