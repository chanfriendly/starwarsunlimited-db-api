import { NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

// GET /api/health — proxies to the backend /health so an external uptime
// check (which can only reach the public Next.js frontend) gets a real
// end-to-end signal: Next.js is up AND the FastAPI backend is reachable.
export async function GET() {
  try {
    const response = await fetch(`${API_URL}/health`, {
      // never serve a cached health result
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json(
        { status: 'unhealthy', backend: response.status },
        { status: 503 },
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', backend: 'unreachable' },
      { status: 503 },
    );
  }
}
