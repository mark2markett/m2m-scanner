import { NextResponse } from 'next/server';
import { KVStore } from '@/lib/server/kvStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await KVStore.getLatestScanStatus();

  if (!status) {
    return NextResponse.json(
      { error: 'No scan status available.' },
      { status: 404 }
    );
  }

  return NextResponse.json(status);
}
