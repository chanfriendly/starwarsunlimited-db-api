// frontend/src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Clear the auth cookie
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in logout API route:', error);
    return NextResponse.json(
      { detail: 'Error during logout' },
      { status: 500 }
    );
  }
}