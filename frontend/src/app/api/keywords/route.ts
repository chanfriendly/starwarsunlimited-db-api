// frontend/src/app/api/keywords/route.ts
import { NextResponse } from 'next/server';

// GET /api/keywords
export async function GET() {
  return NextResponse.json([
    "Ambush",
    "Grit",
    "Epic",
    "Flying",
    "Sentinel",
    "Valiant",
    "Villainous",
    "Shielded"
  ]);
}