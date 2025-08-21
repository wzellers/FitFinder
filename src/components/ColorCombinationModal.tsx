"use client";

import React, { useState, useEffect } from 'react';

interface ColorCombination {
  id: string;
  topColor: string;
  bottomColor: string;
}

interface ColorCombinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  combination: ColorCombination | null;
  isLiked: boolean;
  onUpdate: (updatedCombination: ColorCombination) => Promise<boolean> | boolean;
  onDelete: () => Promise<boolean> | boolean;
}

const colorPalette = [
  "white", "gray", "black", "beige",
  "light blue", "blue", "navy blue", "denim",
  "light green", "dark green", "brown", "yellow",
  "orange", "red", "pink", "purple"
];

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

function getColorStyle(color: string) {
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
}

export default function ColorCombinationModal({ 
  isOpen, 
  onClose, 
  combination, 
  isLiked, 
  onUpdate, 
  onDelete 
}: ColorCombinationModalProps) {
  const [selectedTopColor, setSelectedTopColor] = useState('');
  const [selectedBottomColor, setSelectedBottomColor] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    if (combination) {
      setSelectedTopColor(combination.topColor);
      setSelectedBottomColor(combination.bottomColor);
      setUpdateSuccess(false);
      setDeleteSuccess(false);
    }
  }, [combination]);

  const handleColorClick = (color: string, position: 'top' | 'bottom') => {
    if (position === 'top') {
      setSelectedTopColor(color);
    } else {
      setSelectedBottomColor(color);
    }
  };

  const handleUpdate = async () => {
    if (!combination || !selectedTopColor || !selectedBottomColor) return;

    setUpdating(true);

    const updatedCombination: ColorCombination = {
      ...combination,
      topColor: selectedTopColor,
      bottomColor: selectedBottomColor
    };

    try {
      const ok = await onUpdate(updatedCombination);
      if (ok) {
        setUpdateSuccess(true);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!combination) return;
    
    if (window.confirm('Are you sure you want to delete this color combination?')) {
      const ok = await onDelete();
      if (ok) {
        setDeleteSuccess(true);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    }
  };

  const resetForm = () => {
    if (combination) {
      setSelectedTopColor(combination.topColor);
      setSelectedBottomColor(combination.bottomColor);
    }
  };

  const handleClose = () => {
    setUpdateSuccess(false);
    setDeleteSuccess(false);
    onClose();
  };

  if (!isOpen || !combination) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a2238',
        border: '2px solid #e0f6ff',
        borderRadius: 12,
        padding: '2rem',
        maxWidth: '900px',
        width: '85vw',
        maxHeight: '75vh',
        overflow: 'auto',
        position: 'relative',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: '#e0f6ff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          ×
        </button>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '3rem',
            background: '#dc3545',
            color: '#e0f6ff',
            border: 'none',
            borderRadius: 4,
            padding: '0.3rem 0.6rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          Delete
        </button>

        {/* Title */}
        <h2 style={{
          color: '#e0f6ff',
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          Edit Color Combination
        </h2>

        {/* Current Combination Display */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#e0f6ff', fontSize: '1rem', marginBottom: '1rem', fontFamily: 'Arial, sans-serif' }}>
            Current Combination:
          </h3>
          <div style={{
            display: 'inline-block',
            width: 80,
            height: 80,
            border: '2px solid #1565c0',
            borderRadius: 8,
            overflow: 'hidden',
            margin: '0 auto'
          }}>
            <div style={{
              width: '100%',
              height: '50%',
              ...getColorStyle(combination.topColor)
            }}></div>
            <div style={{
              width: '100%',
              height: '50%',
              ...getColorStyle(combination.bottomColor)
            }}></div>
          </div>
        </div>

        {/* Color Selection */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#e0f6ff', fontSize: '1rem', marginBottom: '1rem', fontFamily: 'Arial, sans-serif' }}>
            Select New Colors:
          </h3>
          
          {/* Top Color Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#e0f6ff', fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
              Click to select Top Color:
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.8rem',
              marginBottom: '1rem',
              width: 'fit-content',
              margin: '0 auto 1rem auto'
            }}>
              {colorPalette.map(color => (
                <div
                  key={color}
                  onClick={() => handleColorClick(color, 'top')}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    border: selectedTopColor === color ? '4px solid #1565c0' : '2px solid #1565c0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    ...getColorStyle(color),
                    boxShadow: selectedTopColor === color ? '0 8px 16px #b3cfff88' : 'none',
                    transition: 'box-shadow 0.2s, border 0.2s'
                  }}
                  title={`Top: ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Color Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#e0f6ff', fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
              Click to select Bottom Color:
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.8rem',
              marginBottom: '1rem',
              width: 'fit-content',
              margin: '0 auto 1rem auto'
            }}>
              {colorPalette.map(color => (
                <div
                  key={color}
                  onClick={() => handleColorClick(color, 'bottom')}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    border: selectedBottomColor === color ? '4px solid #1565c0' : '2px solid #1565c0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    ...getColorStyle(color),
                    boxShadow: selectedBottomColor === color ? '0 8px 16px #b3cfff88' : 'none',
                    transition: 'box-shadow 0.2s, border 0.2s'
                  }}
                  title={`Bottom: ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Selected Colors Display */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ color: '#e0f6ff', fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'Arial, sans-serif' }}>Top Color:</p>
              <div style={{
                width: 140,
                height: 80,
                border: '2px solid #1565c0',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 'bold',
                ...getColorStyle(selectedTopColor),
                color: selectedTopColor ? (getColorStyle(selectedTopColor).backgroundColor === '#ffffff' || getColorStyle(selectedTopColor).backgroundColor === '#f5f5dc' || getColorStyle(selectedTopColor).backgroundColor === '#87ceeb' || getColorStyle(selectedTopColor).backgroundColor === '#90ee90' || getColorStyle(selectedTopColor).backgroundColor === '#ffff00' || getColorStyle(selectedTopColor).backgroundColor === '#ffc0cb' ? '#000000' : '#fff') : '#1565c0'
              }}>
                  {getColorName(selectedTopColor)}
                </div>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ color: '#e0f6ff', fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'Arial, sans-serif' }}>Bottom Color:</p>
              <div style={{
                width: 140,
                height: 80,
                border: '2px solid #1565c0',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 'bold',
                ...getColorStyle(selectedBottomColor),
                color: selectedBottomColor ? (getColorStyle(selectedBottomColor).backgroundColor === '#ffffff' || getColorStyle(selectedBottomColor).backgroundColor === '#f5f5dc' || getColorStyle(selectedBottomColor).backgroundColor === '#87ceeb' || getColorStyle(selectedBottomColor).backgroundColor === '#90ee90' || getColorStyle(selectedBottomColor).backgroundColor === '#ffff00' || getColorStyle(selectedBottomColor).backgroundColor === '#ffc0cb' ? '#000000' : '#fff') : '#1565c0'
              }}>
                  {getColorName(selectedBottomColor)}
                </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button
            onClick={handleUpdate}
            disabled={updating || !selectedTopColor || !selectedBottomColor}
            style={{
              background: '#1565c0',
              color: '#e0f6ff',
              border: 'none',
              borderRadius: 4,
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              cursor: updating ? 'not-allowed' : 'pointer',
              fontFamily: 'Arial, sans-serif',
              opacity: (updating || !selectedTopColor || !selectedBottomColor) ? 0.5 : 1
            }}
          >
            {updating ? 'Updating...' : 'Update Combination'}
          </button>
          <button
            onClick={resetForm}
            style={{
              background: '#6c757d',
              color: '#e0f6ff',
              border: 'none',
              borderRadius: 4,
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            Reset
          </button>
        </div>

        {/* Success Messages */}
        {updateSuccess && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#28a745',
            color: '#e0f6ff',
            padding: '1rem',
            borderRadius: 8,
            fontSize: '1rem',
            fontFamily: 'Arial, sans-serif'
          }}>
            Combination updated successfully!
          </div>
        )}

        {deleteSuccess && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#dc3545',
            color: '#e0f6ff',
            padding: '1rem',
            borderRadius: 8,
            fontSize: '1rem',
            fontFamily: 'Arial, sans-serif'
          }}>
            Combination deleted successfully!
          </div>
        )}
      </div>
    </div>
  );
} 