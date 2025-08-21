import React, { useEffect, useMemo, useState } from 'react';
import ColorCombinationModal from './ColorCombinationModal';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './ToastProvider';

// Copy getColorName from StickFigure
const colorNameMap: { [key: string]: string } = {
  '#000000': 'Black',
  'black': 'Black',
  '#ffffff': 'White',
  'white': 'White',
  '#808080': 'Gray',
  'gray': 'Gray',
  '#f5f5dc': 'Beige',
  'beige': 'Beige',
  '#87ceeb': 'Light Blue',
  'light blue': 'Light Blue',
  '#0000ff': 'Blue',
  'blue': 'Blue',
  '#000080': 'Navy Blue',
  'navy blue': 'Navy Blue',
  '#191970': 'Denim',
  'denim': 'Denim',
  '#90ee90': 'Light Green',
  'light green': 'Light Green',
  '#006400': 'Dark Green',
  'dark green': 'Dark Green',
  '#7B3F00': 'Brown',
  '#7b3f00': 'Brown',
  'brown': 'Brown',
  '#ffff00': 'Yellow',
  'yellow': 'Yellow',
  '#ffa500': 'Orange',
  'orange': 'Orange',
  '#ff0000': 'Red',
  'red': 'Red',
  '#ffc0cb': 'Pink',
  'pink': 'Pink',
  '#800080': 'Purple',
  'purple': 'Purple',
};
function getColorName(color: string) {
  if (!color) return 'None';
  if (colorNameMap[color.toLowerCase()]) return colorNameMap[color.toLowerCase()];
  if (color.startsWith('#') && colorNameMap[color.toLowerCase()]) return colorNameMap[color.toLowerCase()];
  if (colorNameMap[color]) return colorNameMap[color];
  return color.charAt(0).toUpperCase() + color.slice(1);
}

const colorPalette = [
  "white", "gray", "black", "beige",
  "light blue", "blue", "navy blue", "denim",
  "light green", "dark green", "brown", "yellow",
  "orange", "red", "pink", "purple"
];

interface ColorCombination {
  id: string;
  topColor: string;
  bottomColor: string;
}

export default function ColorPreferences() {
  const { user } = useAuth();
  const [selectedTopColor, setSelectedTopColor] = useState('');
  const [selectedBottomColor, setSelectedBottomColor] = useState('');
  const [likedCombinations, setLikedCombinations] = useState<ColorCombination[]>([]);
  const [dislikedCombinations, setDislikedCombinations] = useState<ColorCombination[]>([]);
  const [selectionMode, setSelectionMode] = useState<'top' | 'bottom'>('top');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCombination, setSelectedCombination] = useState<ColorCombination | null>(null);
  const [selectedCombinationType, setSelectedCombinationType] = useState<'liked' | 'disliked'>('liked');
  const [message, setMessage] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const normalizedKey = (combo: { topColor: string; bottomColor: string }) =>
    `${combo.topColor.toLowerCase()}__${combo.bottomColor.toLowerCase()}`;

  const likedKeys = useMemo(() => new Set(likedCombinations.map(c => normalizedKey(c))), [likedCombinations]);
  const dislikedKeys = useMemo(() => new Set(dislikedCombinations.map(c => normalizedKey(c))), [dislikedCombinations]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prefs, error } = await supabase
        .from('color_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Error loading color preferences:', error);
        showToast('Failed to load preferences', 'error');
        return;
      }
      if (!prefs) {
        // No preferences exist yet, start with empty arrays
        setLikedCombinations([]);
        setDislikedCombinations([]);
      } else {
        const liked = (prefs.liked_combinations ?? []).map((c: any) => ({ id: c.id ?? `${c.topColor}-${c.bottomColor}`, topColor: c.topColor, bottomColor: c.bottomColor }));
        const disliked = (prefs.disliked_combinations ?? []).map((c: any) => ({ id: c.id ?? `${c.topColor}-${c.bottomColor}`, topColor: c.topColor, bottomColor: c.bottomColor }));
        setLikedCombinations(liked);
        setDislikedCombinations(disliked);
      }
    };
    load();
  }, [user]);

  const addCombination = async (isLiked: boolean) => {
    if (!user) return;
    if (!selectedTopColor || !selectedBottomColor) return;

    const newCombination: ColorCombination = {
      id: Date.now().toString(),
      topColor: selectedTopColor,
      bottomColor: selectedBottomColor,
    };

    const key = normalizedKey(newCombination);
    const isDuplicateInLiked = likedKeys.has(key);
    const isDuplicateInDisliked = dislikedKeys.has(key);
    if ((isLiked && isDuplicateInLiked) || (!isLiked && isDuplicateInDisliked)) {
      showToast('This color combination already exists', 'warning');
      return;
    }
    if ((isLiked && isDuplicateInDisliked) || (!isLiked && isDuplicateInLiked)) {
      showToast('This combination exists in the opposite list. Remove it there first.', 'warning');
      return;
    }

    setBusy(true);
    try {
      const nextLiked = isLiked ? [...likedCombinations, newCombination] : likedCombinations;
      const nextDisliked = !isLiked ? [...dislikedCombinations, newCombination] : dislikedCombinations;

      const { error } = await supabase
        .from('color_preferences')
        .upsert(
          {
            user_id: user.id,
            liked_combinations: nextLiked.map(c => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
            disliked_combinations: nextDisliked.map(c => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
          },
          { onConflict: 'user_id' }
        );
      if (error) {
        console.error('Error saving preferences:', error);
        showToast('Failed to save. Try again.', 'error');
        return;
      }
      if (isLiked) {
        setLikedCombinations(nextLiked);
      } else {
        setDislikedCombinations(nextDisliked);
      }
      showToast('Added successfully', 'success');
      setSelectedTopColor('');
      setSelectedBottomColor('');
    } finally {
      setBusy(false);
    }
  };

  const deleteCombination = async (id: string, isLiked: boolean) => {
    if (!user) return;
    const nextLiked = isLiked ? likedCombinations.filter(c => c.id !== id) : likedCombinations;
    const nextDisliked = !isLiked ? dislikedCombinations.filter(c => c.id !== id) : dislikedCombinations;
    const { error } = await supabase
      .from('color_preferences')
      .upsert(
        {
          user_id: user.id,
          liked_combinations: nextLiked.map(c => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
          disliked_combinations: nextDisliked.map(c => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.error('Error deleting combination:', error);
      showToast('Failed to delete', 'error');
      return;
    }
    setLikedCombinations(nextLiked);
    setDislikedCombinations(nextDisliked);
    showToast('Deleted', 'success');
  };

  const handleCombinationClick = (combination: ColorCombination, isLiked: boolean) => {
    setSelectedCombination(combination);
    setSelectedCombinationType(isLiked ? 'liked' : 'disliked');
    setShowEditModal(true);
  };

  const handleUpdateCombination = async (updatedCombination: ColorCombination) => {
    if (!user) return false;
    const key = normalizedKey(updatedCombination);
    const isInLiked = likedKeys.has(key);
    const isInDisliked = dislikedKeys.has(key);
    const editingLiked = selectedCombinationType === 'liked';

    // Prevent duplicates in same list
    const currentList = editingLiked ? likedCombinations : dislikedCombinations;
    const duplicateInSame = currentList.some(c => normalizedKey(c) === key && c.id !== updatedCombination.id);
    if (duplicateInSame) {
      showToast('This color combination already exists', 'warning');
      return false;
    }
    // Prevent cross-list conflict
    if ((editingLiked && isInDisliked) || (!editingLiked && isInLiked)) {
      showToast('This combination exists in the opposite list. Remove it there first.', 'warning');
      return false;
    }

    const nextLiked = editingLiked
      ? likedCombinations.map(c => (c.id === updatedCombination.id ? updatedCombination : c))
      : likedCombinations;
    const nextDisliked = !editingLiked
      ? dislikedCombinations.map(c => (c.id === updatedCombination.id ? updatedCombination : c))
      : dislikedCombinations;

    const { error } = await supabase
      .from('color_preferences')
      .upsert(
        {
          user_id: user.id,
          liked_combinations: nextLiked.map(c => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
          disliked_combinations: nextDisliked.map(c => ({ topColor: c.topColor, bottomColor: c.bottomColor })),
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.error('Error updating combination:', error);
      showToast('Failed to update', 'error');
      return false;
    }

    setLikedCombinations(nextLiked);
    setDislikedCombinations(nextDisliked);
    showToast('Updated', 'success');
    return true;
  };

  const handleDeleteCombination = async () => {
    if (selectedCombination) {
      await deleteCombination(selectedCombination.id, selectedCombinationType === 'liked');
      return true;
    }
    return false;
  };

  const getColorStyle = (color: string) => {
    const colorMap: { [key: string]: string } = {
      black: '#000000',
      white: '#ffffff',
      gray: '#808080',
      beige: '#f5f5dc',
      'light blue': '#87ceeb',
      blue: '#0000ff',
      'navy blue': '#000080',
      denim: '#191970',
      'light green': '#90ee90',
      'dark green': '#006400',
      brown: '#7B3F00',
      yellow: '#ffff00',
      orange: '#ffa500',
      red: '#ff0000',
      pink: '#ffc0cb',
      purple: '#800080'
    };
    return { backgroundColor: colorMap[color] || color };
  };

  const handleColorClick = (color: string) => {
    // Select the color based on current mode
    if (selectionMode === 'top') {
      setSelectedTopColor(color);
    } else {
      setSelectedBottomColor(color);
    }
  };

  return (
    <div style={{ width: '90vw', maxWidth: 1000, margin: '0 auto', padding: '2rem 0' }}>
      
      {/* 2-row, 3-column grid: left (button), center (palette), right (color display) */}
      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '0.5rem 0 2rem 0',
        gap: '3.5rem',
      }}>
        {/* Left column: Top/Bottom Color buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setSelectionMode('top')}
            style={{
              width: 140,
              height: 80,
              background: selectionMode === 'top' ? '#1565c0' : 'transparent',
              color: selectionMode === 'top' ? '#e0f6ff' : '#e0f6ff',
              border: '2px solid #1565c0',
              borderRadius: 10,
              fontFamily: 'Arial, sans-serif',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: selectionMode === 'top' ? '0 2px 8px #b3cfff88' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Top Color
          </button>
          <button
            onClick={() => setSelectionMode('bottom')}
            style={{
              width: 140,
              height: 80,
              background: selectionMode === 'bottom' ? '#1565c0' : 'transparent',
              color: selectionMode === 'bottom' ? '#e0f6ff' : '#e0f6ff',
              border: '2px solid #1565c0',
              borderRadius: 10,
              fontFamily: 'Arial, sans-serif',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: selectionMode === 'bottom' ? '0 2px 8px #b3cfff88' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Bottom Color
          </button>
        </div>
        {/* Center column: Color palette */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '1.2rem', margin: '-1rem 0 1rem 0', fontWeight: 700, letterSpacing: '0.01em', textAlign: 'center' }}>Select Colors:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 70px)', gridTemplateRows: 'repeat(4, 70px)', gap: '1rem', margin: '0 auto', marginBottom: '1.2rem' }}>
            {colorPalette.map(color => (
              <button
                key={color}
                onClick={() => handleColorClick(color)}
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '10px',
                  border: (selectedTopColor === color || selectedBottomColor === color) ? '4px solid #1565c0' : '2px solid #1565c0',
                  cursor: 'pointer',
                  ...getColorStyle(color),
                  boxShadow: (selectedTopColor === color || selectedBottomColor === color) ? '0 8px 16px #b3cfff88' : 'none',
                  transition: 'box-shadow 0.2s, border 0.2s'
                }}
                title={color}
              />
            ))}
          </div>
        </div>
        {/* Right column: Color display boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center' }}>
          <div style={{
            width: 140,
            height: 80,
            border: '2px solid #1565c0',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, sans-serif',
            fontSize: '0.95rem',
            fontWeight: 700,
            background: selectedTopColor ? getColorStyle(selectedTopColor).backgroundColor : 'white',
            color: selectedTopColor ? (getColorStyle(selectedTopColor).backgroundColor === '#ffffff' || getColorStyle(selectedTopColor).backgroundColor === '#f5f5dc' || getColorStyle(selectedTopColor).backgroundColor === '#87ceeb' || getColorStyle(selectedTopColor).backgroundColor === '#90ee90' || getColorStyle(selectedTopColor).backgroundColor === '#ffff00' || getColorStyle(selectedTopColor).backgroundColor === '#ffc0cb' ? '#000000' : '#fff') : '#1565c0',
          }}>{getColorName(selectedTopColor ? getColorStyle(selectedTopColor).backgroundColor : '')}</div>
          <div style={{
            width: 140,
            height: 80,
            border: '2px solid #1565c0',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, sans-serif',
            fontSize: '0.95rem',
            fontWeight: 700,
            background: selectedBottomColor ? getColorStyle(selectedBottomColor).backgroundColor : 'white',
            color: selectedBottomColor ? (getColorStyle(selectedBottomColor).backgroundColor === '#ffffff' || getColorStyle(selectedBottomColor).backgroundColor === '#f5f5dc' || getColorStyle(selectedBottomColor).backgroundColor === '#87ceeb' || getColorStyle(selectedBottomColor).backgroundColor === '#90ee90' || getColorStyle(selectedBottomColor).backgroundColor === '#ffff00' || getColorStyle(selectedBottomColor).backgroundColor === '#ffc0cb' ? '#000000' : '#fff') : '#1565c0',
          }}>{getColorName(selectedBottomColor ? getColorStyle(selectedBottomColor).backgroundColor : '')}</div>
        </div>
      </div>
      {(selectedTopColor || selectedBottomColor) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '3rem' }}>
          <button
            onClick={() => addCombination(true)}
            disabled={!selectedTopColor || !selectedBottomColor || busy}
            style={{
              background: '#1565c0',
              color: '#e0f6ff',
              border: 'none',
              borderRadius: 4,
              padding: '0.4rem 0.8rem',
              fontWeight: 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'Arial, sans-serif',
              opacity: (!selectedTopColor || !selectedBottomColor || busy) ? 0.5 : 1
            }}
          >
            Add to Liked
          </button>
          <button
            onClick={() => addCombination(false)}
            disabled={!selectedTopColor || !selectedBottomColor || busy}
            style={{
              background: '#1565c0',
              color: '#e0f6ff',
              border: 'none',
              borderRadius: 4,
              padding: '0.4rem 0.8rem',
              fontWeight: 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'Arial, sans-serif',
              opacity: (!selectedTopColor || !selectedBottomColor || busy) ? 0.5 : 1
            }}
          >
            Add to Disliked
          </button>
        </div>
      )}

      {/* Inline message replaced by toasts */}

              {/* Liked Combinations */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '1.2rem', marginTop: '3.5rem', marginBottom: '0.5rem', borderBottom: '2px solid #e0f6ff', paddingBottom: '0.5rem', textAlign: 'left' }}>
            Liked Combinations
          </h2>
        {likedCombinations.length === 0 ? (
          <p style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontStyle: 'italic' }}>No liked combinations yet</p>
                  ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5em', alignItems: 'start' }}>
              {likedCombinations.map(combo => (
              <div key={combo.id} style={{ position: 'relative' }}>
                <div 
                  onClick={() => handleCombinationClick(combo, true)}
                  style={{
                    width: 60,
                    height: 60,
                    border: '2px solid #1565c0',
                    borderRadius: 8,
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(21, 101, 192, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Top half */}
                  <div style={{
                    width: '100%',
                    height: '50%',
                    ...getColorStyle(combo.topColor)
                  }}></div>
                  {/* Bottom half */}
                  <div style={{
                    width: '100%',
                    height: '50%',
                    ...getColorStyle(combo.bottomColor)
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

              {/* Disliked Combinations */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '1.2rem', marginTop: '3.5rem', marginBottom: '0.5rem', borderBottom: '2px solid #e0f6ff', paddingBottom: '0.5rem', textAlign: 'left' }}>
            Disliked Combinations
          </h2>
        {dislikedCombinations.length === 0 ? (
          <p style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontStyle: 'italic' }}>No disliked combinations yet</p>
                  ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5em', alignItems: 'start' }}>
              {dislikedCombinations.map(combo => (
              <div key={combo.id} style={{ position: 'relative' }}>
                <div 
                  onClick={() => handleCombinationClick(combo, false)}
                  style={{
                    width: 60,
                    height: 60,
                    border: '2px solid #1565c0',
                    borderRadius: 8,
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(21, 101, 192, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Top half */}
                  <div style={{
                    width: '100%',
                    height: '50%',
                    ...getColorStyle(combo.topColor)
                  }}></div>
                  {/* Bottom half */}
                  <div style={{
                    width: '100%',
                    height: '50%',
                    ...getColorStyle(combo.bottomColor)
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Color Combination Edit Modal */}
      <ColorCombinationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        combination={selectedCombination}
        isLiked={selectedCombinationType === 'liked'}
        onUpdate={handleUpdateCombination}
        onDelete={handleDeleteCombination}
      />
    </div>
  );
} 