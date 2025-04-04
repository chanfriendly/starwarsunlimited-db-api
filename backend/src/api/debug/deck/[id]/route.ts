// In a new file: /api/debug/deck/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json({
      message: "Debug endpoint received request",
      id: params.id,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}