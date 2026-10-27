'use client';

import Modal from '@/components/ui/Modal';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  Sparkles,
  Save,
  CloudSun,
  CalendarPlus,
  CloudOff,
  X,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { getClothingImageUrl } from '@/lib/clothingImages';
import { renderShareCard, shareOrDownload } from '@/lib/shareCard';
import { NEUTRAL_INK, themeFromOutfit } from '@/lib/outfitTheme';
import { describeItem } from '@/lib/itemLabels';
import { useAuth } from '@/hooks/useAuth';
import ClothingImage from '@/components/ui/ClothingImage';
import PosterHeader from '@/components/ui/PosterHeader';
import ScrambleText from '@/components/ui/ScrambleText';
import { useOutfitTheme } from '@/components/OutfitTheme';
import { getColorName, getColorStyle } from '@/lib/colorUtils';
import SlotReel, { type ReelDirection } from '@/components/ui/SlotReel';
import SwipeArea, { type SwipeDirection } from '@/components/ui/SwipeArea';
import WornStamp from '@/components/ui/WornStamp';
import WeatherBackdrop from '@/components/ui/WeatherBackdrop';
import { weatherScene } from '@/lib/weatherScene';
import { supabase } from '@/lib/supabaseClient';
import { isUniqueViolation, throwIfAnyError } from '@/lib/supabaseResult';
import { toLocalDateString } from '@/lib/dates';
import { useToast } from '@/components/ToastProvider';
import { colorMap, typeToSection } from '@/lib/constants';
import {
  fetchWeather,
  getTemperatureCategory,
  getWeatherIconUrl,
  TEMPERATURE_THRESHOLDS,
} from '@/lib/weatherApi';
import { buildCandidates, featureVector, sampleItemRatings } from '@/lib/outfitScoring';
import type { OccasionRules } from '@/lib/outfitScoring';
import { occasions } from '@/lib/constants';
import type { Occasion } from '@/lib/constants';
import {
  deserializeModel,
  serializeModel,
  learnFromSkip,
  selectOutfits,
  updateWeights,
  SAVED_OUTFIT_REWARD,
  type BanditModel,
  type FeatureVector,
} from '@/lib/banditModel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RatingPicker from '@/components/ui/RatingPicker';
import { SkeletonOutfitSlots } from '@/components/ui/Skeleton';
import type {
  ClothingItem,
  ColorCombination,
  SavedOutfit,
  UserWeatherPreferences,
  OutfitWear,
} from '@/lib/types';
import type { WeatherData, TemperatureCategory } from '@/lib/weatherApi';
import { loadRatedOutfits } from '@/lib/ratedOutfits';
import { rateOutfitWithoutWearing } from '@/lib/outfitLearning';
import { logImpression, recordOutcome, type ImpressionOutcome } from '@/lib/impressions';

type Slot = 'top' | 'bottom' | 'shoes';
const SLOTS: Slot[] = ['top', 'bottom', 'shoes'];
const SLOT_LABEL: Record<Slot, string> = { top: 'top', bottom: 'bottom', shoes: 'pair of shoes' };

interface OutfitGeneratorProps {
  onNavigateToCalendar?: () => void;
  /** Changes when closet items change, so the generator reloads its data. */
  refreshKey?: number;
  /** Whether the Outfits tab is showing. The generator stays mounted while
   * hidden, so coming back re-reads settings that may have changed (ZIP code,
   * weather and occasion preferences). */
  active?: boolean;
}

export default function OutfitGenerator({
  onNavigateToCalendar,
  refreshKey = 0,
  active = true,
}: OutfitGeneratorProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Data
  // Every item, including dirty ones (needed to show saved outfits); only clean
  // items are used to generate outfits.
  const [allItems, setAllItems] = useState<ClothingItem[]>([]);
  const items = useMemo(() => allItems.filter((i) => !i.is_dirty), [allItems]);
  const [liked, setLiked] = useState<ColorCombination[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [recentWears, setRecentWears] = useState<OutfitWear[]>([]);
  const [ratedOutfits, setRatedOutfits] = useState<OutfitWear[]>([]);
  const [model, setModel] = useState<BanditModel | null>(null);

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // The ZIP code the weather is for (null: none saved).
  const [zip, setZip] = useState<string | null>(null);
  const [tempCategory, setTempCategory] = useState<TemperatureCategory | null>(null);
  const [ignoreWeather, setIgnoreWeather] = useState(false);
  const [userWeatherPrefs, setUserWeatherPrefs] = useState<UserWeatherPreferences | null>(null);

  // Occasion — null means "Any" (no occasion filter).
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [userOccasionRules, setUserOccasionRules] = useState<OccasionRules | null>(null);

  // Current outfit display
  const [top, setTop] = useState<ClothingItem | null>(null);
  const [bottom, setBottom] = useState<ClothingItem | null>(null);
  const [shoes, setShoes] = useState<ClothingItem | null>(null);

  // Locks
  const [lockedTop, setLockedTop] = useState(false);
  const [lockedBottom, setLockedBottom] = useState(false);
  const [lockedShoes, setLockedShoes] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'generator' | 'saved'>('generator');

  // Item picker modal
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null);

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveName, setPendingSaveName] = useState('');

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Recent wears for the variety feature: last RECENCY_WINDOW_DAYS days.
        const recencyCutoff = toLocalDateString(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

        const [
          { data: itemsData },
          { data: prefsData },
          { data: outfitsData },
          { data: profileData },
          { data: weatherPrefsData },
          { data: recentWearsData },
          { data: ratedOutfitsData },
          { data: modelData },
          { data: occPrefsData },
        ] = throwIfAnyError(
          await Promise.all([
            supabase.from('clothing_items').select('*').eq('user_id', user.id),
            supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
            supabase
              .from('saved_outfits')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
            supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
            supabase.from('weather_preferences').select('*').eq('user_id', user.id).maybeSingle(),
            supabase
              .from('outfit_wears')
              .select('*')
              .eq('user_id', user.id)
              .gte('worn_date', recencyCutoff),
            // Worn and browsing ratings, for the rating feature.
            loadRatedOutfits(supabase, user.id).then((data) => ({ data, error: null })),
            supabase
              .from('outfit_model_weights')
              .select('weights, feature_meta')
              .eq('user_id', user.id)
              .maybeSingle(),
            supabase
              .from('occasion_preferences')
              .select('rules')
              .eq('user_id', user.id)
              .maybeSingle(),
          ]),
        );

        setAllItems(itemsData || []);
        setLiked((prefsData?.liked_combinations ?? []) as ColorCombination[]);
        setSavedOutfits(outfitsData || []);
        setRecentWears((recentWearsData ?? []) as OutfitWear[]);
        setRatedOutfits((ratedOutfitsData ?? []) as OutfitWear[]);
        setModel(deserializeModel(modelData));
        setUserOccasionRules((occPrefsData?.rules ?? null) as OccasionRules | null);

        const userWP: UserWeatherPreferences | null = weatherPrefsData
          ? {
              thresholds: weatherPrefsData.thresholds ?? {
                cold: TEMPERATURE_THRESHOLDS.COLD,
                cool: TEMPERATURE_THRESHOLDS.COOL,
                warm: TEMPERATURE_THRESHOLDS.WARM,
              },
              clothingRules: weatherPrefsData.clothing_rules ?? null,
            }
          : null;
        setUserWeatherPrefs(userWP);

        await loadWeather(profileData?.zip_code ?? null, userWP);
      } catch {
        setError("Couldn't load your closet. Refresh to try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user, refreshKey]);

  /** Fetch the weather for `zipCode` (or clear it when there's none). */
  const loadWeather = async (zipCode: string | null, prefs: UserWeatherPreferences | null) => {
    setZip(zipCode);
    if (!zipCode) {
      setWeather(null);
      return;
    }
    setWeatherLoading(true);
    try {
      const wd = await fetchWeather(zipCode);
      setWeather(wd);
      if (wd) setTempCategory(getTemperatureCategory(wd.highTemperature, prefs?.thresholds));
    } finally {
      setWeatherLoading(false);
    }
  };

  // Back on the tab: pick up settings changed meanwhile (a new ZIP code,
  // weather or occasion preferences) without reloading the closet.
  const wasActive = useRef(active);
  useEffect(() => {
    const returned = active && !wasActive.current;
    wasActive.current = active;
    if (!returned || !user) return;
    (async () => {
      try {
        const [{ data: profileData }, { data: weatherPrefsData }, { data: occPrefsData }] =
          throwIfAnyError(
            await Promise.all([
              supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
              supabase.from('weather_preferences').select('*').eq('user_id', user.id).maybeSingle(),
              supabase
                .from('occasion_preferences')
                .select('rules')
                .eq('user_id', user.id)
                .maybeSingle(),
            ]),
          );
        const userWP: UserWeatherPreferences | null = weatherPrefsData
          ? {
              thresholds: weatherPrefsData.thresholds ?? {
                cold: TEMPERATURE_THRESHOLDS.COLD,
                cool: TEMPERATURE_THRESHOLDS.COOL,
                warm: TEMPERATURE_THRESHOLDS.WARM,
              },
              clothingRules: weatherPrefsData.clothing_rules ?? null,
            }
          : null;
        setUserWeatherPrefs(userWP);
        setUserOccasionRules((occPrefsData?.rules ?? null) as OccasionRules | null);
        const nextZip = profileData?.zip_code ?? null;
        if (nextZip !== zip || (nextZip && !weather)) await loadWeather(nextZip, userWP);
        else if (weather) {
          setTempCategory(getTemperatureCategory(weather.highTemperature, userWP?.thresholds));
        }
      } catch {
        // Keep what's on screen; the next visit tries again.
      }
    })();
    // Runs when the tab is shown again; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Generate outfit — featurize candidates, then let the bandit select via
  // ε-greedy (explore/exploit) using the user's learned weights. Locked slots
  // constrain the candidate pool to the frozen item before scoring.
  // Bumped per slot on each generate so its reel spins (kept slots don't).
  const [spins, setSpins] = useState({ top: 0, bottom: 0, shoes: 0 });
  const lastSpinAt = useRef(0);
  const reelDuration = { top: 1100, bottom: 1500, shoes: 1900 } as const;
  // A full spin travels down; swapping one piece slides it the way the user
  // pointed (arrow or swipe), and is quicker.
  const [directions, setDirections] = useState<Record<Slot, ReelDirection>>({
    top: 'down',
    bottom: 'down',
    shoes: 'down',
  });
  const SWAP_DURATION = 1100;
  const sectionFor = { top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes' } as const;

  // Outfits shown since the generator opened, so "Try another" and rating move
  // on to ones not seen yet (until every outfit has been shown).
  const shownOutfits = useRef(new Set<string>());
  const outfitKey = (o: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem }) =>
    `${o.top.id}|${o.bottom.id}|${o.shoes.id}`;

  // The outfit the generator picked and its logged impression, until the user
  // acts on it (skips, saves, wears or rates it). Changing a piece makes it a
  // different outfit, so "Try another" then isn't a skip.
  const shownPick = useRef<{ key: string; impression: Promise<string | null> } | null>(null);
  const isShownPick = () =>
    !!top && !!bottom && !!shoes && shownPick.current?.key === outfitKey({ top, bottom, shoes });
  /** Record what the user did with the generator's pick, if it's on screen. */
  const settleShownPick = (outcome: ImpressionOutcome, rating?: number) => {
    if (shownPick.current && isShownPick()) {
      void recordOutcome(shownPick.current.impression, outcome, rating);
    }
    shownPick.current = null;
  };

  // `latest` lets a caller that just updated the model or ratings use them
  // before React state catches up (e.g. right after rating an outfit).
  // `swap` changes only that piece, keeping the other two, and slides the new
  // one in from `direction`.
  // The outfits that can be shown next, or why there are none.
  const outfitCandidates = (rated: OutfitWear[], swapSlot?: Slot) => {
    let candidates = buildCandidates(items, {
      likedCombinations: liked,
      weather: ignoreWeather ? null : tempCategory,
      weatherRules: userWeatherPrefs?.clothingRules ?? undefined,
      recentWears,
      ratedOutfits: rated,
      occasion,
      occasionRules: userOccasionRules ?? undefined,
      // A fresh guess at each item's rating, so pieces you haven't rated yet
      // get their turn alongside the ones you have.
      itemRating: sampleItemRatings(rated),
    });

    // Respect locked slots: only consider candidates that keep the frozen items.
    if (lockedTop && top) candidates = candidates.filter((c) => c.top.id === top.id);
    if (lockedBottom && bottom) candidates = candidates.filter((c) => c.bottom.id === bottom.id);
    if (lockedShoes && shoes) candidates = candidates.filter((c) => c.shoes.id === shoes.id);
    if (swapSlot && top && bottom && shoes) {
      const current = { top, bottom, shoes };
      candidates = candidates.filter((c) =>
        SLOTS.every((s) =>
          s === swapSlot ? c[s].id !== current[s].id : c[s].id === current[s].id,
        ),
      );
      if (candidates.length === 0) {
        return {
          candidates,
          error: `No other ${SLOT_LABEL[swapSlot]} goes with the rest of this outfit right now.`,
        };
      }
    }
    if (candidates.length === 0) {
      return {
        candidates,
        error: occasion
          ? `Nothing clean in your closet suits ${occasion.toLowerCase()} right now. Try another occasion, or change what fits in Settings.`
          : 'No outfit fits right now. You need at least one clean top, bottom and pair of shoes that suit the weather.',
      };
    }
    return { candidates, error: null };
  };

  const pickOutfit = (
    latest: { model?: BanditModel; ratedOutfits?: OutfitWear[] } = {},
    swap?: { slot: Slot; direction: SwipeDirection },
  ) => {
    setError('');
    const rated = latest.ratedOutfits ?? ratedOutfits;
    const found = outfitCandidates(rated, swap?.slot);
    if (found.error) {
      setError(found.error);
      return;
    }
    let { candidates } = found;

    // Skip outfits already shown (and the one on screen), starting over once
    // they all have been.
    const current = top && bottom && shoes ? outfitKey({ top, bottom, shoes }) : null;
    let unseen = candidates.filter((c) => !shownOutfits.current.has(outfitKey(c)));
    if (unseen.length === 0) {
      shownOutfits.current.clear();
      unseen = candidates.filter((c) => outfitKey(c) !== current);
    }
    if (unseen.length > 0) candidates = unseen;

    // Thompson sampling: each call samples the user's weights afresh, so its top
    // pick is the outfit to show and repeated clicks still vary.
    const shownModel = latest.model ?? model ?? deserializeModel(null);
    const [{ candidate: pick, score }] = selectOutfits(
      candidates.map((c) => ({ candidate: c, features: c.features })),
      shownModel,
      { count: 1 },
    );
    shownOutfits.current.add(outfitKey(pick));
    if (current) shownOutfits.current.add(current);
    shownPick.current = {
      key: outfitKey(pick),
      impression: user
        ? logImpression(user.id, pick, score, shownModel.meta.updates)
        : Promise.resolve(null),
    };
    const spinning = {
      top: swap ? swap.slot === 'top' : !lockedTop,
      bottom: swap ? swap.slot === 'bottom' : !lockedBottom,
      shoes: swap ? swap.slot === 'shoes' : !lockedShoes,
    };
    if (spinning.top) setTop(pick.top);
    if (spinning.bottom) setBottom(pick.bottom);
    if (spinning.shoes) setShoes(pick.shoes);
    lastSpinAt.current = Date.now();
    setDirections({
      top: 'down',
      bottom: 'down',
      shoes: 'down',
      ...(swap ? { [swap.slot]: swap.direction } : {}),
    });
    setSpins((prev) => ({
      top: spinning.top ? prev.top + 1 : prev.top,
      bottom: spinning.bottom ? prev.bottom + 1 : prev.bottom,
      shoes: spinning.shoes ? prev.shoes + 1 : prev.shoes,
    }));
  };

  // The outfit's features today (liked colors, wear and rating history).
  const currentFeatures = (outfit: {
    top: ClothingItem;
    bottom: ClothingItem;
    shoes: ClothingItem;
  }): FeatureVector =>
    featureVector(outfit, { likedCombinations: liked, recentWears, ratedOutfits });

  // Apply an online learning update for a given outfit + reward, then persist the
  // new weights.
  const applyReward = (
    outfit: {
      top: ClothingItem;
      bottom: ClothingItem;
      shoes: ClothingItem;
    },
    reward: number,
  ) => learnAndSave(outfit, (m, features) => updateWeights(m, features, reward));

  // Learn from the outfit, save the model, and return it.
  const learnAndSave = async (
    outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
    learn: (m: BanditModel, features: FeatureVector) => BanditModel,
  ): Promise<BanditModel | undefined> => {
    if (!user) return;
    const updated = learn(model ?? deserializeModel(null), currentFeatures(outfit));
    setModel(updated);
    const serialized = serializeModel(updated);
    const { error: weightsError } = await supabase.from('outfit_model_weights').upsert({
      user_id: user.id,
      weights: serialized.weights,
      feature_meta: serialized.feature_meta,
      updated_at: new Date().toISOString(),
    });
    // Learning is best-effort; the in-memory model still updated.
    if (weightsError) console.warn('Could not save outfit model', weightsError);
    return updated;
  };

  // "Try another": passing on the generator's pick is a weak "not this one".
  const tryAnother = () => {
    if (top && bottom && shoes && isShownPick()) {
      settleShownPick('skipped');
      const updated = learnFromSkipAndSave({ top, bottom, shoes });
      pickOutfit({ model: updated });
      return;
    }
    pickOutfit();
  };
  // Swapping one piece (arrow or swipe) passes on the outfit as shown, so it is
  // learned like "Try another"; then only that piece changes.
  const swapPiece = (slot: Slot, direction: SwipeDirection) => {
    if (!top || !bottom || !shoes) return;
    // Nothing to swap in: say so without counting it as a pass.
    const { error: none } = outfitCandidates(ratedOutfits, slot);
    if (none) {
      setError(none);
      return;
    }
    let updated: BanditModel | undefined;
    if (isShownPick()) {
      settleShownPick('skipped');
      updated = learnFromSkipAndSave({ top, bottom, shoes });
    }
    pickOutfit({ model: updated }, { slot, direction });
  };
  const learnFromSkipAndSave = (outfit: {
    top: ClothingItem;
    bottom: ClothingItem;
    shoes: ClothingItem;
  }) => {
    const updated = learnFromSkip(model ?? deserializeModel(null), currentFeatures(outfit));
    void learnAndSave(outfit, () => updated);
    return updated;
  };

  // Save outfit with name
  const openSaveModal = () => {
    if (!top || !bottom || !shoes || !user) {
      setError('Pick a top, bottom and shoes before saving.');
      return;
    }
    setPendingSaveName(`Outfit ${savedOutfits.length + 1}`);
    setShowSaveModal(true);
  };

  const confirmSaveOutfit = async () => {
    if (!top || !bottom || !shoes || !user) return;
    setShowSaveModal(false);
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('saved_outfits')
        .insert({
          user_id: user.id,
          name: pendingSaveName.trim() || null,
          outfit_items: {
            top_id: top.id,
            bottom_id: bottom.id,
            shoes_id: shoes.id,
          },
        })
        .select()
        .single();
      if (err) throw err;
      showToast('Outfit saved.', 'success');
      settleShownPick('saved');
      // Saving signals mild approval — nudge the model toward this outfit.
      void applyReward({ top, bottom, shoes }, SAVED_OUTFIT_REWARD);
      const { data } = await supabase
        .from('saved_outfits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setSavedOutfits(data || []);
    } catch {
      showToast("Couldn't save this outfit. Try again.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Rate the shown outfit without wearing it. It stays on screen with its
  // rating until the user moves on.
  const [ratingSaving, setRatingSaving] = useState(false);
  const [lastRating, setLastRating] = useState<{ key: string; rating: number } | null>(null);
  const shownKey = top && bottom && shoes ? outfitKey({ top, bottom, shoes }) : '';
  const shownRating = lastRating?.key === shownKey ? lastRating.rating : 0;
  // The rating being pointed at: the outfit's glow warms with it.
  const [ratingPreview, setRatingPreview] = useState(0);
  const rateShownOutfit = async (rating: number) => {
    if (!user || !top || !bottom || !shoes || rating < 1) return;
    setRatingSaving(true);
    const features = currentFeatures({ top, bottom, shoes });
    try {
      const updated = await rateOutfitWithoutWearing(
        user.id,
        { top, bottom, shoes },
        rating,
        features,
      );
      setModel(updated);
      // Remember it for the rating feature right away.
      const rated: OutfitWear[] = [
        {
          id: `rating-new-${Date.now()}`,
          user_id: user.id,
          top_id: top.id,
          bottom_id: bottom.id,
          shoes_id: shoes.id,
          rating,
          worn_date: toLocalDateString(),
        },
        ...ratedOutfits,
      ];
      setRatedOutfits(rated);
      settleShownPick('rated', rating);
      setLastRating({ key: outfitKey({ top, bottom, shoes }), rating });
      setRatingPreview(0);
      showToast(`Rated ${rating}/10. Try another when you're ready.`, 'success');
    } catch {
      showToast("Couldn't save your rating. Try again.", 'error');
    } finally {
      setRatingSaving(false);
    }
  };

  // Wear today
  const [wornStamp, setWornStamp] = useState<ClothingItem[] | null>(null);
  const clearWornStamp = useCallback(() => setWornStamp(null), []);
  const wearToday = async () => {
    if (!user || !top || !bottom || !shoes) return;
    const today = toLocalDateString();
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('outfit_wears')
        .select('id')
        .eq('user_id', user.id)
        .eq('worn_date', today)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        showToast('Already logged an outfit for today', 'warning');
        return;
      }
      const { error: insertError } = await supabase.from('outfit_wears').insert({
        user_id: user.id,
        worn_date: today,
        top_id: top.id,
        bottom_id: bottom.id,
        shoes_id: shoes.id,
        occasion,
        // The outfit as it is today, so a later rating trains on exactly this.
        features: {
          items: [top.id, bottom.id, shoes.id],
          values: currentFeatures({ top, bottom, shoes }),
        },
      });
      if (isUniqueViolation(insertError)) {
        showToast("You've already logged today's outfit. Edit it in Calendar.", 'warning');
        return;
      }
      if (insertError) throw insertError;
      showToast("Logged as today's outfit.", 'success');
      setWornStamp([top, bottom, shoes]);
      settleShownPick('worn');
    } catch {
      showToast("Couldn't log today's outfit. Try again.", 'error');
    }
  };

  // Share: an image of the outfit, shared (phones) or downloaded.
  const [sharing, setSharing] = useState(false);
  const shareOutfit = async () => {
    if (!top || !bottom || !shoes) return;
    setSharing(true);
    try {
      const pieces = [top, bottom, shoes];
      const images = await Promise.all(pieces.map((p) => getClothingImageUrl(p.image_url)));
      const blob = await renderShareCard({
        images,
        palette: pieces.map((p) => colorMap[p.colors[0]] ?? '#e8e4e3'),
        dateLabel: new Date().toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        accent:
          top.colors[0] && bottom.colors[0]
            ? themeFromOutfit(top.colors[0], bottom.colors[0], shoes.colors[0]).uiAccent
            : NEUTRAL_INK,
      });
      const how = await shareOrDownload(blob, `fitfinder-outfit-${toLocalDateString()}.png`);
      if (how === 'downloaded') showToast('Saved an image of your outfit.', 'success');
    } catch (err) {
      // Closing the share sheet isn't an error.
      if ((err as Error)?.name !== 'AbortError') {
        showToast("Couldn't make an image of this outfit. Try again.", 'error');
      }
    } finally {
      setSharing(false);
    }
  };

  // Delete saved outfit
  const requestDeleteOutfit = (outfitId: string) => {
    setPendingDeleteId(outfitId);
    setConfirmOpen(true);
  };

  const confirmDeleteOutfit = async () => {
    if (!user || !pendingDeleteId) return;
    setConfirmOpen(false);
    try {
      const { error: deleteError } = await supabase
        .from('saved_outfits')
        .delete()
        .eq('id', pendingDeleteId)
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;
      setSavedOutfits((prev) => prev.filter((o) => o.id !== pendingDeleteId));
      showToast('Outfit deleted', 'success');
    } catch {
      showToast("Couldn't delete that outfit. Try again.", 'error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  // A saved outfit stores item ids in JSON (no foreign key), so an item can be
  // deleted out from under it. Missing pieces come back as undefined.
  const savedOutfitPieces = (outfit: SavedOutfit) =>
    [outfit.outfit_items.top_id, outfit.outfit_items.bottom_id, outfit.outfit_items.shoes_id].map(
      (id) => allItems.find((i) => i.id === id),
    );

  // Load saved outfit
  const loadSavedOutfit = (outfit: SavedOutfit) => {
    const pieces = savedOutfitPieces(outfit);
    setTop(pieces[0] ?? null);
    setBottom(pieces[1] ?? null);
    setShoes(pieces[2] ?? null);
    if (pieces.some((p) => !p)) {
      showToast('Part of this outfit was deleted from your closet. Pick a replacement.', 'info');
    }
    setLockedTop(false);
    setLockedBottom(false);
    setLockedShoes(false);
    setActiveTab('generator');
  };

  const pickerItems = (() => {
    if (!pickerSlot) return [];
    const section = pickerSlot === 'top' ? 'Tops' : pickerSlot === 'bottom' ? 'Bottoms' : 'Shoes';
    return items.filter((i) => typeToSection[i.type] === section);
  })();

  const handlePickItem = (item: ClothingItem) => {
    if (!pickerSlot) return;
    switch (pickerSlot) {
      case 'top':
        setTop(item);
        setLockedTop(true);
        break;
      case 'bottom':
        setBottom(item);
        setLockedBottom(true);
        break;
      case 'shoes':
        setShoes(item);
        setLockedShoes(true);
        break;
    }
    setPickerSlot(null);
  };

  const hasOutfit = Boolean(top && bottom && shoes);

  const thresholds = userWeatherPrefs?.thresholds ?? {
    cold: TEMPERATURE_THRESHOLDS.COLD,
    cool: TEMPERATURE_THRESHOLDS.COOL,
    warm: TEMPERATURE_THRESHOLDS.WARM,
  };
  const tempLabel =
    tempCategory === 'cold'
      ? `Cold, under ${thresholds.cold}°F`
      : tempCategory === 'cool'
        ? `Cool, ${thresholds.cold}–${thresholds.cool}°F`
        : tempCategory === 'warm'
          ? `Warm, ${thresholds.cool}–${thresholds.warm}°F`
          : `Hot, over ${thresholds.warm}°F`;

  // What the panel's "special instructions" line says about today's conditions.
  const instructions = [
    occasion ? `${occasion} outfit` : 'Any occasion',
    weather && !ignoreWeather
      ? `${weather.highTemperature}°F high, ${weather.condition.toLowerCase()}`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  // The outfit's colour pairing: the top's and the bottom's main colours.
  // After a spin it is revealed once the last reel lands, as the payoff.
  // The palette strip shows every piece's main colour the same way.
  const currentPalette =
    top && bottom && shoes ? [top, bottom, shoes].map((i) => i.colors[0] ?? null) : null;
  const pairingKey = currentPalette ? currentPalette.map((c) => c ?? '').join('|') : '';
  const [palette, setPalette] = useState<(string | null)[] | null>(null);
  const { setPairing: setThemePairing } = useOutfitTheme();
  useEffect(() => {
    const justSpun = Date.now() - lastSpinAt.current < 300;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const swapped = SLOTS.some((s) => directions[s] !== 'down');
    const delay = justSpun && !reduce ? (swapped ? SWAP_DURATION : reelDuration.shoes) : 0;
    const t = setTimeout(() => {
      const next = pairingKey ? pairingKey.split('|').map((c) => c || null) : null;
      setPalette(next);
      // Today's outfit restyles the app (headers, nav, buttons, background).
      if (next?.[0] && next[1]) setThemePairing([next[0], next[1], next[2]]);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairingKey, spins]);

  const slots = [
    {
      key: 'top' as const,
      label: 'Top',
      item: top,
      locked: lockedTop,
      toggle: () => setLockedTop(!lockedTop),
    },
    {
      key: 'bottom' as const,
      label: 'Bottom',
      item: bottom,
      locked: lockedBottom,
      toggle: () => setLockedBottom(!lockedBottom),
    },
    {
      key: 'shoes' as const,
      label: 'Shoes',
      item: shoes,
      locked: lockedShoes,
      toggle: () => setLockedShoes(!lockedShoes),
    },
  ];

  const chip = (active: boolean) =>
    `min-h-[36px] px-3 rounded-full border text-sm font-semibold transition-colors ${
      active
        ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
        : 'bg-white text-[var(--text-secondary)] border-[var(--line-strong)] hover:text-[var(--text)]'
    }`;

  if (loading && items.length === 0) {
    return (
      <div className="w-full">
        <SkeletonOutfitSlots />
      </div>
    );
  }

  return (
    <div className="w-full outfit-glass">
      {/* Today's weather, faintly, behind the screen (off when not dressing for it). */}
      {weather && !ignoreWeather && (
        <WeatherBackdrop {...weatherScene(weather.icon, weather.condition)} />
      )}
      {wornStamp && <WornStamp pieces={wornStamp} date={new Date()} onDone={clearWornStamp} />}
      <PosterHeader
        compact
        title="Today's fit"
        script="get dressed"
        readout={`{ ${items.length} clean ${items.length === 1 ? 'item' : 'items'} to pick from }`}
        actions={
          <div className="segmented-poster">
            <button
              onClick={() => setActiveTab('generator')}
              aria-pressed={activeTab === 'generator'}
            >
              New outfit
            </button>
            <button onClick={() => setActiveTab('saved')} aria-pressed={activeTab === 'saved'}>
              Saved <span className="tabular">({savedOutfits.length})</span>
            </button>
          </div>
        }
      />

      {activeTab === 'generator' && (
        <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
          {/* ====== Left: what the outfit is for (below it on phones) ====== */}
          <div className="order-3 lg:order-1 flex flex-col gap-4 lg:sticky lg:top-24">
            <section aria-labelledby="occasion-heading" className="card p-4">
              <h3 id="occasion-heading" className="panel-label mb-2">
                Occasion
              </h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Occasion">
                <button
                  onClick={() => setOccasion(null)}
                  aria-pressed={occasion === null}
                  className={chip(occasion === null)}
                >
                  Any
                </button>
                {occasions.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccasion(o)}
                    aria-pressed={occasion === o}
                    className={chip(occasion === o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Only items that suit the occasion are used. Change what fits in Settings.
              </p>
            </section>

            <section aria-labelledby="weather-heading" className="card p-4">
              <h3 id="weather-heading" className="panel-label mb-2">
                Weather
              </h3>
              {weatherLoading && (
                <div className="h-16 rounded-md bg-[var(--muted)] animate-pulse" />
              )}

              {weather && !weatherLoading && (
                <>
                  <div className="flex items-center gap-3">
                    <img src={getWeatherIconUrl(weather.icon)} alt="" className="w-11 h-11 -my-1" />
                    <div className="min-w-0">
                      <div className="tabular font-bold text-2xl leading-tight">
                        {weather.temperature}°F
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {weather.condition}, high of {weather.highTemperature}°F ·{' '}
                        <span className={ignoreWeather ? 'line-through' : ''}>{tempLabel}</span>
                      </div>
                    </div>
                  </div>
                  <label className="mt-2 flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      {ignoreWeather ? (
                        <CloudOff size={16} aria-hidden="true" />
                      ) : (
                        <CloudSun size={16} aria-hidden="true" />
                      )}
                      Dress for the weather
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={!ignoreWeather}
                      onChange={() => setIgnoreWeather(!ignoreWeather)}
                      className="w-5 h-5 accent-[var(--carbon)]"
                    />
                  </label>
                </>
              )}

              {!weather && !weatherLoading && (
                <p className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <CloudSun size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    {zip
                      ? `Couldn't load the weather for ${zip} right now.`
                      : 'Add your ZIP code in Settings to get outfits picked for the weather.'}
                  </span>
                </p>
              )}
            </section>
          </div>

          {/* ====== The outfit: the centre of the screen ====== */}
          <section
            aria-labelledby="outfit-heading"
            className="panel w-full px-4 sm:px-6 py-5 order-1 lg:order-2 transition-shadow duration-300"
            style={
              ratingPreview > 0
                ? {
                    // The top's colour, stronger the higher the rating.
                    boxShadow: `0 24px 60px -20px color-mix(in srgb, var(--outfit-glow) ${Math.round(20 + (60 * (ratingPreview - 1)) / 9)}%, transparent)`,
                  }
                : undefined
            }
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 id="outfit-heading" className="text-base">
                Your outfit
              </h3>
              <p className="readout">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
                {instructions && <> · {instructions}</>}
              </p>
              {palette && (
                <div className="w-full mt-2">
                  <div className="flex gap-1.5" aria-hidden="true">
                    {palette.map((c, i) => (
                      <span
                        key={i}
                        className="h-2 flex-1 rounded-full border border-black/5 transition-colors duration-700"
                        style={c ? getColorStyle(c) : { backgroundColor: 'var(--muted)' }}
                      />
                    ))}
                  </div>
                  <p className="readout mt-1.5">
                    <span className="sr-only">Palette: </span>
                    {palette.map((c) => (c ? getColorName(c) : 'No colour')).join(' · ')}
                  </p>
                </div>
              )}
            </div>

            <ul className="mt-4 flex flex-col gap-3">
              {slots.map(({ key, label, item, locked, toggle }) => {
                const canSwap = hasOutfit && !locked && !loading;
                const arrow = (direction: SwipeDirection) => (
                  <button
                    type="button"
                    onClick={() => swapPiece(key, direction)}
                    disabled={!canSwap}
                    aria-label={`Swap ${label.toLowerCase()} (${direction === 'left' ? 'slide left' : 'slide right'})`}
                    className="w-9 h-9 shrink-0 rounded-full border border-[var(--line-strong)] bg-white text-[var(--text-secondary)] hover:text-[var(--text)] flex items-center justify-center transition-opacity disabled:opacity-30"
                  >
                    {direction === 'left' ? (
                      <ChevronLeft size={16} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={16} aria-hidden="true" />
                    )}
                  </button>
                );
                return (
                  <li
                    key={key}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3"
                  >
                    <div className="min-w-0 text-right">
                      <div className="panel-label">{label}</div>
                      <div
                        className="text-sm font-semibold tracking-tight leading-snug line-clamp-3 break-words"
                        title={item ? describeItem(item) : undefined}
                      >
                        {item ? <ScrambleText text={describeItem(item)} /> : 'Not picked yet'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {arrow('left')}
                      <SwipeArea
                        onSwipe={(direction) => swapPiece(key, direction)}
                        disabled={!canSwap}
                        className="shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => setPickerSlot(key)}
                          aria-label={
                            item
                              ? `Change ${label.toLowerCase()}: ${describeItem(item)}`
                              : `Choose a ${label.toLowerCase()}`
                          }
                          className={`w-[7.5rem] h-[7.5rem] [@media(min-height:880px)]:w-36 [@media(min-height:880px)]:h-36 rounded-xl overflow-hidden flex items-center justify-center transition-shadow ${
                            item
                              ? 'bg-white border border-[var(--border)] hover:border-[var(--line-strong)]'
                              : 'border-2 border-dashed border-[var(--line-strong)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                          } ${locked ? 'ring-2 ring-[var(--accent)] ring-offset-2' : ''}`}
                        >
                          {item ? (
                            <SlotReel
                              item={item}
                              pool={items.filter((i) => typeToSection[i.type] === sectionFor[key])}
                              spinKey={spins[key]}
                              durationMs={
                                directions[key] === 'down' ? reelDuration[key] : SWAP_DURATION
                              }
                              direction={directions[key]}
                              spinOnMount={Date.now() - lastSpinAt.current < 300}
                            />
                          ) : (
                            <span className="text-sm font-semibold">Choose</span>
                          )}
                        </button>
                      </SwipeArea>
                      {arrow('right')}
                    </div>
                    <div className="justify-self-start">
                      <button
                        onClick={toggle}
                        disabled={!item}
                        aria-pressed={locked}
                        aria-label={`${locked ? 'Unlock' : 'Lock'} ${label.toLowerCase()}`}
                        className={`min-h-[40px] px-3 rounded-full border text-sm font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-40 ${
                          locked
                            ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                            : 'bg-white text-[var(--text-secondary)] border-[var(--line-strong)] hover:text-[var(--text)]'
                        }`}
                      >
                        {locked ? (
                          <Lock size={14} aria-hidden="true" />
                        ) : (
                          <Unlock size={14} aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">{locked ? 'Kept' : 'Keep'}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {error && (
              <p
                role="status"
                className="text-sm text-[var(--warning)] bg-[#fdf4e3] rounded-md px-3 py-2 mt-4"
              >
                {error}
              </p>
            )}

            <button
              onClick={tryAnother}
              disabled={loading}
              className="btn-primary w-full mt-5 text-base min-h-[52px]"
            >
              <Sparkles size={18} aria-hidden="true" />
              {hasOutfit ? 'Try another outfit' : 'Generate outfit'}
            </button>
          </section>

          {/* ====== Right: rating and history (below the outfit on phones) ====== */}
          <div className="order-2 lg:order-3 flex flex-col gap-4 lg:sticky lg:top-24">
            <section aria-label="This outfit" className="card p-4 flex flex-col gap-2">
              <h3 className="panel-label mb-1">This outfit</h3>
              <button
                onClick={openSaveModal}
                disabled={!hasOutfit}
                className="btn-secondary w-full"
              >
                <Save size={16} aria-hidden="true" /> Save outfit
              </button>
              <button onClick={wearToday} disabled={!hasOutfit} className="btn-secondary w-full">
                <CalendarPlus size={16} aria-hidden="true" /> Wear today
              </button>
              <button
                onClick={shareOutfit}
                disabled={!hasOutfit || sharing}
                aria-label="Share outfit"
                className="btn-secondary w-full"
              >
                <Share2 size={16} aria-hidden="true" /> Share
              </button>
            </section>
            <section aria-label="Rate this outfit" className="card p-4">
              {hasOutfit ? (
                <RatingPicker
                  value={shownRating}
                  onChange={rateShownOutfit}
                  clearable={false}
                  disabled={ratingSaving || shownRating > 0}
                  onPreview={setRatingPreview}
                  legend={
                    shownRating > 0 ? (
                      <>
                        You rated this {shownRating}/10{' '}
                        <span className="font-normal text-[var(--text-secondary)]">
                          (Try another for the next one)
                        </span>
                      </>
                    ) : (
                      <>
                        Rate this outfit{' '}
                        <span className="font-normal text-[var(--text-secondary)]">
                          (no need to wear it; helps FitFinder learn your taste)
                        </span>
                      </>
                    )
                  }
                />
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Generate an outfit, then rate it here. No need to wear it; it helps FitFinder
                  learn your taste.
                </p>
              )}
            </section>
            <p className="text-xs text-[var(--text-secondary)] px-1">
              Swipe a piece or use its arrows to swap just that piece. Keep a piece to build around
              it.
            </p>
            <button onClick={onNavigateToCalendar} className="btn-ghost justify-start">
              <Calendar size={16} aria-hidden="true" /> See what you&apos;ve worn
            </button>
          </div>
        </div>
      )}

      {/* Saved outfits */}
      {activeTab === 'saved' && (
        <div>
          {savedOutfits.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-lg font-semibold mb-1">No saved outfits yet</p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Generate an outfit you like and tap Save outfit to keep it here.
              </p>
              <button onClick={() => setActiveTab('generator')} className="btn-primary">
                <Sparkles size={16} aria-hidden="true" /> Generate an outfit
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedOutfits.map((outfit, idx) => {
                const pieces = savedOutfitPieces(outfit);
                const name = outfit.name || `Outfit ${idx + 1}`;
                return (
                  <li key={outfit.id ?? idx} className="panel px-5 pt-7 pb-5 flex flex-col">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-lg font-bold truncate">{name}</span>
                      <span className="tabular text-xs text-[var(--text-secondary)] shrink-0">
                        {outfit.created_at
                          ? new Date(outfit.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 my-4">
                      {pieces.map((item, i) =>
                        item ? (
                          <div
                            key={i}
                            className="relative aspect-square rounded-md border border-[var(--border)] bg-white overflow-hidden"
                          >
                            <ClothingImage
                              src={item.image_url}
                              alt={describeItem(item)}
                              className="w-full h-full object-contain p-1"
                            />
                            {item.is_dirty && (
                              <span className="badge-dirty absolute bottom-1 right-1 bg-white/80">
                                Dirty
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            key={i}
                            className="aspect-square rounded-md border border-dashed border-[var(--line-strong)] flex items-center justify-center text-xs text-center text-[var(--text-secondary)] p-1"
                          >
                            Deleted item
                          </div>
                        ),
                      )}
                    </div>
                    <div className="divider pt-3 mt-auto flex gap-2">
                      <button
                        onClick={() => loadSavedOutfit(outfit)}
                        className="btn-secondary flex-1"
                        aria-label={`Wear ${name} again`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => requestDeleteOutfit(outfit.id!)}
                        className="btn-ghost text-[var(--danger)] hover:text-[var(--danger)]"
                        aria-label={`Delete ${name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Save name modal */}
      {showSaveModal && (
        <Modal label="Save outfit" onClose={() => setShowSaveModal(false)} className="max-w-sm">
          <h3 className="text-xl mb-4">Save outfit</h3>
          <label htmlFor="save-outfit-name" className="text-sm font-semibold mb-1.5 block">
            Name
          </label>
          <input
            id="save-outfit-name"
            type="text"
            value={pendingSaveName}
            onChange={(e) => setPendingSaveName(e.target.value)}
            placeholder="e.g. Casual Friday"
            className="w-full mb-4"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSaveOutfit();
            }}
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={confirmSaveOutfit} className="btn-primary">
              Save outfit
            </button>
          </div>
        </Modal>
      )}

      {/* Item picker modal */}
      {pickerSlot && (
        <Modal
          label={`Choose a ${pickerSlot}`}
          onClose={() => setPickerSlot(null)}
          className="max-w-3xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl">Choose a {pickerSlot}</h3>
            <button
              onClick={() => setPickerSlot(null)}
              className="btn-ghost px-2"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          {pickerItems.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-6">
              No clean {pickerSlot === 'shoes' ? 'shoes' : `${pickerSlot}s`} in your closet. Add
              some in the Closet, or mark a few clean.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[65vh] overflow-y-auto p-1">
              {pickerItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePickItem(item)}
                  aria-label={describeItem(item)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] bg-white transition-colors"
                >
                  <div className="w-full aspect-square rounded-lg bg-[var(--muted)] overflow-hidden">
                    <ClothingImage
                      src={item.image_url}
                      alt=""
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] line-clamp-2 w-full text-center">
                    {describeItem(item)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Delete this saved outfit?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteOutfit}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
