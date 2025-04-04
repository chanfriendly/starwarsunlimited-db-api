import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Revised signature to match Next.js docs exactly
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get ID directly without destructuring
    const id = params.id;
    
    console.log(`GET /api/me/decks/${id} called`);
    
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
    
    try {
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
    } catch (fetchError: any) {
      console.error('Fetch error in API route:', fetchError);
      
      return NextResponse.json(
        { detail: `Connection error: ${fetchError?.message || 'Network issue'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error(`Error in GET /api/me/decks/[id]:`, error);
    return NextResponse.json(
      { detail: `Server error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}