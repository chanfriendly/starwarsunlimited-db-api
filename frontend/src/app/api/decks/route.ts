import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';

// Type for the deck payload
interface DeckCreateRequest {
  name: string;
  leaders: string[];     // Array of card IDs
  base: string | null;   // Card ID
  cards: Array<{         // Array of card IDs with quantities
    card_id: string;
    quantity: number;
  }>;
}

// Helper function to get the database connection
async function getDatabase() {
  // Use the database in the user's home directory
  const homeDir = os.homedir();
  const dbPath = path.join(homeDir, '.swu', 'swu_cards.db');
  
  // Open the database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Create decks table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS deck_leaders (
      deck_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (deck_id, card_id),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS deck_bases (
      deck_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      PRIMARY KEY (deck_id),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS deck_cards (
      deck_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (deck_id, card_id),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );
  `);
  
  return db;
}

// Helper function to get card details from the database
async function getCardById(db, cardId) {
  const card = await db.get('SELECT * FROM cards WHERE id = ?', cardId);
  
  if (!card) {
    return null;
  }
  
  // Get card aspects
  const aspects = await db.all(
    'SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = ?', 
    cardId
  );
  
  // Get card keywords
  const keywords = await db.all(
    'SELECT keyword FROM card_keywords WHERE card_id = ?', 
    cardId
  );
  
  // Return complete card with relationships
  return {
    ...card,
    aspects,
    keywords: keywords.map(row => row.keyword)
  };
}

// Helper function to get a complete deck with card details
async function getCompleteDeck(db, deckId) {
  // Get the deck
  const deck = await db.get('SELECT * FROM decks WHERE id = ?', deckId);
  
  if (!deck) {
    return null;
  }
  
  // Get leaders
  const leaderRows = await db.all(
    'SELECT * FROM deck_leaders WHERE deck_id = ? ORDER BY position', 
    deckId
  );
  
  // Get base
  const baseRow = await db.get(
    'SELECT * FROM deck_bases WHERE deck_id = ?', 
    deckId
  );
  
  // Get cards
  const cardRows = await db.all(
    'SELECT * FROM deck_cards WHERE deck_id = ?', 
    deckId
  );
  
  // Get full details for each card
  const leaders = await Promise.all(
    leaderRows.map(async row => await getCardById(db, row.card_id))
  );
  
  const base = baseRow ? await getCardById(db, baseRow.card_id) : null;
  
  const cards = await Promise.all(
    cardRows.map(async row => ({
      card: await getCardById(db, row.card_id),
      quantity: row.quantity
    }))
  );
  
  // Return the complete deck
  return {
    ...deck,
    leaders,
    base,
    cards
  };
}

// GET /api/decks
export async function GET() {
  const db = await getDatabase();
  
  try {
    // Get all decks (in a real app, we would filter by user_id)
    const decks = await db.all('SELECT * FROM decks ORDER BY updated_at DESC');
    
    // Get complete details for each deck
    const completeDecks = await Promise.all(
      decks.map(async deck => await getCompleteDeck(db, deck.id))
    );
    
    return NextResponse.json(completeDecks);
  } catch (error) {
    console.error('Error fetching decks:', error);
    return NextResponse.json({ error: 'Failed to fetch decks' }, { status: 500 });
  } finally {
    await db.close();
  }
}

// POST /api/decks
export async function POST(request: Request) {
  const db = await getDatabase();
  
  try {
    const body: DeckCreateRequest = await request.json();
    
    // Validate request
    if (!body.name || !body.leaders || body.leaders.length !== 2 || !body.base || !body.cards || body.cards.length === 0) {
      return NextResponse.json(
        { error: 'Invalid deck data' }, 
        { status: 400 }
      );
    }
    
    // Generate a unique ID for the deck
    const deckId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toISOString();
    const userId = '1'; // In a real app, this would come from authentication
    
    // Create the deck
    await db.run(
      'INSERT INTO decks (id, name, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [deckId, body.name, userId, timestamp, timestamp]
    );
    
    // Add leaders
    for (let i = 0; i < body.leaders.length; i++) {
      await db.run(
        'INSERT INTO deck_leaders (deck_id, card_id, position) VALUES (?, ?, ?)',
        [deckId, body.leaders[i], i]
      );
    }
    
    // Add base
    await db.run(
      'INSERT INTO deck_bases (deck_id, card_id) VALUES (?, ?)',
      [deckId, body.base]
    );
    
    // Add cards
    for (const cardData of body.cards) {
      await db.run(
        'INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, ?)',
        [deckId, cardData.card_id, cardData.quantity]
      );
    }
    
    // Get the complete deck
    const completeDeck = await getCompleteDeck(db, deckId);
    
    return NextResponse.json(completeDeck);
  } catch (error) {
    console.error('Error creating deck:', error);
    return NextResponse.json({ error: 'Failed to create deck' }, { status: 500 });
  } finally {
    await db.close();
  }
}