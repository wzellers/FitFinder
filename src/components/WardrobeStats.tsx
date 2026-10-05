'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ClothingImage from '@/components/ui/ClothingImage';
import { useToast } from '@/components/ToastProvider';
import { describeItem } from '@/lib/itemLabels';
import { supabase } from '@/lib/supabaseClient';
import { throwIfAnyError } from '@/lib/supabaseResult';
import { toLocalDateString } from '@/lib/dates';
import { sectionNames, typeToSection } from '@/lib/constants';
import { getColorName, getColorStyle } from '@/lib/colorUtils';
import { SkeletonStatCards } from '@/components/ui/Skeleton';
import type { ClothingItem, OutfitWear } from '@/lib/types';

interface WearCount {
  itemId: string;
  item: ClothingItem;
  count: number;
}

interface ColorCount {
  color: string;
  count: number;
}

interface Stats {
  totalItems: number;
  totalWears: number;
  itemsByCategory: Record<string, number>;
  dirtyItems: number;
  cleanItems: number;
  mostWornItems: WearCount[];
  leastWornItems: (ClothingItem & { wearCount: number })[];
  colorDistribution: ColorCount[];
  avgRating: number;
  topRatedOutfits: OutfitWear[];
  avgDaysBetweenRepeat: number;
  closetUtilization: number;
}

type TimePeriod = 'week' | 'month' | 'all';

export default function WardrobeStats() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfitWears, setOutfitWears] = useState<OutfitWear[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let startDate: string | null = null;
      if (timePeriod !== 'all') {
        const date = new Date();
        if (timePeriod === 'week') date.setDate(date.getDate() - 7);
        else date.setMonth(date.getMonth() - 1);
        startDate = toLocalDateString(date);
      }

      const [{ data: itemsData }, { data: wearsData }] = throwIfAnyError(
        await Promise.all([
          supabase.from('clothing_items').select('*').eq('user_id', user.id),
          startDate
            ? supabase
                .from('outfit_wears')
                .select('*')
                .eq('user_id', user.id)
                .gte('worn_date', startDate)
            : supabase.from('outfit_wears').select('*').eq('user_id', user.id),
        ]),
      );
      setItems(itemsData || []);
      setOutfitWears(wearsData || []);
    } catch {
      showToast("Couldn't load your stats. Refresh to try again.", 'error');
    } finally {
      setLoading(false);
    }
  }, [user, timePeriod, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo((): Stats => {
    const itemsByCategory: Record<string, number> = {};
    sectionNames.forEach((section) => {
      itemsByCategory[section] = items.filter(
        (item) => typeToSection[item.type] === section,
      ).length;
    });

    const dirtyItems = items.filter((item) => item.is_dirty).length;
    const cleanItems = items.filter((item) => !item.is_dirty).length;

    const wearCounts: Record<string, number> = {};
    const wornItemIds = new Set<string>();
    outfitWears.forEach((wear) => {
      if (wear.top_id) {
        wearCounts[wear.top_id] = (wearCounts[wear.top_id] || 0) + 1;
        wornItemIds.add(wear.top_id);
      }
      if (wear.bottom_id) {
        wearCounts[wear.bottom_id] = (wearCounts[wear.bottom_id] || 0) + 1;
        wornItemIds.add(wear.bottom_id);
      }
      if (wear.shoes_id) {
        wearCounts[wear.shoes_id] = (wearCounts[wear.shoes_id] || 0) + 1;
        wornItemIds.add(wear.shoes_id);
      }
    });

    const closetUtilization = items.length > 0 ? (wornItemIds.size / items.length) * 100 : 0;

    const wearCountsArray: WearCount[] = Object.entries(wearCounts)
      .map(([itemId, count]) => ({ itemId, item: items.find((i) => i.id === itemId)!, count }))
      .filter((wc) => wc.item)
      .sort((a, b) => b.count - a.count);

    const mostWornItems = wearCountsArray.slice(0, 5);

    const leastWornItems = items
      .map((item) => ({ ...item, wearCount: wearCounts[item.id] || 0 }))
      .sort((a, b) => a.wearCount - b.wearCount)
      .slice(0, 5);

    const colorCounts: Record<string, number> = {};
    items.forEach((item) => {
      item.colors.forEach((color) => {
        const normalized = getColorName(color);
        colorCounts[normalized] = (colorCounts[normalized] || 0) + 1;
      });
    });
    const colorDistribution = Object.entries(colorCounts)
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count);

    const ratedOutfits = outfitWears.filter((w) => w.rating != null);
    const avgRating =
      ratedOutfits.length > 0
        ? ratedOutfits.reduce((sum, w) => sum + (w.rating || 0), 0) / ratedOutfits.length
        : 0;

    const topRatedOutfits = [...outfitWears]
      .filter((w) => w.rating != null)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);

    let avgDaysBetweenRepeat = 0;
    if (outfitWears.length > 1) {
      const outfitStrings = outfitWears.map((w) => `${w.top_id}-${w.bottom_id}-${w.shoes_id}`);
      const repeatOccurrences = outfitStrings.filter(
        (str, idx) => outfitStrings.indexOf(str) !== idx,
      );
      avgDaysBetweenRepeat =
        repeatOccurrences.length > 0
          ? Math.round(outfitWears.length / repeatOccurrences.length)
          : 0;
    }

    return {
      totalItems: items.length,
      totalWears: outfitWears.length,
      itemsByCategory,
      dirtyItems,
      cleanItems,
      mostWornItems,
      leastWornItems,
      colorDistribution,
      avgRating,
      topRatedOutfits,
      avgDaysBetweenRepeat,
      closetUtilization,
    };
  }, [items, outfitWears]);

  const getItemImage = (itemId: string | undefined): string | null => {
    if (!itemId) return null;
    return items.find((i) => i.id === itemId)?.image_url || null;
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl">Stats</h2>
        </div>
        <SkeletonStatCards />
      </div>
    );
  }

  const periodLabel =
    timePeriod === 'week' ? 'this week' : timePeriod === 'month' ? 'this month' : 'all time';

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h2 className="text-3xl">Stats</h2>
        <div
          className="inline-flex rounded-full border border-[var(--line-strong)] bg-white p-1"
          role="group"
          aria-label="Time period"
        >
          {(['week', 'month', 'all'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              aria-pressed={timePeriod === period}
              className={`min-h-[36px] px-4 rounded-full text-sm font-medium ${
                timePeriod === period
                  ? 'bg-[var(--text)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              {period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-8 items-start">
        {/* ====== Summary ====== */}
        <div className="panel px-6 pt-8 pb-7">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg">Summary</h3>
            <span className="text-xs text-[var(--text-secondary)]">{periodLabel}</span>
          </div>
          <dl className="mt-4 text-sm">
            <ReceiptLine label="Items" value={stats.totalItems} strong />
            {sectionNames.map((section) => (
              <ReceiptLine
                key={section}
                label={section}
                value={stats.itemsByCategory[section]}
                indent
              />
            ))}
            <ReceiptLine label="Clean" value={stats.cleanItems} />
            <ReceiptLine label="In the wash" value={stats.dirtyItems} />
          </dl>
          <div className="divider my-4" />
          <dl className="text-sm">
            <ReceiptLine label="Outfits logged" value={stats.totalWears} strong />
            <ReceiptLine
              label="Share of closet worn"
              value={`${Math.round(stats.closetUtilization)}%`}
            />
            <ReceiptLine
              label="Days between repeats"
              value={stats.avgDaysBetweenRepeat > 0 ? stats.avgDaysBetweenRepeat : '—'}
            />
            <ReceiptLine
              label="Average rating"
              value={stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} / 10` : '—'}
            />
          </dl>
          <div className="divider my-4" />
          <div aria-hidden="true" className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full bg-[var(--carbon)] transition-all duration-300"
              style={{ width: `${Math.min(stats.closetUtilization, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            {stats.totalWears === 0
              ? `No outfits logged ${periodLabel}. Tap Wear today on an outfit to start tracking.`
              : `You've worn ${Math.round(stats.closetUtilization)}% of your closet ${periodLabel}.`}
          </p>
        </div>

        {/* ====== Detail panels ====== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <section className="card p-5" aria-labelledby="most-worn">
            <h3 id="most-worn" className="text-lg mb-3">
              Most worn
            </h3>
            {stats.mostWornItems.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Nothing worn {periodLabel} yet. Your favourites will show up here.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {stats.mostWornItems.map((wc) => (
                  <ItemRow
                    key={wc.itemId}
                    item={wc.item}
                    detail={`Worn ${wc.count} ${wc.count === 1 ? 'time' : 'times'}`}
                  />
                ))}
              </ol>
            )}
          </section>

          <section className="card p-5" aria-labelledby="neglected">
            <h3 id="neglected" className="text-lg mb-3">
              Least worn
            </h3>
            {stats.leastWornItems.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Add items to your closet to see which ones you skip.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.leastWornItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    detail={
                      item.wearCount === 0
                        ? timePeriod === 'all'
                          ? 'Never worn'
                          : `Not worn ${periodLabel}`
                        : `Worn ${item.wearCount} ${item.wearCount === 1 ? 'time' : 'times'}`
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5" aria-labelledby="colors">
            <h3 id="colors" className="text-lg mb-3">
              Colors
            </h3>
            {stats.colorDistribution.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Colors appear once you add items.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {stats.colorDistribution.slice(0, 10).map(({ color, count }) => (
                  <li
                    key={color}
                    className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 bg-[var(--muted)] rounded-full text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className="w-4 h-4 rounded-full border border-black/20"
                      style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                    />
                    <span>{color}</span>
                    <span className="tabular text-[var(--text-secondary)]">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5" aria-labelledby="best-rated">
            <h3 id="best-rated" className="text-lg mb-3">
              Best-rated outfits
            </h3>
            {stats.topRatedOutfits.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Rate outfits in the Calendar to see your favourites here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.topRatedOutfits.slice(0, 3).map((outfit) => (
                  <li
                    key={outfit.id}
                    className="flex items-center gap-3 p-2 bg-[var(--muted)] rounded-md"
                  >
                    <div className="flex gap-1">
                      {[outfit.top_id, outfit.bottom_id, outfit.shoes_id].map((id, idx) => {
                        const imgUrl = getItemImage(id);
                        return imgUrl ? (
                          <ClothingImage
                            key={idx}
                            src={imgUrl}
                            alt=""
                            className="w-8 h-8 rounded-sm object-contain bg-white"
                          />
                        ) : null;
                      })}
                    </div>
                    <span className="tabular text-sm font-bold">{outfit.rating}/10</span>
                    <span className="text-xs text-[var(--text-secondary)] ml-auto">
                      {new Date(outfit.worn_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** One summary line: label, leader, value. */
function ReceiptLine({
  label,
  value,
  strong = false,
  indent = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2 py-1 ${indent ? 'pl-4 text-[var(--text-secondary)]' : ''}`}
    >
      <dt className={strong ? 'font-semibold' : ''}>{label}</dt>
      <span
        aria-hidden="true"
        className="flex-1 border-b border-dotted border-[var(--line-strong)] translate-y-[-3px]"
      />
      <dd className={`tabular font-semibold ${strong ? 'text-lg font-bold' : 'font-semibold'}`}>
        {value}
      </dd>
    </div>
  );
}

function ItemRow({ item, detail }: { item: ClothingItem; detail: string }) {
  return (
    <li className="flex items-center gap-3">
      <ClothingImage
        src={item.image_url}
        alt=""
        className="w-10 h-10 rounded-md object-contain bg-white border border-[var(--border)]"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{describeItem(item)}</div>
        <div className="text-xs text-[var(--text-secondary)]">{detail}</div>
      </div>
    </li>
  );
}
