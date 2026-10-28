'use client';

import ModalHeader from '@/components/ui/ModalHeader';
import Modal from '@/components/ui/Modal';
import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Loader2, RotateCcw, RotateCw } from 'lucide-react';
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
  // Rotation: quarter turns (for sideways photos) plus a fine tilt.
  const [quarterTurns, setQuarterTurns] = useState(0);
  const [tilt, setTilt] = useState(0);
  const rotation = quarterTurns * 90 + tilt;
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
    setQuarterTurns(0);
    setTilt(0);
  };

  const handleDone = async () => {
    if (!areaPercent) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, areaPercent, rotation);
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
    <Modal label="Adjust and crop" onClose={onCancel} dismissible={!saving}>
      {/* Header */}
      <ModalHeader title="Adjust & crop" onClose={onCancel} closeLabel="Cancel crop" />

      {/* Crop area */}
      <div className="relative w-full h-64 sm:h-80 rounded-lg overflow-hidden bg-[var(--muted)] border border-[var(--border)]">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
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

        <div className="flex items-center gap-3">
          <label
            htmlFor="crop-tilt"
            className="text-xs font-medium text-[var(--text-secondary)] w-10"
          >
            Tilt
          </label>
          <input
            id="crop-tilt"
            type="range"
            min={-45}
            max={45}
            step={0.5}
            value={tilt}
            onChange={(e) => setTilt(Number(e.target.value))}
            onDoubleClick={() => setTilt(0)}
            aria-valuetext={`${tilt} degrees`}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="readout w-10 text-right tabular" aria-hidden="true">
            {tilt > 0 ? '+' : ''}
            {tilt}°
          </span>
          <button
            type="button"
            onClick={() => setQuarterTurns((q) => (q + 1) % 4)}
            className="btn-secondary text-xs px-3 min-h-[36px]"
            aria-label="Rotate 90 degrees"
          >
            <RotateCw size={13} aria-hidden="true" /> 90°
          </button>
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
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : (
            'Apply crop'
          )}
        </button>
      </div>
    </Modal>
  );
}
