'use client';

import Modal from '@/components/ui/Modal';
import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Loader2,
  Eraser,
  Check,
  AlertCircle,
  Crop,
  RotateCcw,
  Camera,
} from 'lucide-react';
import ScrambleText from '@/components/ui/ScrambleText';
import { usePhotoDrop } from '@/hooks/usePhotoDrop';
import { findLookalike } from '@/lib/lookalike';
import { describeItem } from '@/lib/itemLabels';
import { supabase } from '@/lib/supabaseClient';
import type { ClothingItem } from '@/lib/types';
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
  /** Photos to start with (dropped or pasted on the Closet screen). */
  initialFiles?: File[];
  /** The ids of the items just added, so the closet can highlight them. */
  onItemsAdded?: (ids: string[]) => void;
}

/** Whether new photos get their background removed automatically. */
const AUTO_BG_KEY = 'fitfinder:auto-remove-bg';
function readAutoRemove(): boolean {
  try {
    return localStorage.getItem(AUTO_BG_KEY) !== 'off';
  } catch {
    return true;
  }
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
  /** The user changed the type or colours; detection no longer overwrites them. */
  touched: boolean;
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
    touched: false,
  };
}

export default function ImageUpload({
  isOpen,
  onClose,
  onItemUploaded,
  initialFiles,
  onItemsAdded,
}: ImageUploadProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('select');
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [cropDraftId, setCropDraftId] = useState<string | null>(null);
  const [autoRemove, setAutoRemove] = useState(readAutoRemove);
  // The closet, for "Looks like your …" when a new item matches one.
  const [closet, setCloset] = useState<Pick<ClothingItem, 'id' | 'type' | 'colors'>[]>([]);
  // The latest drafts, for async work that outlives the render it started in.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const updateDraft = (id: string, patch: Partial<ItemDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    try {
      supabase
        .from('clothing_items')
        .select('id, type, colors')
        .eq('user_id', user.id)
        .then(
          ({ data }) => {
            if (!cancelled) setCloset((data as typeof closet | null) ?? []);
          },
          () => {},
        );
    } catch {
      // Best-effort: without the closet there's just no lookalike note.
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  const runDetection = async (id: string, blob: Blob) => {
    updateDraft(id, { detecting: true });
    try {
      const result = await detectItem(blob);
      // Don't overwrite what the user has already chosen.
      setDrafts((prev) =>
        prev.map((d) =>
          d.id !== id || d.touched
            ? d
            : {
                ...d,
                type: result.suggestedType ?? '',
                category: result.suggestedSection,
                primaryColor: result.suggestedColors[0] ?? null,
                secondaryColor: result.suggestedColors[1] ?? null,
              },
        ),
      );
    } catch {
      // Detection is best-effort; the user can fill the fields in manually.
    } finally {
      updateDraft(id, { detecting: false });
    }
  };

  const addFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    const newDrafts = images.map((file) => makeDraft(file));
    // Append so "Add more" extends the current batch instead of replacing it.
    setDrafts((prev) => [...prev, ...newDrafts]);
    setStage('review');

    // Auto-detect the newly added items, a few in flight at once.
    runWithConcurrency(newDrafts, DETECT_CONCURRENCY, (draft) =>
      runDetection(draft.id, draft.blob),
    );
    // And cut out their backgrounds, one at a time (it's heavy work).
    if (autoRemove) {
      runWithConcurrency(newDrafts, 1, (draft) =>
        removeBackground(draft.id, { quiet: true, blob: draft.blob }),
      );
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    // Allow re-selecting the same file later.
    event.target.value = '';
  };

  // Photos dropped anywhere or pasted while the dialog is open.
  usePhotoDrop(isOpen, addFiles);

  // Photos dropped or pasted on the Closet screen open the dialog with them.
  const consumedFiles = useRef<File[] | null>(null);
  useEffect(() => {
    if (isOpen && initialFiles?.length && consumedFiles.current !== initialFiles) {
      consumedFiles.current = initialFiles;
      addFiles(initialFiles);
    }
    // addFiles is recreated each render; only new initial files matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFiles]);

  const toggleAutoRemove = () => {
    const next = !autoRemove;
    setAutoRemove(next);
    try {
      localStorage.setItem(AUTO_BG_KEY, next ? 'on' : 'off');
    } catch {
      // Not persisted (private mode); still applies for now.
    }
  };

  /** Cut out a photo's background. `blob` is passed when called before the
   * draft has rendered; `quiet` skips toasts (automatic removal). */
  const removeBackground = async (
    id: string,
    { quiet = false, blob }: { quiet?: boolean; blob?: Blob } = {},
  ) => {
    const source = blob ?? draftsRef.current.find((d) => d.id === id)?.blob;
    if (!source) return;
    updateDraft(id, { removingBg: true });
    try {
      const result = await removeImageBackground(source);
      const current = draftsRef.current.find((d) => d.id === id);
      if (!current) return; // removed meanwhile
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      updateDraft(id, {
        blob: result,
        previewUrl: URL.createObjectURL(result),
        bgRemoved: true,
        edited: true,
      });
      if (!quiet) showToast('Background removed.', 'success');
      // Colors are more accurate without the background; re-run detection.
      runDetection(id, result);
    } catch {
      if (!quiet) {
        showToast(
          "Couldn't remove the background. Try again, or keep the original photo.",
          'error',
        );
      }
    } finally {
      updateDraft(id, { removingBg: false });
    }
  };
  const handleRemoveBackground = (id: string) => removeBackground(id);

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
    updateDraft(id, { category, type: '', touched: true });
  };

  const handlePrimarySelect = (draft: ItemDraft, color: string) => {
    // If the chosen primary equals the current secondary, clear secondary.
    const patch: Partial<ItemDraft> = { primaryColor: color, touched: true };
    if (draft.secondaryColor === color) patch.secondaryColor = null;
    updateDraft(draft.id, patch);
  };

  const handleSecondarySelect = (draft: ItemDraft, color: string) => {
    if (color === draft.primaryColor) return; // can't match primary
    updateDraft(draft.id, { secondaryColor: color, touched: true });
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
    const addedIds: string[] = [];

    await runWithConcurrency(toUpload, UPLOAD_CONCURRENCY, async (draft) => {
      updateDraft(draft.id, { status: 'uploading', errorMessage: null });
      try {
        const colors = draft.secondaryColor
          ? [draft.primaryColor!, draft.secondaryColor]
          : [draft.primaryColor!];
        const id = await uploadItem({
          userId: user!.id,
          blob: draft.blob,
          type: draft.type,
          colors,
          isDirty: draft.isDirty,
        });
        if (id) addedIds.push(id);
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
    if (addedIds.length > 0) onItemsAdded?.(addedIds);

    if (failed === 0) {
      showToast(
        succeeded === 1 ? 'Item added to your closet.' : `${succeeded} items added to your closet.`,
        'success',
      );
      // A moment to see the progress rings finish, then close.
      setTimeout(() => {
        resetForm();
        onClose();
      }, 700);
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
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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
  const removing = drafts.some((d) => d.removingBg);
  const lookalikeOf = (d: ItemDraft) => {
    const match = findLookalike(d.type, d.primaryColor, closet);
    return match ? describeItem(match as ClothingItem) : null;
  };

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
      {/* On a phone: straight to the camera. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take a photo"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Stage: select file */}
      {stage === 'select' && (
        <div className="mb-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-md border-2 border-dashed border-[var(--line-strong)] bg-[var(--muted)] hover:bg-white px-6 py-10 flex flex-col items-center gap-2 transition-colors"
          >
            <Upload size={28} aria-hidden="true" className="text-[var(--carbon)]" />
            <span className="font-semibold text-xl font-bold">Choose photos</span>
            <span className="text-sm text-[var(--text-secondary)] max-w-xs text-center">
              Add one or more photos. We&apos;ll guess the type and colors — you can fix anything
              before saving.
            </span>
            <span className="readout mt-1 hidden sm:inline">
              or drop photos here · paste with ⌘V
            </span>
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="btn-secondary w-full mt-3 sm:hidden"
          >
            <Camera size={16} aria-hidden="true" /> Take a photo
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
                  lookalike={lookalikeOf(draft)}
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
              lookalike={lookalikeOf(drafts[0])}
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

          <label className="flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)] mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRemove}
              onChange={toggleAutoRemove}
              className="w-4 h-4 accent-[var(--carbon)]"
            />
            Remove backgrounds automatically
          </label>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleUploadAll}
              disabled={uploading || !allComplete || removing}
              className="btn-primary disabled:opacity-50"
            >
              {uploading
                ? 'Adding…'
                : removing
                  ? 'Removing backgrounds…'
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
  /** "Navy Blue Button-Up Shirt" when the closet already has one like it. */
  lookalike?: string | null;
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
      <span className={isDirty ? 'badge-dirty' : 'badge-clean'}>{isDirty ? 'Dirty' : 'Clean'}</span>
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

/**
 * The photo: a scan line sweeps it while it's analysed or cut out; once the
 * background is removed it wipes away, and a slider compares with the
 * original. A ring spins while it uploads, then a check.
 */
function DraftPreview({ draft, large = false }: { draft: ItemDraft; large?: boolean }) {
  // How much of the original photo shows, from the left (0 = all cut-out).
  const [compare, setCompare] = useState(0);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${large ? 'w-44 h-44' : 'w-28 h-28'} relative rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]`}
      >
        <img
          src={draft.previewUrl}
          alt="Photo preview"
          className="absolute inset-0 w-full h-full object-contain"
        />
        {draft.bgRemoved && (
          <img
            key={draft.previewUrl}
            src={draft.originalPreviewUrl}
            alt=""
            aria-hidden="true"
            data-testid="original-overlay"
            className="reveal-wipe absolute inset-0 w-full h-full object-contain"
            style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}
          />
        )}
        {(draft.detecting || draft.removingBg) && (
          <span aria-hidden="true" data-testid="scan-line" className="scan-line" />
        )}
        {draft.status === 'uploading' && (
          <span
            role="status"
            aria-label="Uploading"
            className="absolute inset-0 flex items-center justify-center bg-white/50"
          >
            <svg viewBox="0 0 36 36" className="w-10 h-10 animate-spin" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="30 100"
              />
            </svg>
          </span>
        )}
        {draft.status === 'done' && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/40">
            <span className="pop-in w-10 h-10 rounded-full bg-[var(--success)] text-white flex items-center justify-center">
              <Check size={20} strokeWidth={3} aria-label="Added" />
            </span>
          </span>
        )}
      </div>
      {draft.bgRemoved && (
        <input
          type="range"
          min={0}
          max={100}
          value={compare}
          onChange={(e) => setCompare(Number(e.target.value))}
          aria-label="Compare with the original photo"
          className="w-28 accent-[var(--carbon)]"
        />
      )}
    </div>
  );
}

/**
 * What detection found, as chips: the type (typed in as it arrives) and the
 * colours (popping in). Tapping one opens the editors.
 */
function DetailsSummary({
  draft,
  expanded,
  onToggle,
}: {
  draft: ItemDraft;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (draft.detecting && !draft.type && !draft.primaryColor) {
    return <p className="readout text-center">Analyzing…</p>;
  }
  const colors = [draft.primaryColor, draft.secondaryColor].filter((c): c is string => !!c);
  const chip =
    'min-h-[36px] px-3 rounded-full border border-[var(--line-strong)] bg-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--muted)]';
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`Type: ${draft.type || 'not chosen'}. Edit`}
        className={chip}
      >
        {draft.type ? <ScrambleText text={draft.type} /> : 'Choose a type'}
      </button>
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${i === 0 ? 'Main' : 'Second'} color: ${getColorName(c)}. Edit`}
          className={`${chip} pop-in`}
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/20"
            style={getColorStyle(c)}
            aria-hidden="true"
          />
          {getColorName(c)}
        </button>
      ))}
    </div>
  );
}

function LookalikeNote({ name }: { name?: string | null }) {
  if (!name) return null;
  return (
    <p role="note" className="text-xs text-center text-[var(--warning)]">
      Looks like your {name}. You can still add it.
    </p>
  );
}

function DraftDetail({
  draft,
  lookalike,
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
  const [editing, setEditing] = useState(false);
  // Editors show when asked, or while something required is missing.
  const showEditors = editing || invalidType || invalidColor;
  return (
    <>
      {/* Preview */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <DirtyToggle isDirty={draft.isDirty} onToggle={onToggleDirty} />
          <StatusBadge status={draft.status} />
        </div>
        <UploadErrorNote message={draft.errorMessage} />
        <DraftPreview draft={draft} large />
        <DetailsSummary
          draft={draft}
          expanded={showEditors}
          onToggle={() => setEditing(!editing)}
        />
        <LookalikeNote name={lookalike} />
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

      {showEditors && (
        <div className="page-in">
          {/* Category / type */}
          <div className="flex flex-col items-center gap-3 mb-5">
            <label
              className={`text-sm font-medium flex items-center gap-2 ${invalidType ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
            >
              Type {invalidType && '(required)'}
              {draft.detecting && (
                <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
              )}
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
        </div>
      )}
    </>
  );
}

function DraftCard({
  draft,
  lookalike,
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
  const [editing, setEditing] = useState(false);
  const showEditors = editing || needsInfo;
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
        <DraftPreview draft={draft} />
        <DetailsSummary
          draft={draft}
          expanded={showEditors}
          onToggle={() => setEditing(!editing)}
        />
        <LookalikeNote name={lookalike} />
        <div className="flex items-center gap-1.5">
          <CropButton onClick={onCrop} compact />
          <BgRemoveButton draft={draft} onClick={onRemoveBackground} compact />
          {draft.edited && <RevertButton onClick={onRevert} compact />}
        </div>
      </div>

      {showEditors && (
        <div className="page-in">
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
      )}
    </div>
  );
}
