import '@/styles/globals.css';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import type { Metadata, Viewport } from 'next';

// Body font: geometric, modern, a bit more character than Inter.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Display font: used for the FitFinder wordmark and can be reused for headings.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
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
    <html lang="en" className={`${jakarta.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
