"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { typeToSection } from '@/lib/constants';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonCalendar } from '@/components/ui/Skeleton';
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
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number>(0);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      setNotes(day.outfit.notes || '');
      setRating(day.outfit.rating ?? 0);
    } else {
      setSelectedOutfitWear(null);
      resetForm();
    }
    setShowLogModal(true);
  };

  const resetForm = () => { setLogMode('custom'); setSelectedSavedOutfit(''); setSelectedTop(''); setSelectedBottom(''); setSelectedShoes(''); setNotes(''); setRating(0); };

  const handleSavedOutfitSelect = (id: string) => {
    setSelectedSavedOutfit(id);
    const o = savedOutfits.find((s) => s.id === id);
    if (o) { setSelectedTop(o.outfit_items.top_id || ''); setSelectedBottom(o.outfit_items.bottom_id); setSelectedShoes(o.outfit_items.shoes_id); }
  };

  const handleSave = async () => {
    if (!user || !selectedDate) return;
    if (!selectedTop && !selectedBottom && !selectedShoes) { showToast('Select at least one item', 'warning'); return; }
    const dateStr = selectedDate.toISOString().split('T')[0];
    try {
      const payload = {
        top_id: selectedTop || null,
        bottom_id: selectedBottom || null,
        shoes_id: selectedShoes || null,
        outfit_id: selectedSavedOutfit || null,
        notes: notes || null,
        rating: rating > 0 ? rating : null,
      };
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

  const requestDelete = () => {
    if (!selectedOutfitWear) return;
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedOutfitWear) return;
    setConfirmOpen(false);
    await supabase.from('outfit_wears').delete().eq('id', selectedOutfitWear.id);
    setShowLogModal(false);
    loadData();
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Star rating component
  const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--text)]">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className="p-0.5"
            title={`${n}/10`}
          >
            <Star
              size={18}
              className={`transition-colors ${
                n <= value
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="text-xs text-[var(--text-secondary)] ml-1 self-center">{value}/10</span>
        )}
      </div>
    </div>
  );

  if (loading) return <SkeletonCalendar />;

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
      <div className="grid grid-cols-7 gap-[2px] bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)]">
        {dayNames.map((d) => (
          <div key={d} className="bg-[var(--muted)] text-center text-xs font-medium text-[var(--text-secondary)] py-2">{d}</div>
        ))}
        {calendarDays.map((day, idx) => (
          <button
            key={idx}
            onClick={() => handleDayClick(day)}
            className={`group bg-white min-h-[120px] p-1.5 text-left flex flex-col transition-colors hover:bg-blue-50 ${
              !day.isCurrentMonth ? 'opacity-40' : ''
            } ${day.isToday ? 'ring-2 ring-inset ring-[var(--accent)]' : ''}`}
          >
            <span className={`text-xs font-medium ${day.isToday ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{day.dayOfMonth}</span>
            {day.outfit ? (
              <div className="flex flex-col gap-0.5 mt-auto">
                <div className="flex gap-0.5 flex-wrap">
                  {[day.outfit.top_id, day.outfit.bottom_id, day.outfit.shoes_id].filter(Boolean).map((id, i) => {
                    const url = getItemImage(id);
                    return url ? <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover" /> : null;
                  })}
                </div>
                {day.outfit.rating != null && (
                  <div className="flex items-center gap-0.5">
                    <Star size={10} className="text-amber-500 fill-amber-500" />
                    <span className="text-[10px] text-amber-600 font-medium">{day.outfit.rating}</span>
                  </div>
                )}
              </div>
            ) : (
              day.isCurrentMonth && (
                <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Plus size={16} className="text-[var(--text-secondary)]" />
                </div>
              )
            )}
          </button>
        ))}
      </div>

      {/* Log Modal */}
      {showLogModal && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="card p-6 w-[95vw] max-w-3xl max-h-[90vh] overflow-auto relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {selectedOutfitWear ? 'Edit' : 'Log'} Outfit — {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <button onClick={() => setShowLogModal(false)} className="btn-ghost p-1 text-lg">&times;</button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-5">
              <button onClick={() => { setLogMode('custom'); resetForm(); }} className={logMode === 'custom' ? 'btn-primary text-sm flex-1' : 'btn-secondary text-sm flex-1'}>Pick Items</button>
              <button onClick={() => setLogMode('saved')} className={logMode === 'saved' ? 'btn-primary text-sm flex-1' : 'btn-secondary text-sm flex-1'}>From Saved</button>
            </div>

            {logMode === 'saved' && (
              <select value={selectedSavedOutfit} onChange={(e) => handleSavedOutfitSelect(e.target.value)} className="w-full mb-5">
                <option value="">Select saved outfit...</option>
                {savedOutfits.map((o, idx) => (
                  <option key={o.id} value={o.id}>
                    {o.name || (o.created_at ? `Outfit from ${new Date(o.created_at).toLocaleDateString()}` : `Outfit #${idx + 1}`)}
                  </option>
                ))}
              </select>
            )}

            <div className="space-y-5 mb-5">
              {(['Tops', 'Bottoms', 'Shoes'] as const).map((section) => {
                const val = section === 'Tops' ? selectedTop : section === 'Bottoms' ? selectedBottom : selectedShoes;
                const setter = section === 'Tops' ? setSelectedTop : section === 'Bottoms' ? setSelectedBottom : setSelectedShoes;
                const sectionItems = getItemsBySection(section);
                return (
                  <div key={section}>
                    <label className="text-sm font-medium text-[var(--text)] mb-2 block">{section}</label>
                    <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-4 max-h-48 overflow-y-auto p-1">
                      {/* None option */}
                      <button
                        onClick={() => setter('')}
                        className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-xs text-[var(--text-secondary)] transition-all ${
                          val === '' ? 'border-[var(--accent)] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        None
                      </button>
                      {sectionItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setter(item.id)}
                          className={`w-20 h-20 rounded-xl border-2 overflow-hidden bg-white transition-all ${
                            val === item.id ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border)] hover:border-gray-400'
                          }`}
                        >
                          <img src={item.image_url} alt={item.type} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview */}
            <div className="flex gap-3 justify-center mb-5">
              {[selectedTop, selectedBottom, selectedShoes].filter(Boolean).map((id, i) => {
                const url = getItemImage(id);
                return url ? <img key={i} src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-[var(--border)]" /> : null;
              })}
            </div>

            {/* Rating */}
            <div className="mb-5">
              <StarRating value={rating} onChange={setRating} label="Outfit Rating" />
            </div>

            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full mb-5 min-h-[60px]" />

            <div className="flex gap-2 justify-end">
              {selectedOutfitWear && <button onClick={requestDelete} className="btn-danger text-sm mr-auto">Delete</button>}
              <button onClick={() => setShowLogModal(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} className="btn-primary text-sm">{selectedOutfitWear ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Delete this calendar entry?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
