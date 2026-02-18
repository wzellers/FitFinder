"use client";

import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes, colorPalette } from '@/lib/constants';
import { getColorStyle } from '@/lib/colorUtils';
import type { ClothingSection } from '@/lib/types';

interface ImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onItemUploaded?: () => void;
}

export default function ImageUpload({ isOpen, onClose, onItemUploaded }: ImageUploadProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [markDirty, setMarkDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType || selectedColors.length === 0) {
      showToast('Please select a file, item type, and color', 'warning');
      return;
    }
    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, selectedFile);
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
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedCategory('');
    setSelectedType('');
    setSelectedColors([]);
    setMarkDirty(false);
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

        {/* Background removal tip */}
        <div className="bg-[var(--muted)] rounded-lg p-3 mb-5 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p className="mb-1">For best results, remove image backgrounds before uploading. Try:</p>
          <div className="flex gap-3">
            <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">remove.bg</a>
            <a href="https://pixian.ai/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">Pixian.ai</a>
          </div>
        </div>

        {/* File upload */}
        <div className="flex flex-col items-center gap-3 mb-5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload size={16} /> Choose File
          </button>
          {selectedFile && <span className="text-xs text-[var(--text-secondary)]">{selectedFile.name}</span>}
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="flex justify-center mb-5">
            <div className="w-32 h-32 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

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
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !selectedType || selectedColors.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Item'}
          </button>
          <button onClick={resetForm} className="btn-secondary">Reset</button>
        </div>
      </div>
    </div>
  );
}
