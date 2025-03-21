import { NextResponse } from 'next/server';

// GET /api/types
export async function GET() {
  return NextResponse.json([
    "Leader",
    "Base",
    "Unit",
    "Event",
    "Plot",
    "Upgrade"
  ]);
}