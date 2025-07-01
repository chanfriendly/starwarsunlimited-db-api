// frontend/src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';

// The backend API URL - use container networking for server-side requests
const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get registration data from request
    const userData = await request.json();
    
    // Forward the request to the backend
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    // Get response data
    const responseData = await response.json();
    
    // Check for errors
    if (!response.ok) {
      return NextResponse.json(
        { detail: responseData.detail || 'Registration failed' },
        { status: response.status }
      );
    }
    
    // Return success response
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in register API route:', error);
    
    return NextResponse.json(
      { detail: 'Server error during registration' },
      { status: 500 }
    );
  }
}