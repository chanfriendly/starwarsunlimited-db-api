// frontend/src/app/api/collection/route.ts
import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';
import { 
  Database, 
  Card, 
  CollectionItemRow, 
  CountResponse, 
  AspectResults,
  KeywordResults,
  CardResults,
  CollectionItemResults
} from '@/lib/database';

// Helper function to get the database connection
async function getDatabase(): Promise<Database> {
  // Use the database in the user's home directory
  const homeDir = os.homedir();
  const dbPath = path.join(homeDir, '.swu', 'swu_cards.db');
  
  // Open the database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Create user_collection table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_collection (
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (user_id, card_id)
    );
  `);
  
  return db;
}

// Helper function to get card details from the database
async function getCardById(db: Database, cardId: string): Promise<Card | null> {
  const card = await db.get<Card>('SELECT * FROM cards WHERE id = ?', cardId);
  
  if (!card) {
    return null;
  }
  
  // Get card aspects
  const aspects = await db.all<AspectResults>(
    'SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = ?', 
    cardId
  );
  
  // Get card keywords
  const keywords = await db.all<KeywordResults>(
    'SELECT keyword FROM card_keywords WHERE card_id = ?', 
    cardId
  );
  
  // Return complete card with relationships
  return {
    ...card,
    aspects: aspects,
    keywords: keywords.map(item => item.keyword)
  };
}

// For simplicity, we'll seed some collection data if none exists
async function seedCollectionIfEmpty(db: Database, userId: string): Promise<void> {
  // Check if the user has any cards in their collection
  const count = await db.get<CountResponse>(
    'SELECT COUNT(*) as count FROM user_collection WHERE user_id = ?',
    userId
  );
  
  if (count?.count === 0) {
    // Get some card IDs to add to the collection
    const cards = await db.all<CardResults>(
      'SELECT id FROM cards LIMIT 10'
    );
    
    // Add each card to the collection with a random quantity
    for (const card of cards) {
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 cards
      await db.run(
        'INSERT INTO user_collection (user_id, card_id, count) VALUES (?, ?, ?)',
        [userId, card.id, quantity]
      );
    }
  }
}

// GET /api/collection
export async function GET() {
  const db = await getDatabase();
  
  try {
    const userId = '1'; // In a real app, this would come from authentication
    
    // Seed some collection data if none exists
    await seedCollectionIfEmpty(db, userId);
    
    // Get the user's collection
    const collectionRows = await db.all<CollectionItemResults>(
      'SELECT card_id, count FROM user_collection WHERE user_id = ?',
      userId
    );
    
    // Get full details for each card
    const collection = await Promise.all(
      collectionRows.map(async (row) => ({
        card: await getCardById(db, row.card_id),
        count: row.count
      }))
    );
    
    return NextResponse.json(collection);
  } catch (error) {
    console.error('Error fetching collection:', error);
    return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 });
  } finally {
    await db.close();
  }
}

// POST /api/collection
export async function POST(request: Request) {
  const db = await getDatabase();
  
  try {
    const { card_id, count } = await request.json();
    const userId = '1'; // In a real app, this would come from authentication
    
    // Validate request
    if (!card_id || typeof count !== 'number' || count < 0) {
      return NextResponse.json(
        { error: 'Invalid collection item data' }, 
        { status: 400 }
      );
    }
    
    // Check if the card exists in the database
    const existingCard = await getCardById(db, card_id);
    if (!existingCard) {
      return NextResponse.json(
        { error: 'Card not found' }, 
        { status: 404 }
      );
    }
    
    // Check if the card exists in the collection
    const existingItem = await db.get<CollectionItemRow>(
      'SELECT * FROM user_collection WHERE user_id = ? AND card_id = ?',
      [userId, card_id]
    );
    
    if (existingItem) {
      // Update existing item
      if (count === 0) {
        // Delete if count is 0
        await db.run(
          'DELETE FROM user_collection WHERE user_id = ? AND card_id = ?',
          [userId, card_id]
        );
      } else {
        // Update count
        await db.run(
          'UPDATE user_collection SET count = ? WHERE user_id = ? AND card_id = ?',
          [count, userId, card_id]
        );
      }
    } else if (count > 0) {
      // Insert new item
      await db.run(
        'INSERT INTO user_collection (user_id, card_id, count) VALUES (?, ?, ?)',
        [userId, card_id, count]
      );
    }
    
    // Get the updated card with details
    if (count > 0) {
      const card = await getCardById(db, card_id);
      return NextResponse.json({ card, count });
    } else {
      return NextResponse.json({ success: true, message: 'Card removed from collection' });
    }
  } catch (error) {
    console.error('Error updating collection:', error);
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
  } finally {
    await db.close();
  }
}