'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, CloudSun, Mail, MapPin, Shirt, Sparkles, Upload } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import ClothingImage from '@/components/ui/ClothingImage';
import SlotReel from '@/components/ui/SlotReel';
import Wordmark from '@/components/ui/Wordmark';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { colorMap, typeToSection } from '@/lib/constants';
import { describeItem } from '@/lib/itemLabels';
import { detectTimeZone } from '@/components/DailyEmailSettings';
import { pickDailyOutfit, type Outfit } from '@/lib/dailyEmail/digest';
import { toLocalDateString } from '@/lib/dates';
import {
  STARTER_PAIRINGS,
  VARIETY_TARGET,
  closetProgress,
  thresholdsFor,
  type RunsAs,
} from '@/lib/onboarding';
import type { OutfitLinkIds } from '@/lib/outfitLink';
import type { ClothingItem, ClothingSection } from '@/lib/types';

interface OnboardingProps {
  /** Called when setup is done, with the first outfit if one was spun. */
  onComplete: (firstOutfit: OutfitLinkIds | null) => void;
}

const STEPS = ['Welcome', 'Weather', 'Closet', 'Style', 'Email', 'First fit'] as const;
const SEND_TIMES = ['06:30', '07:00', '07:30', '08:00'];

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [zipCode, setZipCode] = useState('');
  const [runs, setRuns] = useState<RunsAs>('normal');
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [pairings, setPairings] = useState<number[]>([]);
  const [emailOn, setEmailOn] = useState(false);
  const [sendTime, setSendTime] = useState('07:00');

  const progress = closetProgress(items);
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const loadItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setItems(data as ClothingItem[]);
  };

  /** Run a step's save, then move on; a failed save only warns, setup carries on. */
  const saveThenNext = async (save: () => Promise<{ error: unknown } | null>, what: string) => {
    if (!user) return;
    setSaving(true);
    const result = await save();
    setSaving(false);
    if (result?.error)
      showToast(`Couldn't save your ${what}. You can set it in Settings.`, 'warning');
    next();
  };

  const saveWeather = () =>
    saveThenNext(async () => {
      const zip = zipCode.trim();
      if (zip) {
        const res = await supabase
          .from('profiles')
          .upsert({ id: user!.id, zip_code: zip }, { onConflict: 'id' });
        if (res.error) return res;
      }
      if (runs === 'normal') return null;
      return supabase
        .from('weather_preferences')
        .upsert(
          { user_id: user!.id, thresholds: thresholdsFor(runs), clothing_rules: null },
          { onConflict: 'user_id' },
        );
    }, 'weather settings');

  const saveStyle = () =>
    saveThenNext(async () => {
      if (pairings.length === 0) return null;
      return supabase.from('color_preferences').upsert(
        {
          user_id: user!.id,
          liked_combinations: pairings.map((i) => STARTER_PAIRINGS[i]),
        },
        { onConflict: 'user_id' },
      );
    }, 'colour pairings');

  const saveEmail = () =>
    saveThenNext(async () => {
      if (!emailOn) return null;
      return supabase
        .from('profiles')
        .update({
          daily_email_enabled: true,
          daily_email_time: sendTime,
          timezone: detectTimeZone(),
        })
        .eq('id', user!.id);
    }, 'email settings');

  const finish = async (outfit: Outfit | null) => {
    if (!user) return;
    // Non-blocking: if this fails, setup only reappears while the closet is empty.
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, onboarding_completed: true }, { onConflict: 'id' });
    if (error) console.warn('Could not mark onboarding complete', error);
    onComplete(
      outfit
        ? { top_id: outfit.top.id, bottom_id: outfit.bottom.id, shoes_id: outfit.shoes.id }
        : null,
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="mb-5">
        <Wordmark size="lg" />
      </div>
      <ol aria-label="Setup steps" className="flex items-center gap-1.5 mb-7">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-8 bg-[var(--accent)]'
                : i < step
                  ? 'w-2 bg-[var(--accent)] opacity-50'
                  : 'w-2 bg-[var(--line-strong)] opacity-40'
            }`}
          >
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      <div key={step} className="page-in panel px-6 sm:px-8 pt-8 pb-7 w-full max-w-lg">
        <p className="readout text-center mb-2">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>

        {/* ===== WELCOME ===== */}
        {step === 0 && (
          <div className="text-center">
            <h1 className="text-3xl font-semibold mb-1">Welcome to FitFinder</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Your closet, the weather and your taste, turned into an outfit each morning.
            </p>
            <SampleOutfit />
            <ul className="text-left space-y-3 mb-7">
              {(
                [
                  [Shirt, 'Add your clothes', 'Photos in, types and colours tagged for you.'],
                  [
                    CloudSun,
                    'Get an outfit for the day',
                    'Picked for the forecast and the occasion.',
                  ],
                  [Sparkles, 'It learns your taste', 'Rate outfits and the picks get better.'],
                ] as const
              ).map(([Icon, title, body]) => (
                <li key={title} className="flex gap-3 items-start">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={next} className="btn-primary w-full">
              Get started <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ===== WEATHER ===== */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-semibold text-center mb-1">Dress for your weather</h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
              FitFinder checks the forecast, so shorts stay home when it&apos;s cold.
            </p>
            <label htmlFor="onboarding-zip" className="text-sm font-semibold block mb-1.5">
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
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="e.g. 10001"
                className="flex-1 min-h-[44px]"
              />
            </div>
            <p id="runs-label" className="text-sm font-semibold mb-2">
              How do you usually feel?
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3" role="group" aria-labelledby="runs-label">
              {(
                [
                  ['cold', 'I run cold'],
                  ['normal', 'Just right'],
                  ['warm', 'I run warm'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRuns(key)}
                  aria-pressed={runs === key}
                  className="toggle-pill !min-h-[52px] !rounded-xl"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="readout text-center mb-6">
              {`{ layers under ${thresholdsFor(runs).cool}° · shorts over ${thresholdsFor(runs).warm}° }`}
            </p>
            <StepNav
              onBack={back}
              onNext={saveWeather}
              busy={saving}
              label={zipCode.trim() || runs !== 'normal' ? 'Continue' : 'Skip for now'}
            />
          </div>
        )}

        {/* ===== CLOSET ===== */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-semibold text-center mb-1">Build your closet</h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-5">
              Add a photo of each piece. FitFinder tags its type and colours and removes the
              background.
            </p>
            <ul className="grid grid-cols-3 gap-2 mb-4" aria-label="Closet so far">
              {(['Tops', 'Bottoms', 'Shoes'] as ClothingSection[]).map((section) => {
                const n = progress.counts[section];
                return (
                  <li
                    key={section}
                    className={`rounded-xl border p-3 text-center transition-colors ${
                      n > 0
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-dashed border-[var(--line-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 text-sm font-semibold">
                      {n > 0 && <Check size={14} aria-hidden="true" />}
                      {section}
                    </div>
                    <div className="readout mt-1">
                      {n >= VARIETY_TARGET ? `${n} · nice` : `${n} / ${VARIETY_TARGET}`}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2 justify-center mb-4 min-h-[40px]">
              {items.length === 0 ? (
                <p className="readout self-center text-center">
                  {'{ a top, a bottom and shoes make your first outfit }'}
                </p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="page-in w-16 text-center">
                    <ClothingImage
                      src={item.image_url}
                      alt={describeItem(item)}
                      className="w-16 h-16 rounded-lg bg-[var(--muted)] object-contain p-1"
                    />
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowImageUpload(true)} className="btn-primary w-full mb-2">
              <Upload size={16} aria-hidden="true" /> Add photos
            </button>
            <p className="text-xs text-[var(--text-secondary)] text-center mb-5">
              Tip: one piece per photo, laid flat or on a hanger.
            </p>
            <StepNav
              onBack={back}
              onNext={next}
              label={progress.canMakeOutfit ? 'Continue' : 'Skip for now'}
            />
          </div>
        )}

        {/* ===== STYLE ===== */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-semibold text-center mb-1">Colours you like together</h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-5">
              A head start for your first picks. FitFinder keeps learning from your ratings.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {STARTER_PAIRINGS.map(({ topColor, bottomColor }, i) => {
                const on = pairings.includes(i);
                return (
                  <button
                    key={i}
                    aria-pressed={on}
                    aria-label={`${topColor} top with ${bottomColor} bottoms`}
                    onClick={() => setPairings((p) => (on ? p.filter((x) => x !== i) : [...p, i]))}
                    className={`relative rounded-xl border-2 p-2.5 flex flex-col items-center transition-colors ${
                      on ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                    }`}
                  >
                    <span
                      className="w-11 h-6 rounded-t-md border border-black/10"
                      style={{ background: colorMap[topColor] }}
                    />
                    <span
                      className="w-11 h-6 rounded-b-md border border-t-0 border-black/10"
                      style={{ background: colorMap[bottomColor] }}
                    />
                    {on && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center">
                        <Check size={12} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <StepNav
              onBack={back}
              onNext={saveStyle}
              busy={saving}
              label={pairings.length ? 'Continue' : 'Skip for now'}
            />
          </div>
        )}

        {/* ===== EMAIL ===== */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-semibold text-center mb-1">Your outfit, every morning</h2>
            <p className="text-sm text-[var(--text-secondary)] text-center mb-5">
              One email a day with an outfit for the forecast. Turn it off any time.
            </p>
            <button
              role="switch"
              aria-checked={emailOn}
              onClick={() => setEmailOn((v) => !v)}
              className="w-full flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 mb-4"
            >
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Mail size={16} aria-hidden="true" /> Daily outfit email
              </span>
              <span
                aria-hidden="true"
                className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                  emailOn ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    emailOn ? 'translate-x-5' : ''
                  }`}
                />
              </span>
            </button>
            {emailOn && (
              <>
                <p id="send-time-label" className="text-sm font-semibold mb-2">
                  Send it at
                </p>
                <div
                  className="flex flex-wrap gap-2 mb-6"
                  role="group"
                  aria-labelledby="send-time-label"
                >
                  {SEND_TIMES.map((t) => (
                    <button
                      key={t}
                      aria-pressed={sendTime === t}
                      onClick={() => setSendTime(t)}
                      className="toggle-pill"
                    >
                      {formatTime(t)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <StepNav
              onBack={back}
              onNext={saveEmail}
              busy={saving}
              label={emailOn ? 'Continue' : 'Not now'}
            />
          </div>
        )}

        {/* ===== FIRST FIT ===== */}
        {step === 5 && (
          <FirstFit
            items={items}
            likedCombinations={pairings.map((i) => STARTER_PAIRINGS[i])}
            onBack={back}
            onFinish={finish}
          />
        )}
      </div>

      <ImageUpload
        isOpen={showImageUpload}
        onClose={() => setShowImageUpload(false)}
        onItemsAdded={() => void loadItems()}
      />
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  label,
  busy = false,
}: {
  onBack: () => void;
  onNext: () => void;
  label: string;
  busy?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button onClick={onBack} className="btn-ghost">
        Back
      </button>
      <button onClick={onNext} disabled={busy} className="btn-primary flex-1">
        {label} <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/** A top, bottom and shoes drawn in colours that change now and then. */
const SAMPLE_COLORS = [
  ['white', 'denim', 'white'],
  ['dark green', 'beige', 'brown'],
  ['navy blue', 'gray', 'black'],
  ['red', 'denim', 'white'],
];

function SampleOutfit() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SAMPLE_COLORS.length), 2400);
    return () => clearInterval(t);
  }, []);
  const [top, bottom, shoes] = SAMPLE_COLORS[i].map((c) => colorMap[c]);
  const shape = {
    fill: 'currentColor',
    stroke: 'rgba(0,0,0,.28)',
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
  };
  const tile = 'w-20 h-20 rounded-xl bg-white border border-[var(--border)] p-2';
  const tint = 'transition-colors duration-700';
  return (
    <div className="flex justify-center gap-3 mb-6" aria-hidden="true">
      <svg viewBox="0 0 100 100" className={`${tile} ${tint}`} style={{ color: top }}>
        <path
          d="M30 18 L42 12 Q50 19 58 12 L70 18 L87 33 L77 43 L70 38 L70 88 L30 88 L30 38 L23 43 L13 33 Z"
          {...shape}
        />
      </svg>
      <svg viewBox="0 0 100 100" className={`${tile} ${tint}`} style={{ color: bottom }}>
        <path d="M29 9 L71 9 L75 91 L56 91 L50 37 L44 91 L25 91 Z" {...shape} />
      </svg>
      <svg viewBox="0 0 100 100" className={`${tile} ${tint}`} style={{ color: shoes }}>
        <path d="M8 64 Q9 44 24 43 L38 45 Q50 54 66 56 L86 60 Q93 64 91 72 L9 72 Z" {...shape} />
        <rect x="9" y="70" width="83" height="8" rx="3" fill="#f4f4f0" stroke="rgba(0,0,0,.25)" />
      </svg>
    </div>
  );
}

function FirstFit({
  items,
  likedCombinations,
  onBack,
  onFinish,
}: {
  items: ClothingItem[];
  likedCombinations: { topColor: string; bottomColor: string }[];
  onBack: () => void;
  onFinish: (outfit: Outfit | null) => void;
}) {
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [finishing, setFinishing] = useState(false);
  const canMake = closetProgress(items).canMakeOutfit;
  const done = (o: Outfit | null) => {
    setFinishing(true);
    onFinish(o);
  };

  if (!canMake) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center mx-auto mb-4">
          <Check size={32} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">You&apos;re all set</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Add a top, a bottom and a pair of shoes in your Closet, then open Outfits for your first
          look.
        </p>
        <button onClick={() => done(null)} disabled={finishing} className="btn-primary w-full">
          Go to my closet
        </button>
      </div>
    );
  }

  const spin = () =>
    setOutfit(
      pickDailyOutfit(
        {
          items,
          recentWears: [],
          ratedOutfits: [],
          likedCombinations,
          model: null,
          forecast: null,
          today: toLocalDateString(new Date()),
        },
        null,
      ),
    );

  const sectionOf = { top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes' } as const;
  return (
    <div className="text-center">
      <h2 className="text-2xl font-semibold mb-1">
        {outfit ? 'Your first fit' : 'Ready for your first outfit?'}
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {outfit
          ? 'Rate outfits as you go and FitFinder learns what you like.'
          : `${items.length} pieces in your closet. Let's put them together.`}
      </p>
      <ul className="flex flex-col items-center gap-2 mb-6" aria-label="First outfit">
        {(['top', 'bottom', 'shoes'] as const).map((slot) => (
          <li
            key={slot}
            className={`w-28 h-28 rounded-xl overflow-hidden flex items-center justify-center ${
              outfit
                ? 'bg-white border border-[var(--border)]'
                : 'border-2 border-dashed border-[var(--line-strong)]'
            }`}
          >
            {outfit ? (
              <>
                <SlotReel
                  item={outfit[slot]}
                  pool={items.filter((i) => typeToSection[i.type] === sectionOf[slot])}
                  spinKey={1}
                  spinOnMount
                />
                <span className="sr-only">{describeItem(outfit[slot])}</span>
              </>
            ) : (
              <span className="readout">{slot}</span>
            )}
          </li>
        ))}
      </ul>
      {outfit ? (
        <button onClick={() => done(outfit)} disabled={finishing} className="btn-primary w-full">
          See it in Outfits <ChevronRight size={16} aria-hidden="true" />
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={onBack} className="btn-ghost">
            Back
          </button>
          <button onClick={spin} className="btn-primary flex-1 min-h-[52px] text-base">
            <Sparkles size={18} aria-hidden="true" /> Spin my first outfit
          </button>
        </div>
      )}
    </div>
  );
}
