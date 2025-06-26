import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// GET /api/collection
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token');

    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/me/collection`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from backend:', errorText);
      return NextResponse.json(
        { detail: 'Error fetching collection', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error in GET /api/collection:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// POST /api/collection
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token');

    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/me/collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from backend:', errorText);
      return NextResponse.json(
        { detail: 'Error updating collection', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error in POST /api/collection:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
