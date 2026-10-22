'use client';

import Modal from '@/components/ui/Modal';
import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { colorPalette } from '@/lib/constants';
import { getColorStyle, getColorName, getContrastTextColor } from '@/lib/colorUtils';
import type { ColorCombination } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ColorCombinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  combination: ColorCombination | null;
  onUpdate: (updatedCombination: ColorCombination) => Promise<boolean> | boolean;
  onDelete: () => Promise<boolean> | boolean;
}

export default function ColorCombinationModal({
  isOpen,
  onClose,
  combination,
  onUpdate,
  onDelete,
}: ColorCombinationModalProps) {
  const [selectedTopColor, setSelectedTopColor] = useState('');
  const [selectedBottomColor, setSelectedBottomColor] = useState('');
  const [updating, setUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      const ok = await onUpdate({
        ...combination,
        topColor: selectedTopColor,
        bottomColor: selectedBottomColor,
      });
      if (ok) setTimeout(onClose, 400);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    if (!combination) return;
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    const ok = await onDelete();
    if (ok) setTimeout(onClose, 400);
  };

  if (!isOpen || !combination) return null;

  return (
    <>
      <Modal label="Edit color combination" onClose={onClose}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl">Edit color combination</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="btn-danger text-xs py-1 px-2">
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={onClose} className="btn-ghost px-2" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Current preview */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-lg border-2 border-[var(--border)] overflow-hidden">
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
                    : 'border-[var(--border)]'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>
          <div
            className="w-full h-10 rounded-lg border border-[var(--border)] flex items-center justify-center text-sm font-medium"
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
                    : 'border-[var(--border)]'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>
          <div
            className="w-full h-10 rounded-lg border border-[var(--border)] flex items-center justify-center text-sm font-medium"
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
            {updating ? 'Saving…' : 'Save combination'}
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
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Delete this color combination?"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
