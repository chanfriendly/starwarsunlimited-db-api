'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDeckById } from '@/lib/api';
import { SavedDeck } from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

// Export the client component
export function DeckViewClient({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [deck, setDeck] = useState<SavedDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // At the beginning of the DeckViewClient component body
  React.useEffect(() => {
    // Check for too many renders (potential loop detection)
    const renderCount = parseInt(sessionStorage.getItem('deckViewRenderCount') || '0') + 1;
    sessionStorage.setItem('deckViewRenderCount', renderCount.toString());
    
    // If we've rendered this component too many times in a short period, reset
    if (renderCount > 10) {
      console.error('[DEBUG] Detected potential render loop - resetting state');
      sessionStorage.removeItem('deckViewRenderCount');
      sessionStorage.removeItem('editingDeck');
      sessionStorage.removeItem('lastEditAttempt');
    }
    
    // Reset render count after 5 seconds of stability
    const timer = setTimeout(() => {
      sessionStorage.setItem('deckViewRenderCount', '0');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  // Use effect to load the deck data
  useEffect(() => {
    if (!deckId) {
        console.error('[DEBUG] No deck ID provided');
        setError('Invalid deck ID');
        setLoading(false);
        return;
    }
    
    const loadDeck = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('[DEBUG] Loading deck with ID:', deckId);
        
        // Check if we have an auth token
        const authToken = localStorage.getItem('auth_token');
        console.log('[DEBUG] Auth token exists:', !!authToken);
        
        // Use the new endpoint with query parameter instead of path parameter
        const response = await fetch(`/api/me/get-deck?id=${encodeURIComponent(deckId)}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
          
          console.log('[DEBUG] Fetch response status:', response.status);
          
          if (!response.ok) {
              const errorText = await response.text();
              console.error('[DEBUG] Error response text:', errorText);
              throw new Error(`Failed to load deck: ${response.status} - ${errorText}`);
          }
          
          const deck = await response.json();
          console.log('[DEBUG] Received deck data:', JSON.stringify(deck, null, 2));
          
          setDeck(deck);
      } catch (err) {
          console.error('[DEBUG] Full error in loadDeck:', err);
          setError(err instanceof Error ? err.message : 'Failed to load deck data');
      } finally {
          setLoading(false);
      }
  };

    loadDeck();
  }, [deckId]);

  const handleEditDeck = () => {
    console.log('[DEBUG] Editing deck:', deckId);
    
    // CIRCUIT BREAKER: Check if we've already tried to edit this deck recently
    const lastEditAttempt = sessionStorage.getItem('lastEditAttempt');
    const now = Date.now();
    
    if (lastEditAttempt) {
      const timeSinceLastAttempt = now - parseInt(lastEditAttempt);
      
      // If we tried to edit within the last 5 seconds, prevent another attempt
      if (timeSinceLastAttempt < 5000) {
        console.log('[DEBUG] Preventing rapid edit attempts - cooling down');
        alert('Please wait a moment before editing again.');
        return false;
      }
    }
    
    // Record this attempt
    sessionStorage.setItem('lastEditAttempt', now.toString());
    sessionStorage.setItem('editingDeck', deckId);
    
    // DIRECT APPROACH: Instead of using React router, use direct URL change 
    // with a timestamp parameter to prevent caching issues
    window.location.href = `/deck-builder?deckId=${deckId}&t=${Date.now()}`;
    
    return false;
  };

  // Add debugging logs to see what's happening
  console.log("Component state:", { loading, error, deckId, hasDeckData: !!deck });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading deck...</p>
        </div>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-3xl mx-auto bg-gray-900 p-8 rounded-lg border border-gray-800">
          <div className="flex items-center gap-3 text-red-400 mb-6">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Error Loading Deck</h1>
          </div>
          <p className="text-gray-300 mb-6">{error || 'Could not find the requested deck'}</p>
          <Button asChild>
            <Link href="/profile">Return to Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Calculate total cards
  const totalCards = deck.cards.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold">{deck.name}</h1>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleEditDeck}
              className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
            >
              Edit Deck
            </Button>
            <Button asChild className="bg-gray-600 hover:bg-gray-500">
              <Link href="/profile">Back to Profile</Link>
            </Button>
          </div>
        </div>

        {/* Deck summary */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Leaders */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-4">Leaders</h2>
              <div className="flex gap-4">
                {deck.leaders && deck.leaders.map(leader => (
                  <div key={leader.id} className="w-32 text-center">
                    <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700 mb-2">
                    <img 
                      src={leader.image_uri || leader.image_url || `/placeholder-card.png`} 
                      alt={leader.name || "Leader card"}
                      className="w-full h-full object-contain" 
                    />
                    </div>
                    <p className="text-sm font-medium">{leader.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Base */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-4">Base</h2>
              {deck.base ? (
                <div className="w-32 text-center">
                  <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700 mb-2">
                  <img 
                    src={deck.base.image_uri || deck.base.image_url || `/placeholder-card.png`} 
                    alt={deck.base.name || "Base card"}
                    className="w-full h-full object-contain" 
                  />
                  </div>
                  <p className="text-sm font-medium">{deck.base.name}</p>
                </div>
              ) : (
                <p>No base card</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-4">Deck Info</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Cards:</span>
                  <span className="font-semibold">{totalCards}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Updated:</span>
                  <span className="font-semibold">{deck.updated_at ? new Date(deck.updated_at).toLocaleDateString() : 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards in deck */}
        <h2 className="text-2xl font-bold mb-4">Cards</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {deck.cards && deck.cards.map(item => (
            <div key={item.card.id} className="relative">
              <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700">
              <img 
                src={item.card.image_uri || item.card.image_url || `/placeholder-card.png`} 
                alt={item.card.name || "Card"}
                className="w-full h-full object-contain" 
              />
              </div>
              {item.quantity > 1 && (
                <div className="absolute top-1 left-1 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  x{item.quantity}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}