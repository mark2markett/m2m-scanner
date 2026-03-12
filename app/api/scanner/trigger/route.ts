import { NextRequest, NextResponse } from 'next/server';
import { loadWatchlist } from '@/lib/data/watchlistLoader';
import { ScannerEngine } from '@/lib/server/scannerEngine';
import { KVStore } from '@/lib/server/kvStore';
import type { ScanBatchStatus } from '@/lib/types';

const BATCH_SIZE = 10;

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization');
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true;

  const secret = request.nextUrl.searchParams.get('secret');
  if (secret === process.env.CRON_SECRET) return true;

  return false;
}

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const watchlistId = request.nextUrl.searchParams.get('watchlist') || 'sp500';
  const watchlistStocks = loadWatchlist(watchlistId);
  const totalAll = watchlistStocks.length;
  const startIndex = parseInt(request.nextUrl.searchParams.get('start') || '0', 10);
  const endIndex = parseInt(request.nextUrl.searchParams.get('end') || String(totalAll), 10);

  const sliceStocks = watchlistStocks.slice(startIndex, endIndex);
  const sliceSize = sliceStocks.length;

  if (sliceSize === 0) {
    return NextResponse.json({ error: 'Empty slice' }, { status: 400 });
  }

  const now = new Date();
  const scanDate = now.toISOString().split('T')[0];
  const totalBatches = Math.ceil(sliceSize / BATCH_SIZE);

  // Update scan status
  const status: ScanBatchStatus = {
    scanDate,
    totalBatches,
    completedBatches: 0,
    currentBatch: 0,
    status: 'running',
    stocksProcessed: 0,
    totalStocks: totalAll,
    startedAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
  };
  await KVStore.setScanStatus(status);

  // Process all batches in this slice sequentially
  const allResults: import('@/lib/types').ScannerStockResult[] = [];

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const bStart = batchIndex * BATCH_SIZE;
    const batchStocks = sliceStocks.slice(bStart, bStart + BATCH_SIZE);
    const batchResults = await ScannerEngine.analyzeBatch(batchStocks);
    allResults.push(...batchResults);

    status.completedBatches = batchIndex + 1;
    status.currentBatch = batchIndex + 1;
    status.stocksProcessed = Math.min((batchIndex + 1) * BATCH_SIZE, sliceSize);
    status.lastUpdatedAt = new Date().toISOString();
    await KVStore.setScanStatus(status);
  }

  // Store this slice's results keyed by start-end
  await KVStore.setSliceResults(scanDate, startIndex, endIndex, allResults);

  return NextResponse.json({
    message: `Slice ${startIndex}-${endIndex} complete`,
    scanDate,
    sliceStocks: sliceSize,
    successCount: allResults.filter(s => !s.error).length,
    errorCount: allResults.filter(s => !!s.error).length,
  });
}
