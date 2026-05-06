import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token');
}

export async function GET() {
  try {
    const token = await getToken();
    if (!token?.value) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    const response = await fetch(`${API_URL}/api/me/wishlist`, {
      headers: { 'Authorization': `Bearer ${token.value}` },
    });
    if (!response.ok) {
      return NextResponse.json({ detail: 'Error fetching wishlist' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error in GET /api/me/wishlist:', error);
    return NextResponse.json({ detail: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken();
    if (!token?.value) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/me/wishlist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return NextResponse.json({ detail: 'Error updating wishlist' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error in POST /api/me/wishlist:', error);
    return NextResponse.json({ detail: 'Server error' }, { status: 500 });
  }
}
