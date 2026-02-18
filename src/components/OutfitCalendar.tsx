"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { typeToSection } from '@/lib/constants';
import type { ClothingItem, OutfitWear, SavedOutfit } from '@/lib/types';

interface DayData {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  outfit: OutfitWear | null;
}

export default function OutfitCalendar() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
  const [outfitWears, setOutfitWears] = useState<OutfitWear[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedOutfitWear, setSelectedOutfitWear] = useState<OutfitWear | null>(null);
  const [logMode, setLogMode] = useState<'saved' | 'custom'>('custom');
  const [selectedSavedOutfit, setSelectedSavedOutfit] = useState('');
  const [selectedTop, setSelectedTop] = useState('');
  const [selectedBottom, setSelectedBottom] = useState('');
  const [selectedShoes, setSelectedShoes] = useState('');
  const [selectedOuterwear, setSelectedOuterwear] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const calStart = new Date(startOfMonth);
      calStart.setDate(calStart.getDate() - startOfMonth.getDay());
      const calEnd = new Date(endOfMonth);
      calEnd.setDate(calEnd.getDate() + (6 - endOfMonth.getDay()));

      const [{ data: wearsData }, { data: itemsData }, { data: savedData }] = await Promise.all([
        supabase.from('outfit_wears').select('*').eq('user_id', user.id)
          .gte('worn_date', calStart.toISOString().split('T')[0])
          .lte('worn_date', calEnd.toISOString().split('T')[0]),
        supabase.from('clothing_items').select('*').eq('user_id', user.id),
        supabase.from('saved_outfits').select('*').eq('user_id', user.id),
      ]);
      setOutfitWears(wearsData || []);
      setItems(itemsData || []);
      setSavedOutfits(savedData || []);
    } catch {
      showToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, currentDate, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: DayData[] = [];

    const prev = new Date(year, month, 0);
    for (let i = first.getDay() - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prev.getDate() - i);
      days.push({ date: d, dayOfMonth: d.getDate(), isCurrentMonth: false, isToday: false, outfit: outfitWears.find((w) => w.worn_date === d.toISOString().split('T')[0]) ?? null });
    }
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(year, month, day);
      days.push({ date: d, dayOfMonth: day, isCurrentMonth: true, isToday: d.getTime() === today.getTime(), outfit: outfitWears.find((w) => w.worn_date === d.toISOString().split('T')[0]) ?? null });
    }
    const rem = 42 - days.length;
    for (let i = 1; i <= rem; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dayOfMonth: i, isCurrentMonth: false, isToday: false, outfit: outfitWears.find((w) => w.worn_date === d.toISOString().split('T')[0]) ?? null });
    }
    setCalendarDays(days);
  }, [currentDate, outfitWears]);

  const getItemImage = (id: string | undefined) => id ? items.find((i) => i.id === id)?.image_url ?? null : null;
  const getItemsBySection = (section: string) => items.filter((i) => typeToSection[i.type] === section && !i.is_dirty);

  const handleDayClick = (day: DayData) => {
    setSelectedDate(day.date);
    if (day.outfit) {
      setSelectedOutfitWear(day.outfit);
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

  const resetForm = () => { setLogMode('custom'); setSelectedSavedOutfit(''); setSelectedTop(''); setSelectedBottom(''); setSelectedShoes(''); setSelectedOuterwear(''); setNotes(''); };

  const handleSavedOutfitSelect = (id: string) => {
    setSelectedSavedOutfit(id);
    const o = savedOutfits.find((s) => s.id === id);
    if (o) { setSelectedTop(o.outfit_items.top_id || ''); setSelectedBottom(o.outfit_items.bottom_id); setSelectedShoes(o.outfit_items.shoes_id); setSelectedOuterwear(o.outfit_items.outerwear_id || ''); }
  };

  const handleSave = async () => {
    if (!user || !selectedDate) return;
    if (!selectedTop && !selectedBottom && !selectedShoes) { showToast('Select at least one item', 'warning'); return; }
    const dateStr = selectedDate.toISOString().split('T')[0];
    try {
      const payload = { top_id: selectedTop || null, bottom_id: selectedBottom || null, shoes_id: selectedShoes || null, outerwear_id: selectedOuterwear || null, outfit_id: selectedSavedOutfit || null, notes: notes || null };
      if (selectedOutfitWear) {
        await supabase.from('outfit_wears').update(payload).eq('id', selectedOutfitWear.id);
      } else {
        await supabase.from('outfit_wears').insert({ user_id: user.id, worn_date: dateStr, ...payload });
      }
      setShowLogModal(false);
      loadData();
    } catch {
      showToast('Failed to save', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedOutfitWear || !confirm('Delete this entry?')) return;
    await supabase.from('outfit_wears').delete().eq('id', selectedOutfitWear.id);
    setShowLogModal(false);
    loadData();
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) return <div className="text-center py-12 text-[var(--text-secondary)] text-sm">Loading calendar...</div>;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={() => setCurrentDate(new Date())} className="btn-secondary text-xs">Today</button>
        </div>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="btn-ghost p-2"><ChevronRight size={18} /></button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)]">
        {dayNames.map((d) => (
          <div key={d} className="bg-[var(--muted)] text-center text-xs font-medium text-[var(--text-secondary)] py-2">{d}</div>
        ))}
        {calendarDays.map((day, idx) => (
          <button
            key={idx}
            onClick={() => handleDayClick(day)}
            className={`bg-white min-h-[80px] p-1.5 text-left flex flex-col transition-colors hover:bg-blue-50 ${
              !day.isCurrentMonth ? 'opacity-40' : ''
            } ${day.isToday ? 'ring-2 ring-inset ring-[var(--accent)]' : ''}`}
          >
            <span className={`text-xs font-medium ${day.isToday ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{day.dayOfMonth}</span>
            {day.outfit && (
              <div className="flex gap-0.5 mt-auto flex-wrap">
                {[day.outfit.top_id, day.outfit.bottom_id].filter(Boolean).map((id, i) => {
                  const url = getItemImage(id);
                  return url ? <img key={i} src={url} alt="" className="w-5 h-5 rounded object-cover" /> : null;
                })}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Log Modal */}
      {showLogModal && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-[var(--text)]">
                {selectedOutfitWear ? 'Edit' : 'Log'} Outfit — {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <button onClick={() => setShowLogModal(false)} className="btn-ghost p-1 text-lg">&times;</button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setLogMode('custom'); resetForm(); }} className={logMode === 'custom' ? 'btn-primary text-xs flex-1' : 'btn-secondary text-xs flex-1'}>Pick Items</button>
              <button onClick={() => setLogMode('saved')} className={logMode === 'saved' ? 'btn-primary text-xs flex-1' : 'btn-secondary text-xs flex-1'}>From Saved</button>
            </div>

            {logMode === 'saved' && (
              <select value={selectedSavedOutfit} onChange={(e) => handleSavedOutfitSelect(e.target.value)} className="w-full mb-4">
                <option value="">Select saved outfit...</option>
                {savedOutfits.map((o) => <option key={o.id} value={o.id}>Outfit from {o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Unknown'}</option>)}
              </select>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['Tops', 'Bottoms', 'Shoes', 'Outerwear'] as const).map((section) => {
                const val = section === 'Tops' ? selectedTop : section === 'Bottoms' ? selectedBottom : section === 'Shoes' ? selectedShoes : selectedOuterwear;
                const setter = section === 'Tops' ? setSelectedTop : section === 'Bottoms' ? setSelectedBottom : section === 'Shoes' ? setSelectedShoes : setSelectedOuterwear;
                return (
                  <div key={section}>
                    <label className="text-xs font-medium text-[var(--text)] mb-1 block">{section}</label>
                    <select value={val} onChange={(e) => setter(e.target.value)} className="w-full text-sm">
                      <option value="">None</option>
                      {getItemsBySection(section).map((i) => <option key={i.id} value={i.id}>{i.type}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Preview */}
            <div className="flex gap-2 justify-center mb-4">
              {[selectedTop, selectedBottom, selectedShoes, selectedOuterwear].map((id, i) => {
                const url = getItemImage(id);
                return url ? <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[var(--border)]" /> : null;
              })}
            </div>

            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full mb-4 min-h-[60px]" />

            <div className="flex gap-2 justify-end">
              {selectedOutfitWear && <button onClick={handleDelete} className="btn-danger text-xs mr-auto">Delete</button>}
              <button onClick={() => setShowLogModal(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={handleSave} className="btn-primary text-xs">{selectedOutfitWear ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
