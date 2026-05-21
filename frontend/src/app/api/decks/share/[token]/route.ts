import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const res = await fetch(`${API_URL}/api/decks/share/${token}`);
    if (!res.ok) {
      return NextResponse.json({ detail: 'Deck not found' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ detail: `Server error: ${error?.message}` }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
