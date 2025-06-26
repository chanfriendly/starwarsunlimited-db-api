// frontend/src/app/api/keywords/route.ts
import { NextResponse } from 'next/server';

// GET /api/keywords
export async function GET() {
  return NextResponse.json([
    "Ambush",
    "Bounty",
    "Coordinate",
    "Grit",
    "Overwhelm",
    "Raid",
    "Restore",
    "Saboteur",
    "Sentinel",
    "Shielded",
    "When Defeated",
    "When Played"
  ]);
}