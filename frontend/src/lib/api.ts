import { fetchWithAuth } from './fetch-utils';

// ---------------------------------------------------------------------------
// Core card types — mirror backend card_to_dict / enrich_card_with_relationships
// ---------------------------------------------------------------------------

export interface CardAspect {
  aspect_name: string;
  // Use string | undefined (not null) so CSS style props accept it directly
  aspect_color?: string;
}

export interface AlternateArt {
  id: string;
  // Non-nullable strings to match how components use them (local AlternateArt types
  // in CardDetail/CardDetailDialog expect required strings, not null/undefined)
  image_uri: string;
  image_url?: string;
  set_name: string;
  set_code: string;
  card_number: string;
  rarity: string;
  artist: string;
}

export interface Card {
  id: string;
  name: string;
  subtitle?: string;
  type?: string;
  energy_cost?: number;
  cost?: number;
  attack?: number;
  health?: number;
  // Keep string | undefined (no null) so <img src> and other string-expecting
  // props don't require explicit null checks
  image_uri?: string;
  image_url?: string;
  image_back_uri?: string;
  text?: string;
  flavor_text?: string;
  set_code?: string;
  set_name?: string;
  card_number?: string;
  rarity?: string;
  artist?: string;
  price_usd?: number;
  epic_action?: string;
  deploy_box?: string;
  double_sided?: boolean;
  created_at?: string;
  updated_at?: string;
  // Enriched relationship fields
  aspects: CardAspect[];
  keywords: string[];
  traits: string[];
  arenas: string[];
  // Grouped art variants (populated by backend grouping logic)
  alternate_arts?: AlternateArt[];
}

// ApiCard is the same shape — used in card-browsing contexts
export type ApiCard = Card;

// ---------------------------------------------------------------------------
// Deck types
// ---------------------------------------------------------------------------

export interface DeckCardEntry {
  card: Card;
  quantity: number;
}

export interface SavedDeck {
  id: string;
  name: string;
  description?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  leaders: Card[];
  base: Card | null;
  cards: DeckCardEntry[];
}

export interface SaveDeckPayload {
  name: string;
  leaders: string[];   // card IDs
  base: string;        // card ID
  cards: Array<{ card_id: string; quantity: number }>;
}

// ---------------------------------------------------------------------------
// Collection types
// ---------------------------------------------------------------------------

export interface CollectionItem {
  card: Card;
  count: number;
  in_collection: boolean;
}

// ---------------------------------------------------------------------------
// Fetch params
// ---------------------------------------------------------------------------

export interface FetchCardsParams {
  page?: string | number;
  limit?: string | number;
  search?: string;
  type?: string;
  not_type?: string;
  aspect?: string;
  costMin?: string | number;
  costMax?: string | number;
  keyword?: string;
  set?: string;
  trait?: string;
  sort?: string;
  structured?: boolean;
}

interface CardsResponse {
  data: ApiCard[];
  meta: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

// ---------------------------------------------------------------------------
// Card endpoints
// ---------------------------------------------------------------------------

export async function fetchCards(params: FetchCardsParams = {}): Promise<CardsResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const response = await fetch(`/api/cards?${query.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch cards: ${response.status}`);
  return response.json();
}

export async function fetchAspects(): Promise<any[]> {
  const response = await fetch('/api/aspects');
  if (!response.ok) throw new Error('Failed to fetch aspects');
  return response.json();
}

export async function fetchTypes(): Promise<any[]> {
  const response = await fetch('/api/types');
  if (!response.ok) throw new Error('Failed to fetch types');
  return response.json();
}

export async function fetchKeywords(): Promise<any[]> {
  const response = await fetch('/api/keywords');
  if (!response.ok) throw new Error('Failed to fetch keywords');
  return response.json();
}

export async function fetchSets(): Promise<any[]> {
  const response = await fetch('/api/sets');
  if (!response.ok) throw new Error('Failed to fetch sets');
  return response.json();
}

export async function fetchTraits(): Promise<any[]> {
  const response = await fetch('/api/traits');
  if (!response.ok) throw new Error('Failed to fetch traits');
  return response.json();
}

// ---------------------------------------------------------------------------
// Collection endpoints (require auth)
// ---------------------------------------------------------------------------

export async function fetchUserCollection(): Promise<CollectionItem[]> {
  return fetchWithAuth('/api/me/collection');
}

export async function addCardToCollection(cardId: string, count: number): Promise<any> {
  return fetchWithAuth('/api/me/collection', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, count }),
  });
}

// ---------------------------------------------------------------------------
// Deck endpoints (require auth)
// ---------------------------------------------------------------------------

export async function fetchUserDecks(): Promise<SavedDeck[]> {
  return fetchWithAuth('/api/decks');
}

export async function fetchUserDeck(deckId: string): Promise<SavedDeck> {
  return fetchWithAuth(`/api/me/get-deck?id=${deckId}`);
}

export async function saveUserDeck(payload: SaveDeckPayload): Promise<SavedDeck | null> {
  try {
    return await fetchWithAuth('/api/decks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[api] saveUserDeck failed:', error);
    return null;
  }
}

export async function updateUserDeck(deckId: string, payload: SaveDeckPayload): Promise<SavedDeck | null> {
  try {
    return await fetchWithAuth(`/api/decks/${deckId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[api] updateUserDeck failed:', error);
    return null;
  }
}

// Returns true on success, throws on error — profile page checks `if (success)`
export async function deleteUserDeck(deckId: string): Promise<boolean> {
  await fetchWithAuth(`/api/decks/${deckId}`, { method: 'DELETE' });
  return true;
}

export async function shareUserDeck(deckId: string): Promise<{ share_token: string }> {
  return fetchWithAuth(`/api/me/decks/${encodeURIComponent(deckId)}/share`, { method: 'POST' });
}

export async function revokeUserDeckShare(deckId: string): Promise<void> {
  await fetchWithAuth(`/api/me/decks/${encodeURIComponent(deckId)}/share`, { method: 'DELETE' });
}

// No auth required — plain fetch
export async function fetchSharedDeck(shareToken: string): Promise<SavedDeck> {
  const res = await fetch(`/api/decks/share/${encodeURIComponent(shareToken)}`);
  if (!res.ok) throw new Error(`Shared deck not found: ${res.status}`);
  return res.json();
}
