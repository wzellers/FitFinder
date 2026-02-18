import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import type { Metadata, Viewport } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
