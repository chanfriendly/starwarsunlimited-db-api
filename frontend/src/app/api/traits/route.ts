import { NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

// GET /api/traits
export async function GET() {
  const response = await fetch(`${API_URL}/api/traits`);
  const data = await response.json();
  return NextResponse.json(data);
}
