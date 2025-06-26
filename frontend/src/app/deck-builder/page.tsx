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
import { Card as CardType, FetchCardsParams, fetchCards, SavedDeck } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { debounce } from 'lodash-es';
import { fetchWithAuth } from '@/lib/fetch-utils';

// Type for individual items in the deck's card list from context/backend
interface DeckCardItem {
    card: CardType;
    quantity: number;
}

// Constants
const SEARCH_DEBOUNCE_MS = 400;
const CARDS_PER_PAGE = 50;
const LOOP_CHECK_WINDOW_MS = 3000;
const MAX_VISITS_IN_WINDOW = 10;

// Memoized CardDetail component
const MemoizedCardDetail = React.memo(CardDetail);

export default function DeckBuilder() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deckIdParam = searchParams.get('deckId');

    // --- State ---
    const [isPotentialLoop, setIsPotentialLoop] = useState(false);
    const [cards, setCards] = useState<CardType[]>([]);
    const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
    const [loading, setLoading] = useState(!deckIdParam);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadingDeck, setLoadingDeck] = useState(!!deckIdParam);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cardTypeFilter, setCardTypeFilter] = useState<string>('');
    const [showAllCards, setShowAllCards] = useState<boolean>(false);
    const [hideCardsInDeck, setHideCardsInDeck] = useState(true);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMoreCards, setHasMoreCards] = useState(true);
    const [deckLoaded, setDeckLoaded] = useState(false);

    // --- Refs ---
    const loadingRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const lastCardElementRef = useRef<HTMLDivElement | null>(null);
    const cardLoadingStageRef = useRef<string | null>(null);

    // --- Deck Builder Context ---
    const {
        currentStage, leaders, base, deckCards, deckName,
        addLeader, removeLeader, setBase: setBaseContext, addCard, removeCard,
        setDeckName, isCardInDeck: isCardIdInDeck, isCardInAspect, resetDeck,
        setCurrentStage: contextSetCurrentStage
    } = useDeckBuilder();

    // --- Loop Detection Effect ---
    useEffect(() => {
        const visitTimestamp = Date.now();
        let visitHistory: number[] = [];
        try { 
            visitHistory = JSON.parse(sessionStorage.getItem('deckBuilderVisitHistory') || '[]'); 
        } catch (e) { 
            console.error("Failed to parse deckBuilderVisitHistory, resetting.", e); 
            visitHistory = []; 
        }

        const recentVisits = visitHistory.filter((ts: number) => visitTimestamp - ts < LOOP_CHECK_WINDOW_MS);
        recentVisits.push(visitTimestamp);
        sessionStorage.setItem('deckBuilderVisitHistory', JSON.stringify(recentVisits));

        if (recentVisits.length > MAX_VISITS_IN_WINDOW) {
            console.error(`[DEBUG] Potential Loop Detected: ${recentVisits.length} renders in ${LOOP_CHECK_WINDOW_MS}ms. Halting potentially problematic operations.`);
            setIsPotentialLoop(true);
            sessionStorage.removeItem('deckBuilderVisitHistory');
            sessionStorage.removeItem('editingDeck');
            sessionStorage.removeItem('lastEditAttempt');
            sessionStorage.removeItem('processedDeckId');
        }
        
        const clearTimer = setTimeout(() => {
            let currentHistory: number[] = [];
            try { 
                currentHistory = JSON.parse(sessionStorage.getItem('deckBuilderVisitHistory') || '[]'); 
            } catch {}
            const lastVisit = currentHistory[currentHistory.length - 1];
            if (lastVisit && Date.now() - lastVisit > LOOP_CHECK_WINDOW_MS) { 
                sessionStorage.removeItem('deckBuilderVisitHistory'); 
            }
        }, LOOP_CHECK_WINDOW_MS + 2000);
        
        return () => clearTimeout(clearTimer);
    }, []);

    // --- Load Cards Function ---
    const loadCards = useCallback(async (page = 1, append = false, currentSearch = searchQuery) => {
        if (loadingRef.current || (append && !hasMoreCards)) return;
        loadingRef.current = true;
        setError(null);
        
        if (page === 1 && !append) setLoading(true); 
        else if (append) setIsLoadingMore(true);
        
        console.log(`[API] Fetching cards: Stage=${currentStage}, Page=${page}, Append=${append}, Search='${currentSearch}'`);
        
        const params: FetchCardsParams = { 
            page: page.toString(), 
            limit: CARDS_PER_PAGE.toString(), 
            search: currentSearch || undefined 
        };
        
        if (currentStage === 'leaders') params.type = 'Leader';
        else if (currentStage === 'base') params.type = 'Base';
        else if (currentStage === 'cards') params.not_type = 'Leader,Base';
        
        try {
            const response = await fetchCards(params);
            const newCards = Array.isArray(response.data) ? response.data : [];
            const meta = response.meta || { pages: 1, total: newCards.length };
            
            setCards(prev => append ? [...prev, ...newCards] : newCards);
            setTotalPages(meta.pages || 1);
            setHasMoreCards((meta.pages || 1) > page);
            setCurrentPage(page);
            
            console.log(`[API] Successfully loaded ${newCards.length} cards for stage '${currentStage}'`);
        } catch (err) {
            console.error(`[API] Failed to load cards:`, err);
            setError(`Failed to load cards: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
            loadingRef.current = false;
        }
    }, [currentStage, searchQuery, hasMoreCards]);

    // --- Load Existing Deck Effect ---
    useEffect(() => {
        if (!deckIdParam || isPotentialLoop) { 
            console.log('[DEBUG] loadExistingDeck Effect: No deckIdParam or potential loop detected. Skipping.'); 
            setLoadingDeck(false); 
            return; 
        }
        
        const processedDeckId = sessionStorage.getItem('processedDeckId');
        
        if (processedDeckId && processedDeckId !== deckIdParam) {
            console.log(`[DEBUG] New deck ID detected (${deckIdParam}). Clearing processed flag for ${processedDeckId}.`);
            sessionStorage.removeItem('processedDeckId');
        } else if (processedDeckId === deckIdParam) {
            console.log('[DEBUG] loadExistingDeck Effect: Already processed this deck ID, skipping reload.');
            setLoadingDeck(false);
            if (currentStage !== 'cards') { 
                contextSetCurrentStage('cards'); 
            }
            return;
        }

        console.log('[DEBUG] loadExistingDeck Effect: Starting load for deck ID:', deckIdParam);

        const loadExistingDeck = async () => {
            setLoadingDeck(true); 
            setError(null);
            
            try {
                sessionStorage.setItem('processedDeckId', deckIdParam);
                let attempts = 0; 
                const maxAttempts = 3; 
                let deckData: SavedDeck | null = null;

                while (attempts < maxAttempts && !deckData) {
                    attempts++;
                    try {
                        console.log(`[API] Load Deck Attempt ${attempts} for deck: ${deckIdParam}`);
                        const fetchedData = await fetchWithAuth(`/api/me/decks/${encodeURIComponent(deckIdParam)}`);
                        console.log('[DEBUG] loadExistingDeck: Received raw data:', JSON.stringify(fetchedData, null, 2));

                        // Validate the fetched data structure
                        if (fetchedData && 
                            typeof fetchedData === 'object' && 
                            fetchedData.id === deckIdParam && 
                            Array.isArray(fetchedData.leaders) && 
                            Array.isArray(fetchedData.cards)) {
                            deckData = fetchedData as SavedDeck;
                            break;
                        } else {
                            throw new Error('Invalid or incomplete deck data received from server.');
                        }
                    } catch (fetchError: any) {
                        console.error(`[Error] Fetch attempt ${attempts} failed:`, fetchError);
                        if (attempts === maxAttempts) throw fetchError;
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    }
                }

                // Process deckData if fetch succeeded
                if (deckData) {
                    console.log('[DEBUG] loadExistingDeck: Fetch successful. Updating context state...');
                    console.log('[DEBUG] loadExistingDeck: Context state BEFORE:', { 
                        name: deckName, 
                        leaders: leaders.length, 
                        base: !!base, 
                        cards: deckCards.length, 
                        stage: currentStage 
                    });
                    
                    resetDeck();
                    setDeckName(deckData.name || "Untitled Deck");
                    
                    // Add Leaders - deckData.leaders is already an array of Card objects
                    if (Array.isArray(deckData.leaders)) {
                        deckData.leaders.forEach((leader: CardType) => { 
                            if (leader?.id) {
                                addLeader(leader); 
                            } else {
                                console.error("[DEBUG] Invalid leader format:", leader); 
                            }
                        });
                    }
                    
                    // Set Base - deckData.base is already a Card object or null
                    if (deckData.base?.id) { 
                        setBaseContext(deckData.base); 
                    } else { 
                        setBaseContext(null); 
                    }
                    
                    // Add Cards - need to handle the backend format
                    if (Array.isArray(deckData.cards)) {
                        deckData.cards.forEach((cardItem: {card_id: string, quantity: number, card?: CardType}) => { 
                            // Use the embedded card data if available
                            if (cardItem.card?.id) {
                                addCard(cardItem.card); 
                            } else {
                                console.error("[DEBUG] Invalid card format - missing card data:", cardItem); 
                            }
                        });
                    }
                    
                    contextSetCurrentStage('cards');
                    console.log("[DEBUG] loadExistingDeck: Context updated and stage set to 'cards'");
                    setDeckLoaded(true);
                    
                    setTimeout(() => { 
                        console.log('[DEBUG] loadExistingDeck: Context state AFTER (delayed):', { 
                            name: deckName, 
                            leaders: leaders.length, 
                            base: !!base, 
                            cards: deckCards.length, 
                            stage: currentStage 
                        }); 
                    }, 100);
                } else {
                    throw new Error("Failed to fetch valid deck data after multiple attempts.");
                }
            } catch (err) {
                console.error('[DEBUG] Final error in loadExistingDeck process:', err);
                if (err instanceof Error && err.message?.includes('(401)')) { 
                    setError('Unauthorized loading deck. Please log in again.'); 
                } else { 
                    setError(`Failed to load deck: ${err instanceof Error ? err.message : 'Unknown error'}`); 
                }
                sessionStorage.removeItem('processedDeckId');
                setDeckLoaded(false);
            } finally {
                setLoadingDeck(false);
            }
        };
        
        loadExistingDeck();

        return () => { 
            console.log('[DEBUG] Cleanup for loadExistingDeck effect'); 
        };
    }, [deckIdParam, isPotentialLoop, resetDeck, setDeckName, addLeader, setBaseContext, addCard, contextSetCurrentStage]);

    // --- Load Cards Effect ---
    useEffect(() => {
        if (isPotentialLoop) return;
        
        const stageKey = `${currentStage}-${searchQuery}`;
        if (cardLoadingStageRef.current === stageKey) return;
        
        cardLoadingStageRef.current = stageKey;
        console.log(`[Cards] Loading cards for stage: ${currentStage}, search: "${searchQuery}"`);
        
        setCards([]);
        setCurrentPage(1);
        setHasMoreCards(true);
        loadCards(1, false, searchQuery);
    }, [currentStage, searchQuery, loadCards, isPotentialLoop]);

    // --- Debounced Search ---
    const debouncedSearch = useMemo(
        () => debounce((query: string) => {
            console.log(`[Search] Debounced search triggered: "${query}"`);
            setSearchQuery(query);
        }, SEARCH_DEBOUNCE_MS),
        []
    );

    // --- Event Handlers ---

    
    const handleCardClick = useCallback((card: CardType) => { 
        setSelectedCard(card); 
    }, []);

    const handleCardDoubleClick = useCallback((card: CardType) => {
        if (currentStage === 'leaders') { 
            if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) {
                addLeader(card); 
            }
        } else if (currentStage === 'base') { 
            if (card.type === 'Base' && !base) {
                setBaseContext(card); 
            }
        } else if (currentStage === 'cards') { 
            if (!isCardIdInDeck(card.id)) {
                addCard(card); 
            }
        }
    }, [currentStage, leaders, base, addLeader, setBaseContext, addCard, isCardIdInDeck]);

    const handleAddToDeck = useCallback((card: CardType) => { 
        handleCardDoubleClick(card); 
    }, [handleCardDoubleClick]);


    const handleRemoveFromDeck = useCallback((cardId: string) => {
        if (leaders.some(l => l.id === cardId)) {
            removeLeader(cardId);
        } else if (base?.id === cardId) {
            setBaseContext(null);
        } else {
            removeCard(cardId);
        }
        if (selectedCard?.id === cardId) {
            setSelectedCard(null);
        }
    }, [leaders, base, removeLeader, setBaseContext, removeCard, selectedCard]);

    const loadMoreCardsHandler = useCallback(() => {
        if (hasMoreCards && !isLoadingMore) {
            loadCards(currentPage + 1, true, searchQuery);
        }
    }, [hasMoreCards, isLoadingMore, currentPage, searchQuery, loadCards]);

    // --- Client-Side Filtering ---
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
            filtered = filtered.filter(card => card.type?.toLowerCase() === cardTypeFilter.toLowerCase()); 
        }
        
        return filtered;
    }, [cards, hideCardsInDeck, deckCards, currentStage, showAllCards, leaders, base, cardTypeFilter, isCardInAspect]);

    // --- UI Helper Functions ---
    const getStageInfo = useCallback(() => {
        switch (currentStage) {
            case 'leaders': 
                return { title: 'Select Leaders', description: 'Choose two leaders for your deck.' };
            case 'base': 
                return { title: 'Select Base', description: 'Choose a base for your deck.' };
            case 'cards': 
                return { title: 'Add Cards', description: 'Add cards to your deck.' };
            default: 
                return { title: 'Deck Builder', description: 'Build your deck.' };
        }
    }, [currentStage]);

    // --- Render Functions ---
    const renderLeaderSelectionArea = useCallback(() => (
        <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 p-4">
                <CardTitle className="text-xl">Your Leaders ({leaders.length}/2)</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {leaders.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {leaders.map((leader) => (
                            <div key={`leader-${leader.id}`} className="relative max-w-xs group cursor-pointer" onClick={() => setSelectedCard(leader)}>
                                <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500 bg-gray-800">
                                    <img 
                                        src={leader.image_uri ?? leader.image_url ?? '/placeholder-card.png'} 
                                        alt={leader.name} 
                                        className="w-full h-full object-contain" 
                                        onError={(e) => { 
                                            const target = e.target as HTMLImageElement; 
                                            target.src = '/placeholder-card.png'; 
                                        }}
                                    />
                                </div>
                                <button 
                                    className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        handleRemoveFromDeck(leader.id); 
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <div className="mt-2 text-center">
                                    <h3 className="font-medium truncate" title={leader.name}>{leader.name}</h3>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-500">
                        Select two leaders from the cards above.
                    </div>
                )}
                <div className="mt-6 flex justify-between">
                    <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                    <Button 
                        onClick={() => contextSetCurrentStage('base')} 
                        disabled={leaders.length !== 2} 
                        className="bg-gradient-to-r from-purple-600 to-purple-400 text-white hover:opacity-90 disabled:opacity-50"
                    >
                        Next: Select Base
                    </Button>
                </div>
            </CardContent>
        </Card>
    ), [leaders, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard]);

    const renderBaseSelectionArea = useCallback(() => (
        <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 p-4">
                <CardTitle className="text-xl">Your Base</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <div className="flex justify-center">
                    {base ? (
                        <div className="relative max-w-xs group cursor-pointer" onClick={() => setSelectedCard(base)}>
                            <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500 bg-gray-800">
                                <img 
                                    src={base.image_uri ?? base.image_url ?? '/placeholder-card.png'} 
                                    alt={base.name} 
                                    className="w-full h-full object-contain" 
                                    onError={(e) => { 
                                        const target = e.target as HTMLImageElement; 
                                        target.src = '/placeholder-card.png'; 
                                    }}
                                />
                            </div>
                            <button 
                                className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleRemoveFromDeck(base.id); 
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="mt-2 text-center">
                                <h3 className="font-medium truncate" title={base.name}>{base.name}</h3>
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-xs w-full text-gray-500">
                            Select a Base
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-between">
                    <Button onClick={() => contextSetCurrentStage('leaders')} variant="outline">Back</Button>
                    <Button onClick={resetDeck} variant="destructive">Reset Deck</Button>
                    <Button 
                        onClick={() => contextSetCurrentStage('cards')} 
                        disabled={!base} 
                        className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90 disabled:opacity-50"
                    >
                        Next: Add Cards
                    </Button>
                </div>
            </CardContent>
        </Card>
    ), [base, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard]);

    const renderCardsSelectionArea = useCallback(() => (
        <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 p-4">
                <CardTitle className="text-xl">Your Deck ({deckCards.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {deckCards.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 gap-2">
                        {deckCards.map((item: DeckCardItem) => { 
                            const card = item.card; 
                            if (!card) return null; 
                            return (
                                <div key={`deck-${card.id}`} className="relative group cursor-pointer" onClick={() => setSelectedCard(card)}>
                                    <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors bg-gray-800">
                                        <img 
                                            src={card.image_uri ?? card.image_url ?? '/placeholder-card.png'} 
                                            alt={card.name} 
                                            className="w-full h-full object-contain" 
                                            onError={(e) => { 
                                                const target = e.target as HTMLImageElement; 
                                                target.src = '/placeholder-card.png'; 
                                            }}
                                        />
                                        <button 
                                            className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleRemoveFromDeck(card.id); 
                                            }}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1 truncate">
                                            {card.name}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-500">
                        Add cards to your deck.
                    </div>
                )}
                <div className="mt-6 flex flex-wrap justify-between items-start gap-4">
                    <div>
                        <Button onClick={() => contextSetCurrentStage('base')} variant="outline" className="mr-2">
                            Back
                        </Button>
                        <Button onClick={resetDeck} variant="destructive">
                            Reset Deck
                        </Button>
                    </div>
                    <Button 
                        onClick={() => setShowSaveDialog(true)} 
                        className="bg-green-600 hover:bg-green-700 text-white" 
                        disabled={leaders.length !== 2 || !base}
                    >
                        Save Deck
                    </Button>
                </div>
                {(leaders.length > 0 || base || deckCards.length > 0) && (
                    <div className="mt-6">
                        <DeckStats />
                    </div>
                )}
            </CardContent>
        </Card>
    ), [deckCards, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard, leaders, base]);

    // --- Main Component Return ---
    if (isPotentialLoop) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
                <div className="text-center bg-red-900/50 border border-red-500 p-6 rounded-lg max-w-md">
                    <h2 className="text-2xl text-red-300 mb-4">Potential Loop Detected</h2>
                    <p className="text-red-200 mb-4">
                        Too many rapid page renders occurred. Deck loading has been halted to prevent issues.
                    </p>
                    <Button 
                        onClick={() => {
                            sessionStorage.clear();
                            window.location.reload();
                        }} 
                        variant="outline" 
                        className="border-red-400 text-red-300 hover:bg-red-900/50"
                    >
                        Clear Cache & Reload
                    </Button>
                </div>
            </div>
        );
    }

    const stageInfo = getStageInfo();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
            <div className="container mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent">
                        Twin Suns Deck Builder
                    </h1>
                    <p className="text-gray-400 mt-2">{stageInfo.description}</p>
                    {error && (
                        <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
                            <p className="text-red-300">{error}</p>
                            <Button 
                                onClick={() => setError(null)} 
                                variant="outline" 
                                size="sm" 
                                className="mt-2 border-red-400 text-red-300"
                            >
                                Dismiss
                            </Button>
                        </div>
                    )}
                </div>

                {/* Loading Deck State */}
                {loadingDeck && (
                    <div className="mb-6 p-4 bg-purple-900/50 border border-purple-500 rounded-lg">
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400 mr-3"></div>
                            <span className="text-purple-300">Loading deck...</span>
                        </div>
                    </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Card Browser and Stage Selection */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Card Browser */}
                        <Card className="bg-gray-900 border-gray-800">
                            <CardHeader className="border-b border-gray-800 p-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                    <CardTitle className="text-xl">{stageInfo.title}</CardTitle>
                                    
                                    {/* Search and Filters */}
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                        {/* Search */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search cards..."
                                                className="w-full sm:w-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                onChange={(e) => debouncedSearch(e.target.value)}
                                            />
                                        </div>
                                        
                                        {/* Type Filter */}
                                        {currentStage === 'cards' && (
                                            <select
                                                value={cardTypeFilter}
                                                onChange={(e) => setCardTypeFilter(e.target.value)}
                                                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            >
                                                <option value="">All Types</option>
                                                <option value="Unit">Units</option>
                                                <option value="Event">Events</option>
                                                <option value="Upgrade">Upgrades</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Stage Controls */}
                                {currentStage === 'cards' && (
                                    <div className="flex flex-wrap gap-4 items-center mt-4">
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="show-all-cards"
                                                checked={showAllCards}
                                                onCheckedChange={setShowAllCards}
                                            />
                                            <Label htmlFor="show-all-cards" className="text-sm text-gray-300">
                                                Show all cards (ignore aspects)
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="hide-cards-in-deck"
                                                checked={hideCardsInDeck}
                                                onCheckedChange={setHideCardsInDeck}
                                            />
                                            <Label htmlFor="hide-cards-in-deck" className="text-sm text-gray-300">
                                                Hide cards already in deck
                                            </Label>
                                        </div>
                                    </div>
                                )}
                            </CardHeader>
                            
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="h-96 flex items-center justify-center text-purple-400">
                                        Loading available cards...
                                    </div>
                                ) : displayedCards.length === 0 && !loading ? (
                                    <div className="h-96 flex items-center justify-center text-gray-400 p-4 text-center">
                                        {searchQuery ? 
                                            `No cards found matching "${searchQuery}".` : 
                                            `No ${currentStage === 'leaders' ? 'leaders' : currentStage === 'base' ? 'bases' : 'cards'} available for this stage.`
                                        }
                                    </div>
                                ) : (
                                    <div className="max-h-[60vh] overflow-y-auto p-4">
                                        <CardGrid 
                                            key={`card-grid-${currentStage}-${searchQuery}-${cardTypeFilter}-${showAllCards}-${hideCardsInDeck}`} 
                                            cards={displayedCards} 
                                            onCardClick={handleCardClick}
                                            onDoubleClick={handleCardDoubleClick}
                                            selectedCardId={selectedCard?.id} 
                                            isCompatible={isCardInAspect} 
                                            isInDeck={isCardIdInDeck} 
                                            currentStage={currentStage} 
                                        />
                                        {hasMoreCards && displayedCards.length > 0 && (
                                            <div ref={lastCardElementRef} style={{ height: '10px', background: 'transparent' }} />
                                        )}
                                    </div>
                                )}
                                
                                {hasMoreCards && !loading && displayedCards.length > 0 && (
                                    <div className="p-4 flex justify-center border-t border-gray-800">
                                        <Button 
                                            onClick={loadMoreCardsHandler} 
                                            variant="outline" 
                                            disabled={isLoadingMore} 
                                            className="bg-gray-800 hover:bg-gray-700 text-white"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                                    Loading...
                                                </>
                                            ) : (
                                                'Load More'
                                            )}
                                        </Button>
                                    </div>
                                )}
                                
                                {!loading && !hasMoreCards && cards.length > 0 && (
                                    <div className="p-4 text-center text-gray-500 text-sm border-t border-gray-800">
                                        End of results.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Stage-specific Selection Areas */}
                        {currentStage === 'leaders' && renderLeaderSelectionArea()}
                        {currentStage === 'base' && renderBaseSelectionArea()}
                        {currentStage === 'cards' && renderCardsSelectionArea()}
                    </div>

                    {/* Right Column: Card Detail */}
                    <div className="lg:col-span-1">
                        <Card className="bg-gray-900 border-gray-800 h-full sticky top-24">
                            <CardHeader className="border-b border-gray-800 p-4">
                                <CardTitle className="text-xl">Card Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[calc(100vh-10rem)] overflow-y-auto">
                                {selectedCard ? (
                                    <MemoizedCardDetail 
                                        key={selectedCard.id} 
                                        card={selectedCard} 
                                        onAddToDeck={handleAddToDeck} 
                                        onRemoveFromDeck={handleRemoveFromDeck} 
                                        isInDeck={isCardIdInDeck(selectedCard.id)} 
                                        isCompatible={currentStage === 'cards' ? isCardInAspect(selectedCard) : true}
                                        currentStage={currentStage}
                                    />
                                ) : (
                                    <div className="p-6 text-center text-gray-400">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-medium mb-2">No Card Selected</h3>
                                        <p>Click on a card to view its details</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Save Deck Dialog */}
            <SaveDeckDialog
                isOpen={showSaveDialog}
                onClose={() => setShowSaveDialog(false)}
                onSuccess={(deckId) => {
                    setShowSaveDialog(false);
                    router.push(`/profile`);
                }}
            />
        </div>
    );
}