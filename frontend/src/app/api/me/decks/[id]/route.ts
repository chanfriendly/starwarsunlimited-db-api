import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token?.value) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    const res = await fetch(`${API_URL}/api/me/decks/${params.id}`, {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    if (!res.ok) {
      return NextResponse.json({ detail: 'Error fetching deck' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ detail: `Server error: ${error?.message}` }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
