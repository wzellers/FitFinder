'use client';

import ModalHeader from '@/components/ui/ModalHeader';
import Modal from '@/components/ui/Modal';
import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Crop, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import ClothingImage from '@/components/ui/ClothingImage';
import Dropdown from '@/components/ui/Dropdown';
import ImageCropper from '@/components/ui/ImageCropper';
import { originalImagePath, replaceItemImage, restoreOriginalImage } from '@/lib/uploadPipeline';
import { useAuth } from '@/hooks/useAuth';
import { ITEM_PHOTO_TRANSITION } from '@/lib/viewTransition';
import { getClothingImageUrl, imagePathFromUrl, removeClothingImages } from '@/lib/clothingImages';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes } from '@/lib/constants';
import { describeItem } from '@/lib/itemLabels';
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
  // The photo shown (it changes after a re-crop) and the cropper's source.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // The photo as it was before its first re-crop, if it has been re-cropped.
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (item) {
      setSelectedType(item.type);
      setSelectedColors(item.colors);
      setIsDirty(item.is_dirty);
      const cat = (Object.keys(clothingTypes) as ClothingSection[]).find((c) =>
        clothingTypes[c].includes(item.type),
      );
      setSelectedCategory(cat || '');
      setImageUrl(item.image_url);
    }
  }, [item]);

  // Is there a kept original (from an earlier re-crop)?
  const findOriginal = useCallback(async () => {
    if (!item || !user) return null;
    const url = await getClothingImageUrl(originalImagePath(user.id, item.id));
    setOriginalUrl(url);
    return url;
  }, [item, user]);
  useEffect(() => {
    setOriginalUrl(null);
    if (isOpen) void findOriginal();
  }, [isOpen, findOriginal]);

  // Re-crop or zoom the photo of an item already in the closet.
  const openCropper = async () => {
    // Crop from the whole original, so an earlier crop can be redone.
    const url = originalUrl ?? (await getClothingImageUrl(imageUrl));
    if (url) setCropSrc(url);
    else showToast("Couldn't load the photo. Try again.", 'error');
  };
  const applyCrop = async (blob: Blob) => {
    if (!item || !user) return;
    setCropSrc(null);
    setUpdating(true);
    try {
      const path = await replaceItemImage({
        userId: user.id,
        itemId: item.id,
        oldImageUrl: imageUrl,
        blob,
      });
      setImageUrl(path);
      void findOriginal();
      showToast('Photo updated.', 'success');
      onItemUpdated?.();
    } catch {
      showToast("Couldn't save the new crop. Try again.", 'error');
    } finally {
      setUpdating(false);
    }
  };
  const restoreOriginal = async () => {
    if (!item || !user) return;
    setUpdating(true);
    try {
      const path = await restoreOriginalImage({
        userId: user.id,
        itemId: item.id,
        currentImageUrl: imageUrl,
      });
      setImageUrl(path);
      showToast('Original photo restored.', 'success');
      onItemUpdated?.();
    } catch {
      showToast("Couldn't restore the original photo. Try again.", 'error');
    } finally {
      setUpdating(false);
    }
  };

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
      await removeClothingImages([
        imagePathFromUrl(imageUrl),
        user ? originalImagePath(user.id, item.id) : null,
      ]);
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
      <Modal label={`Edit ${describeItem(item)}`} onClose={onClose} className="max-w-2xl">
        <ModalHeader title="Edit item" subtitle={describeItem(item)} onClose={onClose} />

        <div className="flex items-center gap-5 mb-6">
          <div className="item-card w-36 shrink-0">
            <div
              className="item-card-photo aspect-square"
              style={{ viewTransitionName: ITEM_PHOTO_TRANSITION }}
            >
              <ClothingImage
                src={imageUrl}
                alt={describeItem(item)}
                className="w-full h-full object-contain p-2"
              />
            </div>
            <button
              onClick={openCropper}
              disabled={updating}
              className="btn-ghost w-full mt-2 text-sm"
            >
              <Crop size={14} aria-hidden="true" /> Adjust / crop
            </button>
            {originalUrl && (
              <button
                onClick={restoreOriginal}
                disabled={updating}
                className="btn-ghost w-full text-sm"
              >
                <RotateCcw size={14} aria-hidden="true" /> Restore original photo
              </button>
            )}
          </div>
          <div className="flex flex-col items-start gap-3">
            <span className={isDirty ? 'badge-dirty' : 'badge-clean'}>
              {isDirty ? 'Dirty' : 'Clean'}
            </span>
            <button onClick={handleToggleDirty} disabled={updating} className="btn-secondary">
              {isDirty ? 'Mark clean' : 'Mark dirty'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Category</span>
            <Dropdown
              label="Category"
              value={selectedCategory}
              onChange={(c) => {
                setSelectedCategory(c);
                setSelectedType('');
              }}
              options={[
                { value: '', label: 'Choose a category' },
                { value: 'Tops', label: 'Tops' },
                { value: 'Bottoms', label: 'Bottoms' },
                { value: 'Shoes', label: 'Shoes' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Type</span>
            <Dropdown
              label="Type"
              value={selectedType}
              onChange={setSelectedType}
              disabled={!selectedCategory}
              options={[
                { value: '', label: 'Choose a type' },
                ...(clothingTypes[selectedCategory as ClothingSection] ?? []).map((t) => ({
                  value: t,
                  label: t,
                })),
              ]}
            />
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
              allowNone
              value={selectedColors[1] ?? null}
              disabledColor={selectedColors[0] ?? null}
              onChange={(color) =>
                setSelectedColors(color ? [selectedColors[0], color] : [selectedColors[0]])
              }
            />
          </div>
        </div>

        <div className="divider pt-5 flex flex-wrap gap-3 items-center">
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
        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc}
            onCancel={() => setCropSrc(null)}
            onCropComplete={applyCrop}
          />
        )}
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
