import { NextResponse } from 'next/server';

// Mock data for development
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

// GET /api/decks
export async function GET() {
  // In a real app, we would verify the user and fetch their decks
  return NextResponse.json(mockDecks);
}

// POST /api/decks
export async function POST(request: Request) {
  const body = await request.json();
  
  // Create a new deck
  const newDeck = {
    id: Math.random().toString(36).substring(2, 9),
    name: body.name,
    description: body.description || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: "1", // Mock user ID
    cards: body.cards.map((card: any, index: number) => ({
      id: (index + 1).toString(),
      deck_id: Math.random().toString(36).substring(2, 9),
      card_id: card.card_id,
      quantity: card.quantity,
      is_leader: card.is_leader || false,
      is_base: card.is_base || false,
      // In a real app, we would fetch card details from the database
      card: {
        id: card.card_id,
        name: "Card " + card.card_id,
        // Other card details would be filled here
      }
    }))
  };
  
  // In a real app, we would save this to the database
  
  return NextResponse.json(newDeck);
}