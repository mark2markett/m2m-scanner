import { NextRequest, NextResponse } from 'next/server';
import { KVStore } from '@/lib/server/kvStore';
import type { ScannerStockResult, ScannerResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

// The 5 slices that cron triggers
const SLICES: [number, number][] = [
  [0, 120],
  [120, 240],
  [240, 360],
  [360, 480],
  [480, 503],
];

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

  // Collect all slice results
  const allStocks: ScannerStockResult[] = [];
  const missingSlices: string[] = [];

  for (const [start, end] of SLICES) {
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
