import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { loadWatchlist } from '@/lib/data/watchlistLoader';

const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
let lastTriggerTime = 0;

const SLICE_SIZE = 120;

function computeSlices(totalStocks: number): [number, number][] {
  const slices: [number, number][] = [];
  for (let start = 0; start < totalStocks; start += SLICE_SIZE) {
    slices.push([start, Math.min(start + SLICE_SIZE, totalStocks)]);
  }
  return slices;
}

export async function POST(request: NextRequest) {
  // Validate password
  let body: { password?: string; watchlist?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const rawAdminPassword = process.env.ADMIN_PASSWORD;
  console.log(`[manual-trigger] ADMIN_PASSWORD env var defined: ${rawAdminPassword !== undefined}, length: ${rawAdminPassword?.length ?? 0}`);

  if (!rawAdminPassword) {
    return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 });
  }

  const adminPassword = rawAdminPassword.trim();
  const submittedPassword = (body.password || '').trim();

  console.log(`[manual-trigger] Password comparison — submitted length: ${submittedPassword.length}, expected length: ${adminPassword.length}, match: ${submittedPassword === adminPassword}`);

  if (!submittedPassword || submittedPassword !== adminPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // Rate limit
  const now = Date.now();
  if (now - lastTriggerTime < RATE_LIMIT_MS) {
    const remaining = Math.ceil((RATE_LIMIT_MS - (now - lastTriggerTime)) / 1000);
    return NextResponse.json(
      { error: `Rate limited. Try again in ${remaining} seconds.` },
      { status: 429 }
    );
  }
  lastTriggerTime = now;

  // Build base URL from the incoming request
  const origin = request.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET;
  const watchlistId = body.watchlist || 'sp500';
  const watchlistStocks = loadWatchlist(watchlistId);
  const slices = computeSlices(watchlistStocks.length);

  // Fire off the scan in the background
  waitUntil(
    (async () => {
      try {
        // Trigger all slices concurrently
        await Promise.all(
          slices.map(([start, end]) =>
            fetch(`${origin}/api/scanner/trigger?start=${start}&end=${end}&watchlist=${watchlistId}&secret=${cronSecret}`)
          )
        );

        // Merge results
        await fetch(`${origin}/api/scanner/merge?watchlist=${watchlistId}&secret=${cronSecret}`);
      } catch (err) {
        console.error('Manual scan failed:', err);
      }
    })()
  );

  return NextResponse.json({ success: true, message: 'Scan started', watchlist: watchlistId, totalStocks: watchlistStocks.length });
}
