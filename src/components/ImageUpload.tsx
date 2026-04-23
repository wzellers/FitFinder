"use client";

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Scissors, Eraser, Loader2, Wand2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes, colorPalette, colorMap, typeToSection } from '@/lib/constants';
import { getColorStyle } from '@/lib/colorUtils';
import type { ClothingSection } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Cropper = dynamic(() => import('react-easy-crop').then(m => m.default) as any, { ssr: false }) as any;

// Area type from react-easy-crop (inlined to avoid import issues)
interface Area { width: number; height: number; x: number; y: number; }

interface ImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onItemUploaded?: () => void;
}

// Crop the image to a 512x512 canvas
function getCroppedImage(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 512, 512);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Blob creation failed'));
      }, 'image/png');
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

// Extract dominant color from image blob by sampling pixels
function extractDominantColor(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64; // downsample for speed
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(objectUrl); resolve(null); return; }
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      // Count non-transparent, non-white/near-white pixels
      const colorCounts: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        // Skip transparent or near-white pixels (likely background)
        if (a < 128) continue;
        if (r > 240 && g > 240 && b > 240) continue;

        // Find closest palette color
        let bestColor = '';
        let bestDist = Infinity;
        for (const name of colorPalette) {
          const hex = colorMap[name];
          if (!hex) continue;
          const pr = parseInt(hex.slice(1, 3), 16);
          const pg = parseInt(hex.slice(3, 5), 16);
          const pb = parseInt(hex.slice(5, 7), 16);
          const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
          if (dist < bestDist) { bestDist = dist; bestColor = name; }
        }
        if (bestColor) {
          colorCounts[bestColor] = (colorCounts[bestColor] || 0) + 1;
        }
      }

      // Find the most frequent color
      let topColor = '';
      let topCount = 0;
      for (const [color, count] of Object.entries(colorCounts)) {
        if (count > topCount) { topCount = count; topColor = color; }
      }
      URL.revokeObjectURL(objectUrl);
      resolve(topColor || null);
    };
    const objectUrl = URL.createObjectURL(blob);
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
    img.src = objectUrl;
  });
}

// Convert blob to base64 data URL
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ImageUpload({ isOpen, onClose, onItemUploaded }: ImageUploadProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [markDirty, setMarkDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow stages: select → crop → preview (optionally bg-remove) → metadata → upload
  const [stage, setStage] = useState<'select' | 'crop' | 'preview'>('select');
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Cropper state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // BG removal
  const [removingBg, setRemovingBg] = useState(false);

  // Auto-detect
  const [detecting, setDetecting] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setRawImageUrl(url);
      setStage('crop');
    }
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirmCrop = async () => {
    if (!rawImageUrl || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImage(rawImageUrl, croppedAreaPixels);
      setCroppedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setStage('preview');

      // Auto-detect color from pixels
      extractDominantColor(blob).then((color) => {
        if (color) setSelectedColors([color]);
      });
    } catch {
      showToast('Crop failed', 'error');
    }
  };

  const handleAutoDetect = async () => {
    if (!croppedBlob) return;
    setDetecting(true);
    try {
      const dataUrl = await blobToDataUrl(croppedBlob);
      const res = await fetch('/api/detect-clothing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Detection failed');
      }
      const { type, color } = await res.json();
      if (type) {
        const section = typeToSection[type];
        if (section) setSelectedCategory(section);
        setSelectedType(type);
      }
      if (color) {
        setSelectedColors([color]);
      }
      showToast(
        type && color ? `Detected: ${type} (${color})` :
        type ? `Detected: ${type}` :
        color ? `Detected color: ${color}` :
        'Could not detect — please select manually',
        type || color ? 'success' : 'warning',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Detection failed';
      if (msg.includes('not configured')) {
        showToast('Add ANTHROPIC_API_KEY to .env.local to enable AI detection', 'warning');
      } else {
        showToast('Auto-detect failed. Select manually.', 'error');
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!croppedBlob) return;
    setRemovingBg(true);
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const result = await removeBackground(croppedBlob, {
        output: { format: 'image/png' },
      });
      const blob = result as Blob;
      setCroppedBlob(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      showToast('Background removed!', 'success');

      // Re-detect color after bg removal (more accurate now)
      extractDominantColor(blob).then((color) => {
        if (color) setSelectedColors([color]);
      });
    } catch {
      showToast('Background removal failed. Try again.', 'error');
    } finally {
      setRemovingBg(false);
    }
  };

  const handleUpload = async () => {
    if (!croppedBlob || !selectedType || selectedColors.length === 0) {
      showToast('Please complete all fields', 'warning');
      return;
    }
    setUploading(true);

    try {
      const fileName = `${user?.id}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, croppedBlob, { contentType: 'image/png' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('clothing-images').getPublicUrl(fileName);

      const { error } = await supabase.from('clothing_items').insert([
        { user_id: user?.id, type: selectedType, colors: selectedColors, image_url: urlData.publicUrl, is_dirty: markDirty },
      ]).select();
      if (error) throw error;

      showToast('Item uploaded!', 'success');
      resetForm();
      onItemUploaded?.();
      setTimeout(onClose, 800);
    } catch {
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRawImageUrl(null);
    setCroppedBlob(null);
    setPreviewUrl(null);
    setStage('select');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setSelectedCategory('');
    setSelectedType('');
    setSelectedColors([]);
    setMarkDirty(false);
    setRemovingBg(false);
    setDetecting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => { resetForm(); onClose(); }}>
      <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Add Clothing Item</h2>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setMarkDirty(!markDirty)}
              className={`text-xs px-2 py-1 rounded font-medium ${markDirty ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {markDirty ? 'Clean' : 'Dirty'}
            </button>
            <button onClick={() => { resetForm(); onClose(); }} className="btn-ghost p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stage: select file */}
        {stage === 'select' && (
          <div className="flex flex-col items-center gap-3 mb-5">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
              <Upload size={16} /> Choose File
            </button>
            <p className="text-xs text-[var(--text-secondary)]">Select a photo to crop and upload.</p>
          </div>
        )}

        {/* Stage: crop */}
        {stage === 'crop' && rawImageUrl && (
          <div className="mb-5">
            <div style={{ position: 'relative', width: '100%', height: '288px' }} className="bg-[var(--muted)] rounded-lg overflow-hidden mb-3">
              <Cropper
                image={rawImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-[var(--text-secondary)]">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStage('select'); setRawImageUrl(null); }} className="btn-secondary text-xs">
                Back
              </button>
              <button onClick={handleConfirmCrop} className="btn-primary text-xs">
                <Scissors size={14} /> Confirm Crop
              </button>
            </div>
          </div>
        )}

        {/* Stage: preview + metadata */}
        {stage === 'preview' && previewUrl && (
          <>
            {/* Preview */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-40 h-40 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => setStage('crop')} className="btn-secondary text-xs">
                  Re-crop
                </button>
                <button
                  onClick={handleRemoveBackground}
                  disabled={removingBg || detecting}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  {removingBg ? <><Loader2 size={12} className="animate-spin" /> Processing...</> : <><Eraser size={12} /> Remove Background</>}
                </button>
                <button
                  onClick={handleAutoDetect}
                  disabled={detecting || removingBg}
                  className="btn-primary text-xs flex items-center gap-1"
                >
                  {detecting ? <><Loader2 size={12} className="animate-spin" /> Detecting...</> : <><Wand2 size={12} /> Auto-Detect</>}
                </button>
              </div>
              {removingBg && (
                <p className="text-xs text-[var(--text-secondary)]">
                  First use may take a moment to download the model (~30 MB).
                </p>
              )}
            </div>

            {/* Category / type */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <label className="text-sm font-medium text-[var(--text)]">Item Type</label>
              <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedType(''); }} className="w-48 text-center">
                <option value="">Select category...</option>
                <option value="Tops">Tops</option>
                <option value="Bottoms">Bottoms</option>
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
              <button
                onClick={handleUpload}
                disabled={uploading || !croppedBlob || !selectedType || selectedColors.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Item'}
              </button>
              <button onClick={resetForm} className="btn-secondary">Reset</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
