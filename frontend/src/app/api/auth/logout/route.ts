import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    // Tell the backend to revoke tokens (bumps token_version)
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {/* fire-and-forget — clear cookie regardless */});
    }

    cookieStore.delete('auth_token');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in logout route:', error);
    return NextResponse.json({ detail: 'Error during logout' }, { status: 500 });
  }
}
