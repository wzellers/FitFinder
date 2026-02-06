// RatingPrompt Component - Modal/popup for rating yesterday's outfit
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { PendingRating, ClothingItem } from '../lib/types';

interface RatingPromptProps {
  pendingRating: PendingRating;
  onSubmit: (wearId: string, rating: number, comfortRating?: number) => void;
  onSkip: () => void;
  onMinimize: () => void;
}

export default function RatingPrompt({ pendingRating, onSubmit, onSkip, onMinimize }: RatingPromptProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [comfortRating, setComfortRating] = useState<number>(5);
  const [showComfort, setShowComfort] = useState(false);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load item images
  useEffect(() => {
    const loadItems = async () => {
      if (!user) return;
      
      const itemIds = [
        pendingRating.outfit_items.top_id,
        pendingRating.outfit_items.bottom_id,
        pendingRating.outfit_items.shoes_id,
        pendingRating.outfit_items.outerwear_id
      ].filter(Boolean) as string[];

      if (itemIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('clothing_items')
          .select('*')
          .in('id', itemIds);
        
        setItems(data || []);
      } catch (e) {
        console.error('Failed to load items:', e);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [user, pendingRating]);

  // Get item by ID
  const getItem = (itemId: string | undefined): ClothingItem | null => {
    if (!itemId) return null;
    return items.find(i => i.id === itemId) || null;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Handle submit
  const handleSubmit = () => {
    onSubmit(pendingRating.wear_id, rating, showComfort ? comfortRating : undefined);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 400
    }}>
      <div style={{
        background: '#1a2238',
        border: '2px solid #1565c0',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(21, 101, 192, 0.3)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '1rem'
        }}>
          <div>
            <h3 style={{ color: '#e0f6ff', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>
              Rate Yesterday&apos;s Outfit
            </h3>
            <p style={{ color: '#e0f6ff', opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>
              {formatDate(pendingRating.worn_date)}
            </p>
          </div>
          <button
            onClick={onMinimize}
            style={{
              background: 'none',
              border: 'none',
              color: '#e0f6ff',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: 0.7,
              padding: '0.25rem'
            }}
          >
            Minimize
          </button>
        </div>

        {/* Outfit Preview */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '0.5rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          {loading ? (
            <div style={{ color: '#e0f6ff', opacity: 0.7 }}>Loading...</div>
          ) : (
            [
              pendingRating.outfit_items.top_id,
              pendingRating.outfit_items.bottom_id,
              pendingRating.outfit_items.shoes_id,
              pendingRating.outfit_items.outerwear_id
            ].map((id, idx) => {
              const item = getItem(id);
              return item ? (
                <img
                  key={idx}
                  src={item.image_url}
                  alt={item.type}
                  style={{
                    width: '70px',
                    height: '70px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    border: '2px solid #34507b'
                  }}
                />
              ) : null;
            })
          )}
        </div>

        {/* Overall Rating */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ 
            display: 'block', 
            color: '#e0f6ff', 
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            Overall Rating
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="range"
              min="1"
              max="10"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              style={{
                flex: 1,
                height: '8px',
                borderRadius: '4px',
                background: `linear-gradient(to right, #1565c0 ${(rating - 1) * 11.1}%, #243152 ${(rating - 1) * 11.1}%)`,
                appearance: 'none',
                cursor: 'pointer'
              }}
            />
            <span style={{ 
              color: '#1565c0', 
              fontWeight: 'bold', 
              fontSize: '1.5rem',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              {rating}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            color: '#e0f6ff', 
            opacity: 0.5,
            fontSize: '0.7rem',
            marginTop: '0.25rem'
          }}>
            <span>Not great</span>
            <span>Amazing</span>
          </div>
        </div>

        {/* Comfort Rating Toggle */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            cursor: 'pointer',
            color: '#e0f6ff',
            fontSize: '0.85rem'
          }}>
            <input
              type="checkbox"
              checked={showComfort}
              onChange={(e) => setShowComfort(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Add comfort rating (optional)
          </label>
          
          {showComfort && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={comfortRating}
                  onChange={(e) => setComfortRating(Number(e.target.value))}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '4px',
                    background: `linear-gradient(to right, #28a745 ${(comfortRating - 1) * 11.1}%, #243152 ${(comfortRating - 1) * 11.1}%)`,
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ 
                  color: '#28a745', 
                  fontWeight: 'bold', 
                  fontSize: '1.25rem',
                  minWidth: '40px',
                  textAlign: 'center'
                }}>
                  {comfortRating}
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                color: '#e0f6ff', 
                opacity: 0.5,
                fontSize: '0.7rem',
                marginTop: '0.25rem'
              }}>
                <span>Uncomfortable</span>
                <span>Super comfy</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onSkip}
            style={{
              flex: 1,
              padding: '0.6rem 1rem',
              background: '#243152',
              color: '#e0f6ff',
              border: '2px solid #34507b',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            style={{
              flex: 2,
              padding: '0.6rem 1rem',
              background: '#1565c0',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            Submit Rating
          </button>
        </div>
      </div>
    </div>
  );
}
