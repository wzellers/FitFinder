'use client';

import React, { useState } from 'react';
import { MapPin, Upload, Palette, ChevronRight, Check } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import Wordmark from '@/components/ui/Wordmark';

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
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, zip_code: zipCode.trim() }, { onConflict: 'id' });
    if (error)
      showToast("Couldn't save your ZIP code. You can add it later in Settings.", 'warning');
  };

  const handleFinish = async () => {
    if (!user) return;
    // Non-blocking: if this fails, onboarding only reappears while the closet is empty.
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, onboarding_completed: true }, { onConflict: 'id' });
    if (error) console.warn('Could not mark onboarding complete', error);
    onComplete();
  };

  const steps: { key: Step; label: string; icon: React.ElementType }[] = [
    { key: 'welcome', label: 'Welcome', icon: MapPin },
    { key: 'upload', label: 'Add items', icon: Upload },
    { key: 'preferences', label: 'Finish', icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-4 py-12">
      {/* Progress indicator */}
      <div className="mb-6">
        <Wordmark size="lg" />
      </div>
      <ol aria-label="Setup steps" className="flex items-center gap-2 mb-8">
        {steps.map(({ key, label, icon: Icon }, idx) => (
          <React.Fragment key={key}>
            <li
              aria-current={step === key ? 'step' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                step === key
                  ? 'bg-[var(--accent)] text-white'
                  : steps.findIndex((s) => s.key === step) > idx
                    ? 'bg-[#e6f2ec] text-[var(--success)]'
                    : 'bg-[var(--muted)] text-[var(--text-secondary)]'
              }`}
            >
              {steps.findIndex((s) => s.key === step) > idx ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Icon size={14} aria-hidden="true" />
              )}
              <span className="sr-only sm:not-sr-only">{label}</span>
            </li>
            {idx < steps.length - 1 && (
              <ChevronRight size={14} aria-hidden="true" className="text-[var(--text-secondary)]" />
            )}
          </React.Fragment>
        ))}
      </ol>

      <div className="panel px-8 pt-10 pb-9 w-full max-w-md">
        {/* ===== WELCOME STEP ===== */}
        {step === 'welcome' && (
          <div className="text-center">
            <h1 className="text-3xl mb-2">Welcome to FitFinder</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Add your ZIP code and FitFinder will pick outfits for the day&apos;s weather.
            </p>

            <label
              htmlFor="onboarding-zip"
              className="text-sm font-semibold block text-left mb-1.5"
            >
              US ZIP code{' '}
              <span className="font-normal text-[var(--text-secondary)]">(optional)</span>
            </label>
            <div className="flex items-center gap-2 mb-6">
              <MapPin size={16} aria-hidden="true" className="text-[var(--carbon)]" />
              <input
                id="onboarding-zip"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 10001"
                maxLength={5}
                className="flex-1 min-h-[44px]"
              />
            </div>

            <button
              onClick={async () => {
                if (zipCode.trim()) await handleSaveZipCode();
                setStep('upload');
              }}
              className="btn-primary w-full"
            >
              Continue <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ===== UPLOAD STEP ===== */}
        {step === 'upload' && (
          <div>
            <h2 className="text-2xl mb-1 text-center">Add your first items</h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-5">
              Add photos of clothes you wear. FitFinder tags the type and colors for you, and you
              can add more any time.
              {uploadedCount > 0 && (
                <span className="block mt-1 text-[var(--success)] font-medium">
                  {uploadedCount} item{uploadedCount > 1 ? 's' : ''} added
                </span>
              )}
            </p>

            <div className="flex flex-col items-center gap-3 mb-4">
              <button onClick={() => setShowImageUpload(true)} className="btn-primary">
                <Upload size={16} aria-hidden="true" /> Add photos
              </button>
            </div>

            <button onClick={() => setStep('preferences')} className="btn-secondary w-full">
              {uploadedCount > 0 ? 'Continue' : 'Skip for now'}{' '}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ===== FINISH STEP ===== */}
        {step === 'preferences' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#e6f2ec] text-[var(--success)] flex items-center justify-center mx-auto mb-4">
              <Check size={32} aria-hidden="true" />
            </div>
            <h2 className="text-2xl mb-2">You&apos;re all set</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              {uploadedCount > 0
                ? `You've added ${uploadedCount} item${uploadedCount > 1 ? 's' : ''}. Nice start!`
                : 'You can add items from the Closet any time.'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Open Outfits to generate your first look, or tune colors and weather in Settings.
            </p>

            <button onClick={handleFinish} className="btn-primary w-full">
              Go to my closet
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
