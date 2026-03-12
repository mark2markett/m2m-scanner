import { NextRequest, NextResponse } from 'next/server';
import { KVStore } from '@/lib/server/kvStore';
import type { ScannerStockResult, ScannerResult } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { scanDate, totalBatches, watchlist } = await request.json();

  if (!scanDate || typeof totalBatches !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Collect all batch results
  const allStocks: ScannerStockResult[] = [];
  for (let i = 0; i < totalBatches; i++) {
    const batchResults = await KVStore.getBatchResults(scanDate, i);
    if (batchResults) {
      allStocks.push(...batchResults);
    }
  }

  const successStocks = allStocks.filter(s => !s.error);
  const errorStocks = allStocks.filter(s => !!s.error);

  // Compute aggregates
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
    startedAt: (await KVStore.getScanStatus(scanDate))?.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    totalStocks: allStocks.length,
    successCount: successStocks.length,
    errorCount: errorStocks.length,
    watchlist: watchlist || 'sp500',
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
    status.completedBatches = totalBatches;
    status.stocksProcessed = allStocks.length;
    status.lastUpdatedAt = new Date().toISOString();
    await KVStore.setScanStatus(status);
  }

  return NextResponse.json({
    message: 'Scan finalized',
    totalStocks: allStocks.length,
    successCount: successStocks.length,
    errorCount: errorStocks.length,
    topByScore: topByScore.slice(0, 5),
  });
}
