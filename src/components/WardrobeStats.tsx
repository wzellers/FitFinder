"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { sectionNames } from '@/lib/constants';
import { typeToSection } from '@/lib/types';
import { getColorName, getColorStyle } from '@/lib/colorUtils';
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
}

type TimePeriod = 'week' | 'month' | 'all';

export default function WardrobeStats() {
  const { user } = useAuth();
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
        startDate = date.toISOString().split('T')[0];
      }

      const [{ data: itemsData }, { data: wearsData }] = await Promise.all([
        supabase.from('clothing_items').select('*').eq('user_id', user.id),
        startDate
          ? supabase.from('outfit_wears').select('*').eq('user_id', user.id).gte('worn_date', startDate)
          : supabase.from('outfit_wears').select('*').eq('user_id', user.id),
      ]);
      setItems(itemsData || []);
      setOutfitWears(wearsData || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user, timePeriod]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo((): Stats => {
    const itemsByCategory: Record<string, number> = {};
    sectionNames.forEach((section) => {
      itemsByCategory[section] = items.filter((item) => typeToSection[item.type] === section).length;
    });

    const dirtyItems = items.filter((item) => item.is_dirty).length;
    const cleanItems = items.filter((item) => !item.is_dirty).length;

    const wearCounts: Record<string, number> = {};
    outfitWears.forEach((wear) => {
      if (wear.top_id) wearCounts[wear.top_id] = (wearCounts[wear.top_id] || 0) + 1;
      if (wear.bottom_id) wearCounts[wear.bottom_id] = (wearCounts[wear.bottom_id] || 0) + 1;
      if (wear.shoes_id) wearCounts[wear.shoes_id] = (wearCounts[wear.shoes_id] || 0) + 1;
      if (wear.outerwear_id) wearCounts[wear.outerwear_id] = (wearCounts[wear.outerwear_id] || 0) + 1;
    });

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
    const avgRating = ratedOutfits.length > 0
      ? ratedOutfits.reduce((sum, w) => sum + (w.rating || 0), 0) / ratedOutfits.length
      : 0;

    const topRatedOutfits = [...outfitWears]
      .filter((w) => w.rating != null)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);

    let avgDaysBetweenRepeat = 0;
    if (outfitWears.length > 1) {
      const outfitStrings = outfitWears.map((w) => `${w.top_id}-${w.bottom_id}-${w.shoes_id}-${w.outerwear_id}`);
      const repeatOccurrences = outfitStrings.filter((str, idx) => outfitStrings.indexOf(str) !== idx);
      avgDaysBetweenRepeat = repeatOccurrences.length > 0
        ? Math.round(outfitWears.length / repeatOccurrences.length)
        : 0;
    }

    return { totalItems: items.length, totalWears: outfitWears.length, itemsByCategory, dirtyItems, cleanItems, mostWornItems, leastWornItems, colorDistribution, avgRating, topRatedOutfits, avgDaysBetweenRepeat };
  }, [items, outfitWears]);

  const getItemImage = (itemId: string | undefined): string | null => {
    if (!itemId) return null;
    return items.find((i) => i.id === itemId)?.image_url || null;
  };

  if (loading) {
    return <div className="text-center py-12 text-[var(--text-secondary)] text-sm">Loading statistics...</div>;
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-header border-0 mb-0 pb-0">Wardrobe Statistics</h2>
        <div className="flex gap-1">
          {(['week', 'month', 'all'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                timePeriod === period
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              {period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Overview Card */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">{stats.totalItems}</div>
              <div className="text-xs text-[var(--text-secondary)]">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">{stats.totalWears}</div>
              <div className="text-xs text-[var(--text-secondary)]">Outfits Logged</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.cleanItems}</div>
              <div className="text-xs text-[var(--text-secondary)]">Clean Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500">{stats.dirtyItems}</div>
              <div className="text-xs text-[var(--text-secondary)]">Dirty Items</div>
            </div>
          </div>
        </div>

        {/* Items by Category */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Items by Category</h3>
          <div className="flex flex-col gap-3">
            {sectionNames.map((section) => (
              <div key={section} className="flex items-center gap-3">
                <span className="text-xs text-[var(--text)] w-20 shrink-0">{section}</span>
                <div className="flex-1 h-5 bg-[var(--muted)] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded transition-all duration-300"
                    style={{ width: `${stats.totalItems > 0 ? (stats.itemsByCategory[section] / stats.totalItems) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text-secondary)] w-6 text-right">{stats.itemsByCategory[section]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Worn */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Most Worn Items</h3>
          {stats.mostWornItems.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] text-xs py-4">No wear data yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.mostWornItems.map((wc, idx) => (
                <div key={wc.itemId} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[var(--accent)] w-5">#{idx + 1}</span>
                  <img src={wc.item.image_url} alt={wc.item.type} className="w-9 h-9 rounded-lg object-cover border border-[var(--border)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text)] truncate">{wc.item.type}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{wc.count} times</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Neglected Items */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Neglected Items</h3>
          {stats.leastWornItems.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] text-xs py-4">Add items to see stats</div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.leastWornItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <img src={item.image_url} alt={item.type} className="w-9 h-9 rounded-lg object-cover border border-[var(--border)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text)] truncate">{item.type}</div>
                    <div className={`text-xs ${item.wearCount === 0 ? 'text-amber-500' : 'text-[var(--text-secondary)]'}`}>
                      {item.wearCount === 0 ? 'Never worn' : `${item.wearCount} times`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Color Distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Color Distribution</h3>
          {stats.colorDistribution.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] text-xs py-4">No color data</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.colorDistribution.slice(0, 10).map(({ color, count }) => (
                <div key={color} className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--muted)] rounded-full text-xs">
                  <div
                    className="w-3 h-3 rounded-full border border-[var(--border)]"
                    style={{ backgroundColor: getColorStyle(color).backgroundColor }}
                  />
                  <span className="text-[var(--text)]">{color}</span>
                  <span className="text-[var(--text-secondary)]">({count})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ratings */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Outfit Ratings</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500">
                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">Avg Rating (1-10)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">{stats.topRatedOutfits.length}</div>
              <div className="text-xs text-[var(--text-secondary)]">Rated Outfits</div>
            </div>
          </div>

          {stats.topRatedOutfits.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text)] mb-2">Top Rated:</h4>
              <div className="flex flex-col gap-2">
                {stats.topRatedOutfits.slice(0, 3).map((outfit) => (
                  <div key={outfit.id} className="flex items-center gap-2 p-2 bg-[var(--muted)] rounded-lg">
                    <div className="flex gap-0.5">
                      {[outfit.top_id, outfit.bottom_id].map((id, idx) => {
                        const imgUrl = getItemImage(id);
                        return imgUrl ? (
                          <img key={idx} src={imgUrl} alt="" className="w-6 h-6 rounded object-cover" />
                        ) : null;
                      })}
                    </div>
                    <span className="text-sm font-semibold text-amber-500">{outfit.rating}/10</span>
                    <span className="text-xs text-[var(--text-secondary)]">{outfit.worn_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
