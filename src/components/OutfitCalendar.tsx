// OutfitCalendar Component - Track what outfits were worn on which days
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { ClothingItem, OutfitWear, SavedOutfit, typeToSection } from '../lib/types';

interface DayData {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  outfit: OutfitWear | null;
}

export default function OutfitCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
  const [outfitWears, setOutfitWears] = useState<OutfitWear[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedOutfitWear, setSelectedOutfitWear] = useState<OutfitWear | null>(null);
  
  // Log outfit form state
  const [logMode, setLogMode] = useState<'saved' | 'custom'>('custom');
  const [selectedSavedOutfit, setSelectedSavedOutfit] = useState<string>('');
  const [selectedTop, setSelectedTop] = useState<string>('');
  const [selectedBottom, setSelectedBottom] = useState<string>('');
  const [selectedShoes, setSelectedShoes] = useState<string>('');
  const [selectedOuterwear, setSelectedOuterwear] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Get data for the entire visible calendar range (including prev/next month days)
      const calendarStart = new Date(startOfMonth);
      calendarStart.setDate(calendarStart.getDate() - startOfMonth.getDay());
      const calendarEnd = new Date(endOfMonth);
      calendarEnd.setDate(calendarEnd.getDate() + (6 - endOfMonth.getDay()));

      const [
        { data: wearsData },
        { data: itemsData },
        { data: savedData }
      ] = await Promise.all([
        supabase
          .from('outfit_wears')
          .select('*')
          .eq('user_id', user.id)
          .gte('worn_date', calendarStart.toISOString().split('T')[0])
          .lte('worn_date', calendarEnd.toISOString().split('T')[0]),
        supabase.from('clothing_items').select('*').eq('user_id', user.id),
        supabase.from('saved_outfits').select('*').eq('user_id', user.id)
      ]);

      setOutfitWears(wearsData || []);
      setItems(itemsData || []);
      setSavedOutfits(savedData || []);
    } catch (e) {
      console.error('Failed to load calendar data:', e);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate calendar days for the current month view
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: DayData[] = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: false,
        isToday: false,
        outfit: outfitWears.find(w => w.worn_date === dateStr) || null
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        outfit: outfitWears.find(w => w.worn_date === dateStr) || null
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dayOfMonth: i,
        isCurrentMonth: false,
        isToday: false,
        outfit: outfitWears.find(w => w.worn_date === dateStr) || null
      });
    }

    setCalendarDays(days);
  }, [currentDate, outfitWears]);

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get item image by ID
  const getItemImage = (itemId: string | undefined): string | null => {
    if (!itemId) return null;
    const item = items.find(i => i.id === itemId);
    return item?.image_url || null;
  };

  // Filter items by category
  const getItemsBySection = (section: string) => {
    return items.filter(item => typeToSection[item.type] === section && !item.is_dirty);
  };

  // Handle day click
  const handleDayClick = (day: DayData) => {
    setSelectedDate(day.date);
    if (day.outfit) {
      setSelectedOutfitWear(day.outfit);
      // Pre-populate form with existing data
      setSelectedTop(day.outfit.top_id || '');
      setSelectedBottom(day.outfit.bottom_id || '');
      setSelectedShoes(day.outfit.shoes_id || '');
      setSelectedOuterwear(day.outfit.outerwear_id || '');
      setNotes(day.outfit.notes || '');
    } else {
      setSelectedOutfitWear(null);
      resetForm();
    }
    setShowLogModal(true);
  };

  // Reset form
  const resetForm = () => {
    setLogMode('custom');
    setSelectedSavedOutfit('');
    setSelectedTop('');
    setSelectedBottom('');
    setSelectedShoes('');
    setSelectedOuterwear('');
    setNotes('');
  };

  // Handle saved outfit selection
  const handleSavedOutfitSelect = (outfitId: string) => {
    setSelectedSavedOutfit(outfitId);
    const outfit = savedOutfits.find(o => o.id === outfitId);
    if (outfit) {
      setSelectedTop(outfit.outfit_items.top_id || '');
      setSelectedBottom(outfit.outfit_items.bottom_id);
      setSelectedShoes(outfit.outfit_items.shoes_id);
      setSelectedOuterwear(outfit.outfit_items.outerwear_id || '');
    }
  };

  // Save outfit wear
  const handleSave = async () => {
    if (!user || !selectedDate) return;
    if (!selectedTop && !selectedBottom && !selectedShoes) {
      alert('Please select at least one item');
      return;
    }

    const dateStr = selectedDate.toISOString().split('T')[0];

    try {
      if (selectedOutfitWear) {
        // Update existing
        await supabase
          .from('outfit_wears')
          .update({
            top_id: selectedTop || null,
            bottom_id: selectedBottom || null,
            shoes_id: selectedShoes || null,
            outerwear_id: selectedOuterwear || null,
            outfit_id: selectedSavedOutfit || null,
            notes: notes || null
          })
          .eq('id', selectedOutfitWear.id);
      } else {
        // Create new
        await supabase
          .from('outfit_wears')
          .insert({
            user_id: user.id,
            worn_date: dateStr,
            top_id: selectedTop || null,
            bottom_id: selectedBottom || null,
            shoes_id: selectedShoes || null,
            outerwear_id: selectedOuterwear || null,
            outfit_id: selectedSavedOutfit || null,
            notes: notes || null
          });
      }

      setShowLogModal(false);
      loadData();
    } catch (e) {
      console.error('Failed to save outfit wear:', e);
      alert('Failed to save. Please try again.');
    }
  };

  // Delete outfit wear
  const handleDelete = async () => {
    if (!selectedOutfitWear) return;
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      await supabase
        .from('outfit_wears')
        .delete()
        .eq('id', selectedOutfitWear.id);

      setShowLogModal(false);
      loadData();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-container" style={{ maxWidth: '100%' }}>
      {/* Calendar Header */}
      <div className="calendar-header">
        <button className="calendar-nav-button" onClick={goToPrevMonth}>
          ← Prev
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 className="calendar-month-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button 
            className="calendar-nav-button" 
            onClick={goToToday}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
          >
            Today
          </button>
        </div>
        <button className="calendar-nav-button" onClick={goToNextMonth}>
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day headers */}
        {dayNames.map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.outfit ? 'has-outfit' : ''}`}
            onClick={() => handleDayClick(day)}
          >
            <div className="calendar-day-number">{day.dayOfMonth}</div>
            <div className="calendar-day-outfit">
              {day.outfit && (
                <div className="calendar-outfit-thumbnail">
                  {[day.outfit.top_id, day.outfit.bottom_id, day.outfit.shoes_id, day.outfit.outerwear_id]
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((id, idx) => {
                      const imgUrl = getItemImage(id);
                      return imgUrl ? (
                        <img key={idx} src={imgUrl} alt="" />
                      ) : null;
                    })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Log Outfit Modal */}
      {showLogModal && selectedDate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300
        }}>
          <div style={{
            background: '#1a2238',
            border: '2px solid #34507b',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#e0f6ff', margin: 0 }}>
                {selectedOutfitWear ? 'Edit' : 'Log'} Outfit - {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                style={{ background: 'none', border: 'none', color: '#e0f6ff', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => { setLogMode('custom'); resetForm(); }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: logMode === 'custom' ? '#1565c0' : '#243152',
                  color: '#e0f6ff',
                  border: '2px solid #1565c0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Pick Items
              </button>
              <button
                onClick={() => setLogMode('saved')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: logMode === 'saved' ? '#1565c0' : '#243152',
                  color: '#e0f6ff',
                  border: '2px solid #1565c0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                From Saved Outfits
              </button>
            </div>

            {/* Saved Outfit Selection */}
            {logMode === 'saved' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#e0f6ff', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                  Select Saved Outfit:
                </label>
                <select
                  value={selectedSavedOutfit}
                  onChange={(e) => handleSavedOutfitSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#243152',
                    color: '#e0f6ff',
                    border: '2px solid #34507b',
                    borderRadius: '6px'
                  }}
                >
                  <option value="">-- Select an outfit --</option>
                  {savedOutfits.map(outfit => (
                    <option key={outfit.id} value={outfit.id}>
                      Outfit from {outfit.created_at ? new Date(outfit.created_at).toLocaleDateString() : 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Item Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Top */}
              <div>
                <label style={{ color: '#e0f6ff', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Top:</label>
                <select
                  value={selectedTop}
                  onChange={(e) => setSelectedTop(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#243152',
                    color: '#e0f6ff',
                    border: '2px solid #34507b',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- None --</option>
                  {getItemsBySection('Tops').map(item => (
                    <option key={item.id} value={item.id}>{item.type}</option>
                  ))}
                </select>
              </div>

              {/* Bottom */}
              <div>
                <label style={{ color: '#e0f6ff', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Bottom:</label>
                <select
                  value={selectedBottom}
                  onChange={(e) => setSelectedBottom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#243152',
                    color: '#e0f6ff',
                    border: '2px solid #34507b',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- None --</option>
                  {getItemsBySection('Bottoms').map(item => (
                    <option key={item.id} value={item.id}>{item.type}</option>
                  ))}
                </select>
              </div>

              {/* Shoes */}
              <div>
                <label style={{ color: '#e0f6ff', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Shoes:</label>
                <select
                  value={selectedShoes}
                  onChange={(e) => setSelectedShoes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#243152',
                    color: '#e0f6ff',
                    border: '2px solid #34507b',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- None --</option>
                  {getItemsBySection('Shoes').map(item => (
                    <option key={item.id} value={item.id}>{item.type}</option>
                  ))}
                </select>
              </div>

              {/* Outerwear */}
              <div>
                <label style={{ color: '#e0f6ff', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Outerwear:</label>
                <select
                  value={selectedOuterwear}
                  onChange={(e) => setSelectedOuterwear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#243152',
                    color: '#e0f6ff',
                    border: '2px solid #34507b',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- None --</option>
                  {getItemsBySection('Outerwear').map(item => (
                    <option key={item.id} value={item.id}>{item.type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Items Preview */}
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              justifyContent: 'center', 
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              {[selectedTop, selectedBottom, selectedShoes, selectedOuterwear].map((id, idx) => {
                const imgUrl = getItemImage(id);
                return imgUrl ? (
                  <img
                    key={idx}
                    src={imgUrl}
                    alt=""
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid #34507b'
                    }}
                  />
                ) : null;
              })}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#e0f6ff', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Notes (optional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Work meeting, date night..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#243152',
                  color: '#e0f6ff',
                  border: '2px solid #34507b',
                  borderRadius: '6px',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {selectedOutfitWear && (
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginRight: 'auto'
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#243152',
                  color: '#e0f6ff',
                  border: '2px solid #34507b',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#1565c0',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {selectedOutfitWear ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
