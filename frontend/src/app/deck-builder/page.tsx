// frontend/src/app/deck-builder/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardGrid } from '@/components/CardGrid';
import { CardDetail } from '@/components/CardDetail';
import { LeaderSelection } from '@/components/LeaderSelection';
import { DeckStats } from '@/components/DeckStats';
import SaveDeckDialog from '@/components/SaveDeckDialog';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
import { Card as CardType, FetchCardsParams, fetchCards, fetchDeckById } from '@/lib/api'; // Removed unused imports
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { debounce } from 'lodash-es'; // Import debounce

// Constants
const SEARCH_DEBOUNCE_MS = 400;
const CARDS_PER_PAGE = 50; // Adjust if needed

export default function DeckBuilder() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deckIdParam = searchParams.get('deckId');

    // --- State Variables ---
    // Core card data from API
    const [cards, setCards] = useState<CardType[]>([]);
    // Cards to actually display after client-side filtering (hiding, aspect check)
    const [displayedCards, setDisplayedCards] = useState<CardType[]>([]);
    // Currently selected card for detail view
    const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
    // Loading indicators
    const [loading, setLoading] = useState(true); // Initial/full load
    const [isLoadingMore, setIsLoadingMore] = useState(false); // Pagination load
    const [loadingDeck, setLoadingDeck] = useState(!!deckIdParam); // Loading existing deck
    // Error handling
    const [error, setError] = useState<string | null>(null);
    // Filters & Search
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cardTypeFilter, setCardTypeFilter] = useState<string>(''); // For potential client-side type refinement
    // UI Toggles
    const [showAllCards, setShowAllCards] = useState<boolean>(false); // Aspect compatibility toggle
    const [hideCardsInDeck, setHideCardsInDeck] = useState(true); // Toggle for hiding cards already added
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMoreCards, setHasMoreCards] = useState(true);

    // Deck Builder Context Hook
    const {
        currentStage, leaders, base, deckCards,
        addLeader, removeLeader, setBase: setBaseContext, addCard, removeCard,
        isCardInDeck: isCardIdInDeck, // Renamed for clarity if needed, or keep as is
        isCardInAspect, resetDeck, setDeckName,
        setCurrentStage: contextSetCurrentStage
    } = useDeckBuilder();

    // --- Debounced Search ---
    const debouncedLoadCards = useCallback(
        debounce((query: string) => {
            console.log("Debounced search triggered with query:", query);
            setCurrentPage(1); // Reset page on new search
            loadCards(1, false, query); // Load page 1, replace results, pass search query
        }, SEARCH_DEBOUNCE_MS),
        [] // Empty dependency array: debounce function is created once
    );

    // Ref to hold the debounced function
    const debouncedSearchRef = useRef(debouncedLoadCards);

    // Handler for search input changes
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        // Call the debounced function via the ref
        debouncedSearchRef.current(query);
    };

    // --- Core Card Loading Function ---
    const loadCards = useCallback(async (page = 1, append = false, currentSearch = searchQuery) => {
        // Prevent loading if already loading more and appending, or if no more pages exist and appending
        if ((append && isLoadingMore) || (append && !hasMoreCards)) {
             console.log("Load more skipped. isLoadingMore:", isLoadingMore, "hasMoreCards:", hasMoreCards);
             return;
        }

        setError(null);
        if (page === 1 && !append) {
            setLoading(true);
        } else if (append) {
            setIsLoadingMore(true);
        }

        console.log(`Fetching cards -> Stage: ${currentStage}, Page: ${page}, Append: ${append}, Search: '${currentSearch}'`);

        const params: FetchCardsParams = {
            page: page.toString(),
            limit: CARDS_PER_PAGE.toString(),
            search: currentSearch || undefined,
        };

        // Add stage-specific type filters for the API call
        if (currentStage === 'leaders') {
            params.type = 'Leader';
        } else if (currentStage === 'base') {
            params.type = 'Base';
        } else if (currentStage === 'cards') {
            params.not_type = 'Leader,Base'; // Exclude leaders and bases
        }
        // Note: The client-side 'cardTypeFilter' is applied AFTER fetching,
        // unless you want to send it to the backend as well.
        // Sending it might override the stage filters, be careful.

        try {
            const response = await fetchCards(params); // Call API function
            console.log(`API Response for page ${page}:`, response);

            const newCards = Array.isArray(response.data) ? response.data : [];
            const meta = response.meta || { pages: 1, total: newCards.length }; // Provide default meta if missing

            // Update state based on append flag
            setCards(prevCards => append ? [...prevCards, ...newCards] : newCards);
            setTotalPages(meta.pages || 1);
            setHasMoreCards(page < (meta.pages || 1));
            setCurrentPage(page); // Always update current page after successful fetch

        } catch (err: any) {
            console.error(`Error loading cards (page ${page}):`, err);
            setError(`Failed to load cards: ${err.message || 'Please check connection or try again.'}`);
            setHasMoreCards(false); // Stop trying on error
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    }, [currentStage, searchQuery, isLoadingMore, hasMoreCards]); // Dependencies: stage changes trigger re-creation, others prevent unnecessary calls

    // --- Effect Hooks ---

    // Load existing deck if ID is present in URL
    useEffect(() => {
        if (deckIdParam) {
            const loadExistingDeck = async () => {
                try {
                    setLoadingDeck(true);
                    const deck = await fetchDeckById(deckIdParam); // Use your API function
                    if (!deck) {
                        setError('Deck not found'); return;
                    }
                    resetDeck();
                    setDeckName(deck.name);
                    deck.leaders.forEach(addLeader);
                    if (deck.base) setBaseContext(deck.base);
                    deck.cards.forEach(item => addCard(item.card)); // Assuming fetchDeckById adapts cards
                    contextSetCurrentStage('cards');
                } catch (err) {
                    console.error('Error loading deck:', err);
                    setError('Failed to load deck.');
                } finally {
                    setLoadingDeck(false);
                }
            };
            loadExistingDeck();
        }
    }, [deckIdParam, addLeader, addCard, resetDeck, setDeckName, contextSetCurrentStage, setBaseContext]);


    // Load initial cards for the stage OR when search is cleared
    useEffect(() => {
        // Only run initial load if search query is empty
        if (searchQuery === '') {
            console.log("Initial load or search cleared for stage:", currentStage);
            setCurrentPage(1); // Reset page
            setHasMoreCards(true); // Assume there are cards initially
            loadCards(1, false, ''); // Load page 1, replace results, empty search
        }
        // If searchQuery is not empty, the debounced handler manages loading
    }, [currentStage, searchQuery]); // Rerun when stage changes OR search query becomes empty


    // Apply client-side filtering (hiding, aspects, type refinement) AFTER cards are fetched
    useEffect(() => {
        let cardsToDisplay = cards;

        // Filter 1: Hide cards already in the main deck area (if toggle is on)
        if (currentStage === 'cards' && hideCardsInDeck) {
            const deckCardIds = new Set(deckCards.map(dc => dc.card.id));
            cardsToDisplay = cardsToDisplay.filter(card => !deckCardIds.has(card.id));
        }

        // Filter 2: Aspect compatibility (if toggle is off and requirements met)
        if (currentStage === 'cards' && !showAllCards && leaders.length === 2 && base) {
            cardsToDisplay = cardsToDisplay.filter(card => isCardInAspect(card));
        }

        // Filter 3: Client-side type refinement (optional)
        if (cardTypeFilter && cardTypeFilter !== 'All') {
            cardsToDisplay = cardsToDisplay.filter(card => card.type === cardTypeFilter);
        }

        setDisplayedCards(cardsToDisplay);
    }, [cards, hideCardsInDeck, deckCards, currentStage, showAllCards, leaders, base, cardTypeFilter, isCardInAspect]);


    // --- Event Handlers ---

    const handleCardClick = (card: CardType) => {
        console.log('Card clicked:', card.name, 'Type:', card.type, 'Stage:', currentStage);
        setSelectedCard(card); // Always update selected card

        // Auto-add logic (optional, can be removed if explicit add button is preferred)
        if (currentStage === 'leaders' && leaders.length < 2 && !leaders.some(l => l.id === card.id)) {
            addLeader(card);
        } else if (currentStage === 'base' && !base && card.type === 'Base') {
            setBaseContext(card);
        }
    };

    const handleCardDoubleClick = (card: CardType) => {
        console.log('Card double-clicked:', card.name);
        // Add card to the main deck area if it's the 'cards' stage and not already added
        if (currentStage === 'cards' && !isCardIdInDeck(card.id)) {
            addCard(card);
        }
    };

    const handleAddToDeck = (card: CardType) => {
        console.log(`Adding ${card.type} via button:`, card.name, 'Stage:', currentStage);
        if (currentStage === 'leaders') {
            if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) addLeader(card);
        } else if (currentStage === 'base') {
            if (card.type === 'Base') setBaseContext(card);
        } else if (currentStage === 'cards') {
            if (!isCardIdInDeck(card.id)) addCard(card);
        }
    };

    const handleRemoveFromDeck = (cardId: string) => {
        console.log('Removing card from deck:', cardId);
        // Check which part of the deck the card belongs to based on stage or card type/ID match
        if (leaders.some(l => l.id === cardId)) {
            removeLeader(cardId);
        } else if (base?.id === cardId) {
            setBaseContext(null);
        } else {
            removeCard(cardId); // Assumes it's in the main deckCards array
        }
        // Optionally deselect card if it was removed
        if (selectedCard?.id === cardId) {
            setSelectedCard(null);
        }
    };

    // --- Load More ---
    const loadMoreCardsHandler = () => {
        if (hasMoreCards && !isLoadingMore) {
            const nextPage = currentPage + 1;
            // Important: Pass the *current* searchQuery state when loading more
            loadCards(nextPage, true, searchQuery);
        } else {
            console.log("Cannot load more. hasMore:", hasMoreCards, "isLoadingMore:", isLoadingMore);
        }
    };

    // --- UI Rendering Logic ---
    const getStageInfo = () => {
        // ... (implementation remains the same) ...
        switch (currentStage) {
            case 'leaders': return { title: 'Select Leaders', description: 'Choose two leaders.', progress: leaders.length / 2 };
            case 'base': return { title: 'Select Base', description: 'Choose a base.', progress: base ? 1 : 0 };
            case 'cards': return { title: 'Add Cards', description: 'Add cards to complete your deck.', progress: Math.min(deckCards.length / 40, 1) };
            default: return { title: 'Build Your Deck', description: 'Create a Twin Suns deck.', progress: 0 };
        }
    };

    const stageInfo = getStageInfo();

    const renderLeaderSelectionArea = () => (
        // ... (JSX remains the same, uses context state) ...
          <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                    <CardTitle className="text-xl">Selected Leaders</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <LeaderSelection
                        leaders={leaders}
                        onRemoveLeader={handleRemoveFromDeck} // Use unified handler
                        onSelectLeader={setSelectedCard}
                    />
                    <div className="mt-6 flex justify-between">
                        <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                        <Button onClick={() => contextSetCurrentStage('base')} disabled={leaders.length < 2} className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90">Next Step</Button>
                    </div>
                </CardContent>
            </Card>
    );

    const renderBaseSelectionArea = () => (
        // ... (JSX remains mostly the same, uses context state) ...
         <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                    <CardTitle className="text-xl">Selected Base</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex justify-center">
                        {base ? (
                            <div className="relative max-w-xs group">
                                <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500 cursor-pointer" onClick={() => setSelectedCard(base)}>
                                    {/* Image rendering logic */}
                                      {base.image_uri || base.image_url ? (
                                        <img src={base.image_uri ?? base.image_url ?? undefined} alt={base.name} className="w-full h-full object-contain"/>
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="text-sm text-center p-2">{base.name}</span></div>
                                      )}
                                </div>
                                 <button className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleRemoveFromDeck(base.id); }}>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                                <div className="mt-2 text-center"><h3 className="font-medium">{base.name}</h3></div>
                            </div>
                        ) : (
                            <div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-xs w-full">
                                <span className="text-gray-500">Select a Base</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-6 flex justify-between">
                        <Button onClick={() => contextSetCurrentStage('leaders')} variant="outline">Back</Button>
                        <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                        <Button onClick={() => contextSetCurrentStage('cards')} disabled={!base} className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90">Next Step</Button>
                    </div>
                </CardContent>
            </Card>
    );

    const renderCardsSelectionArea = () => (
        // ... (JSX remains mostly the same, uses context state) ...
        // Ensure the grid maps over `deckCards` from context
           <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                    <CardTitle className="text-xl">Your Deck</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                     {/* Deck Content Grid */}
                    {deckCards.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2">
                            {deckCards.map(({ card }) => ( // Access card property
                                <div key={card.id} className="relative group">
                                    <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors cursor-pointer" onClick={() => setSelectedCard(card)}>
                                        {/* Image rendering */}
                                        {card.image_uri || card.image_url ? (
                                            <img src={card.image_uri ?? card.image_url ?? ''} alt={card.name} className="w-full h-full object-contain"/>
                                        ) : (
                                             <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="text-xs text-center p-1">{card.name}</span></div>
                                        )}
                                         {/* Remove button */}
                                         <button className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleRemoveFromDeck(card.id); }}>
                                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                         </button>
                                        {/* Name overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1 truncate">{card.name}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-gray-500">No cards added yet.</div>
                    )}

                    {/* Navigation & Stats */}
                    <div className="mt-6 flex justify-between items-start">
                         <div>
                            <Button onClick={() => contextSetCurrentStage('base')} variant="outline" className="mr-2">Back</Button>
                            <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                        </div>
                        <Button onClick={() => setShowSaveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white" disabled={deckCards.length < 1}>Save Deck</Button>
                    </div>
                    {deckCards.length > 0 && (
                        <div className="mt-6"><DeckStats /></div>
                    )}
                </CardContent>
            </Card>
    );

    // --- Main Return JSX ---

    // Show loading indicator for entire deck load
    if (loadingDeck) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="mt-4 text-2xl text-gray-300">Loading deck...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header Section */}
            <section className="py-8 px-4">
                <div className="max-w-7xl mx-auto">
                     <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
                            Twin Suns
                        </span> Deck Builder
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl">{stageInfo.description}</p>
                </div>
            </section>

            {/* Progress Indicator */}
            <section className="py-4 px-4 bg-gray-950 sticky top-0 z-10 border-b border-gray-800">
                <div className="max-w-7xl mx-auto">
                    {/* Progress Steps Visual */}
                     <div className="flex items-center mb-2">
                         <div className={`h-2 rounded-l-full w-1/3 transition-colors ${currentStage === 'leaders' ? 'bg-purple-500' : (leaders.length === 2 ? 'bg-green-500' : 'bg-gray-700')}`}></div>
                         <div className={`h-2 w-1/3 transition-colors ${currentStage === 'base' ? 'bg-purple-500' : (base ? 'bg-green-500' : 'bg-gray-700')}`}></div>
                         <div className={`h-2 rounded-r-full w-1/3 transition-colors ${currentStage === 'cards' ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                     </div>
                    {/* Stage Labels */}
                     <div className="flex text-xs text-gray-400">
                        <div className={`w-1/3 text-center ${currentStage === 'leaders' ? 'text-purple-400 font-bold' : (leaders.length === 2 ? 'text-green-400' : '')}`}>1. Leaders ({leaders.length}/2)</div>
                        <div className={`w-1/3 text-center ${currentStage === 'base' ? 'text-purple-400 font-bold' : (base ? 'text-green-400' : '')}`}>2. Base {base ? '(Selected)' : ''}</div>
                        <div className={`w-1/3 text-center ${currentStage === 'cards' ? 'text-purple-400 font-bold' : ''}`}>3. Cards ({deckCards.length})</div>
                    </div>
                </div>
            </section>


            {/* Main Content Area */}
            <section className="py-6 px-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left/Middle: Card Browser & Selection Area */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Card Browser Card */}
                        <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                            <CardHeader className="border-b border-gray-800 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-xl whitespace-nowrap">
                                        {/* Dynamic Title */}
                                          {currentStage === 'leaders' ? 'Select Leaders' : currentStage === 'base' ? 'Select Base' : 'Add Cards'}
                                    </CardTitle>
                                    {/* Search and Filter Controls */}
                                    <div className="flex flex-wrap items-center gap-2">
                                         <input
                                            type="text"
                                            placeholder="Search all cards..."
                                            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-purple-500 focus:border-purple-500"
                                            value={searchQuery}
                                            onChange={handleSearchChange} // Debounced handler
                                        />
                                        {/* Client-side Type Filter (Optional - keep if useful for refining results) */}
                                        {currentStage === 'cards' && (
                                             <select
                                                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-purple-500 focus:border-purple-500"
                                                value={cardTypeFilter}
                                                onChange={(e) => setCardTypeFilter(e.target.value)}
                                            >
                                                <option value="">All Types</option>
                                                <option value="Unit">Units</option>
                                                <option value="Event">Events</option>
                                                <option value="Upgrade">Upgrades</option>
                                            </select>
                                        )}
                                        {/* Client-side Toggles */}
                                        {currentStage === 'cards' && (
                                            <>
                                                <div className="flex items-center space-x-2">
                                                    <Switch id="show-all-cards" checked={showAllCards} onCheckedChange={setShowAllCards} />
                                                    <Label htmlFor="show-all-cards" className="text-sm text-gray-300 whitespace-nowrap">Show all aspects</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Switch id="hide-cards-in-deck" checked={hideCardsInDeck} onCheckedChange={setHideCardsInDeck} />
                                                    <Label htmlFor="hide-cards-in-deck" className="text-sm text-gray-300 whitespace-nowrap">Hide added cards</Label>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Loading/Error/Empty States */}
                                {loading && !isLoadingMore ? (
                                    <div className="h-96 flex items-center justify-center text-purple-400">Loading cards...</div>
                                ) : error ? (
                                    <div className="h-96 flex items-center justify-center text-red-400 p-4 text-center">{error}</div>
                                ) : displayedCards.length === 0 && !loading ? (
                                     <div className="h-96 flex items-center justify-center text-gray-400 p-4 text-center">
                                        {searchQuery ? `No cards found matching "${searchQuery}".` : "No cards available for this stage."}
                                     </div>
                                ) : (
                                    // Card Grid - Render displayedCards (includes client-side filters)
                                     <div className="max-h-[60vh] overflow-y-auto p-4"> {/* Add padding */}
                                        <CardGrid
                                            cards={displayedCards}
                                            onCardClick={handleCardClick}
                                            onDoubleClick={handleCardDoubleClick}
                                            selectedCardId={selectedCard?.id}
                                            isCompatible={isCardInAspect}
                                            isInDeck={isCardIdInDeck} // Use context function
                                            // Hiding is done via displayedCards state
                                            // hideCardsInDeck={currentStage === 'cards' && hideCardsInDeck}
                                            currentStage={currentStage}
                                        />
                                    </div>
                                )}
                                {/* Load More Section */}
                                {!loading && displayedCards.length > 0 && hasMoreCards && (
                                    <div className="p-4 flex justify-center border-t border-gray-800">
                                        <Button onClick={loadMoreCardsHandler} variant="outline" disabled={isLoadingMore} className="bg-gray-800 hover:bg-gray-700 text-white">
                                            {isLoadingMore ? (<><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>Loading...</>) : ('Load More Cards')}
                                        </Button>
                                    </div>
                                )}
                                {/* End of Results Message */}
                                {!loading && !hasMoreCards && cards.length > 0 && (
                                     <div className="p-4 text-center text-gray-500 text-sm border-t border-gray-800">End of results.</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Stage-specific Selection/Deck Area */}
                        {currentStage === 'leaders' && renderLeaderSelectionArea()}
                        {currentStage === 'base' && renderBaseSelectionArea()}
                        {currentStage === 'cards' && renderCardsSelectionArea()}
                    </div>

                    {/* Right: Card Detail Panel */}
                    <div className="lg:col-span-1">
                        <Card className="bg-gray-900 border-gray-800 h-full sticky top-4">
                            <CardHeader className="border-b border-gray-800">
                                <CardTitle className="text-xl">Card Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {selectedCard ? (
                                    <CardDetail
                                        card={selectedCard}
                                        onAddToDeck={handleAddToDeck}
                                        onRemoveFromDeck={handleRemoveFromDeck}
                                        isInDeck={isCardIdInDeck(selectedCard.id)}
                                        isCompatible={currentStage === 'cards' ? isCardInAspect(selectedCard) : true}
                                        currentStage={currentStage}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        <span className="text-gray-500">Select a card to view details</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Save Deck Dialog */}
            <SaveDeckDialog
                isOpen={showSaveDialog}
                onClose={() => setShowSaveDialog(false)}
                onSuccess={(deckId) => {
                    // Show success message or redirect to the deck page
                    setShowSaveDialog(false);
                    // Navigate to profile page
                    router.push('/profile');
                }}
            />
        </div>
    );
}