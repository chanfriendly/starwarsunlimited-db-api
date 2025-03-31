// frontend/src/app/api/auth/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// The backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get login data
    const formData = await request.formData();
    
    // Forward the request to the backend
    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(formData as any).toString(),
    });
    
    // Get response data
    const responseData = await response.json();
   
    // Check for errors
    if (!response.ok) {
      return NextResponse.json(
        { detail: responseData.detail || 'Login failed' },
        { status: response.status }
      );
    }
    
    // Create a response
    const authResponse = NextResponse.json(responseData);
    
    // Set HTTP-only cookie with the token (for better security)
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth_token',
      value: responseData.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    return authResponse;
  } catch (error) {
    console.error('Error in login API route:', error);
    
    return NextResponse.json(
      { detail: 'Server error during login' },
      { status: 500 }
    );
  }
}