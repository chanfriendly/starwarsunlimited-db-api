import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData as any).toString(),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: responseData.detail || 'Login failed' },
        { status: response.status }
      );
    }

    const authResponse = NextResponse.json({
      success: true,
      access_token: responseData.access_token,
      token_type: responseData.token_type,
    });
    authResponse.cookies.set({
      name: 'auth_token',
      value: responseData.access_token,
      httpOnly: true,
      secure: false,        // flip to true once HTTPS is in place
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    return authResponse;
  } catch (error) {
    console.error('Error in token route:', error);
    return NextResponse.json({ detail: 'Server error during login' }, { status: 500 });
  }
}
