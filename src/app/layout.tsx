import '@/styles/globals.css';
import { Anton, Geist, Geist_Mono, Yellowtail } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import type { Metadata, Viewport } from 'next';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// Tall condensed poster face for page titles and the wordmark.
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-poster',
  display: 'swap',
});
// Retro script, used for one decorative word per page header.
const yellowtail = Yellowtail({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
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
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${anton.variable} ${yellowtail.variable}`}
    >
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
