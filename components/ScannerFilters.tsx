'use client';

import { Search, X } from 'lucide-react';

export interface ScannerFilterState {
  search: string;
  sector: string;
  setupStage: string;
  publishableOnly: boolean;
  minScore: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  aiQuality: string;
  earlyStageOnly: boolean;
  minConfidence: number;
}

interface ScannerFiltersProps {
  filters: ScannerFilterState;
  onChange: (filters: ScannerFilterState) => void;
  sectors: string[];
  stages: string[];
}

export function ScannerFilters({ filters, onChange, sectors, stages }: ScannerFiltersProps) {
  const update = (patch: Partial<ScannerFilterState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 space-y-3">
      {/* Search + toggle buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search symbol or name..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full pl-9 pr-8 py-2 bg-[#0a0e17] border border-[#1f2937] rounded-lg text-sm text-[#E5E7EB] placeholder-[#6B7280] focus:outline-none focus:border-[#00E59B]/50"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#E5E7EB]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => update({ publishableOnly: !filters.publishableOnly })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            filters.publishableOnly
              ? 'bg-[#00E59B]/20 text-[#00E59B] border border-[#00E59B]/40'
              : 'bg-[#0a0e17] text-[#6B7280] border border-[#1f2937] hover:border-[#374151]'
          }`}
        >
          Publishable Only
        </button>

        <button
          onClick={() => update({ earlyStageOnly: !filters.earlyStageOnly })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            filters.earlyStageOnly
              ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40'
              : 'bg-[#0a0e17] text-[#6B7280] border border-[#1f2937] hover:border-[#374151]'
          }`}
        >
          Early Stage Only
        </button>
      </div>

      {/* Dropdowns row */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.sector}
          onChange={(e) => update({ sector: e.target.value })}
          className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-[#E5E7EB] focus:outline-none focus:border-[#00E59B]/50"
        >
          <option value="">All Sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filters.setupStage}
          onChange={(e) => update({ setupStage: e.target.value })}
          className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-[#E5E7EB] focus:outline-none focus:border-[#00E59B]/50"
        >
          <option value="">All Stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filters.aiQuality}
          onChange={(e) => update({ aiQuality: e.target.value })}
          className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-[#E5E7EB] focus:outline-none focus:border-[#00E59B]/50"
        >
          <option value="">All AI Quality</option>
          <option value="high">High Quality</option>
          <option value="moderate">Moderate Quality</option>
          <option value="low">Low Quality</option>
        </select>

        <select
          value={filters.minConfidence}
          onChange={(e) => update({ minConfidence: Number(e.target.value) })}
          className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-[#E5E7EB] focus:outline-none focus:border-[#00E59B]/50"
        >
          <option value={0}>Min Confidence: Any</option>
          <option value={25}>Min Confidence: 25+</option>
          <option value={50}>Min Confidence: 50+</option>
          <option value={70}>Min Confidence: 70+</option>
          <option value={90}>Min Confidence: 90+</option>
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value })}
          className="bg-[#0a0e17] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-[#E5E7EB] focus:outline-none focus:border-[#00E59B]/50"
        >
          <option value="m2mScore">Sort: M2M Score</option>
          <option value="aiConfidence">Sort: AI Confidence</option>
          <option value="changePercent">Sort: Change %</option>
          <option value="rsi">Sort: RSI</option>
          <option value="volume">Sort: Volume</option>
          <option value="symbol">Sort: Symbol</option>
        </select>

        <button
          onClick={() => update({ sortDir: filters.sortDir === 'desc' ? 'asc' : 'desc' })}
          className="px-3 py-2 bg-[#0a0e17] border border-[#1f2937] rounded-lg text-sm text-[#6B7280] hover:text-[#E5E7EB] transition-colors"
        >
          {filters.sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
        </button>
      </div>
    </div>
  );
}
