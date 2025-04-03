import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`GET /api/me/decks/${params.id} called`);
    // Get the token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    // Check if token exists
    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Forward the request to the backend with the token
    console.log(`Forwarding to backend: ${API_URL}/api/me/decks/${params.id}`);
    const response = await fetch(`${API_URL}/api/me/decks/${params.id}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });
    
    // Log response for debugging
    console.log('Backend response status:', response.status);
    
    // Return the appropriate response
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
  } catch (error) {
    console.error(`Error in GET /api/me/decks/${params.id}:`, error);
    return NextResponse.json(
      { detail: 'Server error' },
      { status: 500 }
    );
  }
}