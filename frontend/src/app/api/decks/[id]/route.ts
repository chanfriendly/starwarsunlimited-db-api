import { NextRequest, NextResponse } from 'next/server';

// Mock data for development - reference the same data as in /api/decks/route.ts
const mockDecks = [
  {
    id: "1",
    name: "Vader's Command",
    description: "A powerful Command deck centered around Vader",
    created_at: "2023-09-15T12:00:00Z",
    updated_at: "2023-09-15T12:00:00Z",
    user_id: "1",
    cards: [
      {
        id: "1",
        deck_id: "1",
        card_id: "1",
        quantity: 1,
        is_leader: true,
        is_base: false,
        card: {
          id: "1",
          name: "Darth Vader",
          type: "Leader",
          aspect: "Command",
          cost: 5,
          power: 4,
          health: 4,
          image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-001.webp",
          text: "Villainous. After you play a card, deal 1 damage to target undefeated unit.",
          aspects: [{ aspect_name: "Command", count: 1 }, { aspect_name: "Villainy", count: 1 }]
        }
      },
      {
        id: "2",
        deck_id: "1",
        card_id: "3",
        quantity: 1,
        is_leader: false,
        is_base: true,
        card: {
          id: "3",
          name: "Death Star",
          type: "Base",
          aspect: "Command",
          cost: 7,
          health: 10,
          image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-018.webp",
          text: "Action: Deal 3 damage to all enemy units.",
          aspects: [{ aspect_name: "Command", count: 1 }]
        }
      },
      {
        id: "3",
        deck_id: "1",
        card_id: "5",
        quantity: 2,
        is_leader: false,
        is_base: false,
        card: {
          id: "5",
          name: "Force Push",
          type: "Event",
          aspect: "Force",
          cost: 2,
          image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-030.webp",
          text: "Deal 2 damage to target unit and move it to another arena.",
          aspects: [{ aspect_name: "Force", count: 1 }]
        }
      }
    ]
  },
  {
    id: "2",
    name: "Luke's Heroism",
    description: "A Heroism deck focused on Luke Skywalker",
    created_at: "2023-09-16T12:00:00Z",
    updated_at: "2023-09-16T12:00:00Z",
    user_id: "1",
    cards: [
      {
        id: "4",
        deck_id: "2",
        card_id: "2",
        quantity: 1,
        is_leader: true,
        is_base: false,
        card: {
          id: "2",
          name: "Luke Skywalker",
          type: "Leader",
          aspect: "Heroism",
          cost: 5,
          power: 3,
          health: 5,
          image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-012.webp",
          text: "Valiant. After an opponent plays a card, heal 1 damage from target undefeated unit.",
          aspects: [{ aspect_name: "Heroism", count: 1 }, { aspect_name: "Force", count: 1 }]
        }
      },
      {
        id: "5",
        deck_id: "2",
        card_id: "4",
        quantity: 1,
        is_leader: false,
        is_base: false,
        card: {
          id: "4",
          name: "Millennium Falcon",
          type: "Unit",
          aspect: "Heroism",
          cost: 4,
          power: 3,
          health: 4,
          image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-023.webp",
          text: "Flying. Action: Move this unit to another arena.",
          aspects: [{ aspect_name: "Heroism", count: 1 }]
        }
      }
    ]
  }
];

// GET /api/decks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const deck = mockDecks.find(deck => deck.id === id);
  
  if (!deck) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
  }
  
  return NextResponse.json(deck);
}

// PUT /api/decks/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body = await request.json();
  
  // Find the deck to update
  const deckIndex = mockDecks.findIndex(deck => deck.id === id);
  
  if (deckIndex === -1) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
  }
  
  // In a real app, we would update the deck in the database
  const updatedDeck = {
    ...mockDecks[deckIndex],
    ...body,
    updated_at: new Date().toISOString()
  };
  
  return NextResponse.json(updatedDeck);
}

// DELETE /api/decks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  // In a real app, we would delete the deck from the database
  const deckIndex = mockDecks.findIndex(deck => deck.id === id);
  
  if (deckIndex === -1) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
  }
  
  // Return a success message
  return NextResponse.json({ success: true, message: 'Deck deleted successfully' });
}