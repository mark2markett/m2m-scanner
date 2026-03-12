'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, Clock, Play, X, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
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

  // Watchlist selection
  const [watchlists, setWatchlists] = useState<{ id: string; name: string; stockCount: number }[]>([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState('sp500');

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

  // Manual scan state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Fetch available watchlists on mount
  useEffect(() => {
    fetch('/api/watchlists')
      .then(res => res.ok ? res.json() : [])
      .then(data => setWatchlists(data))
      .catch(() => {});
  }, []);

  const handleManualScan = useCallback(async () => {
    if (!password.trim()) return;
    setScanError(null);
    setScanning(true);
    setShowPasswordModal(false);

    try {
      const res = await fetch('/api/scanner/manual-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim(), watchlist: selectedWatchlist }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScanning(false);
        showToast('error', data.error || 'Failed to start scan');
        return;
      }

      // Start polling status
      const totalStocks = data.totalStocks || watchlists.find(w => w.id === selectedWatchlist)?.stockCount || 503;
      setStatus({ scanDate: new Date().toISOString().split('T')[0], totalBatches: 0, completedBatches: 0, currentBatch: 0, status: 'running', stocksProcessed: 0, totalStocks, startedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() });
    } catch {
      setScanning(false);
      showToast('error', 'Failed to connect to server');
    } finally {
      setPassword('');
    }
  }, [password, selectedWatchlist, watchlists, showToast]);

  // Watch for scan completion when manually triggered
  useEffect(() => {
    if (!scanning) return;
    if (status && status.status === 'completed') {
      setScanning(false);
      showToast('success', 'Scan complete!');
      fetchResults();
    }
    if (status && status.status === 'failed') {
      setScanning(false);
      showToast('error', 'Scan failed');
    }
  }, [status, scanning, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {watchlists.length > 1 ? (
                <div className="relative">
                  <select
                    value={selectedWatchlist}
                    onChange={e => setSelectedWatchlist(e.target.value)}
                    className="appearance-none bg-transparent text-sm font-semibold text-[#E5E7EB] pr-6 cursor-pointer focus:outline-none"
                  >
                    {watchlists.map(w => (
                      <option key={w.id} value={w.id} className="bg-[#111827] text-[#E5E7EB]">
                        {w.name} ({w.stockCount})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280] pointer-events-none" />
                </div>
              ) : (
                <span className="text-sm font-semibold text-[#E5E7EB]">
                  {watchlists.find(w => w.id === selectedWatchlist)?.name || 'S&P 500 Scanner'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {result && (
                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(result.completedAt)}</span>
                </div>
              )}
              <button
                onClick={() => setShowPasswordModal(true)}
                disabled={scanning || (status?.status === 'running')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#00E59B]/10 text-[#00E59B] hover:bg-[#00E59B]/20 border border-[#00E59B]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanning || status?.status === 'running' ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    <span>Run Scan</span>
                  </>
                )}
              </button>
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

      {/* Last scanned banner */}
      {result && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <p className="text-xs text-[#6B7280]">
            Last scanned: {formatTimeAgo(result.completedAt)}
          </p>
        </div>
      )}

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
              Analyzing {status.totalStocks} stocks...
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

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#E5E7EB]">Run Manual Scan</h3>
              <button onClick={() => { setShowPasswordModal(false); setPassword(''); setScanError(null); }} className="text-[#6B7280] hover:text-[#E5E7EB]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualScan()}
              autoFocus
              className="w-full px-3 py-2 bg-[#0a0e17] border border-[#1f2937] rounded-lg text-sm text-[#E5E7EB] placeholder-[#6B7280] focus:outline-none focus:border-[#00E59B]/50 mb-3"
            />
            {scanError && <p className="text-xs text-[#ef4444] mb-3">{scanError}</p>}
            <button
              onClick={handleManualScan}
              disabled={!password.trim()}
              className="w-full py-2 text-sm font-medium rounded-lg bg-[#00E59B] text-[#0a0e17] hover:bg-[#00E59B]/90 transition-colors disabled:opacity-50"
            >
              Start Scan
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-[#065f46] text-[#6ee7b7] border border-[#10b981]/30'
            : 'bg-[#7f1d1d] text-[#fca5a5] border border-[#ef4444]/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
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

function formatTimeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch {
    return iso;
  }
}
