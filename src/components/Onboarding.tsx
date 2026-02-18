"use client";

import React, { useState, useRef } from 'react';
import { MapPin, Upload, Palette, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { clothingTypes, colorPalette } from '@/lib/constants';
import { getColorStyle } from '@/lib/colorUtils';
import type { ClothingSection } from '@/lib/types';

interface OnboardingProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'upload' | 'preferences';

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('welcome');

  // Welcome step
  const [zipCode, setZipCode] = useState('');

  // Upload step
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadItem = async () => {
    if (!selectedFile || !selectedType || selectedColors.length === 0 || !user) return;
    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('clothing-images').upload(fileName, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('clothing-images').getPublicUrl(fileName);
      const { error } = await supabase.from('clothing_items').insert([
        { user_id: user.id, type: selectedType, colors: selectedColors, image_url: urlData.publicUrl, is_dirty: false },
      ]).select();
      if (error) throw error;

      setUploadedCount((c) => c + 1);
      showToast('Item added!', 'success');
      resetUploadForm();
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedCategory('');
    setSelectedType('');
    setSelectedColors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveZipCode = async () => {
    if (!user || !zipCode.trim()) return;
    try {
      await supabase.from('profiles').upsert({ id: user.id, zip_code: zipCode.trim() }, { onConflict: 'id' });
    } catch {
      // non-critical
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').upsert({ id: user.id, onboarding_completed: true }, { onConflict: 'id' });
    } catch {
      // non-critical
    }
    onComplete();
  };

  const steps: { key: Step; label: string; icon: React.ElementType }[] = [
    { key: 'welcome', label: 'Welcome', icon: MapPin },
    { key: 'upload', label: 'Add Items', icon: Upload },
    { key: 'preferences', label: 'Finish', icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-4 py-12">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map(({ key, label, icon: Icon }, idx) => (
          <React.Fragment key={key}>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              step === key
                ? 'bg-[var(--accent)] text-white'
                : steps.findIndex((s) => s.key === step) > idx
                  ? 'bg-green-100 text-green-700'
                  : 'bg-[var(--muted)] text-[var(--text-secondary)]'
            }`}>
              {steps.findIndex((s) => s.key === step) > idx ? <Check size={12} /> : <Icon size={12} />}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {idx < steps.length - 1 && <ChevronRight size={14} className="text-[var(--text-secondary)]" />}
          </React.Fragment>
        ))}
      </div>

      <div className="card p-8 w-full max-w-md">
        {/* ===== WELCOME STEP ===== */}
        {step === 'welcome' && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
              Welcome to Fit<span className="text-[var(--accent)]">Finder</span>
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Let&apos;s set up your wardrobe. First, enter your zip code to enable weather-aware outfit suggestions.
            </p>

            <div className="flex items-center gap-2 mb-6">
              <MapPin size={16} className="text-[var(--accent)]" />
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Zip code (optional)"
                maxLength={10}
                className="flex-1"
              />
            </div>

            <button
              onClick={async () => {
                if (zipCode.trim()) await handleSaveZipCode();
                setStep('upload');
              }}
              className="btn-primary w-full"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ===== UPLOAD STEP ===== */}
        {step === 'upload' && (
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-1 text-center">Add Your First Items</h2>
            <p className="text-xs text-[var(--text-secondary)] text-center mb-5">
              Upload photos of your clothing. You can always add more later.
              {uploadedCount > 0 && (
                <span className="block mt-1 text-green-600 font-medium">{uploadedCount} item{uploadedCount > 1 ? 's' : ''} added</span>
              )}
            </p>

            {/* File upload */}
            <div className="flex flex-col items-center gap-3 mb-4">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                <Upload size={16} /> Choose Photo
              </button>
              {selectedFile && <span className="text-xs text-[var(--text-secondary)]">{selectedFile.name}</span>}
            </div>

            {/* Preview */}
            {previewUrl && (
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                </div>
              </div>
            )}

            {/* Category / type */}
            <div className="flex flex-col items-center gap-2 mb-4">
              <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedType(''); }} className="w-48 text-center text-sm">
                <option value="">Select category...</option>
                <option value="Tops">Tops</option>
                <option value="Bottoms">Bottoms</option>
                <option value="Outerwear">Outerwear</option>
                <option value="Shoes">Shoes</option>
              </select>
              {selectedCategory && (
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-48 text-center text-sm">
                  <option value="">Select type...</option>
                  {clothingTypes[selectedCategory as ClothingSection]?.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Color selection */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--text)] block text-center mb-2">Select main color</label>
              <div className="grid grid-cols-6 gap-1.5 justify-center mx-auto w-fit">
                {colorPalette.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColors([color])}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      selectedColors.includes(color)
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] scale-110'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Upload button */}
            <button
              onClick={handleUploadItem}
              disabled={uploading || !selectedFile || !selectedType || selectedColors.length === 0}
              className="btn-primary w-full mb-3 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Add Item'}
            </button>

            <button
              onClick={() => setStep('preferences')}
              className="btn-secondary w-full"
            >
              {uploadedCount > 0 ? 'Continue' : 'Skip for Now'} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ===== FINISH STEP ===== */}
        {step === 'preferences' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <Check size={32} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-2">You&apos;re All Set!</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              {uploadedCount > 0
                ? `You've added ${uploadedCount} item${uploadedCount > 1 ? 's' : ''}. Nice start!`
                : 'You can add items from the Closet tab anytime.'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Head to Preferences to set your color combinations, then try the Generator to create outfits.
            </p>

            <button onClick={handleFinish} className="btn-primary w-full">
              Get Started
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
