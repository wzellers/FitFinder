'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

/** The browser's IANA time zone, e.g. "America/New_York". */
function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones =
      (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ??
      [];
  } catch {
    zones = [];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  return zones;
}

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Settings for the daily outfit email: on/off, the local time it arrives
 * and the time zone that time is in. The email itself is sent by
 * /api/email/send-due, which a Supabase cron job calls every 15 minutes.
 */
export default function DailyEmailSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [state, setState] = useState<LoadState>('loading');
  const [enabled, setEnabled] = useState(false);
  const [sendTime, setSendTime] = useState('07:00');
  const [timeZone, setTimeZone] = useState(detectTimeZone);
  const [hasZip, setHasZip] = useState(true);
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => timeZoneOptions(timeZone), [timeZone]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('zip_code, daily_email_enabled, daily_email_time, timezone')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // 42703: the columns don't exist until migration 017 is applied.
          setState(error.code === '42703' ? 'unavailable' : 'error');
          return;
        }
        if (data) {
          setEnabled(Boolean(data.daily_email_enabled));
          if (data.daily_email_time) setSendTime(String(data.daily_email_time).slice(0, 5));
          if (data.timezone) setTimeZone(data.timezone);
          setHasZip(Boolean(data.zip_code));
        }
        setState('ready');
      });
  }, [userId]);

  const save = async (nextEnabled = enabled) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ daily_email_enabled: nextEnabled, daily_email_time: sendTime, timezone: timeZone })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      showToast("Couldn't save your email settings. Try again.", 'error');
      return false;
    }
    showToast(nextEnabled ? 'Daily email is on.' : 'Daily email settings saved.', 'success');
    return true;
  };

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    if (!(await save(next))) setEnabled(!next);
  };

  return (
    <div className="card p-5 mb-6">
      <h3 className="text-sm font-semibold text-[var(--text)] mb-1 flex items-center gap-2">
        <Mail size={16} className="text-[var(--accent)]" aria-hidden="true" /> Daily outfit email
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Each morning: an outfit picked for the day&apos;s forecast, plus the pieces you haven&apos;t
        worn yet this week.
      </p>

      {state === 'loading' && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {state === 'unavailable' && (
        <p className="text-sm text-[var(--text-secondary)]">
          The daily email isn&apos;t available yet. Check back soon.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          Couldn&apos;t load your email settings. Refresh to try again.
        </p>
      )}

      {state === 'ready' && (
        <>
          <div className="flex items-center justify-between gap-4 mb-4">
            <span id="daily-email-toggle-label" className="text-sm font-semibold">
              Send me the daily email
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby="daily-email-toggle-label"
              onClick={toggle}
              disabled={saving}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                enabled
                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                  : 'bg-[var(--muted)] border-[var(--line-strong)]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="daily-email-time" className="text-sm font-semibold">
                Time
              </label>
              <input
                id="daily-email-time"
                type="time"
                step={900}
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="w-36 min-h-[44px]"
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1 basis-48">
              <label htmlFor="daily-email-zone" className="text-sm font-semibold">
                Time zone
              </label>
              <select
                id="daily-email-zone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="min-h-[44px] max-w-full"
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={() => save()} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] mt-3">
            Sent to {user?.email ?? 'your account email'}, within 15 minutes of the time you pick.
            Every email has an unsubscribe link.
          </p>
          {!hasZip && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Add your ZIP code under Weather so the email can dress you for the forecast.
            </p>
          )}
        </>
      )}
    </div>
  );
}
