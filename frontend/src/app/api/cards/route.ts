// frontend/src/app/api/cards/route.ts

import { NextResponse } from 'next/server';

// Define the type for card aspects
interface CardAspect {
  aspect_name: string;
  count: number;
  aspect_color?: string;
}

// Define the type for a card
interface Card {
  id: string;
  name: string;
  type: string;
  aspect?: string;
  cost?: number;
  energy_cost?: number;
  power?: number;
  health?: number;
  image_url?: string;
  image_uri?: string;
  text?: string;
  aspects?: CardAspect[];
  keywords?: string[];
  set_code?: string;
  set_name?: string;
}

// Enhanced mock data to include all needed properties
const mockCards: Card[] = [
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
    aspects: [{ aspect_name: "Command", count: 1 }, { aspect_name: "Villainy", count: 1 }],
    keywords: ["Villainous"],
    set_code: "D20"
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
    aspects: [{ aspect_name: "Heroism", count: 1 }, { aspect_name: "Force", count: 1 }],
    keywords: ["Valiant"],
    set_code: "D20"
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
    aspects: [{ aspect_name: "Command", count: 1 }],
    keywords: [],
    set_code: "D20"
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
    aspects: [{ aspect_name: "Heroism", count: 1 }],
    keywords: ["Flying"],
    set_code: "D20"
  },
  {
    id: "5",
    name: "Force Push",
    type: "Event",
    aspect: "Force",
    cost: 2,
    image_url: "https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-030.webp",
    text: "Deal 2 damage to target unit and move it to another arena.",
    aspects: [{ aspect_name: "Force", count: 1 }],
    keywords: [],
    set_code: "D20"
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
    aspects: [{ aspect_name: "Command", count: 1 }],
    keywords: ["Deploy"],
    set_code: "D20"
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
    aspects: [{ aspect_name: "Heroism", count: 1 }],
    keywords: ["Deploy"],
    set_code: "D20"
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
    aspects: [{ aspect_name: "Villainy", count: 1 }, { aspect_name: "Force", count: 1 }],
    keywords: ["Deploy"],
    set_code: "D20"
  }
];

// GET /api/cards
export async function GET(request: Request) {
  // Get query parameters
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search');
  
  // Handle multiple types (comma-separated)
  const typeParam = searchParams.get('type');
  const types = typeParam ? typeParam.split(',') : [];
  
  // Handle multiple aspects (comma-separated)
  const aspectParam = searchParams.get('aspect');
  const aspects = aspectParam ? aspectParam.split(',') : [];
  
  // Handle cost range
  const costMin = parseInt(searchParams.get('costMin') || '0');
  const costMax = parseInt(searchParams.get('costMax') || '10');
  
  // Handle keywords (comma-separated)
  const keywordParam = searchParams.get('keyword');
  const keywords = keywordParam ? keywordParam.split(',') : [];
  
  // Handle sets (comma-separated)
  const setParam = searchParams.get('set');
  const sets = setParam ? setParam.split(',') : [];
  
  // Filter cards
  let filteredCards = [...mockCards];
  
  // Apply search filter
  if (search) {
    filteredCards = filteredCards.filter(card => 
      card.name.toLowerCase().includes(search.toLowerCase()) ||
      (card.text && card.text.toLowerCase().includes(search.toLowerCase()))
    );
  }
  
  // Apply type filter (now supporting multiple types)
  if (types.length > 0) {
    filteredCards = filteredCards.filter(card => 
      types.map(t => t.toLowerCase()).includes(card.type.toLowerCase())
    );
  }
  
  // Apply aspect filter (now supporting multiple aspects)
  if (aspects.length > 0) {
    filteredCards = filteredCards.filter(card => 
      card.aspects?.some((a) => 
        aspects.map(asp => asp.toLowerCase()).includes(a.aspect_name.toLowerCase())
      )
    );
  }
  
  // Apply cost filter - now safely handling the properties
  filteredCards = filteredCards.filter(card => {
    // Use the cost property (which all mockCards have) and fallback for energy_cost
    const cardCost = card.energy_cost !== undefined ? card.energy_cost : 
                   (card.cost !== undefined ? card.cost : 0);
    return cardCost >= costMin && (costMax === 10 ? true : cardCost <= costMax);
  });
  
  // Apply keyword filter
  if (keywords.length > 0) {
    filteredCards = filteredCards.filter(card => 
      card.keywords?.some((k) => 
        keywords.map(kw => kw.toLowerCase()).includes(k.toLowerCase())
      )
    );
  }
  
  // Apply set filter
  if (sets.length > 0) {
    filteredCards = filteredCards.filter(card => {
      // Support both set_code and set_name
      const cardSet = card.set_code || card.set_name || '';
      return sets.some(set => cardSet.toLowerCase().includes(set.toLowerCase()));
    });
  }
  
  // Paginate
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedCards = filteredCards.slice(startIndex, endIndex);
  
  // Return response with proper metadata
  return NextResponse.json({
    data: paginatedCards,
    meta: {
      total: filteredCards.length,
      page,
      limit,
      pages: Math.ceil(filteredCards.length / limit)
    }
  });
}