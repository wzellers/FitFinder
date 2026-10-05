'use client';

import Modal from '@/components/ui/Modal';
import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Eraser, Check, AlertCircle, Crop, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes, colorPalette } from '@/lib/constants';
import { getColorName, getColorStyle } from '@/lib/colorUtils';
import {
  detectItem,
  removeImageBackground,
  uploadItem,
  runWithConcurrency,
  UploadError,
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
  /** Why the last upload attempt failed, shown on the card. */
  errorMessage: string | null;
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
    errorMessage: null,
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
      showToast('Background removed.', 'success');
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
      showToast('Some photos still need a type and color.', 'warning');
      return;
    }

    setUploading(true);
    let succeeded = 0;
    let failed = 0;

    await runWithConcurrency(toUpload, UPLOAD_CONCURRENCY, async (draft) => {
      updateDraft(draft.id, { status: 'uploading', errorMessage: null });
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
      } catch (err) {
        updateDraft(draft.id, {
          status: 'error',
          errorMessage:
            err instanceof UploadError ? err.message : "Couldn't upload this item. Try again.",
        });
        failed += 1;
      }
    });

    setUploading(false);

    if (failed === 0) {
      showToast(
        succeeded === 1 ? 'Item added to your closet.' : `${succeeded} items added to your closet.`,
        'success',
      );
      resetForm();
      setTimeout(onClose, 800);
    } else {
      showToast(
        `${succeeded} added, ${failed} couldn't be uploaded. Check the cards below.`,
        'error',
      );
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
    <Modal
      label={isGrid ? `Add ${drafts.length} items` : 'Add a clothing item'}
      onClose={closeModal}
      className={isGrid ? 'max-w-3xl' : 'max-w-xl'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl">{isGrid ? `Add ${drafts.length} items` : 'Add an item'}</h2>
        <button onClick={closeModal} className="btn-ghost px-2" aria-label="Close">
          <X size={18} aria-hidden="true" />
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
        <div className="mb-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-md border-2 border-dashed border-[var(--manila-deep)] bg-[#fbf6e9] hover:bg-[var(--manila)]/40 px-6 py-10 flex flex-col items-center gap-2 transition-colors"
          >
            <Upload size={28} aria-hidden="true" className="text-[var(--carbon)]" />
            <span className="font-display text-xl font-bold [font-stretch:85%]">Choose photos</span>
            <span className="text-sm text-[var(--text-secondary)] max-w-xs text-center">
              Add one or more photos. We&apos;ll guess the type and colors — you can fix anything
              before saving.
            </span>
          </button>
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
            <p className="flex items-center justify-center gap-1.5 text-sm text-[var(--danger)] mb-3">
              <AlertCircle size={14} />
              {incompleteCount} {incompleteCount === 1 ? 'photo needs' : 'photos need'} a type and
              main color (marked in red).
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
                ? 'Adding…'
                : isGrid
                  ? `Add ${drafts.length} items to closet`
                  : 'Add to closet'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary disabled:opacity-50"
            >
              <Upload size={16} aria-hidden="true" /> Add more photos
            </button>
            <button onClick={resetForm} className="btn-ghost" disabled={uploading}>
              Start over
            </button>
          </div>
        </>
      )}

      {/* Crop overlay (renders above the modal content). */}
      {cropDraftId &&
        (() => {
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
    </Modal>
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

function UploadErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="max-w-[14rem] text-center text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

function StatusBadge({ status }: { status: DraftStatus }) {
  if (status === 'uploading') {
    return <Loader2 size={14} className="animate-spin text-[var(--accent)]" />;
  }
  if (status === 'done') {
    return <Check size={14} className="text-[var(--success)]" />;
  }
  if (status === 'error') {
    return <AlertCircle size={14} className="text-[var(--danger)]" />;
  }
  return null;
}

function DirtyToggle({ isDirty, onToggle }: { isDirty: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Laundry status: ${isDirty ? 'dirty' : 'clean'}. Mark as ${isDirty ? 'clean' : 'dirty'}`}
      className="min-h-[36px] min-w-[44px] flex items-center justify-center"
    >
      <span className={isDirty ? 'stamp-dirty' : 'stamp-clean'}>{isDirty ? 'Dirty' : 'Clean'}</span>
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
      className={`btn-secondary ${compact ? 'text-xs px-2.5 min-h-[36px]' : 'text-sm'} flex items-center gap-1 disabled:opacity-50`}
    >
      {draft.removingBg ? (
        <>
          <Loader2 size={12} className="animate-spin" /> Removing…
        </>
      ) : draft.bgRemoved ? (
        <>
          <Eraser size={12} /> Removed
        </>
      ) : (
        <>
          <Eraser size={12} /> Remove background
        </>
      )}
    </button>
  );
}

function CropButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`btn-secondary ${compact ? 'text-xs px-2.5 min-h-[36px]' : 'text-sm'} flex items-center gap-1`}
    >
      <Crop size={compact ? 12 : 14} /> Adjust / crop
    </button>
  );
}

function RevertButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Undo crop and background removal"
      className={`btn-ghost ${compact ? 'text-xs px-2.5 min-h-[36px]' : 'text-sm'} flex items-center gap-1`}
    >
      <RotateCcw size={compact ? 12 : 14} /> Revert
    </button>
  );
}

function ColorPalette({
  label,
  selected,
  disabledColor,
  invalid,
  onSelect,
}: {
  label: string;
  selected: string | null;
  disabledColor?: string | null;
  invalid?: boolean;
  onSelect: (color: string) => void;
}) {
  const baseBorder = invalid
    ? 'border-[var(--danger)] hover:border-[var(--danger)]'
    : 'border-[var(--border)] hover:border-[var(--text-secondary)]';
  return (
    <div
      role="group"
      aria-label={label}
      className={`grid grid-cols-8 gap-2 justify-center mx-auto w-fit ${
        invalid ? 'p-1.5 rounded-lg ring-1 ring-[var(--danger)] bg-[#fbeceb]' : ''
      }`}
    >
      {colorPalette.map((color) => {
        const isDisabled = disabledColor != null && color === disabledColor;
        return (
          <button
            key={color}
            onClick={() => onSelect(color)}
            disabled={isDisabled}
            aria-pressed={selected === color}
            aria-label={getColorName(color)}
            className={`w-9 h-9 rounded-lg border-2 transition-all ${
              selected === color
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105'
                : baseBorder
            } ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: getColorStyle(color).backgroundColor }}
            title={isDisabled ? `${getColorName(color)} (main color)` : getColorName(color)}
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
  const errorRing = 'border-[var(--danger)] ring-1 ring-[var(--danger)] bg-[#fbeceb]';
  return (
    <>
      <select
        aria-label="Category"
        aria-invalid={invalid && !draft.category ? true : undefined}
        value={draft.category}
        onChange={(e) => onCategoryChange(e.target.value as ClothingSection | '')}
        className={`w-48 text-center ${invalid && !draft.category ? errorRing : ''}`}
      >
        <option value="">Choose a category</option>
        <option value="Tops">Tops</option>
        <option value="Bottoms">Bottoms</option>
        <option value="Shoes">Shoes</option>
      </select>
      {draft.category && (
        <select
          aria-label="Type"
          aria-invalid={invalid && !draft.type ? true : undefined}
          value={draft.type}
          onChange={(e) => onTypeChange(e.target.value)}
          className={`w-48 text-center ${invalid && !draft.type ? errorRing : ''}`}
        >
          <option value="">Choose a type</option>
          {clothingTypes[draft.category]?.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
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
        <UploadErrorNote message={draft.errorMessage} />
        <div className="w-40 h-40 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
          <img
            src={draft.previewUrl}
            alt="Photo preview"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex items-center gap-2">
          <CropButton onClick={onCrop} />
          <BgRemoveButton draft={draft} onClick={onRemoveBackground} />
          {draft.edited && <RevertButton onClick={onRevert} />}
        </div>
        {!draft.bgRemoved && !draft.removingBg && (
          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            The first background removal downloads about 30 MB.
          </p>
        )}
      </div>

      {/* Category / type */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <label
          className={`text-sm font-medium flex items-center gap-2 ${invalidType ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
        >
          Type {invalidType && '(required)'}
          {draft.detecting && <Loader2 size={12} className="animate-spin text-[var(--accent)]" />}
        </label>
        <TypeSelects
          draft={draft}
          invalid={invalidType}
          onCategoryChange={onCategoryChange}
          onTypeChange={onTypeChange}
        />
      </div>

      {/* Primary color */}
      <div className="mb-5">
        <label
          className={`text-sm font-medium block text-center mb-2 ${invalidColor ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
        >
          Main color {invalidColor && '(required)'}
        </label>
        <ColorPalette
          label="Main color"
          selected={draft.primaryColor}
          invalid={invalidColor}
          onSelect={onPrimarySelect}
        />
        {draft.primaryColor && (
          <p className="text-center text-xs text-[var(--text-secondary)] mt-2 capitalize">
            Selected: {draft.primaryColor}
          </p>
        )}
      </div>

      {/* Secondary color (optional) */}
      <div className="mb-5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm font-medium text-[var(--text)]">Second color</span>
          <span className="text-xs text-[var(--text-secondary)]">(optional)</span>
        </div>
        <ColorPalette
          label="Second color"
          selected={draft.secondaryColor}
          disabledColor={draft.primaryColor}
          onSelect={onSecondarySelect}
        />
        <div className="flex items-center justify-center gap-3 mt-2">
          <p className="text-xs text-[var(--text-secondary)]">
            {draft.secondaryColor ? getColorName(draft.secondaryColor) : 'None'}
          </p>
          {draft.secondaryColor && (
            <button
              onClick={onClearSecondary}
              className="min-h-[32px] text-sm font-semibold underline text-[var(--carbon)]"
            >
              Remove second color
            </button>
          )}
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
        needsInfo
          ? 'border-[var(--danger)] ring-1 ring-[var(--danger)] bg-[#fbeceb]/60'
          : 'border-[var(--border)]'
      }`}
    >
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 btn-ghost px-2"
        aria-label="Remove this photo"
      >
        <X size={14} aria-hidden="true" />
      </button>

      {/* Preview + bg removal */}
      <div className="flex flex-col items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <DirtyToggle isDirty={draft.isDirty} onToggle={onToggleDirty} />
          <StatusBadge status={draft.status} />
          {draft.detecting && <Loader2 size={12} className="animate-spin text-[var(--accent)]" />}
          {needsInfo && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--danger)]">
              <AlertCircle size={11} aria-hidden="true" /> Needs a type and color
            </span>
          )}
        </div>
        <UploadErrorNote message={draft.errorMessage} />
        <div className="w-28 h-28 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
          <img
            src={draft.previewUrl}
            alt="Photo preview"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <CropButton onClick={onCrop} compact />
          <BgRemoveButton draft={draft} onClick={onRemoveBackground} compact />
          {draft.edited && <RevertButton onClick={onRevert} compact />}
        </div>
      </div>

      {/* Category / type */}
      <div className="flex flex-col items-center gap-2 mb-3">
        <TypeSelects
          draft={draft}
          invalid={invalidType}
          onCategoryChange={onCategoryChange}
          onTypeChange={onTypeChange}
        />
      </div>

      {/* Primary color */}
      <div className="mb-3">
        <label
          className={`text-xs font-medium block text-center mb-1 ${invalidColor ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
        >
          Main color {invalidColor && '(required)'}
        </label>
        <ColorPalette
          label="Main color"
          selected={draft.primaryColor}
          invalid={invalidColor}
          onSelect={onPrimarySelect}
        />
      </div>

      {/* Secondary color */}
      <div className="mb-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xs font-medium text-[var(--text)]">Second color</span>
          {draft.secondaryColor && (
            <button
              onClick={onClearSecondary}
              className="min-h-[32px] px-1 text-xs font-semibold underline text-[var(--carbon)]"
            >
              Remove
            </button>
          )}
        </div>
        <ColorPalette
          label="Second color"
          selected={draft.secondaryColor}
          disabledColor={draft.primaryColor}
          onSelect={onSecondarySelect}
        />
      </div>
    </div>
  );
}
