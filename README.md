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
