'use client';

import Modal from '@/components/ui/Modal';
import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import ClothingImage from '@/components/ui/ClothingImage';
import { imagePathFromUrl, removeClothingImages } from '@/lib/clothingImages';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes } from '@/lib/constants';
import { describeItem, ticketNumber } from '@/lib/itemLabels';
import ColorSwatchGroup from '@/components/ui/ColorSwatchGroup';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { ClothingItem, ClothingSection } from '@/lib/types';

interface EditItemProps {
  isOpen: boolean;
  onClose: () => void;
  item: ClothingItem | null;
  onItemUpdated?: () => void;
  onItemDeleted?: () => void;
}

export default function EditItem({
  isOpen,
  onClose,
  item,
  onItemUpdated,
  onItemDeleted,
}: EditItemProps) {
  const { showToast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      showToast('Choose a type and a color first.', 'warning');
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update({ type: selectedType, colors: selectedColors })
        .eq('id', item.id);
      if (error) throw error;
      showToast('Changes saved.', 'success');
      onItemUpdated?.();
      setTimeout(onClose, 800);
    } catch {
      showToast("Couldn't save your changes. Try again.", 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setConfirmOpen(false);
    setUpdating(true);
    try {
      const { error } = await supabase.from('clothing_items').delete().eq('id', item.id);
      if (error) throw error;
      await removeClothingImages([imagePathFromUrl(item.image_url)]);
      showToast('Item deleted.', 'success');
      onItemDeleted?.();
      setTimeout(onClose, 800);
    } catch {
      showToast("Couldn't delete this item. Try again.", 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleDirty = async () => {
    if (!item) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update({ is_dirty: !isDirty })
        .eq('id', item.id);
      if (error) throw error;
      setIsDirty(!isDirty);
      onItemUpdated?.();
    } catch {
      showToast("Couldn't update laundry status. Try again.", 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <>
      <Modal label={`Edit ${describeItem(item)}`} onClose={onClose} className="max-w-xl">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl">Edit item</h2>
            <p className="tabular text-sm text-[var(--text-secondary)]">
              Tag No. {ticketNumber(item.id)}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-5 mb-6">
          <div className="hang-tag w-36 shrink-0">
            <div className="hang-tag-photo aspect-square">
              <ClothingImage
                src={item.image_url}
                alt={describeItem(item)}
                className="w-full h-full object-contain p-2"
              />
            </div>
          </div>
          <div className="flex flex-col items-start gap-3">
            <span className={isDirty ? 'stamp-dirty text-sm' : 'stamp-clean text-sm'}>
              {isDirty ? 'Dirty' : 'Clean'}
            </span>
            <button onClick={handleToggleDirty} disabled={updating} className="btn-secondary">
              {isDirty ? 'Mark clean' : 'Mark dirty'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-item-category" className="text-sm font-semibold">
              Category
            </label>
            <select
              id="edit-item-category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedType('');
              }}
              className="min-h-[44px]"
            >
              <option value="">Choose a category</option>
              <option value="Tops">Tops</option>
              <option value="Bottoms">Bottoms</option>
              <option value="Shoes">Shoes</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-item-type" className="text-sm font-semibold">
              Type
            </label>
            <select
              id="edit-item-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              disabled={!selectedCategory}
              className="min-h-[44px]"
            >
              <option value="">Choose a type</option>
              {clothingTypes[selectedCategory as ClothingSection]?.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <ColorSwatchGroup
            legend="Main color"
            value={selectedColors[0] ?? null}
            onChange={(color) => {
              if (!color) return;
              // Keep the second colour unless it now matches the main one.
              const second = selectedColors[1];
              setSelectedColors(second && second !== color ? [color, second] : [color]);
            }}
          />
          <div className="mt-4">
            <ColorSwatchGroup
              legend={
                <>
                  Second color{' '}
                  <span className="font-normal text-[var(--text-secondary)]">(optional)</span>
                </>
              }
              size="sm"
              allowNone
              value={selectedColors[1] ?? null}
              disabledColor={selectedColors[0] ?? null}
              onChange={(color) =>
                setSelectedColors(color ? [selectedColors[0], color] : [selectedColors[0]])
              }
            />
          </div>
        </div>

        <div className="ticket-rule pt-5 flex flex-wrap gap-3 items-center">
          <button
            onClick={handleUpdate}
            disabled={updating || !selectedType || selectedColors.length === 0}
            className="btn-primary"
          >
            {updating ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => {
              if (item) {
                setSelectedType(item.type);
                setSelectedColors(item.colors);
              }
            }}
            className="btn-secondary"
          >
            Undo changes
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={updating}
            className="btn-ghost text-[var(--danger)] hover:text-[var(--danger)] ml-auto"
          >
            <Trash2 size={16} aria-hidden="true" /> Delete item
          </button>
        </div>
      </Modal>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        message={`Delete this ${item.type.toLowerCase()}? It will also disappear from saved outfits. This can't be undone.`}
        confirmLabel="Delete item"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
