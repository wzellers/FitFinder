'use client';

import React from 'react';
import { Lightbulb, RotateCcw } from 'lucide-react';
import SettingsCard from '@/components/ui/SettingsCard';
import { useToast } from '@/components/ToastProvider';
import { resetTips } from '@/lib/tips';

/** Settings → Effects: bring back the first-visit tips on every screen. */
export default function TipsSettings() {
  const { showToast } = useToast();
  return (
    <SettingsCard
      icon={Lightbulb}
      title="Tips"
      description="The short tips each screen shows the first time you open it."
    >
      <button
        onClick={() => {
          resetTips();
          showToast('Tips are back. Each screen shows them next time you open it.', 'success');
        }}
        className="btn-secondary"
      >
        <RotateCcw size={16} aria-hidden="true" /> Show tips again
      </button>
    </SettingsCard>
  );
}
