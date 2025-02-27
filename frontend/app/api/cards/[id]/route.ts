import { NextRequest, NextResponse } from 'next/server';

// Mock data for development - should match the cards in the cards/route.ts file
const mockCards = [
  {
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
  },
  {
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
  },
  {
    id: "3",
    name: "Death Star",
    type: "Base",
    aspect: "Command",
    cost: 7,
    health: 10,
    image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-018.webp",
    text: "Action: Deal 3 damage to all enemy units.",
    aspects: [{ aspect_name: "Command", count: 1 }]
  },
  {
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
  },
  {
    id: "5",
    name: "Force Push",
    type: "Event",
    aspect: "Force",
    cost: 2,
    image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-030.webp",
    text: "Deal 2 damage to target unit and move it to another arena.",
    aspects: [{ aspect_name: "Force", count: 1 }]
  },
  {
    id: "6",
    name: "Stormtrooper Squad",
    type: "Unit",
    aspect: "Command",
    cost: 3,
    power: 2,
    health: 2,
    image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-035.webp",
    text: "Deploy: Deal 1 damage to target unit.",
    aspects: [{ aspect_name: "Command", count: 1 }]
  },
  {
    id: "7",
    name: "Rebel Trooper",
    type: "Unit",
    aspect: "Heroism",
    cost: 2,
    power: 1,
    health: 3,
    image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-040.webp",
    text: "Deploy: Draw a card if you control a Leader.",
    aspects: [{ aspect_name: "Heroism", count: 1 }]
  },
  {
    id: "8",
    name: "Emperor Palpatine",
    type: "Leader",
    aspect: "Villainy",
    cost: 6,
    power: 3,
    health: 5,
    image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-045.webp",
    text: "Deploy: Deal 2 damage to each enemy unit.",
    aspects: [{ aspect_name: "Villainy", count: 1 }, { aspect_name: "Force", count: 1 }]
  }
];

// GET /api/cards/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const card = mockCards.find(card => card.id === id);
  
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }
  
  return NextResponse.json(card);
}