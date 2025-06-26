// frontend/src/app/api/sets/route.ts
import { NextResponse } from 'next/server';

// GET /api/sets
export async function GET() {
  return NextResponse.json([
    "SOR",
    "SHD", 
    "TWI"
  ]);
}