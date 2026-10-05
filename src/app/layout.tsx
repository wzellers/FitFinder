import '@/styles/globals.css';
import { Archivo, Instrument_Sans } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import type { Metadata, Viewport } from 'next';

// Body text: Instrument Sans — a clear, slightly warm grotesk for reading.
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Labels, headings and ticket numbers: Archivo, whose width axis gives the
// condensed, printed-ticket look of a dry cleaner's tags.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
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
    <html lang="en" className={`${instrumentSans.variable} ${archivo.variable}`}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
