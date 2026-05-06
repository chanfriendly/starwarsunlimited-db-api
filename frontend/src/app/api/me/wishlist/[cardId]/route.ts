import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token?.value) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    const { cardId } = await params;
    const response = await fetch(`${API_URL}/api/me/wishlist/${cardId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` },
    });
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    if (!response.ok) {
      return NextResponse.json({ detail: 'Error removing from wishlist' }, { status: response.status });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/me/wishlist/[cardId]:', error);
    return NextResponse.json({ detail: 'Server error' }, { status: 500 });
  }
}
