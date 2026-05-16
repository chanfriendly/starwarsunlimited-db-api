// frontend/src/app/api/cards/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

// GET /api/cards - Proxy to backend with all query parameters
export async function GET(request: NextRequest) {
  try {
    // Get all search parameters from the frontend request
    const searchParams = request.nextUrl.searchParams;
    
    // Build the backend URL with the same parameters
    const backendUrl = new URL(`${API_URL}/api/cards/`);
    
    // Copy all query parameters to the backend request
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    
    // Make the request to the backend
    const response = await fetch(backendUrl.toString());
    
    if (!response.ok) {
      console.error('Backend cards request failed:', response.status, response.statusText);
      throw new Error(`Backend request failed: ${response.status}`);
    }
    
    const data = await response.json();

    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in cards API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    );
  }
}