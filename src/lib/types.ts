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

// User-defined occasion rules (mirrors shape of occasionRules in constants)
export type UserOccasionRules = Record<string, { tops: string[]; bottoms: string[]; shoes: string[] }>;

// Represents a saved outfit configuration
export interface SavedOutfit {
  id?: string;
  user_id: string;
  name?: string;
  outfit_items: {
    top_id: string;
    bottom_id: string;
    shoes_id: string;
  };
  created_at?: string;
}

// Clothing category sections
export type ClothingSection = 'Tops' | 'Bottoms' | 'Shoes';

// ============================================================================
// WEATHER-RELATED TYPES
// ============================================================================

import type { TemperatureCategory } from '@/lib/weatherApi';

// Defines which temperature categories a clothing type is appropriate for
export interface ClothingWeatherRules {
  blockedIn: TemperatureCategory[];
  suggestedIn: TemperatureCategory[];
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
  };
}

// ============================================================================
// USER WEATHER PREFERENCES
// ============================================================================

export interface UserWeatherPreferences {
  thresholds: { cold: number; cool: number; warm: number };
  clothingRules: Record<string, ClothingWeatherRules> | null;
}

// Tab types for the dashboard navigation
export type DashboardTab = 'closet' | 'generator' | 'calendar' | 'stats' | 'preferences';
