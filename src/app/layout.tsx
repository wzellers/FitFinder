import '@/styles/globals.css';
import { Geist, Geist_Mono, Michroma } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import type { Metadata, Viewport } from 'next';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// Wide techno face, used only for the wordmark.
const michroma = Michroma({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-wide',
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${michroma.variable}`}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
