'use client';

import ModalHeader from '@/components/ui/ModalHeader';
import Modal from '@/components/ui/Modal';
import React, { useState, useEffect } from 'react';
import { Minus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ClothingImage from '@/components/ui/ClothingImage';
import { describeItem } from '@/lib/itemLabels';
import { supabase } from '@/lib/supabaseClient';
import type { PendingRating, ClothingItem } from '@/lib/types';

interface RatingPromptProps {
  pendingRating: PendingRating;
  onSubmit: (wearId: string, rating: number) => void;
  onSkip: () => void;
  onMinimize: () => void;
}

export default function RatingPrompt({
  pendingRating,
  onSubmit,
  onSkip,
  onMinimize,
}: RatingPromptProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      if (!user) return;
      const itemIds = [
        pendingRating.outfit_items.top_id,
        pendingRating.outfit_items.bottom_id,
        pendingRating.outfit_items.shoes_id,
      ].filter(Boolean) as string[];

      if (itemIds.length === 0) {
        setLoading(false);
        return;
      }

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
    onSubmit(pendingRating.wear_id, rating);
  };

  return (
    <Modal label="Rate yesterday's outfit" onClose={onMinimize} className="max-w-sm">
      {/* Header */}
      <ModalHeader
        title="How was yesterday's outfit?"
        subtitle={formatDate(pendingRating.worn_date)}
        onClose={onMinimize}
        closeLabel="Remind me later"
        closeIcon={<Minus size={16} aria-hidden="true" />}
      />

      {/* Outfit Preview */}
      <div className="flex justify-center gap-2 mb-5 flex-wrap">
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)]">Loading...</div>
        ) : (
          [
            pendingRating.outfit_items.top_id,
            pendingRating.outfit_items.bottom_id,
            pendingRating.outfit_items.shoes_id,
          ].map((id, idx) => {
            const item = getItem(id);
            return item ? (
              <ClothingImage
                key={idx}
                src={item.image_url}
                alt={describeItem(item)}
                className="w-16 h-16 object-contain bg-white rounded-md border border-[var(--border)]"
              />
            ) : null;
          })
        )}
      </div>

      {/* Overall Rating */}
      <div className="mb-5">
        <label htmlFor="rating-slider" className="text-sm font-semibold block mb-2">
          How did it feel?
        </label>
        <div className="flex items-center gap-3">
          <input
            id="rating-slider"
            aria-valuetext={`${rating} out of 10`}
            type="range"
            min="1"
            max="10"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="flex-1 h-2 accent-[var(--accent)] cursor-pointer bg-[var(--muted)] rounded-full border-0 p-0 ring-0"
          />
          <span
            className="tabular font-semibold text-2xl font-bold min-w-[40px] text-center"
            aria-hidden="true"
          >
            {rating}
          </span>
        </div>
        <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
          <span>Not great</span>
          <span>Amazing</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button onClick={onSkip} className="btn-secondary flex-1">
          Skip
        </button>
        <button onClick={handleSubmit} className="btn-primary flex-[2]">
          Save rating
        </button>
      </div>
    </Modal>
  );
}
