// frontend/src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    
    if (!token || !token.value) {

      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });

    
    if (!response.ok) {

      return NextResponse.json(
        { detail: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    const userData = await response.json();

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { detail: 'Authentication verification failed' },
      { status: 500 }
    );
  }
}