import '../styles/globals.css';
import ToastProvider from '../components/ToastProvider';

export const metadata = {
  title: 'FitFinder',
  description: 'Find your perfect outfit!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}