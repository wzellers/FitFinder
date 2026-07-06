"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Eraser, Check, AlertCircle, Crop, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes, colorPalette } from '@/lib/constants';
import { getColorStyle } from '@/lib/colorUtils';
import {
  detectItem,
  removeImageBackground,
  uploadItem,
  runWithConcurrency,
} from '@/lib/uploadPipeline';
import ImageCropper from '@/components/ui/ImageCropper';
import type { ClothingSection } from '@/lib/types';

interface ImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onItemUploaded?: () => void;
}

type Stage = 'select' | 'review';

type DraftStatus = 'pending' | 'uploading' | 'done' | 'error';

interface ItemDraft {
  id: string;
  blob: Blob;
  previewUrl: string;
  /** The originally-selected image, kept so edits (crop/bg-removal) can be undone. */
  originalBlob: Blob;
  originalPreviewUrl: string;
  /** True once the image has been changed from the original (crop or bg-removal). */
  edited: boolean;
  category: ClothingSection | '';
  type: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  isDirty: boolean;
  bgRemoved: boolean;
  removingBg: boolean;
  detecting: boolean;
  status: DraftStatus;
}

const DETECT_CONCURRENCY = 4;
const UPLOAD_CONCURRENCY = 4;

function makeDraft(blob: Blob): ItemDraft {
  // Two independent object URLs for the same original blob: one for the live
  // preview (which may be replaced by edits) and one kept pristine for revert.
  return {
    id: crypto.randomUUID(),
    blob,
    previewUrl: URL.createObjectURL(blob),
    originalBlob: blob,
    originalPreviewUrl: URL.createObjectURL(blob),
    edited: false,
    category: '',
    type: '',
    primaryColor: null,
    secondaryColor: null,
    isDirty: false,
    bgRemoved: false,
    removingBg: false,
    detecting: false,
    status: 'pending',
  };
}

export default function ImageUpload({ isOpen, onClose, onItemUploaded }: ImageUploadProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('select');
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [cropDraftId, setCropDraftId] = useState<string | null>(null);

  const updateDraft = (id: string, patch: Partial<ItemDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const runDetection = async (id: string, blob: Blob) => {
    updateDraft(id, { detecting: true });
    try {
      const result = await detectItem(blob);
      updateDraft(id, {
        type: result.suggestedType ?? '',
        category: result.suggestedSection,
        primaryColor: result.suggestedColors[0] ?? null,
        secondaryColor: result.suggestedColors[1] ?? null,
      });
    } catch {
      // Detection is best-effort; the user can fill the fields in manually.
    } finally {
      updateDraft(id, { detecting: false });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newDrafts = Array.from(files).map((file) => makeDraft(file));
    // Append so "Add more" extends the current batch instead of replacing it.
    setDrafts((prev) => [...prev, ...newDrafts]);
    setStage('review');

    // Allow re-selecting the same file later.
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Auto-detect the newly added items, a few in flight at once.
    runWithConcurrency(newDrafts, DETECT_CONCURRENCY, (draft) =>
      runDetection(draft.id, draft.blob),
    );
  };

  const handleRemoveBackground = async (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;
    updateDraft(id, { removingBg: true });
    try {
      const result = await removeImageBackground(draft.blob);
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      updateDraft(id, {
        blob: result,
        previewUrl: URL.createObjectURL(result),
        bgRemoved: true,
        edited: true,
      });
      showToast('Background removed!', 'success');
      // Colors are more accurate without the background; re-run detection.
      runDetection(id, result);
    } catch {
      showToast('Background removal failed. Please try again.', 'error');
    } finally {
      updateDraft(id, { removingBg: false });
    }
  };

  const handleCropApplied = (id: string, blob: Blob) => {
    const draft = drafts.find((d) => d.id === id);
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    updateDraft(id, { blob, previewUrl: URL.createObjectURL(blob), edited: true });
    setCropDraftId(null);
    // Cropping changes the dominant pixels, so re-detect colors/type.
    runDetection(id, blob);
  };

  // Restore the pristine original image, undoing any crop / background removal.
  const handleRevertOriginal = (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    updateDraft(id, {
      blob: draft.originalBlob,
      previewUrl: URL.createObjectURL(draft.originalBlob),
      edited: false,
      bgRemoved: false,
    });
    runDetection(id, draft.originalBlob);
  };

  const handleCategoryChange = (id: string, category: ClothingSection | '') => {
    updateDraft(id, { category, type: '' });
  };

  const handlePrimarySelect = (draft: ItemDraft, color: string) => {
    // If the chosen primary equals the current secondary, clear secondary.
    const patch: Partial<ItemDraft> = { primaryColor: color };
    if (draft.secondaryColor === color) patch.secondaryColor = null;
    updateDraft(draft.id, patch);
  };

  const handleSecondarySelect = (draft: ItemDraft, color: string) => {
    if (color === draft.primaryColor) return; // can't match primary
    updateDraft(draft.id, { secondaryColor: color });
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => {
      const draft = prev.find((d) => d.id === id);
      if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      if (draft?.originalPreviewUrl) URL.revokeObjectURL(draft.originalPreviewUrl);
      return prev.filter((d) => d.id !== id);
    });
  };

  const isComplete = (draft: ItemDraft) => Boolean(draft.type && draft.primaryColor);

  const handleUploadAll = async () => {
    const toUpload = drafts.filter((d) => d.status !== 'done');
    const incomplete = toUpload.filter((d) => !isComplete(d));
    if (incomplete.length > 0) {
      showToast('Please complete all items before uploading', 'warning');
      return;
    }

    setUploading(true);
    let succeeded = 0;
    let failed = 0;

    await runWithConcurrency(toUpload, UPLOAD_CONCURRENCY, async (draft) => {
      updateDraft(draft.id, { status: 'uploading' });
      try {
        const colors = draft.secondaryColor
          ? [draft.primaryColor!, draft.secondaryColor]
          : [draft.primaryColor!];
        await uploadItem({
          userId: user!.id,
          blob: draft.blob,
          type: draft.type,
          colors,
          isDirty: draft.isDirty,
        });
        updateDraft(draft.id, { status: 'done' });
        succeeded += 1;
        onItemUploaded?.();
      } catch {
        updateDraft(draft.id, { status: 'error' });
        failed += 1;
      }
    });

    setUploading(false);

    if (failed === 0) {
      showToast(
        succeeded === 1 ? 'Item uploaded!' : `Uploaded ${succeeded} items`,
        'success',
      );
      resetForm();
      setTimeout(onClose, 800);
    } else {
      showToast(`${succeeded} uploaded, ${failed} failed`, 'error');
      // Keep only the failed cards so the user can fix and retry.
      setDrafts((prev) => {
        prev
          .filter((d) => d.status === 'done')
          .forEach((d) => {
            if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
            if (d.originalPreviewUrl) URL.revokeObjectURL(d.originalPreviewUrl);
          });
        return prev
          .filter((d) => d.status === 'error')
          .map((d) => ({ ...d, status: 'pending' as DraftStatus }));
      });
    }
  };

  const resetForm = () => {
    drafts.forEach((d) => {
      if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      if (d.originalPreviewUrl) URL.revokeObjectURL(d.originalPreviewUrl);
    });
    setDrafts([]);
    setStage('select');
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const isGrid = drafts.length > 1;
  const allComplete = drafts.length > 0 && drafts.every(isComplete);
  // Count items still missing required fields, but only once detection has
  // finished for them (so we don't flag cards that are still loading).
  const incompleteCount = drafts.filter((d) => !d.detecting && !isComplete(d)).length;

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className={`modal-content ${isGrid ? 'max-w-3xl' : 'max-w-xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {isGrid ? `Add ${drafts.length} Items` : 'Add Clothing Item'}
          </h2>
          <button onClick={closeModal} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        {/* Shared hidden file input (used by both the select and review stages). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Stage: select file */}
        {stage === 'select' && (
          <div className="flex flex-col items-center gap-3 mb-5">
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
              <Upload size={16} /> Upload Photos
            </button>
            <p className="text-xs text-[var(--text-secondary)] text-center">
              Pick one photo or several at once. We&apos;ll detect the type and colors
              automatically — you can remove the background and fix anything before saving.
              You can also add more items one at a time on the next screen.
            </p>
          </div>
        )}

        {/* Stage: review + correct */}
        {stage === 'review' && drafts.length > 0 && (
          <>
            {isGrid ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    invalidType={!draft.detecting && !draft.type}
                    invalidColor={!draft.detecting && !draft.primaryColor}
                    onRemoveBackground={() => handleRemoveBackground(draft.id)}
                    onCrop={() => setCropDraftId(draft.id)}
                    onRevert={() => handleRevertOriginal(draft.id)}
                    onCategoryChange={(c) => handleCategoryChange(draft.id, c)}
                    onTypeChange={(t) => updateDraft(draft.id, { type: t })}
                    onPrimarySelect={(c) => handlePrimarySelect(draft, c)}
                    onSecondarySelect={(c) => handleSecondarySelect(draft, c)}
                    onClearSecondary={() => updateDraft(draft.id, { secondaryColor: null })}
                    onToggleDirty={() => updateDraft(draft.id, { isDirty: !draft.isDirty })}
                    onRemove={() => removeDraft(draft.id)}
                  />
                ))}
              </div>
            ) : (
              <DraftDetail
                draft={drafts[0]}
                invalidType={!drafts[0].detecting && !drafts[0].type}
                invalidColor={!drafts[0].detecting && !drafts[0].primaryColor}
                onRemoveBackground={() => handleRemoveBackground(drafts[0].id)}
                onCrop={() => setCropDraftId(drafts[0].id)}
                onRevert={() => handleRevertOriginal(drafts[0].id)}
                onCategoryChange={(c) => handleCategoryChange(drafts[0].id, c)}
                onTypeChange={(t) => updateDraft(drafts[0].id, { type: t })}
                onPrimarySelect={(c) => handlePrimarySelect(drafts[0], c)}
                onSecondarySelect={(c) => handleSecondarySelect(drafts[0], c)}
                onClearSecondary={() => updateDraft(drafts[0].id, { secondaryColor: null })}
                onToggleDirty={() => updateDraft(drafts[0].id, { isDirty: !drafts[0].isDirty })}
              />
            )}

            {/* Validation summary */}
            {incompleteCount > 0 && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-red-600 mb-3">
                <AlertCircle size={14} />
                {incompleteCount} {incompleteCount === 1 ? 'item needs' : 'items need'} a type
                and primary color (highlighted in red).
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleUploadAll}
                disabled={uploading || !allComplete}
                className="btn-primary disabled:opacity-50"
              >
                {uploading
                  ? 'Uploading...'
                  : isGrid
                    ? `Upload All (${drafts.length})`
                    : 'Upload Item'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary disabled:opacity-50"
              >
                <Upload size={16} /> Add another
              </button>
              <button onClick={resetForm} className="btn-secondary" disabled={uploading}>
                Reset
              </button>
            </div>
          </>
        )}

        {/* Crop overlay (renders above the modal content). */}
        {cropDraftId && (() => {
          const d = drafts.find((x) => x.id === cropDraftId);
          if (!d) return null;
          return (
            <ImageCropper
              imageSrc={d.previewUrl}
              onCancel={() => setCropDraftId(null)}
              onCropComplete={(blob) => handleCropApplied(cropDraftId, blob)}
            />
          );
        })()}
      </div>
    </div>
  );
}

interface DraftEditorProps {
  draft: ItemDraft;
  /** Type/category not yet chosen (and detection has finished). */
  invalidType: boolean;
  /** Primary color not yet chosen (and detection has finished). */
  invalidColor: boolean;
  onRemoveBackground: () => void;
  onCrop: () => void;
  onRevert: () => void;
  onCategoryChange: (category: ClothingSection | '') => void;
  onTypeChange: (type: string) => void;
  onPrimarySelect: (color: string) => void;
  onSecondarySelect: (color: string) => void;
  onClearSecondary: () => void;
  onToggleDirty: () => void;
}

function StatusBadge({ status }: { status: DraftStatus }) {
  if (status === 'uploading') {
    return <Loader2 size={14} className="animate-spin text-[var(--accent)]" />;
  }
  if (status === 'done') {
    return <Check size={14} className="text-green-600" />;
  }
  if (status === 'error') {
    return <AlertCircle size={14} className="text-red-600" />;
  }
  return null;
}

function DirtyToggle({ isDirty, onToggle }: { isDirty: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`text-xs px-2 py-1 rounded font-medium ${
        isDirty ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
      }`}
    >
      {isDirty ? 'Dirty' : 'Clean'}
    </button>
  );
}

function BgRemoveButton({
  draft,
  onClick,
  compact,
}: {
  draft: ItemDraft;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={draft.removingBg || draft.bgRemoved}
      className={`btn-secondary ${compact ? 'text-[10px] px-2 py-1' : 'text-xs'} flex items-center gap-1 disabled:opacity-50`}
    >
      {draft.removingBg ? (
        <><Loader2 size={12} className="animate-spin" /> Removing…</>
      ) : draft.bgRemoved ? (
        <><Eraser size={12} /> Removed</>
      ) : (
        <><Eraser size={12} /> Remove background</>
      )}
    </button>
  );
}

function CropButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`btn-secondary ${compact ? 'text-[10px] px-2 py-1' : 'text-xs'} flex items-center gap-1`}
    >
      <Crop size={compact ? 12 : 14} /> Adjust / crop
    </button>
  );
}

function RevertButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Undo crop / background removal"
      className={`btn-ghost ${compact ? 'text-[10px] px-2 py-1' : 'text-xs'} flex items-center gap-1`}
    >
      <RotateCcw size={compact ? 12 : 14} /> Revert
    </button>
  );
}

function ColorPalette({
  selected,
  disabledColor,
  invalid,
  onSelect,
}: {
  selected: string | null;
  disabledColor?: string | null;
  invalid?: boolean;
  onSelect: (color: string) => void;
}) {
  const baseBorder = invalid ? 'border-red-400 hover:border-red-500' : 'border-gray-200 hover:border-gray-400';
  return (
    <div
      className={`grid grid-cols-8 gap-2 justify-center mx-auto w-fit ${
        invalid ? 'p-1.5 rounded-lg ring-1 ring-red-400 bg-red-50' : ''
      }`}
    >
      {colorPalette.map((color) => {
        const isDisabled = disabledColor != null && color === disabledColor;
        return (
          <button
            key={color}
            onClick={() => onSelect(color)}
            disabled={isDisabled}
            className={`w-9 h-9 rounded-lg border-2 transition-all ${
              selected === color
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105'
                : baseBorder
            } ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: getColorStyle(color).backgroundColor }}
            title={isDisabled ? `${color} (primary)` : color}
          />
        );
      })}
    </div>
  );
}

function TypeSelects({
  draft,
  invalid,
  onCategoryChange,
  onTypeChange,
}: {
  draft: ItemDraft;
  invalid?: boolean;
  onCategoryChange: (c: ClothingSection | '') => void;
  onTypeChange: (t: string) => void;
}) {
  const errorRing = 'border-red-400 ring-1 ring-red-400 bg-red-50';
  return (
    <>
      <select
        value={draft.category}
        onChange={(e) => onCategoryChange(e.target.value as ClothingSection | '')}
        className={`w-48 text-center ${invalid && !draft.category ? errorRing : ''}`}
      >
        <option value="">Select category...</option>
        <option value="Tops">Tops</option>
        <option value="Bottoms">Bottoms</option>
        <option value="Shoes">Shoes</option>
      </select>
      {draft.category && (
        <select
          value={draft.type}
          onChange={(e) => onTypeChange(e.target.value)}
          className={`w-48 text-center ${invalid && !draft.type ? errorRing : ''}`}
        >
          <option value="">Select type...</option>
          {clothingTypes[draft.category]?.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      )}
    </>
  );
}

function DraftDetail({
  draft,
  invalidType,
  invalidColor,
  onRemoveBackground,
  onCrop,
  onRevert,
  onCategoryChange,
  onTypeChange,
  onPrimarySelect,
  onSecondarySelect,
  onClearSecondary,
  onToggleDirty,
}: DraftEditorProps) {
  return (
    <>
      {/* Preview */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <DirtyToggle isDirty={draft.isDirty} onToggle={onToggleDirty} />
          <StatusBadge status={draft.status} />
        </div>
        <div className="w-40 h-40 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
          <img src={draft.previewUrl} alt="Preview" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <CropButton onClick={onCrop} />
          <BgRemoveButton draft={draft} onClick={onRemoveBackground} />
          {draft.edited && <RevertButton onClick={onRevert} />}
        </div>
        {!draft.bgRemoved && !draft.removingBg && (
          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            First use downloads a model (~30 MB).
          </p>
        )}
      </div>

      {/* Category / type */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <label className={`text-sm font-medium flex items-center gap-2 ${invalidType ? 'text-red-600' : 'text-[var(--text)]'}`}>
          Item Type {invalidType && '(required)'}
          {draft.detecting && <Loader2 size={12} className="animate-spin text-[var(--accent)]" />}
        </label>
        <TypeSelects draft={draft} invalid={invalidType} onCategoryChange={onCategoryChange} onTypeChange={onTypeChange} />
      </div>

      {/* Primary color */}
      <div className="mb-5">
        <label className={`text-sm font-medium block text-center mb-2 ${invalidColor ? 'text-red-600' : 'text-[var(--text)]'}`}>
          Primary color {invalidColor && '(required)'}
        </label>
        <ColorPalette selected={draft.primaryColor} invalid={invalidColor} onSelect={onPrimarySelect} />
        {draft.primaryColor && (
          <p className="text-center text-xs text-[var(--text-secondary)] mt-2 capitalize">
            Selected: {draft.primaryColor}
          </p>
        )}
      </div>

      {/* Secondary color (optional) */}
      <div className="mb-5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <label className="text-sm font-medium text-[var(--text)]">Secondary color</label>
          <span className="text-xs text-[var(--text-secondary)]">(optional)</span>
        </div>
        <ColorPalette
          selected={draft.secondaryColor}
          disabledColor={draft.primaryColor}
          onSelect={onSecondarySelect}
        />
        <div className="flex items-center justify-center gap-3 mt-2">
          {draft.secondaryColor ? (
            <p className="text-xs text-[var(--text-secondary)] capitalize">Selected: {draft.secondaryColor}</p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">No secondary color</p>
          )}
          <button
            onClick={onClearSecondary}
            disabled={!draft.secondaryColor}
            className="text-xs underline text-[var(--accent)] disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed"
          >
            No secondary color
          </button>
        </div>
      </div>
    </>
  );
}

function DraftCard({
  draft,
  invalidType,
  invalidColor,
  onRemoveBackground,
  onCrop,
  onRevert,
  onCategoryChange,
  onTypeChange,
  onPrimarySelect,
  onSecondarySelect,
  onClearSecondary,
  onToggleDirty,
  onRemove,
}: DraftEditorProps & { onRemove: () => void }) {
  const needsInfo = invalidType || invalidColor;
  return (
    <div
      className={`rounded-lg border p-3 relative ${
        needsInfo ? 'border-red-400 ring-1 ring-red-400 bg-red-50/40' : 'border-[var(--border)]'
      }`}
    >
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 btn-ghost p-1"
        title="Remove from batch"
      >
        <X size={14} />
      </button>

      {/* Preview + bg removal */}
      <div className="flex flex-col items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <DirtyToggle isDirty={draft.isDirty} onToggle={onToggleDirty} />
          <StatusBadge status={draft.status} />
          {draft.detecting && <Loader2 size={12} className="animate-spin text-[var(--accent)]" />}
          {needsInfo && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-red-600">
              <AlertCircle size={11} /> Needs info
            </span>
          )}
        </div>
        <div className="w-28 h-28 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
          <img src={draft.previewUrl} alt="Preview" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-1.5">
          <CropButton onClick={onCrop} compact />
          <BgRemoveButton draft={draft} onClick={onRemoveBackground} compact />
          {draft.edited && <RevertButton onClick={onRevert} compact />}
        </div>
      </div>

      {/* Category / type */}
      <div className="flex flex-col items-center gap-2 mb-3">
        <TypeSelects draft={draft} invalid={invalidType} onCategoryChange={onCategoryChange} onTypeChange={onTypeChange} />
      </div>

      {/* Primary color */}
      <div className="mb-3">
        <label className={`text-xs font-medium block text-center mb-1 ${invalidColor ? 'text-red-600' : 'text-[var(--text)]'}`}>
          Primary {invalidColor && '(required)'}
        </label>
        <ColorPalette selected={draft.primaryColor} invalid={invalidColor} onSelect={onPrimarySelect} />
      </div>

      {/* Secondary color */}
      <div className="mb-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <label className="text-xs font-medium text-[var(--text)]">Secondary</label>
          <button
            onClick={onClearSecondary}
            disabled={!draft.secondaryColor}
            className="text-[10px] underline text-[var(--accent)] disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed"
          >
            clear
          </button>
        </div>
        <ColorPalette
          selected={draft.secondaryColor}
          disabledColor={draft.primaryColor}
          onSelect={onSecondarySelect}
        />
      </div>
    </div>
  );
}
