import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

// GET /api/decks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/me/decks/${id}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from backend:', errorText);
      return NextResponse.json(
        { detail: 'Error fetching deck', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error in GET /api/decks/[id]:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// PUT /api/decks/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/me/decks/${id}`, {
      method: 'PUT',
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
        { detail: 'Error updating deck', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error in PUT /api/decks/[id]:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// DELETE /api/decks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/me/decks/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from backend:', errorText);
      return NextResponse.json(
        { detail: 'Error deleting deck', error: errorText },
        { status: response.status }
      );
    }

    // No content for successful delete, so return success message
    return NextResponse.json({ success: true, message: 'Deck deleted successfully' });
  } catch (error: any) {
    console.error(`Error in DELETE /api/decks/[id]:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
