import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './ToastProvider';

interface ClosetProps {
  onAddItem: () => void;
  onEditItem?: (item: ClothingItem) => void;
}

interface ClothingItem {
  id: string;
  type: string;
  colors: string[];
  image_url: string;
  is_dirty: boolean;
  created_at: string;
}

const sectionNames = ['Tops', 'Bottoms', 'Outerwear', 'Shoes'];

// Map clothing types to sections
const typeToSection: { [key: string]: string } = {
  'T-Shirt': 'Tops',
  'Long Sleeve Shirt': 'Tops',
  'Polo': 'Tops',
  'Tank Top': 'Tops',
  'Button-Up Shirt': 'Tops',
  'Sweater': 'Tops',
  'Hoodie': 'Tops',
  'Jacket': 'Outerwear',
  'Sweatshirt': 'Outerwear',
  'Crewneck': 'Outerwear',
  'Jeans': 'Bottoms',
  'Pants': 'Bottoms',
  'Shorts': 'Bottoms',
  'Sweats': 'Bottoms',
  'Skirt': 'Bottoms',
  'Leggings': 'Bottoms',
  'Shoes': 'Shoes'
};

export default function Closet({ onAddItem, onEditItem }: ClosetProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching items:', error);
      } else {
        console.log('Fetched items from database:', data);
        setItems(data || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemsForSection = (section: string) => {
    const sectionItems = items.filter(item => {
      const itemSection = typeToSection[item.type];
      return itemSection === section;
    });
    
    // Debug logging
    if (section === 'Outerwear') {
      console.log('Outerwear section items:', sectionItems);
      console.log('All items:', items);
      console.log('Type mappings:', typeToSection);
    }
    
    return sectionItems;
  };

  const handleAddItem = (section: string) => {
    onAddItem();
  };

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
    } catch (e) {
      console.error('Bulk laundry error:', e);
      showToast('Failed to update laundry status', 'error');
    }
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

  return (
    <div style={{ width: '90vw', maxWidth: 1000, margin: '0 auto', padding: '2rem 0' }}>
      {/* Top controls */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          style={{ background: '#1565c0', color: '#e0f6ff', border: 'none', borderRadius: 4, padding: '0.25rem 0.8rem', fontWeight: 400, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}
          onClick={() => handleAddItem('')}
        >
          + Add Item
        </button>
        <button
          style={{ background: '#ffc107', color: '#000', border: 'none', borderRadius: 4, padding: '0.25rem 0.8rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}
          onClick={() => bulkMarkAllDirty(true)}
        >
          Mark All Dirty
        </button>
        <button
          style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, padding: '0.25rem 0.8rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}
          onClick={() => bulkMarkAllDirty(false)}
        >
          Mark All Clean
        </button>
      </div>

      {sectionNames.map((section) => {
        const sectionItems = getItemsForSection(section);
        
        return (
          <section key={section} style={{ marginBottom: '3.5rem' }}>
            <h2 style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '2px solid #e0f6ff', paddingBottom: '0.5rem', textAlign: 'left' }}>{section}</h2>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '1.2rem', 
              alignItems: 'flex-end',
              width: '100%',
              margin: 0,
              padding: 0,
              boxSizing: 'border-box'
            }}>
              {/* Plus sign box for adding item */}
              <button
                onClick={() => handleAddItem(section)}
                style={{
                  width: 130,
                  height: 130,
                  background: 'none',
                  border: '2px solid #e0f6ff',
                  color: '#e0f6ff',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  padding: 0,
                  flexShrink: 0,
                  boxSizing: 'border-box'
                }}
                aria-label={`Add item to ${section}`}
              >
                <span style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, fontFamily: 'Arial, sans-serif', textShadow: '0 2px 8px #b3cfff88', marginTop: '-5px' }}>+</span>
                <span style={{ fontSize: '0.7rem', color: '#e0f6ff', fontWeight: 400, fontFamily: 'Arial, sans-serif', opacity: 0.7, letterSpacing: '0.01em', marginTop: -15, display: 'flex', alignItems: 'center' }}>Add Item</span>
              </button>

              {/* Render uploaded items */}
              {sectionItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => onEditItem && onEditItem(item)}
                  style={{
                    width: 130,
                    height: 130,
                    border: '2px solid #e0f6ff',
                    borderRadius: 12,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#0f1624',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    padding: 0,
                    flexShrink: 0,
                    boxSizing: 'border-box',
                    opacity: item.is_dirty ? 0.4 : 1,
                    filter: item.is_dirty ? 'grayscale(100%)' : 'none'
                  }}
                >
                  {/* Item Image - Centered */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem'
                  }}>
                    <img 
                      src={item.image_url} 
                      alt={item.type}
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain',
                        width: 'auto',
                        height: 'auto'
                      }} 
                      onError={(e) => {
                        // Fallback for broken images
                        e.currentTarget.src = 'https://via.placeholder.com/100x100/1a2238/e0f6ff?text=Item';
                      }}
                    />
                    {item.is_dirty && (
                      <div style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        background: '#ffc107',
                        color: '#000',
                        borderRadius: 4,
                        padding: '0.1rem 0.3rem',
                        fontSize: '0.65rem',
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: 700
                      }}>
                        Dirty
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
} 