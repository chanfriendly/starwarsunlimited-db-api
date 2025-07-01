import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Get the deck ID from query parameters
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { detail: 'Missing deck ID' },
        { status: 400 }
      );
    }
    
    console.log(`GET /api/me/get-deck?id=${id} called`);
    
    // Get the token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    console.log(`Forwarding to backend: ${API_URL}/api/me/decks/${id}`);
    
    const response = await fetch(`${API_URL}/api/me/decks/${id}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });
    
    console.log('Backend response status:', response.status);
    
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
    console.error(`Error in GET /api/me/get-deck:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}