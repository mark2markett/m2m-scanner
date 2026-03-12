import { NextResponse } from 'next/server';
import { getAvailableWatchlists } from '@/lib/data/watchlistLoader';

export const dynamic = 'force-dynamic';

export async function GET() {
  const watchlists = getAvailableWatchlists();
  return NextResponse.json(watchlists);
}
