"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, ChevronDown, ChevronRight, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { sectionNames, typeToSection, colorPalette, clothingTypes } from '@/lib/constants';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import type { ClothingItem, ClothingSection } from '@/lib/types';

// localStorage keys
const STORAGE_KEYS = {
  collapsedSections: 'fitfinder_closet_collapsed_sections',
  collapsedSubsections: 'fitfinder_closet_collapsed_subsections',
  hideEmpty: 'fitfinder_closet_hide_empty',
} as const;

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const cached = localStorage.getItem(key);
    return cached ? (JSON.parse(cached) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage might be full or unavailable
  }
}

interface ClosetProps {
  onAddItem: () => void;
  onEditItem?: (item: ClothingItem) => void;
}

export default function Closet({ onAddItem, onEditItem }: ClosetProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Filters
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [filterDirty, setFilterDirty] = useState<'all' | 'clean' | 'dirty'>('all');

  // Collapse state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    () => loadJson(STORAGE_KEYS.collapsedSections, {}),
  );
  const [collapsedSubsections, setCollapsedSubsections] = useState<Record<string, boolean>>(
    () => loadJson(STORAGE_KEYS.collapsedSubsections, {}),
  );
  const [hideEmpty, setHideEmpty] = useState<boolean>(
    () => loadJson(STORAGE_KEYS.hideEmpty, false),
  );

  // Persist collapse state
  useEffect(() => { saveJson(STORAGE_KEYS.collapsedSections, collapsedSections); }, [collapsedSections]);
  useEffect(() => { saveJson(STORAGE_KEYS.collapsedSubsections, collapsedSubsections); }, [collapsedSubsections]);
  useEffect(() => { saveJson(STORAGE_KEYS.hideEmpty, hideEmpty); }, [hideEmpty]);

  const hasActiveFilters = filterSection !== '' || filterColor !== '' || filterDirty !== 'all';

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

  // Filter items by type (subsection level)
  const getItemsForType = useCallback((type: string) => {
    let filtered = items.filter((item) => item.type === type);
    if (filterColor) {
      filtered = filtered.filter((item) => item.colors.includes(filterColor));
    }
    if (filterDirty === 'clean') {
      filtered = filtered.filter((item) => !item.is_dirty);
    } else if (filterDirty === 'dirty') {
      filtered = filtered.filter((item) => item.is_dirty);
    }
    return filtered;
  }, [items, filterColor, filterDirty]);

  // Get total filtered count for a section
  const getSectionCount = useCallback((section: ClothingSection) => {
    return clothingTypes[section].reduce((sum, type) => sum + getItemsForType(type).length, 0);
  }, [getItemsForType]);

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

  const clearFilters = () => {
    setFilterSection('');
    setFilterColor('');
    setFilterDirty('all');
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSubsection = (key: string) => {
    setCollapsedSubsections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionsToShow = filterSection ? [filterSection as ClothingSection] : sectionNames;

  if (loading) {
    return (
      <div className="w-full">
        {sectionNames.map((section) => (
          <section key={section} className="mb-8">
            <h2 className="section-header">{section}</h2>
            <SkeletonGrid count={6} />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full flex gap-6">
      {/* Left sidebar — action buttons */}
      <div className="hidden sm:flex flex-col gap-2 shrink-0 w-[140px]">
        <button onClick={onAddItem} className="btn-primary text-sm">
          <Plus size={16} /> Add Item
        </button>
        <button onClick={() => bulkMarkAllDirty(true)} className="btn-secondary text-amber-600 text-sm">
          Mark All Dirty
        </button>
        <button onClick={() => bulkMarkAllDirty(false)} className="btn-secondary text-green-600 text-sm">
          Mark All Clean
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">

      {/* Mobile-only action buttons */}
      <div className="flex sm:hidden items-center gap-2 flex-wrap mb-4">
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

      {/* Filter bar */}
      <div className="bg-[var(--muted)] rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3">
        <select
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
          className="text-xs"
        >
          <option value="">All Categories</option>
          {sectionNames.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filterColor}
          onChange={(e) => setFilterColor(e.target.value)}
          className="text-xs"
        >
          <option value="">All Colors</option>
          {colorPalette.map((c) => (
            <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {(['all', 'clean', 'dirty'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterDirty(status)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                filterDirty === status
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
              }`}
            >
              {status === 'all' ? 'All' : status === 'clean' ? 'Clean' : 'Dirty'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setHideEmpty(!hideEmpty)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors flex items-center gap-1 ${
            hideEmpty
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
          }`}
        >
          <EyeOff size={12} /> Hide Empty
        </button>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Sections */}
      {sectionsToShow.map((section) => {
        const sectionCount = getSectionCount(section);
        const types = clothingTypes[section];
        const isSectionCollapsed = collapsedSections[section] ?? false;

        // When filtering to a specific section, don't hide it even if empty
        if (filterSection && sectionCount === 0) return null;

        return (
          <section key={section} className="mb-8">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section)}
              className="w-full flex items-center gap-3 pb-3 mb-4 border-b-2 border-[var(--border)] select-none cursor-pointer group"
            >
              {isSectionCollapsed
                ? <ChevronRight size={22} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
                : <ChevronDown size={22} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
              }
              <h2 className="text-2xl font-bold text-[var(--text)] tracking-tight">{section}</h2>
              <span className="bg-[var(--accent-light)] text-[var(--accent)] text-sm font-semibold px-2.5 py-0.5 rounded-full">
                {sectionCount}
              </span>
            </button>

            {!isSectionCollapsed && (
              <div className="space-y-4 pl-2">
                {types.map((type) => {
                  const typeItems = getItemsForType(type);
                  const subsectionKey = `${section}:${type}`;
                  const isSubCollapsed = collapsedSubsections[subsectionKey] ?? false;
                  const singleType = types.length === 1;

                  // Hide empty subsections if toggle is on
                  if (hideEmpty && typeItems.length === 0) return null;

                  return (
                    <div key={type}>
                      {/* Subsection header — skip when section has only one type */}
                      {!singleType && (
                        <button
                          onClick={() => toggleSubsection(subsectionKey)}
                          className="flex items-center gap-2 mb-3 select-none cursor-pointer group"
                        >
                          {isSubCollapsed
                            ? <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
                            : <ChevronDown size={16} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
                          }
                          <span className="text-base font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">
                            {type}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)] bg-[var(--muted)] px-2 py-0.5 rounded-full font-medium">
                            {typeItems.length}
                          </span>
                        </button>
                      )}

                      {/* Subsection content */}
                      {(singleType || !isSubCollapsed) && (
                        <>
                          {typeItems.length === 0 ? (
                            <div className="flex items-center gap-3 ml-5 mb-2">
                              <button
                                onClick={onAddItem}
                                className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                              >
                                <Plus size={20} />
                                <span className="text-[10px] mt-0.5">Add</span>
                              </button>
                              <p className="text-xs text-[var(--text-secondary)]">
                                No {type.toLowerCase()}s yet
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 ml-5 mb-2">
                              {/* Add button */}
                              <button
                                onClick={onAddItem}
                                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors aspect-square"
                              >
                                <Plus size={20} />
                                <span className="text-[10px] mt-0.5">Add</span>
                              </button>

                              {typeItems.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => onEditItem?.(item)}
                                  className={`flex flex-col rounded-xl border border-[var(--border)] bg-white overflow-hidden relative group transition-shadow hover:shadow-md ${
                                    item.is_dirty ? 'opacity-40 grayscale' : ''
                                  }`}
                                >
                                  <div className="aspect-square w-full overflow-hidden">
                                    <img
                                      src={item.image_url}
                                      alt={item.type}
                                      className="w-full h-full object-contain p-1.5"
                                    />
                                  </div>
                                  {item.is_dirty && (
                                    <span className="absolute top-1 left-1 bg-amber-400 text-[10px] font-bold text-black px-1.5 py-0.5 rounded">
                                      Dirty
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      </div>
    </div>
  );
}
