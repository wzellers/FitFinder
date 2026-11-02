'use client';

import SettingsCard from '@/components/ui/SettingsCard';
import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

type Setting = 'weather_effects' | 'seasonal_themes';

const SWITCHES: { key: Setting; label: string; hint: string }[] = [
  {
    key: 'weather_effects',
    label: 'Weather effects',
    hint: "Today's sky on the Outfits screen: sun, clouds, rain, snow and storms.",
  },
  {
    key: 'seasonal_themes',
    label: 'Seasonal themes',
    hint: 'Decorations for the season and holidays, like falling leaves or Christmas lights.',
  },
];

/**
 * Settings → Effects: turn the Outfits screen's animated weather and
 * seasonal themes on or off. Saved to the profile, so they follow the user
 * to every device; both start on.
 */
export default function EffectsSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<Setting, boolean>>({
    weather_effects: true,
    seasonal_themes: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<Setting | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setValues({
          weather_effects: data?.weather_effects !== false,
          seasonal_themes: data?.seasonal_themes !== false,
        });
        setLoaded(true);
      });
  }, [userId]);

  const toggle = async (key: Setting) => {
    if (!user) return;
    const next = !values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setSaving(key);
    const { error } = await supabase
      .from('profiles')
      .update({ [key]: next })
      .eq('id', user.id);
    setSaving(null);
    if (error) {
      setValues((v) => ({ ...v, [key]: !next }));
      showToast("Couldn't save that setting. Try again.", 'error');
    }
  };

  return (
    <SettingsCard
      icon={Sparkles}
      title="Weather & seasonal effects"
      description="The animations on the Outfits screen. Turn off either one if you'd rather keep it plain."
    >
      <div className="flex flex-col gap-4">
        {SWITCHES.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span id={`${key}-label`} className="text-sm font-semibold">
                {label}
              </span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values[key]}
              aria-labelledby={`${key}-label`}
              onClick={() => toggle(key)}
              disabled={!loaded || saving === key}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                values[key]
                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                  : 'bg-[var(--muted)] border-[var(--line-strong)]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                  values[key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
