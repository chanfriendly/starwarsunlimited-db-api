// frontend/src/app/decks/[id]/DeckViewClient.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { SavedDeck } from '@/lib/api'; // Assuming SavedDeck type is defined in api.ts
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-utils'; 

// Export the client component
export function DeckViewClient({ deckId }: { deckId: string }) {
  const router = useRouter(); // Instantiate the router
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
      // Consider navigating away or showing an error message if loop persists
    }

    // Reset render count after 5 seconds of stability
    const timer = setTimeout(() => {
      sessionStorage.setItem('deckViewRenderCount', '0');
    }, 5000);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array means this runs once on mount and on cleanup

  // Use effect to load the deck data
  useEffect(() => {
    if (!deckId) { /* ... error handling ... */ return; }

    const loadDeck = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[DEBUG] DeckViewClient: Loading deck with ID:', deckId);

        // --- CHANGE TO fetchWithAuth ---
        // Use fetchWithAuth which adds the Authorization header
        const loadedDeckData: SavedDeck = await fetchWithAuth(`/api/me/decks/${encodeURIComponent(deckId)}`);
        // No need for credentials: 'include' if using Bearer token via fetchWithAuth
        // --- END CHANGE ---

        console.log('[DEBUG] DeckViewClient: Received deck data:', JSON.stringify(loadedDeckData, null, 2));

        // Optional: Validate structure again
        if (!loadedDeckData || typeof loadedDeckData.id !== 'string') {
             console.error('[DEBUG] DeckViewClient: Invalid deck data structure received:', loadedDeckData);
             throw new Error('Received invalid deck data from server.');
        }

        setDeck(loadedDeckData);

      } catch (err) {
        console.error('[DEBUG] DeckViewClient: Full error in loadDeck:', err);
        // Provide specific error message for 401
        if (err instanceof Error && err.message?.includes('(401)')) {
             setError('Unauthorized. Please log in.');
        } else {
             setError(err instanceof Error ? err.message : 'Failed to load deck data');
        }
      } finally {
        setLoading(false);
      }
    };

    loadDeck();
  }, [deckId]); // Dependency array

  const handleEditDeck = () => {
    if (!deck) {
      console.warn('[DEBUG] Edit attempted but deck data is not loaded yet.');
      return;
    }
    const currentDeckId = deck.id; // Use ID from loaded deck state
    console.log('[DEBUG] Editing deck:', currentDeckId);

    // --- CIRCUIT BREAKER ---
    const lastEditAttempt = sessionStorage.getItem('lastEditAttempt');
    const now = Date.now();
    if (lastEditAttempt) {
      const timeSinceLastAttempt = now - parseInt(lastEditAttempt);
      if (timeSinceLastAttempt < 5000) { // 5 second cooldown
        console.log('[DEBUG] Preventing rapid edit attempts - cooling down');
        alert('Please wait a moment before editing again.');
        return;
      }
    }
    sessionStorage.setItem('lastEditAttempt', now.toString());
    // Store the ID we are trying to edit, useful for debugging on the builder page
    sessionStorage.setItem('editingDeck', currentDeckId);
    // --- END CIRCUIT BREAKER ---

    // *** Use Next.js router for client-side navigation ***
    router.push(`/deck-builder?deckId=${currentDeckId}`);
    console.log(`[DEBUG] Navigating to /deck-builder?deckId=${currentDeckId}`);

    // No need for 'return false;'
  };

  // Loading State UI
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

  // Error State UI
  if (error || !deck) { // Also handle case where deck is null after loading finishes (should imply an error)
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-3xl mx-auto bg-gray-900 p-8 rounded-lg border border-gray-800">
          <div className="flex items-center gap-3 text-red-400 mb-6">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Error Loading Deck</h1>
          </div>
          <p className="text-gray-300 mb-6">{error || 'Could not find or load the requested deck.'}</p>
          <Button asChild>
            <Link href="/profile">Return to Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Success State UI - Render the deck details
  // Calculate total cards (Ensure quantity is handled correctly - Twin Suns = 1 per card)
  const totalCards = deck.cards.reduce((sum, item) => sum + (item.quantity || 1), 0); // Default quantity to 1 if missing

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold">{deck.name}</h1>
          <div className="flex gap-3">
            {/* Edit Button - calls the updated handleEditDeck */}
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
                {deck.leaders?.map(leader => ( // Add optional chaining for safety
                  <div key={leader.id} className="w-32 text-center">
                    <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700 mb-2 bg-gray-800"> {/* Added bg */}
                      <img
                        src={leader.image_uri || leader.image_url || `/placeholder-card.png`}
                        alt={leader.name || "Leader card"}
                        className="w-full h-full object-contain"
                        onError={(e) => (e.currentTarget.src = '/placeholder-card.png')} // Fallback image
                      />
                    </div>
                    <p className="text-sm font-medium truncate" title={leader.name}>{leader.name || 'Unknown Leader'}</p>
                  </div>
                ))}
                {(!deck.leaders || deck.leaders.length === 0) && <p className="text-gray-500">No leaders found.</p>}
              </div>
            </div>

            {/* Base */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-4">Base</h2>
              {deck.base ? (
                <div className="w-32 text-center">
                  <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700 mb-2 bg-gray-800"> {/* Added bg */}
                    <img
                      src={deck.base.image_uri || deck.base.image_url || `/placeholder-card.png`}
                      alt={deck.base.name || "Base card"}
                      className="w-full h-full object-contain"
                      onError={(e) => (e.currentTarget.src = '/placeholder-card.png')} // Fallback image
                    />
                  </div>
                  <p className="text-sm font-medium truncate" title={deck.base.name}>{deck.base.name || 'Unknown Base'}</p>
                </div>
              ) : (
                <p className="text-gray-500">No base card found.</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-4">Deck Info</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Cards:</span>
                  <span className="font-semibold">{totalCards}</span>
                </div>
                {/* Add more stats if available/needed */}
                <div className="flex justify-between">
                  <span className="text-gray-400">Format:</span>
                  <span className="font-semibold">Twin Suns</span> {/* Assuming Twin Suns */}
                </div>
                 <div className="flex justify-between">
                   <span className="text-gray-400">Last Updated:</span>
                   <span className="font-semibold">{deck.updated_at ? new Date(deck.updated_at).toLocaleDateString() : 'N/A'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-400">Created:</span>
                   <span className="font-semibold">{deck.created_at ? new Date(deck.created_at).toLocaleDateString() : 'N/A'}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards in deck */}
        <h2 className="text-2xl font-bold mb-4">Cards ({totalCards})</h2>
        {deck.cards && deck.cards.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4"> {/* Adjusted grid cols */}
            {deck.cards.map(item => (
              <div key={item.card.id} className="relative group">
                <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700 bg-gray-800 group-hover:border-purple-500 transition-colors"> {/* Added bg, hover */}
                  <img
                    src={item.card.image_uri || item.card.image_url || `/placeholder-card.png`}
                    alt={item.card.name || "Card"}
                    className="w-full h-full object-contain"
                    loading="lazy" // Add lazy loading for card images
                    onError={(e) => (e.currentTarget.src = '/placeholder-card.png')} // Fallback image
                  />
                   {/* Optional: Show name on hover/focus */}
                   <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                     {item.card.name || 'Unknown Card'}
                   </div>
                </div>
                {/* Twin Suns quantity should be 1, so no need for quantity badge */}
                {/* {item.quantity > 1 && (
                  <div className="absolute top-1 left-1 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">
                    x{item.quantity}
                  </div>
                )} */}
              </div>
            ))}
          </div>
        ) : (
           <div className="text-center text-gray-500 py-10">
             This deck currently has no cards added.
           </div>
        )}
      </div>
    </div>
  );
}