"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

/**
 * TypeScript Interfaces for Outfit Generator
 * 
 * These interfaces define the structure of data used throughout the component
 */

// Represents a single clothing item in the user's closet
interface ClothingItem {
  id: string;           // Unique identifier for the item
  type: string;         // Type of clothing (e.g., 'T-Shirt', 'Jeans')
  colors: string[];     // Array of colors for the item
  image_url: string;    // URL to the item's image
  is_dirty: boolean;    // Whether the item is currently dirty/unavailable
}

// Represents a color combination between top and bottom items
interface ColorCombination { 
  topColor: string;     // Color of the top item
  bottomColor: string;  // Color of the bottom item
}

// Represents a saved outfit configuration
interface SavedOutfit {
  id?: string;          // Optional unique identifier
  user_id: string;      // ID of the user who saved the outfit
  outfit_items: {       // The clothing items that make up the outfit
    top_id: string;     // ID of the top item
    outerwear_id?: string; // Optional ID of outerwear item
    bottom_id: string;  // ID of the bottom item
    shoes_id: string;   // ID of the shoes
  };
  created_at?: string;  // When the outfit was saved
}

/**
 * Clothing Type to Section Mapping
 * 
 * This mapping categorizes different clothing types into the four main sections:
 * - Tops: Shirts, sweaters, etc.
 * - Outerwear: Jackets, hoodies, etc.
 * - Bottoms: Pants, shorts, skirts, etc.
 * - Shoes: Footwear
 */
const typeToSection: { [key: string]: 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes' | undefined } = {
  // Top items
  'T-Shirt': 'Tops',
  'Long Sleeve Shirt': 'Tops',
  'Polo': 'Tops',
  'Tank Top': 'Tops',
  'Button-Up Shirt': 'Tops',
  'Sweater': 'Tops',
  'Hoodie': 'Tops',
  
  // Outerwear items
  'Jacket': 'Outerwear',
  'Sweatshirt': 'Outerwear',
  'Crewneck': 'Outerwear',
  
  // Bottom items
  'Jeans': 'Bottoms',
  'Pants': 'Bottoms',
  'Shorts': 'Bottoms',
  'Sweats': 'Bottoms',
  'Skirt': 'Bottoms',
  'Leggings': 'Bottoms',
  
  // Footwear
  'Shoes': 'Shoes',
};

/**
 * OutfitGenerator Component
 * 
 * This component allows users to:
 * 1. Generate random outfits from their closet
 * 2. Lock specific items to build around them
 * 3. Save outfits they like for later use
 * 4. View and manage their saved outfits
 * 5. Delete saved outfits
 * 
 * The component respects user color preferences and ensures valid color combinations.
 */
export default function OutfitGenerator() {
  // Authentication context
  const { user } = useAuth();
  
  // ===== STATE MANAGEMENT =====
  
  // Clothing items and preferences
  const [items, setItems] = useState<ClothingItem[]>([]);                    // All clean clothing items from user's closet
  const [liked, setLiked] = useState<ColorCombination[]>([]);                // Color combinations user likes
  const [disliked, setDisliked] = useState<ColorCombination[]>([]);          // Color combinations user dislikes
  
  // Current outfit display
  const [top, setTop] = useState<ClothingItem | null>(null);                 // Currently displayed top item
  const [outerwear, setOuterwear] = useState<ClothingItem | null>(null);     // Currently displayed outerwear item
  const [bottom, setBottom] = useState<ClothingItem | null>(null);           // Currently displayed bottom item
  const [shoes, setShoes] = useState<ClothingItem | null>(null);             // Currently displayed shoes
  
  // Item locking states (locked items won't change when generating new outfits)
  const [lockedTop, setLockedTop] = useState(false);                         // Whether top item is locked
  const [lockedOuterwear, setLockedOuterwear] = useState(false);             // Whether outerwear item is locked
  const [lockedBottom, setLockedBottom] = useState(false);                   // Whether bottom item is locked
  const [lockedShoes, setLockedShoes] = useState(false);                     // Whether shoes are locked
  
  // UI state
  const [loading, setLoading] = useState(false);                             // Loading state for async operations
  const [error, setError] = useState<string>('');                            // Error message display
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);       // User's saved outfits
  const [activeTab, setActiveTab] = useState<'generator' | 'saved'>('generator'); // Current tab view
  
  // ===== UTILITY FUNCTIONS =====
  
  /**
   * Creates a normalized key for color combinations
   * This ensures consistent comparison regardless of color order
   */
  const normalizedKey = (a: string, b: string) => `${a.toLowerCase()}__${b.toLowerCase()}`;
  
  // Create sets for efficient color combination lookups
  const likedSet = useMemo(() => new Set(liked.map(c => normalizedKey(c.topColor, c.bottomColor))), [liked]);
  const dislikedSet = useMemo(() => new Set(disliked.map(c => normalizedKey(c.topColor, c.bottomColor))), [disliked]);
  
  // ===== DATA FETCHING =====
  
  /**
   * Fetches all necessary data when component mounts or user changes
   * - Clothing items (only clean ones)
   * - User's color preferences
   * - Previously saved outfits
   */
  useEffect(() => {
    if (!user) return;
    
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch all data in parallel for better performance
        const [{ data: itemsData, error: itemsErr }, { data: prefsData, error: prefsErr }, { data: outfitsData, error: outfitsErr }] = await Promise.all([
          // Get clean clothing items
          supabase.from('clothing_items').select('*').eq('user_id', user.id).eq('is_dirty', false),
          // Get user's color preferences
          supabase.from('color_preferences').select('*').eq('user_id', user.id).maybeSingle(),
          // Get saved outfits
          supabase.from('saved_outfits').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        ]);
        
        // Handle any database errors
        if (itemsErr) throw itemsErr;
        if (prefsErr) throw prefsErr;
        if (outfitsErr) throw outfitsErr;
        
        // Update state with fetched data
        setItems(itemsData || []);
        const liked = (prefsData?.liked_combinations ?? []) as ColorCombination[];
        const disliked = (prefsData?.disliked_combinations ?? []) as ColorCombination[];
        setLiked(liked);
        setDisliked(disliked);
        setSavedOutfits(outfitsData || []);
        
      } catch (e: any) {
        console.error(e);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAll();
  }, [user]);
  
  // ===== CLOTHING ITEM FILTERING =====
  
  // Filter items by category for outfit generation
  const tops = useMemo(() => items.filter(i => typeToSection[i.type] === 'Tops'), [items]);
  const outerwearItems = useMemo(() => items.filter(i => typeToSection[i.type] === 'Outerwear'), [items]);
  const bottoms = useMemo(() => items.filter(i => typeToSection[i.type] === 'Bottoms'), [items]);
  const shoesItems = useMemo(() => items.filter(i => typeToSection[i.type] === 'Shoes'), [items]);
  
  // Combine tops and outerwear for selection (they're treated equally in outfit generation)
  const topAndOuterwearItems = useMemo(() => [...tops, ...outerwearItems], [tops, outerwearItems]);
  
  // ===== OUTFIT GENERATION LOGIC =====
  
  /**
   * Main function to generate and display a new outfit.
   * This function handles the user interaction and coordinates the outfit generation process.
   */
  const pickOutfit = () => {
    // Check if we have enough items to generate an outfit
    if (topAndOuterwearItems.length === 0 || bottoms.length === 0 || shoesItems.length === 0) {
      setError('You need at least one clean top or outerwear, one bottom, and one pair of shoes to generate an outfit.');
      return;
    }
    
    // Clear any previous errors
    setError('');

    // Generate outfit with color validation
    const outfit = generateValidOutfit();
    
    if (!outfit) {
      setError('No valid outfit combinations found. Try adding more clothing items or adjusting your color preferences.');
      return;
    }

    // Update the outfit display (only unlocked items)
    if (!lockedTop) {
      // Set the top to whichever item is selected (top or outerwear)
      setTop(outfit.top || outfit.outerwear);
      setOuterwear(null); // Clear outerwear since it's now displayed as top
    }
    if (!lockedBottom) setBottom(outfit.bottom);
    if (!lockedShoes) setShoes(outfit.shoes);
  };
  
  /**
   * Generates a valid outfit based on user preferences and available items.
   * It attempts to find a combination that satisfies all color and compatibility rules.
   * @returns An object containing the generated outfit items, or null if no valid combination is found.
   */
  const generateValidOutfit = () => {
    const maxAttempts = 100; // Prevent infinite loops
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Randomly select one item from each category
      const randomTopOrOuterwear = topAndOuterwearItems[Math.floor(Math.random() * topAndOuterwearItems.length)];
      const randomBottom = bottoms[Math.floor(Math.random() * bottoms.length)];
      const randomShoes = shoesItems[Math.floor(Math.random() * shoesItems.length)];
      
      // Determine if the selected item is a top or outerwear
      const isOuterwear = typeToSection[randomTopOrOuterwear.type] === 'Outerwear';
      const randomTop = isOuterwear ? null : randomTopOrOuterwear;
      const randomOuterwear = isOuterwear ? randomTopOrOuterwear : null;
      
      // Validate the outfit combination (top-bottom and consider outerwear compatibility)
      if (isValidOutfitCombination(randomTop, randomOuterwear, randomBottom)) {
        return {
          top: randomTop,
          outerwear: randomOuterwear,
          bottom: randomBottom,
          shoes: randomShoes
        };
      }
    }
    
    return null; // No valid combination found after max attempts
  };

  /**
   * Checks if a given outfit combination is valid based on user preferences and color rules.
   * @param topItem The top item (can be null if no top is selected)
   * @param outerwearItem The outerwear item (can be null if no outerwear is selected)
   * @param bottomItem The bottom item
   * @returns True if the combination is valid, false otherwise.
   */
  const isValidOutfitCombination = (topItem: ClothingItem | null, outerwearItem: ClothingItem | null, bottomItem: ClothingItem): boolean => {
    // We need either a top OR outerwear (or both)
    if (!topItem && !outerwearItem) {
      return false;
    }
    
    // If we have a top, validate the top-bottom combination
    if (topItem && !isValidColorCombination(topItem, bottomItem)) {
      return false;
    }
    
    // If we have outerwear, validate the outerwear-bottom combination
    if (outerwearItem) {
      const outerwearColor = outerwearItem.colors[0];
      const bottomColor = bottomItem.colors[0];
      
      if (!outerwearColor) return false;
      
      // Check if outerwear-bottom combination is valid
      if (!isValidColorCombination(outerwearItem, bottomItem)) {
        return false;
      }
      
      // If we also have a top, validate the outerwear-top combination
      if (topItem) {
        const topColor = topItem.colors[0];
        if (!topColor) return false;
        
        // Check if outerwear-top combination is valid (not disliked)
        const outerwearTopKey = normalizedKey(outerwearColor, topColor);
        if (disliked.length > 0 && dislikedSet.has(outerwearTopKey)) {
          return false;
        }
        
        // If user has liked combinations, check if outerwear-top combination is liked
        if (liked.length > 0 && !likedSet.has(outerwearTopKey)) {
          return false;
        }
      }
    }
    
    return true;
  };

  /**
   * Checks if a given color combination is valid based on user preferences.
   * @param topItem The top item
   * @param bottomItem The bottom item
   * @returns True if the combination is valid, false otherwise.
   */
  const isValidColorCombination = (topItem: ClothingItem, bottomItem: ClothingItem): boolean => {
    const topColor = topItem.colors[0];
    const bottomColor = bottomItem.colors[0];
    
    if (!topColor || !bottomColor) return false;
    
    const combinationKey = normalizedKey(topColor, bottomColor);
    
    // If user has liked combinations, the combination must be in liked list
    if (liked.length > 0 && !likedSet.has(combinationKey)) {
      return false;
    }
    
    // If user has disliked combinations, the combination must NOT be in disliked list
    if (disliked.length > 0 && dislikedSet.has(combinationKey)) {
      return false;
    }
    
    // If no liked combinations exist, only check that it's not disliked
    if (liked.length === 0 && disliked.length > 0) {
      return !dislikedSet.has(combinationKey);
    }
    
    // If no disliked combinations exist, only check that it's in liked
    if (disliked.length === 0 && liked.length > 0) {
      return true;
    }
    
    // If neither liked nor disliked combinations exist, any combination is valid
    if (liked.length === 0 && disliked.length === 0) {
      return true;
    }
    
    // Default case: combination must be liked and not disliked
    return likedSet.has(combinationKey) && !dislikedSet.has(combinationKey);
  };

  // ===== SAVING AND LOADING SAVED OUTFITS =====

  /**
   * Loads a saved outfit into the current outfit display.
   * @param outfit The saved outfit data to load.
   */
  const loadSavedOutfit = (outfit: SavedOutfit) => {
    const topItem = items.find(item => item.id === outfit.outfit_items.top_id);
    const bottomItem = items.find(item => item.id === outfit.outfit_items.bottom_id);
    const shoesItem = items.find(item => item.id === outfit.outfit_items.shoes_id);
    
    if (topItem) setTop(topItem);
    if (bottomItem) setBottom(bottomItem);
    if (shoesItem) setShoes(shoesItem);
    
    // Unlock all items when loading a saved outfit
    setLockedTop(false);
    setLockedOuterwear(false);
    setLockedBottom(false);
    setLockedShoes(false);
    
    // Hide saved outfits view
    setActiveTab('generator');
  };

  /**
   * Deletes a saved outfit from the database.
   * @param outfitId The ID of the outfit to delete.
   */
  const deleteOutfit = async (outfitId: string) => {
    // Ensure user is authenticated
    if (!user) {
      setError('You must be logged in to delete outfits');
      return;
    }
    
    // Confirm deletion with user
    if (!confirm('Are you sure you want to delete this outfit? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Delete outfit from database
      const { error } = await supabase
        .from('saved_outfits')
        .delete()
        .eq('id', outfitId)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Remove the deleted outfit from local state
      setSavedOutfits(prevOutfits => prevOutfits.filter(outfit => outfit.id !== outfitId));
      
      // Clear any existing errors
      setError('');
      
    } catch (e: any) {
      console.error('Error deleting outfit:', e);
      setError('Failed to delete outfit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves the current outfit to the user's saved outfits.
   * This function handles the UI state and database interaction.
   */
  const saveOutfit = async () => {
    // Validate that we have a complete outfit to save
    if (!top || !bottom || !shoes) {
      setError('Cannot save incomplete outfit');
      return;
    }
    
    // Ensure user is authenticated
    if (!user) {
      setError('You must be logged in to save outfits');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Create outfit data structure for database
      const outfit: SavedOutfit = {
        user_id: user.id,
        outfit_items: {
          top_id: top.id,
          outerwear_id: outerwear?.id,  // Optional outerwear
          bottom_id: bottom.id,
          shoes_id: shoes.id,
        }
      };
      
      // Debug logging for troubleshooting
      console.log('Attempting to save outfit:', outfit);
      console.log('User ID:', user.id);
      console.log('User object:', user);
      console.log('Supabase client:', supabase);
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Supabase key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      // Validate outfit data integrity
      if (!outfit.outfit_items.top_id || !outfit.outfit_items.bottom_id || !outfit.outfit_items.shoes_id) {
        throw new Error('Missing required outfit items');
      }
      
      if (!outfit.user_id) {
        throw new Error('Missing user ID');
      }
      
      // Test database connection before attempting to save
      console.log('Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('saved_outfits')
        .select('count')
        .limit(1);
      
      console.log('Connection test result:', { testData, testError });
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        console.error('Test error details:', {
          message: testError.message,
          details: testError.details,
          hint: testError.hint,
          code: testError.code
        });
        throw new Error(`Database connection failed: ${testError.message}`);
      }
      
      console.log('Connection test passed, attempting to save outfit...');
      
      // Insert outfit data into database
      console.log('About to insert this outfit data:', JSON.stringify(outfit, null, 2));
      
      const { data, error } = await supabase
        .from('saved_outfits')
        .insert(outfit)
        .select()
        .single();
      
      console.log('Supabase response:', { data, error });
      console.log('Full error object:', JSON.stringify(error, null, 2));
      
      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        console.error('Full error object:', error);
        console.error('Error JSON:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      // Success!
      setError(''); // Clear any existing errors
      alert('Outfit saved successfully!');
      
      // Refresh saved outfits list
      const { data: newOutfits, error: fetchErr } = await supabase
        .from('saved_outfits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!fetchErr) {
        setSavedOutfits(newOutfits || []);
      }
      
      
      
    } catch (e: any) {
      console.error('Error saving outfit:', e);
      console.error('Error type:', typeof e);
      console.error('Error constructor:', e.constructor.name);
      console.error('Error keys:', Object.keys(e));
      console.error('Error details:', {
        message: e.message,
        details: e.details,
        hint: e.hint,
        code: e.code,
        stack: e.stack
      });
      
      // Try to extract error information in different ways
      let errorMessage = 'Failed to save outfit.';
      
      if (e && typeof e === 'object') {
        if (e.message) {
          errorMessage = `Failed to save outfit: ${e.message}`;
        } else if (e.details) {
          errorMessage = `Failed to save outfit: ${e.details}`;
        } else if (e.error) {
          errorMessage = `Failed to save outfit: ${e.error}`;
        } else if (e.toString && e.toString() !== '[object Object]') {
          errorMessage = `Failed to save outfit: ${e.toString()}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ===== UI RENDERING =====
  
  return (
    <div style={{ minHeight: 300, width: '90vw', maxWidth: 1000, margin: '0 auto', padding: '1rem 0' }}>
      
      {/* Error Message Display */}
      {error && (
        <div style={{ textAlign: 'center', color: '#ff8c00', marginBottom: '1rem', fontFamily: 'Arial, sans-serif' }}>{error}</div>
      )}
      
      {/* Navigation Button - Only show when on generator tab */}
      {activeTab === 'generator' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTab('saved')}
            style={{
              background: '#1565c0',
              color: '#e0f6ff',
              border: '2px solid #e0f6ff',
              borderRadius: 6,
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold'
            }}
          >
            View Saved Outfits
          </button>
        </div>
      )}
      
      {/* Tab Content */}
      {activeTab === 'generator' && (
        <>
          {/* Generator Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
            {/* Top/Outerwear Item */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 150, height: 150, border: '2px solid #e0f6ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1624' }}>
                {top ? (
                  <img 
                    src={top.image_url} 
                    alt={top.type} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/100x100/1a2238/e0f6ff?text=Top';
                    }}
                  />
                ) : outerwear ? (
                  <img 
                    src={outerwear.image_url} 
                    alt={outerwear.type} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/100x100/1a2238/e0f6ff?text=Outerwear';
                    }}
                  />
                ) : (
                  <span style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.9rem' }}>Top</span>
                )}
              </div>
              <button
                onClick={() => setLockedTop(!lockedTop)}
                style={{
                  background: lockedTop ? '#ff8c00' : '#1565c0',
                  color: '#e0f6ff',
                  border: '2px solid #e0f6ff',
                  borderRadius: 6,
                  padding: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 'bold',
                  minWidth: '40px'
                }}
                title={lockedTop ? 'Unlock Top/Outerwear' : 'Lock Top/Outerwear'}
              >
                <span style={{ fontSize: '0.7rem' }}>{lockedTop ? '🔒' : '🔓'}</span>
              </button>
            </div>
            
            {/* Bottom Item */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 150, height: 150, border: '2px solid #e0f6ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1624' }}>
                {bottom ? (
                  <img 
                    src={bottom.image_url} 
                    alt={bottom.type} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/100x100/1a2238/e0f6ff?text=Bottom';
                    }}
                  />
                ) : (
                  <span style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.9rem' }}>Bottom</span>
                )}
              </div>
              <button
                onClick={() => setLockedBottom(!lockedBottom)}
                style={{
                  background: lockedBottom ? '#ff8c00' : '#1565c0',
                  color: '#e0f6ff',
                  border: '2px solid #e0f6ff',
                  borderRadius: 6,
                  padding: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 'bold',
                  minWidth: '40px'
                }}
                title={lockedBottom ? 'Unlock Bottom' : 'Lock Bottom'}
              >
                <span style={{ fontSize: '0.7rem' }}>{lockedBottom ? '🔒' : '🔓'}</span>
              </button>
            </div>
            
            {/* Shoes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 150, height: 150, border: '2px solid #e0f6ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1624' }}>
                {shoes ? (
                  <img 
                    src={shoes.image_url} 
                    alt={shoes.type} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/100x100/1a2238/e0f6ff?text=Shoes';
                    }}
                  />
                ) : (
                  <span style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.9rem' }}>Shoes</span>
                )}
              </div>
              <button
                onClick={() => setLockedShoes(!lockedShoes)}
                style={{
                  background: lockedShoes ? '#ff8c00' : '#1565c0',
                  color: '#e0f6ff',
                  border: '2px solid #e0f6ff',
                  borderRadius: 6,
                  padding: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 'bold',
                  minWidth: '40px'
                }}
                title={lockedShoes ? 'Unlock Shoes' : 'Lock Shoes'}
              >
                <span style={{ fontSize: '0.7rem' }}>{lockedShoes ? '🔒' : '🔓'}</span>
              </button>
            </div>
          </div>
          
          {/* Generate and Save Buttons Below Stack */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '3rem' }}>
            <button
              onClick={pickOutfit}
              disabled={loading}
              style={{ 
                background: '#1565c0', 
                color: '#e0f6ff', 
                border: '2px solid #e0f6ff', 
                borderRadius: 6, 
                padding: '0.75rem 1.5rem', 
                cursor: 'pointer',
                fontSize: '1rem',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Generating...' : 'Generate Outfit'}
            </button>
            <button
              onClick={() => saveOutfit()}
              disabled={!top && !outerwear || !bottom || !shoes}
              style={{ 
                background: '#28a745', 
                color: '#e0f6ff', 
                border: '2px solid #e0f6ff', 
                borderRadius: 6, 
                padding: '0.75rem 1.5rem', 
                cursor: 'pointer',
                fontSize: '1rem',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                opacity: (!top && !outerwear || !bottom || !shoes) ? 0.5 : 1
              }}
            >
              Save Outfit
            </button>
          </div>
        </>
      )}
      
      {/* ===== SAVED OUTFITS TAB ===== */}
      {activeTab === 'saved' && (
        <div style={{ textAlign: 'center' }}>
          {/* Back to Generator Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <button
              onClick={() => setActiveTab('generator')}
              style={{
                background: '#1565c0',
                color: '#e0f6ff',
                border: '2px solid #e0f6ff',
                borderRadius: 8,
                padding: '0.75rem 1.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
            >
              ← Back to Generator
            </button>
          </div>
          
          <h3 style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', marginBottom: '2rem', fontSize: '1rem' }}>
            Saved Outfits ({savedOutfits.length})
          </h3>
          {savedOutfits.length === 0 ? (
            <div style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '1.1rem' }}>
              No saved outfits yet. Generate and save some outfits to see them here!
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', maxWidth: 'fit-content' }}>
                {savedOutfits.map((outfit, index) => {
                const topItem = items.find(item => item.id === outfit.outfit_items.top_id);
                const outerwearItem = items.find(item => item.id === outfit.outfit_items.outerwear_id);
                const bottomItem = items.find(item => item.id === outfit.outfit_items.bottom_id);
                const shoesItem = items.find(item => item.id === outfit.outfit_items.shoes_id);
                
                return (
                  <div 
                    key={outfit.id || index} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      gap: '0.25rem',
                      padding: '0.5rem',
                      border: '2px solid #e0f6ff',
                      borderRadius: 8,
                      background: '#0f1624',
                      minWidth: '140px',
                      maxWidth: '160px'
                    }}
                  >
                    {/* Date Header */}
                    <div style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {outfit.created_at ? new Date(outfit.created_at).toLocaleDateString() : 'Unknown date'}
                    </div>
                    
                    {/* Top/Outerwear */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 100, height: 100, border: '2px solid #e0f6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a2238' }}>
                        {topItem ? (
                          <img 
                            src={topItem.image_url} 
                            alt={topItem.type} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x80/1a2238/e0f6ff?text=Top';
                            }}
                          />
                        ) : outerwearItem ? (
                          <img 
                            src={outerwearItem.image_url} 
                            alt={outerwearItem.type} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x80/1a2238/e0f6ff?text=Outerwear';
                            }}
                          />
                        ) : (
                          <span style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.6rem' }}>Top/Outerwear</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Bottom */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 100, height: 100, border: '2px solid #e0f6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a2238' }}>
                        {bottomItem ? (
                          <img 
                            src={bottomItem.image_url} 
                            alt={bottomItem.type} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x80/1a2238/e0f6ff?text=Bottom';
                            }}
                          />
                        ) : (
                          <span style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.6rem' }}>Bottom</span>
                        )}
                      </div>
                    </div>
                    
                                        {/* Shoes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 100, height: 100, border: '2px solid #e0f6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a2238' }}>
                        {shoesItem ? (
                          <img 
                            src={shoesItem.image_url} 
                            alt={shoesItem.type} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x80/1a2238/e0f6ff?text=Shoes';
                            }}
                          />
                        ) : (
                          <span style={{ color: '#e0f6ff', fontFamily: 'Arial, sans-serif', fontSize: '0.6rem' }}>Shoes</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {/* Load Outfit Button */}
                      <button
                        onClick={() => loadSavedOutfit(outfit)}
                        disabled={loading}
                        style={{
                          background: '#1565c0',
                          color: '#e0f6ff',
                          border: '2px solid #e0f6ff',
                          borderRadius: 6,
                          padding: '0.25rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          fontFamily: 'Arial, sans-serif',
                          fontWeight: 'bold',
                          minWidth: '40px'
                        }}
                        title="Load Outfit"
                      >
                        <span style={{ fontSize: '0.7rem' }}>👕</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => deleteOutfit(outfit.id || '')}
                        disabled={loading}
                        style={{
                          background: '#dc3545',
                          color: '#e0f6ff',
                          border: '2px solid #e0f6ff',
                          borderRadius: 6,
                          padding: '0.25rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          fontFamily: 'Arial, sans-serif',
                          fontWeight: 'bold',
                          minWidth: '40px'
                        }}
                        title="Delete Outfit"
                      >
                        <span style={{ fontSize: '0.7rem' }}>🗑️</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}
      

    </div>
  );
} 