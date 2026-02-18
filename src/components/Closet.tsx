"use client";

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { sectionNames, typeToSection } from '@/lib/constants';
import type { ClothingItem } from '@/lib/types';

interface ClosetProps {
  onAddItem: () => void;
  onEditItem?: (item: ClothingItem) => void;
}

export default function Closet({ onAddItem, onEditItem }: ClosetProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch {
      showToast('Failed to load closet items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getItemsForSection = (section: string) =>
    items.filter((item) => typeToSection[item.type] === section);

  const bulkMarkAllDirty = async (makeDirty: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update({ is_dirty: makeDirty })
        .eq('user_id', user.id);
      if (error) throw error;
      showToast(makeDirty ? 'All items marked dirty' : 'All items marked clean', 'success');
      fetchItems();
    } catch {
      showToast('Failed to update laundry status', 'error');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[var(--text-secondary)] text-sm">Loading closet...</div>;
  }

  return (
    <div className="w-full">
      {/* Top controls */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <button onClick={onAddItem} className="btn-primary">
          <Plus size={16} /> Add Item
        </button>
        <button onClick={() => bulkMarkAllDirty(true)} className="btn-secondary text-amber-600">
          Mark All Dirty
        </button>
        <button onClick={() => bulkMarkAllDirty(false)} className="btn-secondary text-green-600">
          Mark All Clean
        </button>
      </div>

      {sectionNames.map((section) => {
        const sectionItems = getItemsForSection(section);
        return (
          <section key={section} className="mb-8">
            <h2 className="section-header">{section}</h2>

            {sectionItems.length === 0 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={onAddItem}
                  className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <Plus size={28} />
                  <span className="text-xs mt-1">Add Item</span>
                </button>
                <p className="text-sm text-[var(--text-secondary)]">
                  No {section.toLowerCase()} yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {/* Add button */}
                <button
                  onClick={onAddItem}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <Plus size={24} />
                  <span className="text-[10px] mt-0.5">Add</span>
                </button>

                {sectionItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onEditItem?.(item)}
                    className={`aspect-square rounded-xl border border-[var(--border)] bg-white overflow-hidden relative group transition-shadow hover:shadow-md ${
                      item.is_dirty ? 'opacity-40 grayscale' : ''
                    }`}
                  >
                    <img
                      src={item.image_url}
                      alt={item.type}
                      className="w-full h-full object-contain p-2"
                    />
                    {item.is_dirty && (
                      <span className="absolute top-1 left-1 bg-amber-400 text-[10px] font-bold text-black px-1.5 py-0.5 rounded">
                        Dirty
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
