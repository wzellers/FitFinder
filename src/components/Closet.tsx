'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { Plus, X, ChevronDown, ChevronRight, WashingMachine } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ClothingImage from '@/components/ui/ClothingImage';
import PosterHeader from '@/components/ui/PosterHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import { sectionNames, colorPalette, clothingTypes } from '@/lib/constants';
import { getColorName, getColorStyle } from '@/lib/colorUtils';
import { describeItem } from '@/lib/itemLabels';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import type { ClothingItem, ClothingSection } from '@/lib/types';

// localStorage keys (per-viewer conveniences only)
const STORAGE_KEYS = {
  collapsedSections: 'fitfinder_closet_collapsed_sections',
  collapsedSubsections: 'fitfinder_closet_collapsed_subsections',
  // v2: empty types are now hidden by default
  hideEmpty: 'fitfinder_closet_hide_empty_v2',
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

type LaundryAction = 'clean' | 'dirty' | null;

export default function Closet({ onAddItem, onEditItem }: ClosetProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const filterId = useId();

  // Filters
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [filterDirty, setFilterDirty] = useState<'all' | 'clean' | 'dirty'>('all');

  // Collapse state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() =>
    loadJson(STORAGE_KEYS.collapsedSections, {}),
  );
  const [collapsedSubsections, setCollapsedSubsections] = useState<Record<string, boolean>>(() =>
    loadJson(STORAGE_KEYS.collapsedSubsections, {}),
  );
  const [hideEmpty, setHideEmpty] = useState<boolean>(() => loadJson(STORAGE_KEYS.hideEmpty, true));

  const [laundryAction, setLaundryAction] = useState<LaundryAction>(null);

  useEffect(() => {
    saveJson(STORAGE_KEYS.collapsedSections, collapsedSections);
  }, [collapsedSections]);
  useEffect(() => {
    saveJson(STORAGE_KEYS.collapsedSubsections, collapsedSubsections);
  }, [collapsedSubsections]);
  useEffect(() => {
    saveJson(STORAGE_KEYS.hideEmpty, hideEmpty);
  }, [hideEmpty]);

  const hasActiveFilters = filterSection !== '' || filterColor !== '' || filterDirty !== 'all';

  const fetchItems = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch {
      showToast("Couldn't load your closet. Refresh to try again.", 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getItemsForType = useCallback(
    (type: string) => {
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
    },
    [items, filterColor, filterDirty],
  );

  const getSectionCount = useCallback(
    (section: ClothingSection) =>
      clothingTypes[section].reduce((sum, type) => sum + getItemsForType(type).length, 0),
    [getItemsForType],
  );

  const bulkSetDirty = async (makeDirty: boolean) => {
    if (!user) return;
    setLaundryAction(null);
    const { error } = await supabase
      .from('clothing_items')
      .update({ is_dirty: makeDirty })
      .eq('user_id', user.id);
    if (error) {
      showToast("Couldn't update your laundry. Try again.", 'error');
      return;
    }
    showToast(makeDirty ? 'Everything is in the wash.' : 'Everything is clean.', 'success');
    fetchItems();
  };

  // Toggle a single item clean/dirty without opening the editor.
  const toggleItemDirty = async (item: ClothingItem) => {
    const next = !item.is_dirty;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_dirty: next } : i)));
    const { error } = await supabase
      .from('clothing_items')
      .update({ is_dirty: next })
      .eq('id', item.id);
    if (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_dirty: item.is_dirty } : i)),
      );
      showToast("Couldn't update that item. Try again.", 'error');
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
  const dirtyCount = items.filter((i) => i.is_dirty).length;

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

  const chip = (active: boolean) =>
    `min-h-[36px] px-3 rounded-full border text-sm font-semibold transition-colors ${
      active
        ? 'bg-[var(--sky)] text-[var(--burgundy)] border-[var(--sky)]'
        : 'bg-white text-[var(--text-secondary)] border-[var(--line-strong)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="w-full">
      <PosterHeader
        title="Closet"
        script="all yours"
        readout={
          items.length === 0
            ? '{ empty }'
            : `{ ${items.length} ${items.length === 1 ? 'item' : 'items'} · ${dirtyCount} in the wash }`
        }
        actions={
          <>
            <button onClick={() => setLaundryAction('clean')} className="btn-poster">
              <WashingMachine size={16} aria-hidden="true" /> Mark all clean
            </button>
            <button onClick={() => setLaundryAction('dirty')} className="btn-poster">
              Mark all dirty
            </button>
            <button onClick={onAddItem} className="btn-poster-primary order-first sm:order-last">
              <Plus size={18} aria-hidden="true" /> Add item
            </button>
          </>
        }
      />

      {/* Filters */}
      <div
        role="group"
        aria-label="Filter closet"
        className="card px-3 py-3 mb-8 flex flex-wrap items-center gap-2"
      >
        <label htmlFor={`${filterId}-section`} className="sr-only">
          Category
        </label>
        <select
          id={`${filterId}-section`}
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
          className="min-h-[36px] py-1"
        >
          <option value="">All categories</option>
          {sectionNames.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label htmlFor={`${filterId}-color`} className="sr-only">
          Color
        </label>
        <select
          id={`${filterId}-color`}
          value={filterColor}
          onChange={(e) => setFilterColor(e.target.value)}
          className="min-h-[36px] py-1"
        >
          <option value="">All colors</option>
          {colorPalette.map((c) => (
            <option key={c} value={c}>
              {getColorName(c)}
            </option>
          ))}
        </select>

        <div className="flex gap-1" role="group" aria-label="Laundry status">
          {(['all', 'clean', 'dirty'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterDirty(status)}
              aria-pressed={filterDirty === status}
              className={chip(filterDirty === status)}
            >
              {status === 'all' ? 'All' : status === 'clean' ? 'Clean' : 'Dirty'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setHideEmpty(!hideEmpty)}
          aria-pressed={hideEmpty}
          className={chip(hideEmpty)}
        >
          Hide empty types
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="min-h-[36px] px-2 text-sm font-semibold text-[var(--carbon)] hover:underline flex items-center gap-1"
          >
            <X size={14} aria-hidden="true" /> Clear filters
          </button>
        )}
      </div>

      {items.length === 0 && (
        <div className="card p-8 text-center mb-8">
          <p className="text-lg font-semibold mb-1">Your closet is empty</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Add a few photos of clothes you wear and FitFinder will tag the type and colors for you.
          </p>
          <button onClick={onAddItem} className="btn-primary">
            <Plus size={18} aria-hidden="true" /> Add your first item
          </button>
        </div>
      )}

      {/* Sections */}
      {sectionsToShow.map((section) => {
        const sectionCount = getSectionCount(section);
        const types = clothingTypes[section];
        const isSectionCollapsed = collapsedSections[section] ?? false;
        const emptyTypes = types.filter((t) => getItemsForType(t).length === 0);

        if (filterSection && sectionCount === 0) return null;

        return (
          <section key={section} className="mb-10">
            <button
              onClick={() => toggleSection(section)}
              aria-expanded={!isSectionCollapsed}
              className="w-full flex items-center gap-3 pb-2 mb-5 border-b border-[var(--border)] select-none group text-left"
            >
              {isSectionCollapsed ? (
                <ChevronRight size={22} aria-hidden="true" />
              ) : (
                <ChevronDown size={22} aria-hidden="true" />
              )}
              <h2 className="text-2xl">{section}</h2>
              <span className="readout">{sectionCount}</span>
            </button>

            {!isSectionCollapsed && (
              <div className="space-y-6">
                {types.map((type) => {
                  const typeItems = getItemsForType(type);
                  const subsectionKey = `${section}:${type}`;
                  const isSubCollapsed = collapsedSubsections[subsectionKey] ?? false;
                  const singleType = types.length === 1;

                  if (hideEmpty && typeItems.length === 0) return null;

                  return (
                    <div key={type}>
                      {!singleType && (
                        <button
                          onClick={() => toggleSubsection(subsectionKey)}
                          aria-expanded={!isSubCollapsed}
                          className="flex items-center gap-2 mb-3 min-h-[36px] select-none group"
                        >
                          {isSubCollapsed ? (
                            <ChevronRight size={16} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={16} aria-hidden="true" />
                          )}
                          <span className="font-semibold text-lg font-bold">{type}</span>
                          <span className="readout">{typeItems.length}</span>
                        </button>
                      )}

                      {(singleType || !isSubCollapsed) && (
                        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                          {typeItems.map((item) => (
                            <li key={item.id}>
                              <ItemCard
                                item={item}
                                onOpen={() => onEditItem?.(item)}
                                onToggleDirty={() => toggleItemDirty(item)}
                              />
                            </li>
                          ))}
                          <li>
                            <button
                              onClick={onAddItem}
                              className="w-full h-full min-h-[120px] rounded-md border-2 border-dashed border-[var(--line-strong)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus size={20} aria-hidden="true" />
                              <span className="text-sm font-semibold">
                                Add {type.toLowerCase()}
                              </span>
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  );
                })}

                {hideEmpty && emptyTypes.length > 0 && !singleTypeSection(types) && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-[var(--text-secondary)]">Nothing yet:</span>
                    {emptyTypes.map((t) => (
                      <button
                        key={t}
                        onClick={onAddItem}
                        className="min-h-[36px] px-3 rounded-full border border-dashed border-[var(--line-strong)] font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      <ConfirmDialog
        isOpen={laundryAction !== null}
        message={
          laundryAction === 'dirty'
            ? `Mark all ${items.length} items as dirty? They won't be picked for outfits until they're clean.`
            : `Mark all ${items.length} items as clean?`
        }
        confirmLabel={laundryAction === 'dirty' ? 'Mark all dirty' : 'Mark all clean'}
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => bulkSetDirty(laundryAction === 'dirty')}
        onCancel={() => setLaundryAction(null)}
      />
    </div>
  );
}

function singleTypeSection(types: string[]) {
  return types.length === 1;
}

interface ItemCardProps {
  item: ClothingItem;
  onOpen: () => void;
  onToggleDirty: () => void;
}

/** A closet item: photo, type, colors and a clean/dirty toggle. */
function ItemCard({ item, onOpen, onToggleDirty }: ItemCardProps) {
  const name = describeItem(item);
  return (
    <div className="item-card h-full flex flex-col">
      <button onClick={onOpen} className="text-left rounded-sm" aria-label={`Edit ${name}`}>
        <div className="item-card-photo aspect-square w-full">
          <ClothingImage
            src={item.image_url}
            alt=""
            className={`w-full h-full object-contain p-4 transition-[filter,opacity] ${
              item.is_dirty ? 'grayscale opacity-60' : ''
            }`}
          />
        </div>
        <div className="mt-2.5 px-0.5 text-sm font-medium leading-tight truncate">{item.type}</div>
      </button>
      <div className="flex items-center justify-between gap-2 mt-1.5 px-0.5">
        <span className="flex items-center gap-1" aria-hidden="true">
          {item.colors.map((c) => (
            <span
              key={c}
              title={getColorName(c)}
              className="w-3.5 h-3.5 rounded-full border border-black/20"
              style={getColorStyle(c)}
            />
          ))}
        </span>
        <button
          onClick={onToggleDirty}
          aria-label={`${name} is ${item.is_dirty ? 'dirty' : 'clean'}. Mark as ${
            item.is_dirty ? 'clean' : 'dirty'
          }`}
          className="min-h-[32px] min-w-[44px] flex items-center justify-end"
        >
          <span className={item.is_dirty ? 'badge-dirty' : 'badge-clean'}>
            {item.is_dirty ? 'Dirty' : 'Clean'}
          </span>
        </button>
      </div>
    </div>
  );
}
