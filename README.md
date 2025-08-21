# FitFinder 

A smart wardrobe management and outfit generation application that helps you organize your clothes and create stylish outfits based on your color preferences.

## Features

### Smart Closet Management
- **Organized Sections**: Automatically categorize clothing into Tops, Bottoms, Outerwear, and Shoes
- **Image Upload**: Add photos of your clothing items with drag-and-drop functionality
- **Item Details**: Track clothing type, colors, and cleanliness status
- **Bulk Operations**: Mark multiple items as clean/dirty with one click

### Color Preferences
- **Personalized Tastes**: Set your favorite and least favorite color combinations
- **Smart Filtering**: Outfit generator respects your color preferences
- **Visual Feedback**: See which color combinations you like/dislike

### Outfit Generator
- **Random Generation**: Get fresh outfit ideas from your closet
- **Item Locking**: Lock specific pieces you want to wear and generate around them
- **Color Harmony**: Ensures outfits follow good color combination principles
- **Outfit Saving**: Save your favorite combinations for future reference

### User Authentication
- **Secure Login**: User accounts with Supabase authentication
- **Personal Closets**: Each user has their own private wardrobe
- **Data Persistence**: Your clothes and preferences are safely stored

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for backend services)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/FitFinder.git
   cd FitFinder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key
   - Create the following tables in your Supabase database:

   ```sql
   -- Clothing items table
   CREATE TABLE clothing_items (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     type TEXT NOT NULL,
     colors TEXT[] NOT NULL,
     image_url TEXT NOT NULL,
     is_dirty BOOLEAN DEFAULT false,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Saved outfits table
   CREATE TABLE saved_outfits (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     outfit_items JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Color preferences table
   CREATE TABLE color_preferences (
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     liked_combinations JSONB DEFAULT '[]',
     disliked_combinations JSONB DEFAULT '[]',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

4. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Use

### 1. Getting Started
- Sign up for a new account or log in
- Click the "?" button in the top-left for detailed instructions

### 2. Building Your Closet
- Navigate to the **Closet** tab
- Click "Add Item" in any section
- Upload a photo of your clothing item
- Select the item type and colors
- Save to add it to your wardrobe

### 3. Setting Color Preferences
- Go to the **Preferences** tab
- Mark color combinations you like/dislike
- This helps the outfit generator create better combinations

### 4. Generating Outfits
- Switch to the **Generator** tab
- Click "Generate Outfit" for random suggestions
- Lock specific items you want to wear
- Save outfits you love for later

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Image Storage**: Supabase Storage
- **Deployment**: Vercel-ready

## Responsive Design

FitFinder is fully responsive and works great on:
- Desktop computers
- Tablets
- Mobile phones

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Next.js and React
- Powered by Supabase
- Styled with Tailwind CSS

## Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Check the in-app help (click the "?" button)
- Review the code comments for technical details

---

**Happy styling! 🎨✨**
