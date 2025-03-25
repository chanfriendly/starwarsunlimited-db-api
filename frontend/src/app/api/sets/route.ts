// frontend/src/app/api/sets/route.ts
import { NextResponse } from 'next/server';

// GET /api/sets
export async function GET() {
  return NextResponse.json([
    "D20", // Shadows of the Galaxy
    "D21", // Twilight of the Republic
    "D22", // Unlimited Power
    "D23", // Rise of the Sith
    "D24"  // Rebellion Era
  ]);
}