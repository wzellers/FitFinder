"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

interface ClothingItem {
  id: string;
  type: string;
  colors: string[];
  image_url: string;
  is_dirty: boolean;
  created_at: string;
}

interface EditItemProps {
  isOpen: boolean;
  onClose: () => void;
  item: ClothingItem | null;
  onItemUpdated?: () => void;
  onItemDeleted?: () => void;
}

const clothingTypes = {
  'Tops': ['T-Shirt', 'Long Sleeve Shirt', 'Polo', 'Tank Top', 'Button-Up Shirt'],
  'Bottoms': ['Jeans', 'Pants', 'Shorts', 'Sweats', 'Skirt', 'Leggings'],
  'Outerwear': ['Jacket', 'Sweatshirt', 'Crewneck', 'Sweater'],
  'Shoes': ['Shoes']
};

const colorOptions = [
  'white', 'gray', 'black', 'beige',
  'light blue', 'blue', 'navy blue', 'denim',
  'light green', 'dark green', 'brown', 'yellow',
  'orange', 'red', 'pink', 'purple'
];

export default function EditItem({ isOpen, onClose, item, onItemUpdated, onItemDeleted }: EditItemProps) {
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize form with item data when modal opens
  React.useEffect(() => {
    if (item) {
      setSelectedType(item.type);
      setSelectedColors(item.colors);
      setIsDirty(item.is_dirty);
      
      // Determine category from type
      const category = Object.keys(clothingTypes).find(cat => 
        clothingTypes[cat as keyof typeof clothingTypes].includes(item.type)
      );
      setSelectedCategory(category || '');
    }
  }, [item]);

  const handleColorClick = (color: string) => {
    setSelectedColors([color]); // Only allow one color selection
  };

  const handleUpdate = async () => {
    if (!item || !selectedType || selectedColors.length === 0) {
      alert('Please select an item type and at least one color');
      return;
    }

    setUpdating(true);
    
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update({
          type: selectedType,
          colors: selectedColors
        })
        .eq('id', item.id);

      if (error) {
        console.error('Error updating item:', error);
        alert('Update failed. Please try again.');
        setUpdating(false);
        return;
      }

      setUpdateSuccess(true);
      setUpdating(false);
      
      // Notify parent component to refresh closet
      if (onItemUpdated) {
        onItemUpdated();
      }
      
      // Close modal after success
      setTimeout(() => {
        onClose();
        setUpdateSuccess(false);
      }, 1500);
      
    } catch (error) {
      console.error('Update error:', error);
      alert('Update failed. Please try again.');
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;

    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    setUpdating(true);
    
    try {
      const { error } = await supabase
        .from('clothing_items')
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error('Error deleting item:', error);
        alert('Delete failed. Please try again.');
        setUpdating(false);
        return;
      }

      setDeleteSuccess(true);
      setUpdating(false);
      
      // Notify parent component to refresh closet
      if (onItemDeleted) {
        onItemDeleted();
      }
      
      // Close modal after success
      setTimeout(() => {
        onClose();
        setDeleteSuccess(false);
      }, 1500);
      
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed. Please try again.');
      setUpdating(false);
    }
  };

  const handleToggleDirty = async () => {
    if (!item) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update({ is_dirty: !isDirty })
        .eq('id', item.id);

      if (error) {
        console.error('Error updating dirty status:', error);
        alert('Failed to update laundry status. Please try again.');
        setUpdating(false);
        return;
      }

      setIsDirty(!isDirty);
      if (onItemUpdated) onItemUpdated();
      setUpdating(false);
    } catch (error) {
      console.error('Dirty toggle error:', error);
      alert('Failed to update laundry status. Please try again.');
      setUpdating(false);
    }
  };

  const resetForm = () => {
    if (item) {
      setSelectedType(item.type);
      setSelectedColors(item.colors);
      const category = Object.keys(clothingTypes).find(cat => 
        clothingTypes[cat as keyof typeof clothingTypes].includes(item.type)
      );
      setSelectedCategory(category || '');
    }
    setUpdateSuccess(false);
    setDeleteSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || !item) return null;

  return (
    // MODAL OVERLAY - Darkens background and centers modal
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.4)', // Background darkness
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* MODAL CONTAINER - Main modal box styling */}
      <div style={{
        background: '#1a2238', // Navy background
        border: '2px solid #e0f6ff', // Light blue border
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '900px', // Modal width
        width: '85vw',
        maxHeight: '75vh', // Modal height
        overflow: 'auto',
        position: 'relative',
        margin: '2rem'
      }}>
        {/* LAUNDRY BUTTON - Top-left corner */}
        <button
          onClick={handleToggleDirty}
          disabled={updating}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            background: isDirty ? '#28a745' : '#ffc107',
            border: 'none',
            color: isDirty ? '#fff' : '#000',
            fontSize: '0.8rem',
            cursor: updating ? 'not-allowed' : 'pointer',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 700
          }}
        >
          {isDirty ? 'Mark Clean' : 'Mark Dirty'}
        </button>
        {/* CLOSE BUTTON - X button in top-right corner */}
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
            zIndex: 10,
            fontFamily: 'Arial, sans-serif'
          }}
        >
          ×
        </button>

        {/* DELETE BUTTON - Top-right corner */}
        <button
          onClick={handleDelete}
          disabled={updating}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '3rem',
            background: '#dc3545',
            border: 'none',
            color: '#fff',
            fontSize: '0.8rem',
            cursor: updating ? 'not-allowed' : 'pointer',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          Delete
        </button>

        {/* MODAL TITLE - Main heading */}
        <h2 style={{ 
          color: '#e0f6ff', 
          fontFamily: 'Arial, sans-serif', 
          fontSize: '1.2rem', 
          marginBottom: '1.5rem', 
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          Edit Clothing Item
        </h2>

        {/* CURRENT ITEM IMAGE */}
        <div style={{ 
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <label style={{ 
            display: 'block', 
            color: '#e0f6ff', 
            fontSize: '0.8rem', 
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center'
          }}>
            Current Item
          </label>
          <div style={{ 
            width: '150px', 
            height: '150px', 
            border: '2px solid #e0f6ff', 
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f1624'
          }}>
            <img 
              src={item.image_url} 
              alt={item.type} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain' 
              }} 
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/100x100/1a2238/e0f6ff?text=Item';
              }}
            />
          </div>
        </div>

        {/* ITEM TYPE SELECTION - Category and type dropdowns */}
        <div style={{ 
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <label style={{ 
            display: 'block', 
            color: '#e0f6ff', 
            fontSize: '0.9rem', 
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            fontFamily: 'Arial, sans-serif'
          }}>
            Item Type
          </label>
          
          {/* CATEGORY DROPDOWN - Tops, Bottoms, Outerwear, Shoes */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedType('');
            }}
            style={{
              width: 'fit-content',
              padding: '0.5rem 0.8rem',
              border: '2px solid #e0f6ff',
              borderRadius: '4px',
              background: '#0f1624',
              color: '#e0f6ff',
              fontSize: '0.85rem',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center'
            }}
          >
            <option value="">Select category...</option>
            <option value="Tops">👕 Tops</option>
            <option value="Bottoms">👖 Bottoms</option>
            <option value="Outerwear">🧥 Outerwear</option>
            <option value="Shoes">👟 Shoes</option>
          </select>

          {/* TYPE DROPDOWN - Specific item types based on category */}
          {selectedCategory && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: 'fit-content',
                padding: '0.5rem 0.8rem',
                border: '2px solid #e0f6ff',
                borderRadius: '4px',
                background: '#0f1624',
                color: '#e0f6ff',
                fontSize: '0.85rem',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center'
              }}
            >
              <option value="">Select type...</option>
              {clothingTypes[selectedCategory as keyof typeof clothingTypes]?.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* COLOR SELECTION - Color palette grid */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            color: '#e0f6ff', 
            fontSize: '0.9rem', 
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            fontFamily: 'Arial, sans-serif'
          }}>
            Select the main color of the item
          </label>
          {/* COLOR GRID - 4x4 grid of color buttons */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 70px)', 
            gridTemplateRows: 'repeat(4, 70px)', 
            gap: '1rem', 
            margin: '0 auto', 
            justifyContent: 'center'
          }}>
            {colorOptions.map(color => (
              <button
                key={color}
                onClick={() => handleColorClick(color)}
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '10px',
                  border: selectedColors.includes(color) ? '4px solid #1565c0' : '2px solid #1565c0',
                  cursor: 'pointer',
                  backgroundColor: getColorStyle(color).backgroundColor,
                  boxShadow: selectedColors.includes(color) ? '0 8px 16px #b3cfff88' : 'none',
                  transition: 'box-shadow 0.2s, border 0.2s'
                }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* SELECTED COLOR DISPLAY - Shows chosen color */}
        {selectedColors.length > 0 && (
          <div style={{ 
            marginBottom: '1.5rem',
            padding: '0.5rem',
            background: '#0f1624',
            border: '1px solid #e0f6ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            textAlign: 'center',
            width: 'fit-content',
            margin: '0 auto 1.5rem auto'
          }}>
            <label style={{ 
              color: '#e0f6ff', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>
              Selected Color:
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.4rem',
                background: '#1a2238',
                border: '1px solid #e0f6ff',
                borderRadius: '4px',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: getColorStyle(selectedColors[0]).backgroundColor,
                  border: '1px solid #e0f6ff'
                }}
              />
              <span style={{ 
                color: '#e0f6ff', 
                fontSize: '0.7rem',
                fontFamily: 'Arial, sans-serif',
                textTransform: 'capitalize',
                textAlign: 'center'
              }}>
                {selectedColors[0]}
              </span>
            </div>
          </div>
        )}

        {/* UPDATE BUTTONS - Update and Reset buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={handleUpdate}
            disabled={updating || !selectedType || selectedColors.length === 0}
            style={{
              padding: '0.75rem 2rem',
              border: '2px solid #1565c0',
              borderRadius: '4px',
              background: updating || !selectedType || selectedColors.length === 0 
                ? '#0f1624' 
                : '#1565c0',
              color: updating || !selectedType || selectedColors.length === 0 
                ? '#666' 
                : '#fff',
              cursor: updating || !selectedType || selectedColors.length === 0 
                ? 'not-allowed' 
                : 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            {updating ? 'Updating...' : 'Update Item'}
          </button>
          
          <button
            onClick={resetForm}
            style={{
              padding: '0.75rem 2rem',
              border: '2px solid #e0f6ff',
              borderRadius: '4px',
              background: 'transparent',
              color: '#e0f6ff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            Reset
          </button>
        </div>

        {/* SUCCESS MESSAGE - Shows when update completes */}
        {updateSuccess && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#0f1624', 
            border: '2px solid #1565c0',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#1565c0', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
              ✅ Item updated successfully!
            </p>
          </div>
        )}

        {/* DELETE SUCCESS MESSAGE */}
        {deleteSuccess && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#0f1624', 
            border: '2px solid #dc3545',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#dc3545', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
              ✅ Item deleted successfully!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get color style (same as in ColorPreferences)
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