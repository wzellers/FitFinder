// Shared TypeScript interfaces used across the application

// Re-export constants that other modules may still import from here
export { typeToSection, clothingTypes, sectionNames } from '@/lib/constants';

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

// ============================================================================
// WEATHER-RELATED TYPES AND CLOTHING TEMPERATURE RULES
// ============================================================================

import type { TemperatureCategory } from '@/lib/weatherApi';

// Defines which temperature categories a clothing type is appropriate for
export interface ClothingWeatherRules {
  blockedIn: TemperatureCategory[];
  suggestedIn: TemperatureCategory[];
}

// Weather appropriateness rules for each clothing type
export const clothingWeatherRules: Record<string, ClothingWeatherRules> = {
  'Tank Top': { blockedIn: ['cold', 'cool'], suggestedIn: ['hot'] },
  'T-Shirt': { blockedIn: ['cold'], suggestedIn: ['warm', 'hot'] },
  'Long Sleeve Shirt': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  'Polo': { blockedIn: ['cold'], suggestedIn: ['warm'] },
  'Button-Up Shirt': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  'Hoodie': { blockedIn: [], suggestedIn: ['cold', 'cool'] },
  'Jacket': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Sweatshirt': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Crewneck': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Sweater': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Shorts': { blockedIn: ['cold'], suggestedIn: ['hot', 'warm'] },
  'Skirt': { blockedIn: ['cold'], suggestedIn: ['warm', 'hot'] },
  'Jeans': { blockedIn: [], suggestedIn: ['cool', 'warm'] },
  'Pants': { blockedIn: [], suggestedIn: ['cold', 'cool', 'warm'] },
  'Sweats': { blockedIn: ['hot'], suggestedIn: ['cold', 'cool'] },
  'Leggings': { blockedIn: [], suggestedIn: ['cold', 'cool', 'warm'] },
};

export function isClothingAppropriateForWeather(
  clothingType: string,
  temperatureCategory: TemperatureCategory,
): boolean {
  const rules = clothingWeatherRules[clothingType];
  if (!rules) return true;
  return !rules.blockedIn.includes(temperatureCategory);
}

export function isClothingSuggestedForWeather(
  clothingType: string,
  temperatureCategory: TemperatureCategory,
): boolean {
  const rules = clothingWeatherRules[clothingType];
  if (!rules) return false;
  return rules.suggestedIn.includes(temperatureCategory);
}

export function isOuterwearRequired(temperatureCategory: TemperatureCategory): boolean {
  return temperatureCategory === 'cold';
}

export function isOuterwearSuggested(temperatureCategory: TemperatureCategory): boolean {
  return temperatureCategory === 'cold' || temperatureCategory === 'cool';
}

// ============================================================================
// OUTFIT WEAR TRACKING AND RATINGS
// ============================================================================

export interface OutfitWear {
  id: string;
  user_id: string;
  outfit_id?: string;
  top_id?: string;
  bottom_id?: string;
  shoes_id?: string;
  outerwear_id?: string;
  worn_date: string;
  notes?: string;
  rating?: number;
  comfort_rating?: number;
  created_at?: string;
}

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
