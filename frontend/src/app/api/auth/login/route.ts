// frontend/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// The backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get login data
    const userData = await request.json();
    
    // Convert to form data format expected by OAuth2
    const formData = new URLSearchParams();
    formData.append('username', userData.username);
    formData.append('password', userData.password);
    
    // Forward the request to the backend
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    const cookieStore = await cookies();


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
    authResponse.cookies.set({
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