// types.d.ts
declare module '@/lib/api' {
  export interface Card {
    id: string;
    name: string;
    subtitle?: string;
    energy_cost?: number;
    type: string;
    rarity?: string;
    text?: string;
    attack?: number;
    health?: number;
    image_uri?: string;
    image_back_uri?: string;
    set_name?: string;
    set_code?: string;
    card_number?: string;
    aspects: Array<{aspect_name: string; aspect_color: string}>;
    keywords: string[];
    traits: string[];
    arenas: string[];
  }

  export interface DeckCard {
    card: Card;
    quantity: number;
  }

  export function getCards(params?: any): Promise<{cards: Card[], total: number}>;
  export function getTypes(): Promise<string[]>;
  export function getAspects(): Promise<Array<{aspect_name: string; aspect_color: string}>>;
  // Add other API functions as needed
}