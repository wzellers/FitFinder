# FitFinder

A smart wardrobe management and outfit generation app. Upload your clothing, set color preferences, and get intelligent outfit suggestions based on weather, occasion, color harmony, and what you've worn recently.

Built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Supabase.

## Features

### Closet Management
- Upload clothing photos organized into Tops, Bottoms, Outerwear, and Shoes
- Tag items by type and color for accurate outfit matching
- Track laundry status (clean/dirty) — dirty items are excluded from generation
- Edit or delete items anytime

### Smart Outfit Generation
- Weighted scoring algorithm considers five factors:
  - **Color harmony** (30%) — favors your liked color combinations
  - **Weather** (25%) — filters by temperature using your local forecast
  - **Variety** (20%) — avoids items you've worn in the past week
  - **Occasion** (15%) — matches clothing types to Casual, Work, Date, or Active
  - **Comfort** (10%) — boosts items from your highest-rated past outfits
- Lock individual pieces and regenerate around them
- Cycle through the top 10 scored results
- Save outfits for later or log them as today's wear

### Outfit Calendar
- Visual monthly calendar showing what you wore each day
- Log outfits by picking individual items or loading a saved outfit
- Edit or delete past entries

### Wardrobe Stats
- Overview of total items, wear count, clean/dirty breakdown
- Category distribution bars
- Most worn and neglected items
- Color distribution across your wardrobe
- Average outfit rating and top-rated outfits
- Filter stats by week, month, or all time

### Color Preferences
- Set your zip code for weather-aware outfit suggestions
- Build a library of liked color combinations
- Visual color pairing interface with your actual wardrobe colors

### Onboarding
- Guided 3-step setup for new users (zip code, first items, finish)
- Rating prompt for yesterday's outfit on each visit

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, TypeScript (strict mode), Tailwind CSS 3
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Icons**: Lucide React
- **Weather**: OpenWeatherMap API

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- A Supabase project

### Setup

1. Clone the repo
   ```bash
   git clone https://github.com/wzellers/FitFinder.git
   cd FitFinder
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env.local` file
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_OPENWEATHERMAP_API_KEY=your_openweathermap_key
   ```

4. Set up the Supabase database. Create these tables:

   ```sql
   CREATE TABLE clothing_items (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     type TEXT NOT NULL,
     colors TEXT[] NOT NULL,
     image_url TEXT NOT NULL,
     is_dirty BOOLEAN DEFAULT false,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE saved_outfits (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     outfit_items JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE color_preferences (
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     liked_combinations JSONB DEFAULT '[]',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE outfit_wears (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     worn_date DATE NOT NULL,
     top_id UUID REFERENCES clothing_items(id),
     bottom_id UUID REFERENCES clothing_items(id),
     shoes_id UUID REFERENCES clothing_items(id),
     outerwear_id UUID REFERENCES clothing_items(id),
     outfit_id UUID REFERENCES saved_outfits(id),
     rating INTEGER,
     comfort_rating INTEGER,
     notes TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE profiles (
     id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     zip_code TEXT,
     onboarding_completed BOOLEAN DEFAULT false,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

   Also create a `clothing-images` storage bucket in Supabase with public access.

5. Run the dev server
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/
    layout.tsx          # Root layout with Inter font and ToastProvider
    page.tsx            # Main page with tab navigation and modal management
  components/
    AuthForm.tsx        # Login / signup form
    Closet.tsx          # Wardrobe grid with section filters
    ColorPreferences.tsx # Color combo builder + zip code settings
    ColorCombinationModal.tsx # Modal for adding color pairings
    EditItem.tsx        # Edit item type, color, laundry status
    ImageUpload.tsx     # Upload new clothing items
    Onboarding.tsx      # New user guided setup
    OutfitCalendar.tsx  # Monthly calendar with outfit logging
    OutfitGenerator.tsx # Scoring-based outfit generation + saved outfits
    RatingPrompt.tsx    # Rate yesterday's outfit modal
    ToastProvider.tsx   # Toast notification system
    WardrobeStats.tsx   # Wardrobe analytics dashboard
    ui/Skeleton.tsx     # Loading skeleton components
  hooks/
    useAuth.ts          # Supabase auth state hook
  lib/
    colorUtils.ts       # Color display helpers
    constants.ts        # Shared constants (types, palettes, occasion rules)
    outfitScoring.ts    # Weighted outfit scoring engine
    supabaseClient.ts   # Supabase client instance
    types.ts            # TypeScript interfaces and weather rules
    weatherApi.ts       # OpenWeatherMap integration with caching
  styles/
    globals.css         # Tailwind directives + CSS custom properties + component classes
```

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run start` — start production server
