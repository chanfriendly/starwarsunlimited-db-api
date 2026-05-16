import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();

    const formData = new URLSearchParams();
    formData.append('username', userData.username);
    formData.append('password', userData.password);

    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: responseData.detail || 'Login failed' },
        { status: response.status }
      );
    }

    const nextResponse = NextResponse.json({ success: true, message: 'Login successful' });
    nextResponse.cookies.set({
      name: 'auth_token',
      value: responseData.access_token,
      httpOnly: true,
      secure: false,        // flip to true once HTTPS is in place
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours — matches ACCESS_TOKEN_EXPIRE_MINUTES default
      path: '/',
    });
    return nextResponse;
  } catch (error) {
    console.error('Error in login route:', error);
    return NextResponse.json({ detail: 'Server error during login' }, { status: 500 });
  }
}
