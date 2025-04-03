import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/me/decks called');
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
    const response = await fetch(`${API_URL}/api/me/decks`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });
    
    // Return the appropriate response
    if (!response.ok) {
      return NextResponse.json(
        { detail: 'Error fetching decks' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/me/decks:', error);
    return NextResponse.json(
      { detail: 'Server error' },
      { status: 500 }
    );
  }
}