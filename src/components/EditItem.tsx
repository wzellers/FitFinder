"use client";

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes, colorPalette } from '@/lib/constants';
import { getColorStyle } from '@/lib/colorUtils';
import type { ClothingItem, ClothingSection } from '@/lib/types';

interface EditItemProps {
  isOpen: boolean;
  onClose: () => void;
  item: ClothingItem | null;
  onItemUpdated?: () => void;
  onItemDeleted?: () => void;
}

export default function EditItem({ isOpen, onClose, item, onItemUpdated, onItemDeleted }: EditItemProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (item) {
      setSelectedType(item.type);
      setSelectedColors(item.colors);
      setIsDirty(item.is_dirty);
      const cat = (Object.keys(clothingTypes) as ClothingSection[]).find((c) =>
        clothingTypes[c].includes(item.type),
      );
      setSelectedCategory(cat || '');
    }
  }, [item]);

  const handleUpdate = async () => {
    if (!item || !selectedType || selectedColors.length === 0) {
      showToast('Please select a type and color', 'warning');
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase.from('clothing_items').update({ type: selectedType, colors: selectedColors }).eq('id', item.id);
      if (error) throw error;
      showToast('Item updated', 'success');
      onItemUpdated?.();
      setTimeout(onClose, 800);
    } catch {
      showToast('Update failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !confirm('Delete this item?')) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from('clothing_items').delete().eq('id', item.id);
      if (error) throw error;
      showToast('Item deleted', 'success');
      onItemDeleted?.();
      setTimeout(onClose, 800);
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleDirty = async () => {
    if (!item) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from('clothing_items').update({ is_dirty: !isDirty }).eq('id', item.id);
      if (error) throw error;
      setIsDirty(!isDirty);
      onItemUpdated?.();
    } catch {
      showToast('Failed to update laundry status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Edit Item</h2>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleToggleDirty}
              disabled={updating}
              className={`text-xs px-2 py-1 rounded font-medium ${isDirty ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {isDirty ? 'Mark Clean' : 'Mark Dirty'}
            </button>
            <button onClick={handleDelete} disabled={updating} className="btn-danger text-xs py-1 px-2">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="btn-ghost p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Current image */}
        <div className="flex justify-center mb-5">
          <div className="w-32 h-32 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
            <img src={item.image_url} alt={item.type} className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Category / type */}
        <div className="flex flex-col items-center gap-3 mb-5">
          <label className="text-sm font-medium text-[var(--text)]">Item Type</label>
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedType(''); }} className="w-48 text-center">
            <option value="">Select category...</option>
            <option value="Tops">Tops</option>
            <option value="Bottoms">Bottoms</option>
            <option value="Outerwear">Outerwear</option>
            <option value="Shoes">Shoes</option>
          </select>
          {selectedCategory && (
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-48 text-center">
              <option value="">Select type...</option>
              {clothingTypes[selectedCategory as ClothingSection]?.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          )}
        </div>

        {/* Color selection */}
        <div className="mb-5">
          <label className="text-sm font-medium text-[var(--text)] block text-center mb-2">Select main color</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 justify-center mx-auto w-fit">
            {colorPalette.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColors([color])}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  selectedColors.includes(color)
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                title={color}
              />
            ))}
          </div>
          {selectedColors.length > 0 && (
            <p className="text-center text-xs text-[var(--text-secondary)] mt-2 capitalize">
              Selected: {selectedColors[0]}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button onClick={handleUpdate} disabled={updating || !selectedType || selectedColors.length === 0} className="btn-primary disabled:opacity-50">
            {updating ? 'Updating...' : 'Update Item'}
          </button>
          <button onClick={() => { if (item) { setSelectedType(item.type); setSelectedColors(item.colors); } }} className="btn-secondary">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
