// frontend/src/app/deck-builder/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardGrid } from '@/components/CardGrid';
import { CardDetail } from '@/components/CardDetail';
import { LeaderSelection } from '@/components/LeaderSelection';
import { DeckStats } from '@/components/DeckStats';
import SaveDeckDialog from '@/components/SaveDeckDialog';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
import { Card as CardType, FetchCardsParams, fetchCards, fetchDeckById } from '@/lib/api'; // Ensure fetchCards is imported
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { debounce } from 'lodash-es'; // Make sure lodash-es is installed

// Constants
const SEARCH_DEBOUNCE_MS = 400;
const CARDS_PER_PAGE = 50;

// Memoized CardDetail component to prevent unnecessary re-renders
const MemoizedCardDetail = React.memo(CardDetail);

export default function DeckBuilder() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deckIdParam = searchParams.get('deckId');

    // --- Refs ---
    const loadingRef = useRef(false); // Ref to prevent concurrent fetches
    const observerRef = useRef<IntersectionObserver | null>(null); // Ref for the observer
    const lastCardElementRef = useRef<HTMLDivElement | null>(null); // Ref for the trigger element

    // --- State Variables ---
    const [cards, setCards] = useState<CardType[]>([]); // Raw card data from API
    const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
    const [loading, setLoading] = useState(true); // Initial/full stage load indicator
    const [isLoadingMore, setIsLoadingMore] = useState(false); // Pagination load indicator
    const [loadingDeck, setLoadingDeck] = useState(!!deckIdParam); // Loading existing deck indicator
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cardTypeFilter, setCardTypeFilter] = useState<string>(''); // For client-side type refinement
    const [showAllCards, setShowAllCards] = useState<boolean>(false); // Aspect compatibility toggle
    const [hideCardsInDeck, setHideCardsInDeck] = useState(true); // Toggle for hiding cards already added
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMoreCards, setHasMoreCards] = useState(true);

    // --- Deck Builder Context Hook ---
    const {
        currentStage, leaders, base, deckCards,
        addLeader, removeLeader, setBase: setBaseContext, addCard, removeCard,
        isCardInDeck: isCardIdInDeck,
        isCardInAspect, resetDeck, setDeckName,
        setCurrentStage: contextSetCurrentStage
    } = useDeckBuilder();

    // --- Callbacks ---

    // Core Card Loading Function (Stable)
    const loadCards = useCallback(async (page = 1, append = false, currentSearch = searchQuery) => {
        if (loadingRef.current) {
            console.log("Load cancelled: Already loading.");
            return;
        }
        if (append && !hasMoreCards) {
            console.log("Load cancelled: No more cards.");
            return;
        }

        loadingRef.current = true;
        setError(null);
        if (page === 1 && !append) setLoading(true);
        else if (append) setIsLoadingMore(true);

        console.log(`Fetching cards -> Stage: ${currentStage}, Page: ${page}, Append: ${append}, Search: '${currentSearch}'`);
        const params: FetchCardsParams = {
            page: page.toString(),
            limit: CARDS_PER_PAGE.toString(),
            search: currentSearch || undefined,
        };

        // Apply stage-specific filters for the API call
        if (currentStage === 'leaders') params.type = 'Leader';
        else if (currentStage === 'base') params.type = 'Base';
        else if (currentStage === 'cards') params.not_type = 'Leader,Base';

        try {
            // Assuming fetchCards uses fetchPublic which handles trailing slash
            const response = await fetchCards(params);
            console.log(`API Response for page ${page}:`, response);
            const newCards = Array.isArray(response.data) ? response.data : [];
            const meta = response.meta || { pages: 1, total: newCards.length };

            setCards(prev => append ? [...prev, ...newCards] : newCards);
            setTotalPages(meta.pages || 1);
            setHasMoreCards(page < (meta.pages || 1));
            setCurrentPage(page); // Update current page after fetch

        } catch (err: any) {
            console.error(`Error loading cards (page ${page}):`, err);
            setError(`Failed to load cards: ${err.message || 'Network error'}`);
            setHasMoreCards(false); // Stop pagination on error
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
            loadingRef.current = false; // Release lock
        }
    }, [currentStage, searchQuery, hasMoreCards]); // Dependencies for the load definition

    // Debounced Search Function (Stable)
    const debouncedLoadCardsSearch = useCallback(
        debounce((query: string) => {
            console.log("Debounced search executing for:", query);
            setCurrentPage(1); // Reset page for new search
            setHasMoreCards(true); // Assume results exist
            loadCards(1, false, query); // Load page 1, replace results, pass search query
        }, SEARCH_DEBOUNCE_MS),
        [loadCards] // Depends only on the stable loadCards callback
    );

    // Search Input Handler (Stable)
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        debouncedLoadCardsSearch(query);
    }, [debouncedLoadCardsSearch]);

    // Load More Handler (Stable)
    const loadMoreCardsHandler = useCallback(() => {
        if (hasMoreCards && !isLoadingMore && !loadingRef.current) {
            const nextPage = currentPage + 1;
            loadCards(nextPage, true, searchQuery); // append=true, use current search
        } else {
            console.log("Cannot load more. hasMore:", hasMoreCards, "isLoadingMore:", isLoadingMore, "loadingRef:", loadingRef.current);
        }
    }, [currentPage, hasMoreCards, isLoadingMore, searchQuery, loadCards]);


    // --- Effects ---

    // Effect for Initial Load / Stage Change
    // This effect now *only* triggers when the stage changes.
    // Search changes are handled by the debounced function triggering loadCards.
    useEffect(() => {
        console.log("Effect: Stage changed to", currentStage);
        setSearchQuery(''); // Clear search when stage changes
        setCurrentPage(1);
        setHasMoreCards(true);
        setCards([]); // Clear existing cards immediately for stage change
        setError(null); // Clear errors on stage change
        // Load the first page for the new stage
        // Wrap in timeout to allow state updates to settle? Might not be needed.
        // setTimeout(() => loadCards(1, false, ''), 0);
        loadCards(1, false, ''); // Load immediately
    }, [currentStage]); // Only depends on currentStage


    // Effect for Infinite Scroll Intersection Observer
    useEffect(() => {
        const currentRef = lastCardElementRef.current; // Capture ref value
        if (isLoadingMore || !hasMoreCards || !currentRef) {
            // If observer exists, disconnect it if we shouldn't be observing
            if (observerRef.current) {
                console.log("Disconnecting existing observer (isLoadingMore or !hasMoreCards)");
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            return;
        }

        // If observer doesn't exist, create it
        if (!observerRef.current) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !loadingRef.current) {
                    console.log("Intersection Observer: Last element visible, loading more...");
                    loadMoreCardsHandler();
                }
            }, {
                root: null,
                rootMargin: '0px 0px 300px 0px', // Load when 300px away from bottom
                threshold: 0.1
            });
             observer.observe(currentRef);
             observerRef.current = observer;
             console.log("Intersection Observer created and observing.");
        }

        // Cleanup function
        return () => {
            if (observerRef.current) {
                console.log("Disconnecting observer on cleanup.");
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [isLoadingMore, hasMoreCards, loadMoreCardsHandler]); // Dependencies determine when to re-setup observer


    // Effect for Loading Existing Deck (Keep as is)
    useEffect(() => {
        if (!deckIdParam) return;
        const loadExistingDeck = async () => {
             try {
                 setLoadingDeck(true);
                 setError(null); // Clear previous errors
                 const deck = await fetchDeckById(deckIdParam);
                 if (!deck) { setError('Deck not found'); return; }
                 resetDeck();
                 setDeckName(deck.name);
                 // Ensure leaders/base/cards are valid before adding
                 if (Array.isArray(deck.leaders)) deck.leaders.forEach(addLeader);
                 if (deck.base) setBaseContext(deck.base);
                 if (Array.isArray(deck.cards)) deck.cards.forEach(item => addCard(item.card));
                 contextSetCurrentStage('cards'); // Go to final stage after loading
             } catch (err: any) {
                 console.error('Error loading deck:', err);
                 setError(`Failed to load deck: ${err.message || 'Unknown error'}`);
             } finally {
                 setLoadingDeck(false);
             }
        };
        loadExistingDeck();
     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deckIdParam]); // Only run when deckIdParam changes (add context functions if needed, but avoid loops)

    // --- Client-Side Filtering (Memoized) ---
    const displayedCards = useMemo(() => {
        let filtered = cards;
        if (currentStage === 'cards' && hideCardsInDeck) {
            const deckCardIds = new Set(deckCards.map(dc => dc.card.id));
            filtered = filtered.filter(card => !deckCardIds.has(card.id));
        }
        if (currentStage === 'cards' && !showAllCards && leaders.length === 2 && base) {
            filtered = filtered.filter(card => isCardInAspect(card));
        }
        if (cardTypeFilter && cardTypeFilter !== 'All') {
            // Ensure type comparison is consistent (e.g., case-insensitive) if needed
            filtered = filtered.filter(card => card.type?.toLowerCase() === cardTypeFilter.toLowerCase());
        }
        console.log(`Memo: displayedCards updated. Input cards: ${cards.length}, Output: ${filtered.length}`);
        return filtered;
    }, [cards, hideCardsInDeck, deckCards, currentStage, showAllCards, leaders, base, cardTypeFilter, isCardInAspect]);

    // --- Other Handlers (Memoized for stability) ---
    const handleCardClick = useCallback((card: CardType) => {
        setSelectedCard(card);
        // Simplified: Only select card on click. Adding is done via button or double-click.
    }, []);

    const handleCardDoubleClick = useCallback((card: CardType) => {
        if (currentStage === 'leaders') {
             if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) addLeader(card);
        } else if (currentStage === 'base') {
             if (card.type === 'Base' && !base) setBaseContext(card);
        } else if (currentStage === 'cards') {
             if (!isCardIdInDeck(card.id)) addCard(card);
        }
    }, [currentStage, leaders, base, isCardIdInDeck, addLeader, setBaseContext, addCard]);

    const handleAddToDeck = useCallback((card: CardType) => {
        // Logic is the same as double-click for adding
        handleCardDoubleClick(card);
    }, [handleCardDoubleClick]);

    const handleRemoveFromDeck = useCallback((cardId: string) => {
        if (leaders.some(l => l.id === cardId)) removeLeader(cardId);
        else if (base?.id === cardId) setBaseContext(null);
        else removeCard(cardId);

        if (selectedCard?.id === cardId) setSelectedCard(null);
    }, [leaders, base, removeLeader, setBaseContext, removeCard, selectedCard]);

    // --- UI Rendering Logic (Memoized where applicable) ---
    const getStageInfo = useCallback(() => {
        switch (currentStage) {
            case 'leaders': return { title: 'Select Leaders', description: 'Choose two leaders.', progress: leaders.length / 2 };
            case 'base': return { title: 'Select Base', description: 'Choose a base.', progress: base ? 1 : 0 };
            case 'cards': return { title: 'Add Cards', description: 'Add cards to complete your deck (Twin Suns: 1 copy max).', progress: Math.min(deckCards.length / 50, 1) }; // Target 50 cards for Twin Suns
            default: return { title: 'Build Your Deck', description: 'Create a Twin Suns deck.', progress: 0 };
        }
    }, [currentStage, leaders.length, base, deckCards.length]);

    const stageInfo = getStageInfo();

    const renderLeaderSelectionArea = useCallback(() => (
          <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800 p-4">
                    <CardTitle className="text-xl">Selected Leaders ({leaders.length}/2)</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <LeaderSelection
                        leaders={leaders}
                        onRemoveLeader={handleRemoveFromDeck}
                        onSelectLeader={setSelectedCard} // Allow clicking selected leader to view details again
                    />
                    <div className="mt-6 flex justify-between">
                        <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                        <Button onClick={() => contextSetCurrentStage('base')} disabled={leaders.length !== 2} className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90 disabled:opacity-50">Next: Select Base</Button>
                    </div>
                </CardContent>
            </Card>
    ), [leaders, handleRemoveFromDeck, resetDeck, contextSetCurrentStage]);

    const renderBaseSelectionArea = useCallback(() => (
         <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800 p-4">
                    <CardTitle className="text-xl">Selected Base</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex justify-center mb-4 min-h-[200px]"> {/* Added min-height */}
                        {base ? (
                            <div className="relative max-w-xs group cursor-pointer" onClick={() => setSelectedCard(base)}>
                                <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500">
                                    {/* Image rendering */}
                                    {base.image_uri || base.image_url ? <img src={base.image_uri ?? base.image_url ?? ''} alt={base.name} className="w-full h-full object-contain"/> : <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="text-sm text-center p-2">{base.name}</span></div> }
                                </div>
                                <button className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => { e.stopPropagation(); handleRemoveFromDeck(base.id); }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <div className="mt-2 text-center"><h3 className="font-medium">{base.name}</h3></div>
                            </div>
                        ) : (
                            <div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-xs w-full text-gray-500">Select a Base</div>
                        )}
                    </div>
                    <div className="mt-6 flex justify-between">
                        <Button onClick={() => contextSetCurrentStage('leaders')} variant="outline">Back</Button>
                        <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                        <Button onClick={() => contextSetCurrentStage('cards')} disabled={!base} className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90 disabled:opacity-50">Next: Add Cards</Button>
                    </div>
                </CardContent>
            </Card>
    ), [base, handleRemoveFromDeck, resetDeck, contextSetCurrentStage]);

    const renderCardsSelectionArea = useCallback(() => (
           <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800 p-4">
                    <CardTitle className="text-xl">Your Deck ({deckCards.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {/* Deck Content Grid */}
                    {deckCards.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 gap-2"> {/* Added xl */}
                            {deckCards.map(({ card }, idx) => (
                                <div key={`deck-${card.id}-${idx}`} className="relative group cursor-pointer" onClick={() => setSelectedCard(card)}>
                                    <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors">
                                        {/* Image rendering */}
                                        {card.image_uri || card.image_url ? <img src={card.image_uri ?? card.image_url ?? ''} alt={card.name} className="w-full h-full object-contain"/> : <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="text-xs text-center p-1">{card.name}</span></div> }
                                         {/* Remove button */}
                                         <button className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => { e.stopPropagation(); handleRemoveFromDeck(card.id); }}>
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
                    <div className="mt-6 flex flex-wrap justify-between items-start gap-4">
                         <div>
                            <Button onClick={() => contextSetCurrentStage('base')} variant="outline" className="mr-2">Back</Button>
                            <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                        </div>
                        <Button onClick={() => setShowSaveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white" disabled={deckCards.length < 1}>Save Deck</Button> {/* Allow saving even empty decks? */}
                    </div>
                    {deckCards.length > 0 && (
                        <div className="mt-6"><DeckStats /></div>
                    )}
                </CardContent>
            </Card>
    ), [deckCards, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard]);


    // --- Main Return JSX ---

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
                     <div className="flex items-center mb-2">
                         <div className={`h-2 rounded-l-full w-1/3 transition-colors duration-300 ${currentStage === 'leaders' ? 'bg-purple-500' : (leaders.length === 2 ? 'bg-green-500' : 'bg-gray-700')}`}></div>
                         <div className={`h-2 w-1/3 transition-colors duration-300 ${currentStage === 'base' ? 'bg-purple-500' : (base ? 'bg-green-500' : 'bg-gray-700')}`}></div>
                         <div className={`h-2 rounded-r-full w-1/3 transition-colors duration-300 ${currentStage === 'cards' ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                     </div>
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
                                        {currentStage === 'leaders' ? 'Select Leaders' : currentStage === 'base' ? 'Select Base' : 'Add Cards'}
                                    </CardTitle>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Search all cards..."
                                            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-purple-500 focus:border-purple-500"
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                        />
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
                                    // Card Grid - Renders 'displayedCards'
                                     <div className="max-h-[60vh] overflow-y-auto p-4">
                                        <CardGrid
                                            key={`card-grid-${currentStage}-${searchQuery}`} // Key helps React reset grid if needed
                                            cards={displayedCards}
                                            onCardClick={handleCardClick}
                                            onDoubleClick={handleCardDoubleClick}
                                            selectedCardId={selectedCard?.id}
                                            isCompatible={isCardInAspect}
                                            isInDeck={isCardIdInDeck}
                                            currentStage={currentStage}
                                            // hideCardsInDeck is applied via displayedCards now
                                        />
                                        {/* Intersection Observer Trigger Element */}
                                        {/* Render this element only if there might be more cards */}
                                        {hasMoreCards && displayedCards.length > 0 && (
                                            <div ref={lastCardElementRef} style={{ height: '10px', background: 'transparent' }} />
                                        )}
                                    </div>
                                )}
                                {/* Load More Button (Fallback or Manual Trigger) */}
                                {/* Only show if there are more pages and not currently loading */}
                                {hasMoreCards && !loading && !isLoadingMore && displayedCards.length > 0 && (
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
                           <CardHeader className="border-b border-gray-800 p-4"> {/* Ensure padding */}
                                <CardTitle className="text-xl">Card Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0"> {/* Remove padding here to let CardDetail handle it */}
                                {selectedCard ? (
                                    <MemoizedCardDetail
                                        key={selectedCard.id} // Key for memoization
                                        card={selectedCard}
                                        onAddToDeck={handleAddToDeck}
                                        onRemoveFromDeck={handleRemoveFromDeck}
                                        isInDeck={isCardIdInDeck(selectedCard.id)}
                                        isCompatible={currentStage === 'cards' ? isCardInAspect(selectedCard) : true}
                                        currentStage={currentStage}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center p-4 text-gray-500"> {/* Add padding */}
                                        Select a card to view details
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
                    setShowSaveDialog(false);
                    router.push('/profile'); // Or redirect to the specific deck page: `/decks/${deckId}`
                }}
            />
        </div>
    );
}