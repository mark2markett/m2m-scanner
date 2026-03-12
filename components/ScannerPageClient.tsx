'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { ScannerSummary } from '@/components/ScannerSummary';
import { ScannerFilters, type ScannerFilterState } from '@/components/ScannerFilters';
import { ScannerTable } from '@/components/ScannerTable';
import type { ScannerResult, ScanBatchStatus, ScannerStockResult } from '@/lib/types';

const SINGLE_STOCK_URL = 'https://singlestock.mark2markets.com';

export function ScannerPageClient() {
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [status, setStatus] = useState<ScanBatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ScannerFilterState>({
    search: '',
    sector: '',
    setupStage: '',
    publishableOnly: false,
    minScore: 0,
    sortBy: 'm2mScore',
    sortDir: 'desc',
    aiQuality: '',
    earlyStageOnly: false,
    minConfidence: 0,
  });

  // Fetch results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scanner/results');
      if (res.ok) {
        const data: ScannerResult = await res.json();
        setResult(data);
        setStatus(null);
      } else if (res.status === 404) {
        // No results yet, check status
        const statusRes = await fetch('/api/scanner/status');
        if (statusRes.ok) {
          setStatus(await statusRes.json());
        }
      } else {
        setError('Failed to load scan results.');
      }
    } catch {
      setError('Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Poll status if scan is running
  useEffect(() => {
    if (!status || status.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scanner/status');
        if (res.ok) {
          const newStatus: ScanBatchStatus = await res.json();
          setStatus(newStatus);
          if (newStatus.status === 'completed') {
            clearInterval(interval);
            fetchResults();
          }
        }
      } catch { /* ignore */ }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, fetchResults]);

  // Extract unique sectors and stages from result
  const { sectors, stages } = useMemo(() => {
    if (!result?.stocks) return { sectors: [], stages: [] };
    const sectorSet = new Set<string>();
    const stageSet = new Set<string>();
    for (const s of result.stocks) {
      if (s.sector) sectorSet.add(s.sector);
      if (s.setupStage) stageSet.add(s.setupStage);
    }
    return {
      sectors: [...sectorSet].sort(),
      stages: [...stageSet].sort(),
    };
  }, [result]);

  // Filter & sort stocks
  const filteredStocks = useMemo(() => {
    if (!result?.stocks) return [];

    let stocks = result.stocks.filter(s => !s.error);

    if (filters.search) {
      const q = filters.search.toLowerCase();
      stocks = stocks.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
      );
    }

    if (filters.sector) {
      stocks = stocks.filter(s => s.sector === filters.sector);
    }

    if (filters.setupStage) {
      stocks = stocks.filter(s => s.setupStage === filters.setupStage);
    }

    if (filters.publishableOnly) {
      stocks = stocks.filter(s => s.publishable);
    }

    if (filters.minScore > 0) {
      stocks = stocks.filter(s => s.m2mScore >= filters.minScore);
    }

    if (filters.aiQuality) {
      stocks = stocks.filter(s => s.aiSetupQuality === filters.aiQuality);
    }

    if (filters.earlyStageOnly) {
      stocks = stocks.filter(s => s.aiEarlyStage);
    }

    if (filters.minConfidence > 0) {
      stocks = stocks.filter(s => s.aiConfidence >= filters.minConfidence);
    }

    // Sort
    stocks.sort((a, b) => {
      const key = filters.sortBy as keyof ScannerStockResult;
      const aVal = a[key];
      const bVal = b[key];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return filters.sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return filters.sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return stocks;
  }, [result, filters]);

  const handleSelectStock = useCallback((symbol: string) => {
    window.open(`${SINGLE_STOCK_URL}/?symbol=${symbol}`, '_blank');
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="bg-[#111827] border-b border-[#1f2937] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="text-[#00E59B] font-bold text-xl tracking-tight">M2M</span>
              <div className="h-5 w-px bg-[#1f2937]" />
              <span className="text-sm font-semibold text-[#E5E7EB]">S&P 500 Scanner</span>
            </div>
            <div className="flex items-center gap-3">
              {result && (
                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(result.completedAt)}</span>
                </div>
              )}
              <button
                onClick={fetchResults}
                disabled={loading}
                className="p-2 text-[#6B7280] hover:text-[#00E59B] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Loading state */}
        {loading && !result && !status && (
          <div className="text-center py-20">
            <RefreshCw className="h-8 w-8 text-[#00E59B] animate-spin mx-auto mb-4" />
            <p className="text-[#6B7280]">Loading scanner results...</p>
          </div>
        )}

        {/* Scan in progress */}
        {status && status.status === 'running' && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 text-center">
            <RefreshCw className="h-8 w-8 text-[#00E59B] animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#E5E7EB] mb-2">Scan In Progress</h2>
            <p className="text-[#6B7280] mb-4">
              Analyzing {status.totalStocks} S&P 500 stocks...
            </p>
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                <span>Batch {status.completedBatches} of {status.totalBatches}</span>
                <span>{status.stocksProcessed} / {status.totalStocks} stocks</span>
              </div>
              <div className="w-full h-3 bg-[#1f2937] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00E59B] rounded-full transition-all duration-500"
                  style={{ width: `${(status.stocksProcessed / status.totalStocks) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#111827] border border-[#ef4444]/30 rounded-xl p-6 text-center">
            <p className="text-[#ef4444] mb-2">{error}</p>
            <button
              onClick={fetchResults}
              className="text-sm text-[#00E59B] hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* No results yet */}
        {!loading && !result && !status && !error && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-12 text-center">
            <h2 className="text-lg font-semibold text-[#E5E7EB] mb-2">No Scan Results Yet</h2>
            <p className="text-[#6B7280]">
              The scanner runs automatically at 8:00 AM ET on weekdays.
              Results will appear here after the first scan completes.
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            <ScannerSummary result={result} />

            <ScannerFilters
              filters={filters}
              onChange={setFilters}
              sectors={sectors}
              stages={stages}
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">
                {filteredStocks.length} of {result.successCount ?? 0} stocks
              </span>
            </div>

            <ScannerTable stocks={filteredStocks} onSelectStock={handleSelectStock} />
          </>
        )}
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}
