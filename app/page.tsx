import type { Metadata } from 'next';
import { ScannerPageClient } from '@/components/ScannerPageClient';

export const metadata: Metadata = {
  title: 'S&P 500 Scanner | M2M Stock Intelligence',
  description: 'Pre-market scanner analyzing all S&P 500 stocks with M2M scoring, setup detection, and trend alignment.',
};

export default function ScannerPage() {
  return <ScannerPageClient />;
}
