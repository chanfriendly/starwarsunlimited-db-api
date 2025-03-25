// frontend/src/app/api/keywords/route.ts
import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';

// GET /api/keywords
export async function GET() {
  try {
    // Try to get keywords from the database first
    const homeDir = os.homedir();
    const dbPath = path.join(homeDir, '.swu', 'swu_cards.db');
    
    try {
      // Open the database
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      
      // Check if the card_keywords table exists
      const tableCheck = await db.get(
        `SELECT name FROM sqlite_master 
         WHERE type='table' AND name='card_keywords'`
      );
      
      if (tableCheck) {
        // Query distinct keywords from the database
        const keywordsResult = await db.all(
          `SELECT DISTINCT keyword FROM card_keywords 
           ORDER BY keyword`
        );
        
        // Extract keywords from result
        const keywords = keywordsResult.map(row => row.keyword);
        
        // Close database connection
        await db.close();
        
        // If we found keywords, return them
        if (keywords.length > 0) {
          return NextResponse.json(keywords);
        }
      } else {
        // Close database connection since table doesn't exist
        await db.close();
      }
    } catch (dbError) {
      console.warn('Error accessing database for keywords:', dbError);
      // Continue to fallback
    }
    
    // Fallback to hardcoded list of common keywords
    return NextResponse.json([
      "Ambush",
      "Grit",
      "Epic",
      "Flying",
      "Sentinel",
      "Valiant",
      "Villainous",
      "Shielded",
      "Deploy",
      "Resourceful",
      "Relentless"
    ]);
  } catch (error) {
    console.error('Error in keywords API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}