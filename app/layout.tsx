import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'S&P 500 Scanner | M2M Stock Intelligence',
  description: 'Pre-market scanner analyzing all S&P 500 stocks with M2M scoring, setup detection, and trend alignment.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0e17] text-[#E5E7EB] antialiased">
        {children}
      </body>
    </html>
  );
}
