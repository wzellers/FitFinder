// Shared TypeScript interfaces used across the application

// Represents a single clothing item in the user's closet
export interface ClothingItem {
  id: string;
  type: string;
  colors: string[];
  image_url: string;
  is_dirty: boolean;
  created_at?: string;
}

// Represents a color combination preference
export interface ColorCombination {
  id?: string;
  topColor: string;
  bottomColor: string;
}

// Represents a saved outfit configuration
export interface SavedOutfit {
  id?: string;
  user_id: string;
  outfit_items: {
    top_id: string;
    outerwear_id?: string;
    bottom_id: string;
    shoes_id: string;
  };
  created_at?: string;
}

// Clothing category sections
export type ClothingSection = 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes';

// Maps clothing types to their sections
export const typeToSection: Record<string, ClothingSection> = {
  // Top items
  'T-Shirt': 'Tops',
  'Long Sleeve Shirt': 'Tops',
  'Polo': 'Tops',
  'Tank Top': 'Tops',
  'Button-Up Shirt': 'Tops',
  'Hoodie': 'Tops',
  // Outerwear items
  'Jacket': 'Outerwear',
  'Sweatshirt': 'Outerwear',
  'Crewneck': 'Outerwear',
  'Sweater': 'Outerwear',
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

// Available clothing types grouped by category
export const clothingTypes: Record<ClothingSection, string[]> = {
  'Tops': ['T-Shirt', 'Long Sleeve Shirt', 'Polo', 'Tank Top', 'Button-Up Shirt', 'Hoodie'],
  'Bottoms': ['Jeans', 'Pants', 'Shorts', 'Sweats', 'Skirt', 'Leggings'],
  'Outerwear': ['Jacket', 'Sweatshirt', 'Crewneck', 'Sweater'],
  'Shoes': ['Shoes']
};

// Section names for iteration
export const sectionNames: ClothingSection[] = ['Tops', 'Bottoms', 'Outerwear', 'Shoes'];

// ============================================================================
// WEATHER-RELATED TYPES AND CLOTHING TEMPERATURE RULES
// ============================================================================

import { TemperatureCategory } from './weatherApi';

// Defines which temperature categories a clothing type is appropriate for
export interface ClothingWeatherRules {
  blockedIn: TemperatureCategory[];   // Weather conditions where this item should NOT be worn
  suggestedIn: TemperatureCategory[]; // Weather conditions where this item is recommended
}

// Weather appropriateness rules for each clothing type
// Items not listed are considered appropriate for all weather conditions
export const clothingWeatherRules: Record<string, ClothingWeatherRules> = {
  // Tops that are blocked in cold weather
  'Tank Top': {
    blockedIn: ['cold', 'cool'],
    suggestedIn: ['hot']
  },
  'T-Shirt': {
    blockedIn: ['cold'],  // OK in cool weather with outerwear
    suggestedIn: ['warm', 'hot']
  },
  
  // Long sleeve options - good for cooler weather
  'Long Sleeve Shirt': {
    blockedIn: [],
    suggestedIn: ['cool', 'warm']
  },
  'Polo': {
    blockedIn: ['cold'],
    suggestedIn: ['warm']
  },
  'Button-Up Shirt': {
    blockedIn: [],
    suggestedIn: ['cool', 'warm']
  },
  'Hoodie': {
    blockedIn: [],
    suggestedIn: ['cold', 'cool']
  },
  
  // Outerwear - required in cold, suggested in cool
  'Jacket': {
    blockedIn: ['hot'],
    suggestedIn: ['cold', 'cool']
  },
  'Sweatshirt': {
    blockedIn: ['hot'],
    suggestedIn: ['cold', 'cool']
  },
  'Crewneck': {
    blockedIn: ['hot'],
    suggestedIn: ['cold', 'cool']
  },
  'Sweater': {
    blockedIn: ['hot'],
    suggestedIn: ['cold', 'cool']
  },
  
  // Bottoms
  'Shorts': {
    blockedIn: ['cold'],
    suggestedIn: ['hot', 'warm']
  },
  'Skirt': {
    blockedIn: ['cold'],
    suggestedIn: ['warm', 'hot']
  },
  'Jeans': {
    blockedIn: [],
    suggestedIn: ['cool', 'warm']
  },
  'Pants': {
    blockedIn: [],
    suggestedIn: ['cold', 'cool', 'warm']
  },
  'Sweats': {
    blockedIn: ['hot'],
    suggestedIn: ['cold', 'cool']
  },
  'Leggings': {
    blockedIn: [],
    suggestedIn: ['cold', 'cool', 'warm']
  }
};

// Helper function to check if a clothing item is appropriate for a temperature
export function isClothingAppropriateForWeather(
  clothingType: string, 
  temperatureCategory: TemperatureCategory
): boolean {
  const rules = clothingWeatherRules[clothingType];
  if (!rules) return true; // If no rules defined, item is always appropriate
  return !rules.blockedIn.includes(temperatureCategory);
}

// Helper function to check if a clothing item is suggested for a temperature
export function isClothingSuggestedForWeather(
  clothingType: string, 
  temperatureCategory: TemperatureCategory
): boolean {
  const rules = clothingWeatherRules[clothingType];
  if (!rules) return false; // If no rules defined, item is not specifically suggested
  return rules.suggestedIn.includes(temperatureCategory);
}

// Check if outerwear is required for the given temperature
export function isOuterwearRequired(temperatureCategory: TemperatureCategory): boolean {
  return temperatureCategory === 'cold';
}

// Check if outerwear is suggested for the given temperature
export function isOuterwearSuggested(temperatureCategory: TemperatureCategory): boolean {
  return temperatureCategory === 'cold' || temperatureCategory === 'cool';
}

// ============================================================================
// OUTFIT WEAR TRACKING AND RATINGS
// ============================================================================

// Represents a logged outfit wear entry
export interface OutfitWear {
  id: string;
  user_id: string;
  outfit_id?: string;           // Reference to saved_outfits if applicable
  top_id?: string;
  bottom_id?: string;
  shoes_id?: string;
  outerwear_id?: string;
  worn_date: string;            // ISO date string (YYYY-MM-DD)
  notes?: string;
  rating?: number;              // 1-10 overall rating
  comfort_rating?: number;      // 1-10 comfort rating
  created_at?: string;
}

// Represents pending rating prompts for outfits worn but not yet rated
export interface PendingRating {
  wear_id: string;
  worn_date: string;
  outfit_items: {
    top_id?: string;
    bottom_id?: string;
    shoes_id?: string;
    outerwear_id?: string;
  };
}

// Tab types for the dashboard navigation
export type DashboardTab = 'closet' | 'generator' | 'calendar' | 'stats' | 'preferences';
