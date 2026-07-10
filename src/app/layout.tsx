import '@/styles/globals.css';
import localFont from 'next/font/local';
import ToastProvider from '@/components/ToastProvider';
import type { Metadata, Viewport } from 'next';

// Body font: "Super Retro M54" — a retro pixel-ish face used app-wide.
const superRetro = localFont({
  src: [
    { path: '../../public/fonts/SuperRetroM54.ttf', style: 'normal' },
    { path: '../../public/fonts/SuperRetroM54-Italic.ttf', style: 'italic' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

// Display font: "Kelvinized" — bold italic wordmark used for the FitFinder logo.
const kelvinized = localFont({
  src: '../../public/fonts/Kelvinized.ttf',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FitFinder — Smart Wardrobe & Outfit Generator',
  description:
    'Manage your wardrobe, get weather-aware outfit suggestions, and track what you wear with FitFinder.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${superRetro.variable} ${kelvinized.variable}`}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
