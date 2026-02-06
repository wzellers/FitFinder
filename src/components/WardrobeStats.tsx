// WardrobeStats Component - Visual insights into wardrobe usage patterns
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { ClothingItem, OutfitWear, typeToSection, sectionNames } from '../lib/types';
import { getColorName } from '../lib/colorUtils';

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
  leastWornItems: ClothingItem[];
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

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Calculate date range based on time period
      let startDate: string | null = null;
      if (timePeriod !== 'all') {
        const date = new Date();
        if (timePeriod === 'week') {
          date.setDate(date.getDate() - 7);
        } else {
          date.setMonth(date.getMonth() - 1);
        }
        startDate = date.toISOString().split('T')[0];
      }

      const [{ data: itemsData }, { data: wearsData }] = await Promise.all([
        supabase.from('clothing_items').select('*').eq('user_id', user.id),
        startDate
          ? supabase.from('outfit_wears').select('*').eq('user_id', user.id).gte('worn_date', startDate)
          : supabase.from('outfit_wears').select('*').eq('user_id', user.id)
      ]);

      setItems(itemsData || []);
      setOutfitWears(wearsData || []);
    } catch (e) {
      console.error('Failed to load stats data:', e);
    } finally {
      setLoading(false);
    }
  }, [user, timePeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate statistics
  const stats = useMemo((): Stats => {
    // Items by category
    const itemsByCategory: Record<string, number> = {};
    sectionNames.forEach(section => {
      itemsByCategory[section] = items.filter(item => typeToSection[item.type] === section).length;
    });

    // Dirty/clean counts
    const dirtyItems = items.filter(item => item.is_dirty).length;
    const cleanItems = items.filter(item => !item.is_dirty).length;

    // Wear counts per item
    const wearCounts: Record<string, number> = {};
    outfitWears.forEach(wear => {
      if (wear.top_id) wearCounts[wear.top_id] = (wearCounts[wear.top_id] || 0) + 1;
      if (wear.bottom_id) wearCounts[wear.bottom_id] = (wearCounts[wear.bottom_id] || 0) + 1;
      if (wear.shoes_id) wearCounts[wear.shoes_id] = (wearCounts[wear.shoes_id] || 0) + 1;
      if (wear.outerwear_id) wearCounts[wear.outerwear_id] = (wearCounts[wear.outerwear_id] || 0) + 1;
    });

    // Most worn items
    const wearCountsArray: WearCount[] = Object.entries(wearCounts)
      .map(([itemId, count]) => ({
        itemId,
        item: items.find(i => i.id === itemId)!,
        count
      }))
      .filter(wc => wc.item)
      .sort((a, b) => b.count - a.count);

    const mostWornItems = wearCountsArray.slice(0, 5);

    // Least worn items (items never worn or worn least)
    const itemsWithWearCount = items.map(item => ({
      ...item,
      wearCount: wearCounts[item.id] || 0
    }));
    const leastWornItems = itemsWithWearCount
      .sort((a, b) => a.wearCount - b.wearCount)
      .slice(0, 5);

    // Color distribution
    const colorCounts: Record<string, number> = {};
    items.forEach(item => {
      item.colors.forEach(color => {
        const normalizedColor = getColorName(color);
        colorCounts[normalizedColor] = (colorCounts[normalizedColor] || 0) + 1;
      });
    });
    const colorDistribution = Object.entries(colorCounts)
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count);

    // Average rating
    const ratedOutfits = outfitWears.filter(w => w.rating != null);
    const avgRating = ratedOutfits.length > 0
      ? ratedOutfits.reduce((sum, w) => sum + (w.rating || 0), 0) / ratedOutfits.length
      : 0;

    // Top rated outfits
    const topRatedOutfits = [...outfitWears]
      .filter(w => w.rating != null)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);

    // Average days between repeating an outfit (simplified calculation)
    let avgDaysBetweenRepeat = 0;
    if (outfitWears.length > 1) {
      const outfitStrings = outfitWears.map(w => 
        `${w.top_id}-${w.bottom_id}-${w.shoes_id}-${w.outerwear_id}`
      );
      const repeatOccurrences = outfitStrings.filter((str, idx) => 
        outfitStrings.indexOf(str) !== idx
      );
      avgDaysBetweenRepeat = repeatOccurrences.length > 0 
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
      avgDaysBetweenRepeat
    };
  }, [items, outfitWears]);

  // Get item image
  const getItemImage = (itemId: string | undefined): string | null => {
    if (!itemId) return null;
    const item = items.find(i => i.id === itemId);
    return item?.image_url || null;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#e0f6ff' }}>
        Loading statistics...
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header with time period selector */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem' 
      }}>
        <h2 style={{ color: '#e0f6ff', margin: 0, fontSize: '1.5rem' }}>Wardrobe Statistics</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['week', 'month', 'all'] as TimePeriod[]).map(period => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              style={{
                padding: '0.4rem 0.8rem',
                background: timePeriod === period ? '#1565c0' : '#243152',
                color: '#e0f6ff',
                border: '2px solid #1565c0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: timePeriod === period ? 600 : 400
              }}
            >
              {period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {/* Overview Card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Overview</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-number">{stats.totalItems}</div>
              <div className="stat-subtitle">Total Items</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-number">{stats.totalWears}</div>
              <div className="stat-subtitle">Outfits Logged</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-number" style={{ color: '#28a745' }}>{stats.cleanItems}</div>
              <div className="stat-subtitle">Clean Items</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-number" style={{ color: '#ffc107' }}>{stats.dirtyItems}</div>
              <div className="stat-subtitle">Dirty Items</div>
            </div>
          </div>
        </div>

        {/* Items by Category */}
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Items by Category</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sectionNames.map(section => (
              <div key={section} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#e0f6ff', fontSize: '0.9rem', width: '80px' }}>{section}</span>
                <div style={{ 
                  flex: 1, 
                  height: '20px', 
                  background: '#243152', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${stats.totalItems > 0 ? (stats.itemsByCategory[section] / stats.totalItems) * 100 : 0}%`,
                    height: '100%',
                    background: '#1565c0',
                    borderRadius: '4px',
                    transition: 'width 0.3s'
                  }} />
                </div>
                <span style={{ color: '#e0f6ff', fontSize: '0.85rem', width: '30px', textAlign: 'right' }}>
                  {stats.itemsByCategory[section]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Worn Items */}
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Most Worn Items</h3>
          </div>
          {stats.mostWornItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#e0f6ff', opacity: 0.7, padding: '1rem', fontSize: '0.9rem' }}>
              No wear data yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stats.mostWornItems.map((wc, idx) => (
                <div key={wc.itemId} className="stat-item-row">
                  <span style={{ 
                    color: '#1565c0', 
                    fontWeight: 'bold', 
                    width: '20px',
                    fontSize: '0.85rem'
                  }}>
                    #{idx + 1}
                  </span>
                  <img 
                    src={wc.item.image_url} 
                    alt={wc.item.type}
                    className="stat-item-image"
                  />
                  <div className="stat-item-info">
                    <div className="stat-item-name">{wc.item.type}</div>
                    <div className="stat-item-count">{wc.count} times worn</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Least Worn Items */}
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Neglected Items</h3>
          </div>
          {stats.leastWornItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#e0f6ff', opacity: 0.7, padding: '1rem', fontSize: '0.9rem' }}>
              Add items to see stats
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stats.leastWornItems.map((item) => (
                <div key={item.id} className="stat-item-row">
                  <img 
                    src={item.image_url} 
                    alt={item.type}
                    className="stat-item-image"
                  />
                  <div className="stat-item-info">
                    <div className="stat-item-name">{item.type}</div>
                    <div className="stat-item-count" style={{ color: '#ff8c00' }}>
                      {(item as ClothingItem & { wearCount?: number }).wearCount === 0 ? 'Never worn' : `${(item as ClothingItem & { wearCount?: number }).wearCount} times`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Color Distribution */}
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Color Distribution</h3>
          </div>
          {stats.colorDistribution.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#e0f6ff', opacity: 0.7, padding: '1rem', fontSize: '0.9rem' }}>
              No color data
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {stats.colorDistribution.slice(0, 10).map(({ color, count }) => (
                <div 
                  key={color}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.6rem',
                    background: '#243152',
                    borderRadius: '15px',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: color.toLowerCase().replace(' ', ''),
                    border: '1px solid #34507b'
                  }} />
                  <span style={{ color: '#e0f6ff' }}>{color}</span>
                  <span style={{ color: '#e0f6ff', opacity: 0.7 }}>({count})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ratings */}
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Outfit Ratings</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-number" style={{ color: '#ffc107' }}>
                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
              </div>
              <div className="stat-subtitle">Avg Rating (1-10)</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-number">
                {stats.topRatedOutfits.length}
              </div>
              <div className="stat-subtitle">Rated Outfits</div>
            </div>
          </div>
          
          {stats.topRatedOutfits.length > 0 && (
            <div>
              <h4 style={{ color: '#e0f6ff', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Top Rated:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stats.topRatedOutfits.slice(0, 3).map((outfit) => (
                  <div key={outfit.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.4rem',
                    background: '#243152',
                    borderRadius: '6px'
                  }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[outfit.top_id, outfit.bottom_id].map((id, idx) => {
                        const imgUrl = getItemImage(id);
                        return imgUrl ? (
                          <img 
                            key={idx}
                            src={imgUrl}
                            alt=""
                            style={{ width: '25px', height: '25px', objectFit: 'cover', borderRadius: '3px' }}
                          />
                        ) : null;
                      })}
                    </div>
                    <span style={{ color: '#ffc107', fontSize: '0.85rem', fontWeight: 600 }}>
                      {outfit.rating}/10
                    </span>
                    <span style={{ color: '#e0f6ff', fontSize: '0.75rem', opacity: 0.7 }}>
                      {outfit.worn_date}
                    </span>
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
