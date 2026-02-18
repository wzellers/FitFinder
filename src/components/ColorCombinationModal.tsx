"use client";

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { colorPalette } from '@/lib/constants';
import { getColorStyle, getColorName, getContrastTextColor } from '@/lib/colorUtils';
import type { ColorCombination } from '@/lib/types';

interface ColorCombinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  combination: ColorCombination | null;
  isLiked: boolean;
  onUpdate: (updatedCombination: ColorCombination) => Promise<boolean> | boolean;
  onDelete: () => Promise<boolean> | boolean;
}

export default function ColorCombinationModal({
  isOpen,
  onClose,
  combination,
  isLiked,
  onUpdate,
  onDelete,
}: ColorCombinationModalProps) {
  const [selectedTopColor, setSelectedTopColor] = useState('');
  const [selectedBottomColor, setSelectedBottomColor] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (combination) {
      setSelectedTopColor(combination.topColor);
      setSelectedBottomColor(combination.bottomColor);
    }
  }, [combination]);

  const handleUpdate = async () => {
    if (!combination || !selectedTopColor || !selectedBottomColor) return;
    setUpdating(true);
    try {
      const ok = await onUpdate({ ...combination, topColor: selectedTopColor, bottomColor: selectedBottomColor });
      if (ok) setTimeout(onClose, 400);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!combination) return;
    if (window.confirm('Delete this color combination?')) {
      const ok = await onDelete();
      if (ok) setTimeout(onClose, 400);
    }
  };

  if (!isOpen || !combination) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Edit Combination</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="btn-danger text-xs py-1 px-2">
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={onClose} className="btn-ghost p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Current preview */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-lg border-2 border-gray-200 overflow-hidden">
            <div className="w-full h-1/2" style={getColorStyle(combination.topColor)} />
            <div className="w-full h-1/2" style={getColorStyle(combination.bottomColor)} />
          </div>
        </div>

        {/* Top color */}
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text)] mb-2 block">Top Color</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedTopColor(color)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedTopColor === color
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]'
                    : 'border-gray-200'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>
          <div
            className="w-full h-10 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-medium"
            style={{
              backgroundColor: getColorStyle(selectedTopColor).backgroundColor,
              color: getContrastTextColor(selectedTopColor),
            }}
          >
            {getColorName(selectedTopColor)}
          </div>
        </div>

        {/* Bottom color */}
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text)] mb-2 block">Bottom Color</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedBottomColor(color)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedBottomColor === color
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]'
                    : 'border-gray-200'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>
          <div
            className="w-full h-10 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-medium"
            style={{
              backgroundColor: getColorStyle(selectedBottomColor).backgroundColor,
              color: getContrastTextColor(selectedBottomColor),
            }}
          >
            {getColorName(selectedBottomColor)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleUpdate}
            disabled={updating || !selectedTopColor || !selectedBottomColor}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Update'}
          </button>
          <button
            onClick={() => {
              setSelectedTopColor(combination.topColor);
              setSelectedBottomColor(combination.bottomColor);
            }}
            className="btn-secondary"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
