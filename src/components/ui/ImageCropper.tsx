"use client";

import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Loader2, X, RotateCcw } from 'lucide-react';
import { getCroppedBlob } from '@/lib/imageCrop';

interface ImageCropperProps {
  /** Object URL, data URL, or CORS-served remote URL to crop. */
  imageSrc: string;
  onCancel: () => void;
  /** Called with the cropped PNG blob when the user confirms. */
  onCropComplete: (blob: Blob) => void;
}

const INITIAL_CROP: Point = { x: 0, y: 0 };
const INITIAL_ZOOM = 1;

export default function ImageCropper({ imageSrc, onCancel, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>(INITIAL_CROP);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [aspect, setAspect] = useState<number | undefined>(undefined); // undefined = free
  const [areaPercent, setAreaPercent] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Capture the crop rectangle as a percentage of the image. With
  // restrictPosition disabled this can extend past the image edges when the user
  // zooms out, which lets the saved output include the surrounding padding
  // ("fit whole image in frame").
  const handleCropComplete = useCallback((percentArea: Area) => {
    setAreaPercent(percentArea);
  }, []);

  const resetView = () => {
    setCrop(INITIAL_CROP);
    setZoom(INITIAL_ZOOM);
    setAspect(undefined);
  };

  const handleDone = async () => {
    if (!areaPercent) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, areaPercent);
      onCropComplete(blob);
    } catch {
      // Keep the cropper open so the user can retry.
      setSaving(false);
    }
  };

  const aspectBtn = (label: string, value: number | undefined) => (
    <button
      onClick={() => setAspect(value)}
      className={`text-xs py-1 px-2 ${aspect === value ? 'btn-primary' : 'btn-secondary'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">Adjust &amp; crop</h2>
          <button onClick={onCancel} className="btn-ghost p-1" aria-label="Cancel crop">
            <X size={18} />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative w-full h-64 sm:h-80 rounded-lg overflow-hidden bg-[var(--muted)] border border-[var(--border)]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={0.3}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            restrictPosition={false}
            objectFit="contain"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[var(--text-secondary)] w-10">Zoom</label>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
              aria-label="Zoom"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Shape</span>
              {aspectBtn('Free', undefined)}
              {aspectBtn('1:1', 1)}
            </div>
            <button onClick={resetView} className="btn-ghost text-xs flex items-center gap-1">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleDone}
            disabled={saving || !areaPercent}
            className="btn-primary disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              'Apply crop'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
