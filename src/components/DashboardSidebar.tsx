// DashboardSidebar Component - Shows weather, quick stats, and recent activity
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { fetchWeather, WeatherData, getWeatherIconUrl, getTemperatureCategory, TEMPERATURE_THRESHOLDS } from '../lib/weatherApi';
import { ClothingItem, OutfitWear } from '../lib/types';

interface QuickStats {
  totalItems: number;
  itemsWornThisWeek: number;
  savedOutfits: number;
  dirtyItems: number;
}

export default function DashboardSidebar() {
  const { user } = useAuth();
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [zipCode, setZipCode] = useState<string | null>(null);
  const [stats, setStats] = useState<QuickStats>({
    totalItems: 0,
    itemsWornThisWeek: 0,
    savedOutfits: 0,
    dirtyItems: 0
  });
  const [recentOutfits, setRecentOutfits] = useState<OutfitWear[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);

  // Load all sidebar data
  const loadSidebarData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all data in parallel
      const [
        { data: profileData },
        { data: itemsData },
        { data: savedData },
        { data: wearsData }
      ] = await Promise.all([
        supabase.from('profiles').select('zip_code').eq('id', user.id).maybeSingle(),
        supabase.from('clothing_items').select('*').eq('user_id', user.id),
        supabase.from('saved_outfits').select('id').eq('user_id', user.id),
        supabase.from('outfit_wears').select('*').eq('user_id', user.id).order('worn_date', { ascending: false }).limit(5)
      ]);

      // Set items for thumbnails
      if (itemsData) {
        setItems(itemsData);
      }

      // Calculate stats
      const totalItems = itemsData?.length || 0;
      const dirtyItems = itemsData?.filter(item => item.is_dirty).length || 0;
      const savedOutfits = savedData?.length || 0;

      // Calculate items worn this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      
      const { data: weekWears } = await supabase
        .from('outfit_wears')
        .select('id')
        .eq('user_id', user.id)
        .gte('worn_date', weekAgoStr);
      
      setStats({
        totalItems,
        itemsWornThisWeek: weekWears?.length || 0,
        savedOutfits,
        dirtyItems
      });

      // Set recent outfits
      if (wearsData) {
        setRecentOutfits(wearsData);
      }

      // Load weather if zip code is set
      if (profileData?.zip_code) {
        setZipCode(profileData.zip_code);
        setWeatherLoading(true);
        const weather = await fetchWeather(profileData.zip_code);
        setWeatherData(weather);
        setWeatherLoading(false);
      }

    } catch (e) {
      console.error('Failed to load sidebar data:', e);
    }
  }, [user]);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  // Get item image by ID
  const getItemImage = (itemId: string | undefined): string | null => {
    if (!itemId) return null;
    const item = items.find(i => i.id === itemId);
    return item?.image_url || null;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Weather Widget */}
      <div className="panel-card">
        <div className="panel-card-header">
          <h3 className="panel-card-title">Weather</h3>
        </div>
        
        {weatherLoading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#e0f6ff', opacity: 0.7 }}>
            Loading weather...
          </div>
        ) : weatherData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img 
                src={getWeatherIconUrl(weatherData.icon)} 
                alt={weatherData.condition}
                style={{ width: 50, height: 50 }}
              />
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e0f6ff' }}>
                  {weatherData.temperature}°F
                </div>
                <div style={{ fontSize: '0.8rem', color: '#e0f6ff', opacity: 0.8 }}>
                  High: {weatherData.highTemperature}°F
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#e0f6ff' }}>
              {weatherData.condition} • {weatherData.description}
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              padding: '0.4rem 0.6rem', 
              background: getTemperatureCategory(weatherData.highTemperature) === 'cold' ? '#1976d2' :
                          getTemperatureCategory(weatherData.highTemperature) === 'cool' ? '#42a5f5' :
                          getTemperatureCategory(weatherData.highTemperature) === 'warm' ? '#ff9800' : '#f44336',
              borderRadius: '6px',
              color: '#fff',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {getTemperatureCategory(weatherData.highTemperature) === 'cold' && `Cold (below ${TEMPERATURE_THRESHOLDS.COLD}°F)`}
              {getTemperatureCategory(weatherData.highTemperature) === 'cool' && `Cool (${TEMPERATURE_THRESHOLDS.COLD}-${TEMPERATURE_THRESHOLDS.COOL}°F)`}
              {getTemperatureCategory(weatherData.highTemperature) === 'warm' && `Warm (${TEMPERATURE_THRESHOLDS.COOL}-${TEMPERATURE_THRESHOLDS.WARM}°F)`}
              {getTemperatureCategory(weatherData.highTemperature) === 'hot' && `Hot (above ${TEMPERATURE_THRESHOLDS.WARM}°F)`}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '0.5rem', color: '#e0f6ff', opacity: 0.7, fontSize: '0.85rem' }}>
            {zipCode ? 'Weather unavailable' : 'Set zip code in Preferences'}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="panel-card">
        <div className="panel-card-header">
          <h3 className="panel-card-title">Quick Stats</h3>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.totalItems}</div>
            <div className="stat-label">Items</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.savedOutfits}</div>
            <div className="stat-label">Saved Outfits</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem', color: stats.itemsWornThisWeek > 0 ? '#28a745' : '#1565c0' }}>
              {stats.itemsWornThisWeek}
            </div>
            <div className="stat-label">Worn This Week</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem', color: stats.dirtyItems > 0 ? '#ffc107' : '#1565c0' }}>
              {stats.dirtyItems}
            </div>
            <div className="stat-label">Dirty Items</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="panel-card">
        <div className="panel-card-header">
          <h3 className="panel-card-title">Recent Outfits</h3>
        </div>
        
        {recentOutfits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '0.5rem', color: '#e0f6ff', opacity: 0.7, fontSize: '0.85rem' }}>
            No outfits logged yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentOutfits.map(outfit => (
              <div 
                key={outfit.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.5rem',
                  background: '#1a2238',
                  borderRadius: '8px',
                  border: '1px solid #34507b'
                }}
              >
                {/* Mini outfit preview */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '2px', 
                  width: '40px', 
                  height: '40px',
                  flexShrink: 0
                }}>
                  {[outfit.top_id, outfit.bottom_id].map((id, idx) => {
                    const imgUrl = getItemImage(id);
                    return imgUrl ? (
                      <img 
                        key={idx}
                        src={imgUrl}
                        alt=""
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          borderRadius: '3px'
                        }}
                      />
                    ) : (
                      <div 
                        key={idx}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: '#243152',
                          borderRadius: '3px'
                        }}
                      />
                    );
                  })}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e0f6ff' }}>
                    {formatDate(outfit.worn_date)}
                  </div>
                  {outfit.rating && (
                    <div style={{ fontSize: '0.7rem', color: '#ffc107' }}>
                      {'★'.repeat(Math.round(outfit.rating / 2))}{'☆'.repeat(5 - Math.round(outfit.rating / 2))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
