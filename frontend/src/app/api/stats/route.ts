// frontend/src/app/api/stats/route.ts

import { NextResponse } from 'next/server';

// Server-side URL: use INTERNAL_API_URL (Docker network) with fallback for native dev
const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/stats`, {
      // Setting a short cache time
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching stats: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in stats API route:', error);
    
    // Return fallback data if the backend request fails
    return NextResponse.json(
      {
        total_cards: 891,
        aspects_count: 6,
        types_count: 12,
        sets_count: 3
      },
      { status: 200 }
    );
  }
}