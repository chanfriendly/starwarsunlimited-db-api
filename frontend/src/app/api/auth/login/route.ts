// frontend/src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// The backend API URL - use container networking for server-side requests
const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get login data
    const userData = await request.json();
    console.log('Login attempt for:', userData.username);
    
    // Convert to form data format expected by OAuth2
    const formData = new URLSearchParams();
    formData.append('username', userData.username);
    formData.append('password', userData.password);
    
    console.log('Sending login request to backend:', `${API_URL}/api/auth/token`);
    
    // Forward the request to the backend
    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    // Log response status
    console.log('Backend login response status:', response.status);
    
    // Get response data
    const responseData = await response.json();
    console.log('Token received:', responseData.access_token ? 'Yes (length: ' + responseData.access_token.length + ')' : 'No');
    
    // Check for errors
    if (!response.ok) {
      console.error('Login failed:', responseData);
      return NextResponse.json(
        { detail: responseData.detail || 'Login failed' },
        { status: response.status }
      );
    }
    
    // Create a response
    const nextResponse = NextResponse.json({
      success: true,
      message: 'Login successful'
    });
    
    // Set HTTP-only cookie with the token
    console.log('Setting auth_token cookie with path: /');
    nextResponse.cookies.set({
      name: 'auth_token',
      value: responseData.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    console.log('Response cookies set, returning response');
    return nextResponse;
  } catch (error) {
    console.error('Error in login API route:', error);
    
    return NextResponse.json(
      { detail: 'Server error during login' },
      { status: 500 }
    );
  }
}