import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { loadWatchlist } from '@/lib/data/watchlistLoader';
import { ScannerEngine } from '@/lib/server/scannerEngine';
import { KVStore } from '@/lib/server/kvStore';

const BATCH_SIZE = 10;

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { scanDate, batchIndex, totalBatches, watchlist } = await request.json();

  if (!scanDate || typeof batchIndex !== 'number' || typeof totalBatches !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const watchlistStocks = loadWatchlist(watchlist || 'sp500');
  const start = batchIndex * BATCH_SIZE;
  const batchStocks = watchlistStocks.slice(start, start + BATCH_SIZE);

  if (batchStocks.length === 0) {
    return NextResponse.json({ error: 'Empty batch' }, { status: 400 });
  }

  // Process this batch
  const results = await ScannerEngine.analyzeBatch(batchStocks);
  await KVStore.setBatchResults(scanDate, batchIndex, results);

  // Update status
  const status = await KVStore.getScanStatus(scanDate);
  if (status) {
    status.completedBatches = batchIndex + 1;
    status.currentBatch = batchIndex + 1;
    status.stocksProcessed = Math.min((batchIndex + 1) * BATCH_SIZE, watchlistStocks.length);
    status.lastUpdatedAt = new Date().toISOString();
    await KVStore.setScanStatus(status);
  }

  const nextBatch = batchIndex + 1;
  const baseUrl = getBaseUrl(request);

  if (nextBatch < totalBatches) {
    // Chain to next batch
    waitUntil(
      fetch(`${baseUrl}/api/scanner/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ scanDate, batchIndex: nextBatch, totalBatches, watchlist }),
      })
    );
  } else {
    // Last batch — finalize
    waitUntil(
      fetch(`${baseUrl}/api/scanner/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ scanDate, totalBatches, watchlist }),
      })
    );
  }

  return NextResponse.json({
    message: `Batch ${batchIndex} complete`,
    processed: batchStocks.length,
    nextBatch: nextBatch < totalBatches ? nextBatch : 'finalize',
  });
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
