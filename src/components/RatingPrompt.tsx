"use client";

import React, { useState, useEffect } from 'react';
import { Minus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import type { PendingRating, ClothingItem } from '@/lib/types';

interface RatingPromptProps {
  pendingRating: PendingRating;
  onSubmit: (wearId: string, rating: number, comfortRating?: number) => void;
  onSkip: () => void;
  onMinimize: () => void;
}

export default function RatingPrompt({ pendingRating, onSubmit, onSkip, onMinimize }: RatingPromptProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [comfortRating, setComfortRating] = useState<number>(5);
  const [showComfort, setShowComfort] = useState(false);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      if (!user) return;
      const itemIds = [
        pendingRating.outfit_items.top_id,
        pendingRating.outfit_items.bottom_id,
        pendingRating.outfit_items.shoes_id,
        pendingRating.outfit_items.outerwear_id,
      ].filter(Boolean) as string[];

      if (itemIds.length === 0) { setLoading(false); return; }

      try {
        const { data } = await supabase.from('clothing_items').select('*').in('id', itemIds);
        setItems(data || []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [user, pendingRating]);

  const getItem = (itemId: string | undefined): ClothingItem | null => {
    if (!itemId) return null;
    return items.find((i) => i.id === itemId) || null;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const handleSubmit = () => {
    onSubmit(pendingRating.wear_id, rating, showComfort ? comfortRating : undefined);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-sm">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">
              Rate Yesterday&apos;s Outfit
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {formatDate(pendingRating.worn_date)}
            </p>
          </div>
          <button onClick={onMinimize} className="btn-ghost text-xs p-1.5">
            <Minus size={14} />
          </button>
        </div>

        {/* Outfit Preview */}
        <div className="flex justify-center gap-2 mb-5 flex-wrap">
          {loading ? (
            <div className="text-sm text-[var(--text-secondary)]">Loading...</div>
          ) : (
            [
              pendingRating.outfit_items.top_id,
              pendingRating.outfit_items.bottom_id,
              pendingRating.outfit_items.shoes_id,
              pendingRating.outfit_items.outerwear_id,
            ].map((id, idx) => {
              const item = getItem(id);
              return item ? (
                <img
                  key={idx}
                  src={item.image_url}
                  alt={item.type}
                  className="w-16 h-16 object-cover rounded-xl border-2 border-[var(--border)]"
                />
              ) : null;
            })
          )}
        </div>

        {/* Overall Rating */}
        <div className="mb-5">
          <label className="text-sm font-medium text-[var(--text)] block mb-2">
            Overall Rating
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="flex-1 h-2 accent-[var(--accent)] cursor-pointer bg-[var(--muted)] rounded-full border-0 p-0 ring-0"
            />
            <span className="text-2xl font-bold text-[var(--accent)] min-w-[40px] text-center">
              {rating}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1">
            <span>Not great</span>
            <span>Amazing</span>
          </div>
        </div>

        {/* Comfort Rating Toggle */}
        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={showComfort}
              onChange={(e) => setShowComfort(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer p-0"
            />
            Add comfort rating (optional)
          </label>

          {showComfort && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={comfortRating}
                  onChange={(e) => setComfortRating(Number(e.target.value))}
                  className="flex-1 h-2 accent-green-600 cursor-pointer bg-[var(--muted)] rounded-full border-0 p-0 ring-0"
                />
                <span className="text-xl font-bold text-green-600 min-w-[40px] text-center">
                  {comfortRating}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1">
                <span>Uncomfortable</span>
                <span>Super comfy</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button onClick={onSkip} className="btn-secondary flex-1">
            Skip
          </button>
          <button onClick={handleSubmit} className="btn-primary flex-[2]">
            Submit Rating
          </button>
        </div>
      </div>
    </div>
  );
}
