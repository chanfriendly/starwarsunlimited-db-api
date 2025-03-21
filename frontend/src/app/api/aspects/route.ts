import { NextResponse } from 'next/server';

// GET /api/aspects
export async function GET() {
  return NextResponse.json([
    "Command",
    "Heroism",
    "Villainy",
    "Force",
    "Aggression",
    "Cunning"
  ]);
}