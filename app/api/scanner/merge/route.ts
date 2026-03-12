import { NextRequest, NextResponse } from 'next/server';
import { KVStore } from '@/lib/server/kvStore';
import { loadWatchlist } from '@/lib/data/watchlistLoader';
import type { ScannerStockResult, ScannerResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SLICE_SIZE = 120;

function computeSlices(totalStocks: number): [number, number][] {
  const slices: [number, number][] = [];
  for (let start = 0; start < totalStocks; start += SLICE_SIZE) {
    slices.push([start, Math.min(start + SLICE_SIZE, totalStocks)]);
  }
  return slices;
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization');
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true;

  const secret = request.nextUrl.searchParams.get('secret');
  if (secret === process.env.CRON_SECRET) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const scanDate = now.toISOString().split('T')[0];
  const watchlistId = request.nextUrl.searchParams.get('watchlist') || 'sp500';
  const watchlistStocks = loadWatchlist(watchlistId);
  const slices = computeSlices(watchlistStocks.length);

  // Collect all slice results
  const allStocks: ScannerStockResult[] = [];
  const missingSlices: string[] = [];

  for (const [start, end] of slices) {
    const sliceResults = await KVStore.getSliceResults(scanDate, start, end);
    if (sliceResults) {
      allStocks.push(...sliceResults);
    } else {
      missingSlices.push(`${start}-${end}`);
    }
  }

  if (missingSlices.length > 0) {
    return NextResponse.json({
      error: 'Some slices have not completed yet',
      missingSlices,
      stocksSoFar: allStocks.length,
    }, { status: 202 });
  }

  const successStocks = allStocks.filter(s => !s.error);
  const errorStocks = allStocks.filter(s => !!s.error);

  const sorted = [...successStocks].sort((a, b) => b.m2mScore - a.m2mScore);
  const topByScore = sorted.slice(0, 20).map(s => s.symbol);
  const justTriggered = successStocks.filter(s => s.setupStage === 'Just Triggered').map(s => s.symbol);
  const publishable = successStocks.filter(s => s.publishable).map(s => s.symbol);
  const earlyStage = successStocks.filter(s => s.aiEarlyStage).map(s => s.symbol);
  const highQuality = successStocks.filter(s => s.aiSetupQuality === 'high').map(s => s.symbol);

  const bySector: Record<string, number> = {};
  for (const stock of successStocks) {
    bySector[stock.sector] = (bySector[stock.sector] || 0) + 1;
  }

  const result: ScannerResult = {
    scanDate,
    startedAt: now.toISOString(),
    completedAt: new Date().toISOString(),
    totalStocks: allStocks.length,
    successCount: successStocks.length,
    errorCount: errorStocks.length,
    watchlist: watchlistId,
    stocks: allStocks,
    topByScore,
    justTriggered,
    publishable,
    earlyStage,
    highQuality,
    bySector,
  };

  await KVStore.setLatestResult(result);

  // Update status to completed
  const status = await KVStore.getScanStatus(scanDate);
  if (status) {
    status.status = 'completed';
    status.stocksProcessed = allStocks.length;
    status.lastUpdatedAt = new Date().toISOString();
    await KVStore.setScanStatus(status);
  }

  return NextResponse.json({
    message: 'Scan merged',
    scanDate,
    totalStocks: allStocks.length,
    successCount: successStocks.length,
    errorCount: errorStocks.length,
    topByScore: topByScore.slice(0, 5),
  });
}
