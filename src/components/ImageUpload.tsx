"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

interface ClothingItem {
  type: string;
  colors: string[];
  image_url: string;
  is_dirty: boolean;
}

interface ImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onItemUploaded?: () => void;
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

export default function ImageUpload({ isOpen, onClose, onItemUploaded }: ImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [markDirty, setMarkDirty] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setUploadSuccess(false);
    }
  };

  const handleColorClick = (color: string) => {
    setSelectedColors([color]); // Only allow one color selection
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType || selectedColors.length === 0) {
      alert('Please select a file, item type, and at least one color');
      return;
    }

    setUploading(true);
    
    try {
      // Upload image to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        alert(`Image upload failed: ${uploadError.message}. Please make sure the storage bucket 'clothing-images' exists and is properly configured.`);
        setUploading(false);
        return;
      }

      // Get the public URL for the uploaded image
      const { data: urlData } = supabase.storage
        .from('clothing-images')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;
      
      // Save item to database
      const { data, error } = await supabase
        .from('clothing_items')
        .insert([
          {
            user_id: user?.id,
            type: selectedType,
            colors: selectedColors,
            image_url: imageUrl,
            is_dirty: markDirty
          }
        ])
        .select();

      if (error) {
        console.error('Error saving item:', error);
        alert('Upload failed. Please try again.');
        setUploading(false);
        return;
      }

      setUploadSuccess(true);
      setUploading(false);
      
      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedCategory('');
      setSelectedType('');
      setSelectedColors([]);
      setMarkDirty(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Notify parent component to refresh closet
      if (onItemUploaded) {
        onItemUploaded();
      }
      
      // Close modal after success
      setTimeout(() => {
        onClose();
        setUploadSuccess(false);
      }, 1500);
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedCategory('');
    setSelectedType('');
    setSelectedColors([]);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

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
          {/* LAUNDRY TOGGLE - Top-left corner */}
          <button
            type="button"
            onClick={() => setMarkDirty(prev => !prev)}
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              background: markDirty ? '#28a745' : '#ffc107',
              border: 'none',
              color: markDirty ? '#fff' : '#000',
              fontSize: '0.8rem',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {markDirty ? 'Mark Clean' : 'Mark Dirty'}
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

        {/* MODAL TITLE - Main heading */}
        <h2 style={{ 
          color: '#e0f6ff', 
          fontFamily: 'Arial, sans-serif', 
          fontSize: '1.2rem', 
          marginBottom: '1.5rem', 
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          Add Clothing Item
        </h2>

        {/* BACKGROUND REMOVAL INFO - Instructions box with links */}
        <div style={{ 
          background: '#0f1624', 
          border: '1px solid #e0f6ff', 
          borderRadius: '8px', 
          padding: '1rem', 
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          lineHeight: '1.4',
          fontFamily: 'Arial, sans-serif'
        }}>
          <p style={{ color: '#e0f6ff', marginBottom: '0.5rem', fontFamily: 'Arial, sans-serif' }}>
            To make your outfits look clean and professional, we recommend removing the background from your clothing photos before uploading.
          </p>
          <p style={{ color: '#e0f6ff', marginBottom: '0.5rem', fontFamily: 'Arial, sans-serif' }}>
            You can use free tools like:
          </p>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '1rem', 
            marginBottom: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <a 
              href="https://www.remove.bg/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1565c0', 
                textDecoration: 'underline',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              remove.bg
            </a>
            <a 
              href="https://pixian.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1565c0', 
                textDecoration: 'underline',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              Pixian.ai
            </a>
            <a 
              href="https://cleanup.pictures/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1565c0', 
                textDecoration: 'underline',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              Cleanup.pictures
            </a>
          </div>
          <p style={{ color: '#e0f6ff', fontSize: '0.8rem', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
            If you don't remove the background, that's totally fine, but your outfit previews may look less clean.
          </p>
        </div>

        {/* FILE UPLOAD SECTION - File input and preview */}
        <div style={{ 
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {/* FILE INPUT LABEL - "Upload Image" text */}
          <label style={{ 
            display: 'block', 
            color: '#e0f6ff', 
            fontSize: '0.8rem', 
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center'
          }}>
            Upload Image
          </label>
          {/* CUSTOM FILE INPUT - Hidden real input, custom styled button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{
                display: 'none' // Hide the original input
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '0.4rem 0.8rem',
                border: '2px solid #e0f6ff',
                borderRadius: '4px',
                background: '#0f1624',
                color: '#e0f6ff',
                fontSize: '0.75rem',
                fontFamily: 'Arial, sans-serif',
                cursor: 'pointer'
              }}
            >
              Choose File
            </button>
            <span style={{
              color: '#e0f6ff',
              fontSize: '0.75rem',
              fontFamily: 'Arial, sans-serif',
              display: 'flex',
              alignItems: 'center'
            }}>
              {selectedFile ? selectedFile.name : 'No file chosen'}
            </span>
          </div>
        </div>

        {/* IMAGE PREVIEW - Shows uploaded image thumbnail */}
        {previewUrl && (
          <div style={{ 
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
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
              Preview
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
                src={previewUrl} 
                alt="Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain',
                  objectPosition: 'center'
                }} 
              />
            </div>
          </div>
        )}

        {/* ITEM TYPE SELECTION - Category and type dropdowns */}
        <div style={{ 
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center',
          marginTop: '0'
        }}>
          <label style={{ 
            display: 'block', 
            color: '#e0f6ff', 
            fontSize: '0.9rem', 
            marginBottom: '0.3rem',
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
              width: 'auto',
              minWidth: '150px',
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
                width: 'auto',
                minWidth: '150px',
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

        {/* UPLOAD BUTTONS - Upload and Reset buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !selectedType || selectedColors.length === 0}
            style={{
              padding: '0.75rem 2rem',
              border: '2px solid #1565c0',
              borderRadius: '4px',
              background: uploading || !selectedFile || !selectedType || selectedColors.length === 0 
                ? '#0f1624' 
                : '#1565c0',
              color: uploading || !selectedFile || !selectedType || selectedColors.length === 0 
                ? '#666' 
                : '#fff',
              cursor: uploading || !selectedFile || !selectedType || selectedColors.length === 0 
                ? 'not-allowed' 
                : 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Item'}
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

        {/* SUCCESS MESSAGE - Shows when upload completes */}
        {uploadSuccess && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#0f1624', 
            border: '2px solid #1565c0',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#1565c0', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
              ✅ Item uploaded successfully!
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