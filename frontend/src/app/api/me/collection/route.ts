import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/me/collection called');
    // Get the token from cookies - await it properly
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    // Check if token exists
    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the all_cards parameter if it exists
    const { searchParams } = new URL(request.url);
    const allCards = searchParams.get('all_cards') === 'true';
    
    // Forward the request to the backend with the token
    const url = `${API_URL}/api/me/collection${allCards ? '?all_cards=true' : ''}`;
    console.log('Forwarding to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });
    
    // Return the appropriate response
    if (!response.ok) {
      return NextResponse.json(
        { detail: 'Error fetching collection' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/me/collection:', error);
    return NextResponse.json(
      { detail: 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/me/collection called');
    // Get the token from cookies - await it here too
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    // Debug logging
    console.log('Cookie token available:', !!token);
    
    // Check if token exists
    if (!token || !token.value) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the request body
    const body = await request.json();
    console.log('Request body:', body);
    
    // Forward the request to the backend with the token
    console.log('Forwarding to backend:', `${API_URL}/api/me/collection`);
    const response = await fetch(`${API_URL}/api/me/collection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    // Log response for debugging
    console.log('Backend response status:', response.status);
    
    // If response is not ok, log the error details
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from backend:', errorText);
      return NextResponse.json(
        { detail: 'Error updating collection', error: errorText },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/me/collection:', error);
    return NextResponse.json(
      { detail: 'Server error' },
      { status: 500 }
    );
  }
}