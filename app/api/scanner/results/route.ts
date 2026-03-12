import { NextResponse } from 'next/server';
import { KVStore } from '@/lib/server/kvStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await KVStore.getLatestResult();

  if (!result) {
    return NextResponse.json(
      { error: 'No scan results available. A scan may not have been run yet.' },
      { status: 404 }
    );
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
