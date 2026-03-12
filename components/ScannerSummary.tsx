'use client';

import { BarChart3, CheckCircle, Zap, Star, PieChart } from 'lucide-react';
import type { ScannerResult } from '@/lib/types';

interface ScannerSummaryProps {
  result: ScannerResult;
}

export function ScannerSummary({ result }: ScannerSummaryProps) {
  const publishable = result.publishable ?? [];
  const earlyStage = result.earlyStage ?? [];
  const highQuality = result.highQuality ?? [];
  const bySector = result.bySector ?? {};

  const cards = [
    {
      label: 'Stocks Scanned',
      value: result.successCount ?? 0,
      sub: `${result.errorCount ?? 0} errors`,
      icon: BarChart3,
      color: '#00E59B',
    },
    {
      label: 'Publishable',
      value: publishable.length,
      sub: `of ${result.successCount ?? 0}`,
      icon: CheckCircle,
      color: '#22c55e',
    },
    {
      label: 'Early Stage',
      value: earlyStage.length,
      sub: 'AI-detected forming setups',
      icon: Zap,
      color: '#f59e0b',
    },
    {
      label: 'High Quality',
      value: highQuality.length,
      sub: 'AI-rated high quality',
      icon: Star,
      color: '#8b5cf6',
    },
    {
      label: 'Sectors',
      value: Object.keys(bySector).length,
      sub: `top: ${getTopSector(bySector)}`,
      icon: PieChart,
      color: '#3b82f6',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[#111827] border border-[#1f2937] rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon className="h-4 w-4" style={{ color: card.color }} />
            <span className="text-xs text-[#6B7280]">{card.label}</span>
          </div>
          <div className="text-2xl font-bold text-[#E5E7EB]">{card.value}</div>
          <div className="text-xs text-[#6B7280] mt-1">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

function getTopSector(bySector: Record<string, number>): string {
  const entries = Object.entries(bySector);
  if (entries.length === 0) return 'N/A';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
