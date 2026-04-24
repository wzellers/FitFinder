"use client";

import React, { useState } from 'react';
import { MapPin, Upload, Palette, ChevronRight, Check } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

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
  const [uploadedCount, setUploadedCount] = useState(0);
  const [showImageUpload, setShowImageUpload] = useState(false);

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

            <div className="flex flex-col items-center gap-3 mb-4">
              <button onClick={() => setShowImageUpload(true)} className="btn-primary">
                <Upload size={16} /> Add Clothing Item
              </button>
            </div>

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

      <ImageUpload
        isOpen={showImageUpload}
        onClose={() => setShowImageUpload(false)}
        onItemUploaded={() => setUploadedCount((c) => c + 1)}
      />
    </div>
  );
}
