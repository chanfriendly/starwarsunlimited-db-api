// frontend/src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/auth/me called');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    console.log('Auth token in cookie:', token ? 'exists' : 'not found');
    
    if (!token || !token.value) {
      console.log('No token found');
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
    
    console.log('Backend /me response status:', response.status);
    
    if (!response.ok) {
      console.log('Backend authentication failed');
      return NextResponse.json(
        { detail: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    const userData = await response.json();
    console.log('User data retrieved:', userData);
    return NextResponse.json(userData);
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { detail: 'Authentication verification failed' },
      { status: 500 }
    );
  }
}