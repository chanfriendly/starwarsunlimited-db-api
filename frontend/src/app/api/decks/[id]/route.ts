import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';

// Type for the deck update payload
interface DeckUpdateRequest {
  name?: string;
  leaders?: string[];
  base?: string | null;
  cards?: Array<{
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

// GET /api/decks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = await getDatabase();
  
  try {
    const id = params.id;
    
    // Get the complete deck
    const deck = await getCompleteDeck(db, id);
    
    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }
    
    return NextResponse.json(deck);
  } catch (error) {
    console.error('Error getting deck:', error);
    return NextResponse.json({ error: 'Failed to get deck' }, { status: 500 });
  } finally {
    await db.close();
  }
}

// PUT /api/decks/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = await getDatabase();
  
  try {
    const id = params.id;
    const body: DeckUpdateRequest = await request.json();
    
    // Check if the deck exists
    const existingDeck = await db.get('SELECT * FROM decks WHERE id = ?', id);
    
    if (!existingDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }
    
    // Begin transaction
    await db.exec('BEGIN TRANSACTION');
    
    // Update deck name if provided
    if (body.name) {
      await db.run(
        'UPDATE decks SET name = ?, updated_at = ? WHERE id = ?',
        [body.name, new Date().toISOString(), id]
      );
    } else {
      // Just update the timestamp
      await db.run(
        'UPDATE decks SET updated_at = ? WHERE id = ?',
        [new Date().toISOString(), id]
      );
    }
    
    // Update leaders if provided
    if (body.leaders && body.leaders.length === 2) {
      // Delete existing leaders
      await db.run('DELETE FROM deck_leaders WHERE deck_id = ?', id);
      
      // Add new leaders
      for (let i = 0; i < body.leaders.length; i++) {
        await db.run(
          'INSERT INTO deck_leaders (deck_id, card_id, position) VALUES (?, ?, ?)',
          [id, body.leaders[i], i]
        );
      }
    }
    
    // Update base if provided
    if (body.base !== undefined) {
      // Delete existing base
      await db.run('DELETE FROM deck_bases WHERE deck_id = ?', id);
      
      // Add new base if not null
      if (body.base) {
        await db.run(
          'INSERT INTO deck_bases (deck_id, card_id) VALUES (?, ?)',
          [id, body.base]
        );
      }
    }
    
    // Update cards if provided
    if (body.cards) {
      // Delete existing cards
      await db.run('DELETE FROM deck_cards WHERE deck_id = ?', id);
      
      // Add new cards
      for (const cardData of body.cards) {
        await db.run(
          'INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?, ?, ?)',
          [id, cardData.card_id, cardData.quantity]
        );
      }
    }
    
    // Commit transaction
    await db.exec('COMMIT');
    
    // Get the updated deck
    const updatedDeck = await getCompleteDeck(db, id);
    
    return NextResponse.json(updatedDeck);
  } catch (error) {
    // Rollback transaction on error
    await db.exec('ROLLBACK');
    console.error('Error updating deck:', error);
    return NextResponse.json({ error: 'Failed to update deck' }, { status: 500 });
  } finally {
    await db.close();
  }
}

// DELETE /api/decks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = await getDatabase();
  
  try {
    const id = params.id;
    
    // Check if the deck exists
    const existingDeck = await db.get('SELECT * FROM decks WHERE id = ?', id);
    
    if (!existingDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }
    
    // Delete the deck
    await db.run('DELETE FROM decks WHERE id = ?', id);
    
    // Return success
    return NextResponse.json({ success: true, message: 'Deck deleted successfully' });
  } catch (error) {
    console.error('Error deleting deck:', error);
    return NextResponse.json({ error: 'Failed to delete deck' }, { status: 500 });
  } finally {
    await db.close();
  }
}