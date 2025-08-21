"use client";

// Import React and custom components
import React, { useState } from 'react';
import AuthForm from '../components/AuthForm';
import Closet from '../components/Closet';
import ColorPreferences from '../components/ColorPreferences';
import OutfitGenerator from '../components/OutfitGenerator';
import ImageUpload from '../components/ImageUpload';
import EditItem from '../components/EditItem';
import { useAuth } from '../hooks/useAuth';

/**
 * Main Page Component - FitFinder App
 * 
 * This is the root component that manages the overall app state and renders
 * different sections based on user authentication and active tab selection.
 * 
 * Features:
 * - User authentication (login/signup)
 * - Tab-based navigation between Closet, Preferences, and Generator
 * - Directions sidebar for app usage instructions
 * - Modal management for image upload and item editing
 */
export default function Page() {
  // Authentication state from custom hook
  const { user, signOut } = useAuth();
  
  // Local state management
  const [activeTab, setActiveTab] = useState('closet');           // Current active tab: 'closet', 'preferences', or 'generator'
  const [showDirections, setShowDirections] = useState(false);    // Controls visibility of directions sidebar
  const [showImageUpload, setShowImageUpload] = useState(false);  // Controls visibility of image upload modal
  const [showEditItem, setShowEditItem] = useState(false);        // Controls visibility of edit item modal
  const [selectedItem, setSelectedItem] = useState(null);         // Currently selected item for editing
  const [closetRefreshKey, setClosetRefreshKey] = useState(0);   // Key to force closet component refresh

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: '#1a2238', display: 'flex', flexDirection: 'row', minHeight: '100vh' }}>
      
      {/* ===== TOP NAVIGATION BAR ===== */}
      {/* Only show navigation when user is authenticated */}
      {user && (
        <>
          {/* Directions Button - Top Left */}
          <div style={{ position: 'absolute', top: '1.2rem', left: '1.2rem', zIndex: 100, display: 'flex', gap: '1.5rem' }}>
            <button
              onClick={() => setShowDirections(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#e0f6ff',
                fontSize: '1.2rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'Arial, sans-serif',
              }}
              aria-label="Show directions"
            >
              ?
            </button>
          </div>
          
          {/* Sign Out Button - Top Right */}
          <div style={{ position: 'absolute', top: '1.2rem', right: '1.2rem', zIndex: 100, display: 'flex', gap: '1.5rem' }}>
            <button
              onClick={signOut}
              style={{
                background: 'none',
                border: 'none',
                color: '#e0f6ff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'Arial, sans-serif',
              }}
              aria-label="Sign out"
            >
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* ===== DIRECTIONS SIDEBAR ===== */}
      {/* Slide-out panel that appears from the left when directions button is clicked */}
      {showDirections && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 320,
          height: '100vh',
          background: '#1a2238',
          zIndex: 200,
          boxShadow: '4px 0 32px #1565c044',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '2.5rem 2.5rem 2rem 2.5rem',
          transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Close Button - Top Right of Sidebar */}
          <button
            onClick={() => setShowDirections(false)}
            style={{
              position: 'absolute',
              top: 12,
              right: 16,
              background: 'none',
              border: 'none',
              fontSize: '1.3rem',
              color: '#e0f6ff',
              cursor: 'pointer',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 400,
            }}
            aria-label="Close directions"
          >
            ×
          </button>
          
          {/* Directions Title */}
          <h2 style={{ 
            fontFamily: 'Arial, sans-serif', 
            color: '#e0f6ff', 
            marginBottom: 16, 
            textAlign: 'center',
            fontSize: '1.3rem',
            fontWeight: 'bold'
          }}>Directions</h2>
          
          {/* Scrollable Directions Content */}
          <div style={{ 
            color: '#e0f6ff', 
            fontFamily: 'Arial, sans-serif',
            overflowY: 'auto',
            flex: 1,
            paddingRight: '0.5rem',
            paddingBottom: '2rem',
            fontSize: '0.8rem',
            lineHeight: '1.5',
            textAlign: 'center'
          }}>
            
            {/* Step 1: Closet Management */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ 
                fontSize: '1.1rem', 
                marginBottom: '0.5rem', 
                color: '#e0f6ff', 
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center'
              }}>
                1. Closet
              </h3>
              <ul style={{ 
                margin: 0,
                fontFamily: 'Arial, sans-serif',
                listStyle: 'none',
                paddingLeft: 0
              }}>
                <li style={{ marginBottom: '0.3rem' }}>Upload pictures of your clothing items and organize them into categories (tops, bottoms, outerwear, shoes)</li>
                <li style={{ marginBottom: '0.3rem' }}>You can also mark items as clean or dirty so your digital closet stays true to what's available in real life</li>
              </ul>
            </div>

            {/* Step 2: Color Preferences */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ 
                fontSize: '1.1rem', 
                marginBottom: '0.5rem', 
                color: '#e0f6ff', 
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center'
              }}>
                2. Preferences
              </h3>
              <ul style={{ 
                margin: 0,
                fontFamily: 'Arial, sans-serif',
                listStyle: 'none',
                paddingLeft: 0
              }}>
                <li style={{ marginBottom: '0.3rem' }}>Add color combinations you like/dislike so you'll never see a combination you don't like</li>
              </ul>
            </div>

            {/* Step 3: Outfit Generation */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ 
                fontSize: '1.1rem', 
                marginBottom: '0.5rem', 
                color: '#e0f6ff', 
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center'
              }}>
                3. Generator
              </h3>
              <ul style={{ 
                margin: 0,
                fontFamily: 'Arial, sans-serif',
                listStyle: 'none',
                paddingLeft: 0
              }}>
                <li style={{ marginBottom: '0.3rem' }}>Click the "Generate" button to see what outfits you can make with your clothes</li>
                <li style={{ marginBottom: '0.3rem' }}>Lock specific items and let the app build around them</li>
                <li style={{ marginBottom: '0.3rem' }}>Save outfits you like for easy access later</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT AREA ===== */}
      <main style={{
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 0,
        margin: 0,
        fontFamily: 'Arial, sans-serif',
        marginTop: 0,
        color: '#e0f6ff',
        backgroundColor: '#1a2238',
      }}>
        
        {/* App Logo/Title */}
        <h1 className="fitfinder-glow" style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '0.1em',
          letterSpacing: '0.1em',
          fontWeight: 900,
          fontFamily: 'Orbitron, Arial, sans-serif',
          fontSize: '2.5rem',
          marginBottom: '1.2rem',
          marginTop: '1.5rem',
          color: '#e0f6ff',
        }}>
          <span style={{ fontSize: '3.8rem', lineHeight: '1', display: 'inline-block' }}>F</span>IT
          <span style={{ fontSize: '3.8rem', lineHeight: '1', display: 'inline-block' }}>F</span>INDER
        </h1>
        
        {/* ===== TAB NAVIGATION ===== */}
        {/* Only show tabs when user is authenticated */}
        {user && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1.2rem', marginBottom: '1.5rem', justifyContent: 'center', alignItems: 'center', marginTop: '0.5rem' }}>
            
            {/* Closet Tab Button */}
            <button
              onClick={() => setActiveTab('closet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: activeTab === 'closet' ? '#1565c0' : 'none',
                color: activeTab === 'closet' ? '#fff' : '#e0f6ff',
                fontWeight: 700,
                fontSize: '0.95rem',
                fontFamily: 'Arial, sans-serif',
                border: activeTab === 'closet' ? '2px solid #1565c0' : '2px solid transparent',
                outline: 'none',
                borderRadius: '14px',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'closet' ? '0 2px 8px #1565c044' : 'none',
                transition: 'background 0.18s, color 0.18s, border 0.18s',
                minWidth: 0,
              }}
            >
              Closet
            </button>
            
            {/* Preferences Tab Button */}
            <button
              onClick={() => setActiveTab('preferences')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: activeTab === 'preferences' ? '#1565c0' : 'none',
                color: activeTab === 'preferences' ? '#fff' : '#e0f6ff',
                fontWeight: 700,
                fontSize: '0.95rem',
                fontFamily: 'Arial, sans-serif',
                border: activeTab === 'preferences' ? '2px solid #1565c0' : '2px solid transparent',
                outline: 'none',
                borderRadius: '14px',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'preferences' ? '0 2px 8px #1565c044' : 'none',
                transition: 'background 0.18s, color 0.18s, border 0.18s',
                minWidth: 0,
              }}
            >
              Preferences
            </button>
            
            {/* Generator Tab Button */}
            <button
              onClick={() => setActiveTab('generator')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: activeTab === 'generator' ? '#1565c0' : 'none',
                color: activeTab === 'generator' ? '#fff' : '#e0f6ff',
                fontWeight: 700,
                fontSize: '0.95rem',
                fontFamily: 'Arial, sans-serif',
                border: activeTab === 'generator' ? '2px solid #1565c0' : '2px solid transparent',
                outline: 'none',
                borderRadius: '14px',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'generator' ? '0 2px 8px #1565c044' : 'none',
                transition: 'background 0.18s, color 0.18s, border 0.18s',
                minWidth: 0,
              }}
            >
              Generator
            </button>
          </div>
        )}
        
        {/* ===== TAB CONTENT RENDERING ===== */}
        {/* Conditionally render different components based on active tab */}
        {user ? (
          <>
            {/* Closet Tab - Manage clothing items */}
            {activeTab === 'closet' && <Closet 
              key={closetRefreshKey} 
              onAddItem={() => setShowImageUpload(true)}
              onEditItem={(item) => {
                setSelectedItem(item);
                setShowEditItem(true);
              }}
            />}
            
            {/* Preferences Tab - Set color preferences */}
            {activeTab === 'preferences' && <ColorPreferences />}
            
            {/* Generator Tab - Create and save outfits */}
            {activeTab === 'generator' && <OutfitGenerator />}
          </>
        ) : (
          /* Show authentication form when user is not logged in */
          <AuthForm />
        )}
        
        {/* ===== MODAL COMPONENTS ===== */}
        
        {/* Image Upload Modal - For adding new clothing items */}
        <ImageUpload 
          isOpen={showImageUpload} 
          onClose={() => setShowImageUpload(false)}
          onItemUploaded={() => setClosetRefreshKey(prev => prev + 1)}
        />

        {/* Edit Item Modal - For modifying existing clothing items */}
        <EditItem 
          isOpen={showEditItem} 
          onClose={() => setShowEditItem(false)}
          item={selectedItem}
          onItemUpdated={() => setClosetRefreshKey(prev => prev + 1)}
          onItemDeleted={() => setClosetRefreshKey(prev => prev + 1)}
        />
      </main>
    </div>
  );
}