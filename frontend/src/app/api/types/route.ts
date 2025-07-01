import { NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

// GET /api/types
export async function GET() {
  const response = await fetch(`${API_URL}/api/types`);
  const data = await response.json();
  return NextResponse.json(data);
}