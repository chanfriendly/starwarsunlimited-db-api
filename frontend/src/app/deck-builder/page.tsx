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
// Assuming Card and SavedDeck types are correctly defined and exported from lib/api
import { Card as CardType, FetchCardsParams, fetchCards, SavedDeck } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { debounce } from 'lodash-es';
// Import the authenticated fetch utility
import { fetchWithAuth } from '@/lib/fetch-utils'; // <<< IMPORT fetchWithAuth

// --- Define Interface for Loaded Deck Data ---
// Using SavedDeck imported from lib/api as the structure for loaded deck data
type LoadedDeckData = SavedDeck;

// Type for individual items in the deck's card list from context/backend
// Ensure this matches how deckCards is structured in your context AND backend response
interface DeckCardItem {
    card: CardType;
    quantity: number;
}

// Add this flag outside the component to prevent excessive API calls
let isLoadingDeckData = false;

// Constants
const SEARCH_DEBOUNCE_MS = 400;
const CARDS_PER_PAGE = 50;
const LOOP_CHECK_WINDOW_MS = 3000;
const MAX_VISITS_IN_WINDOW = 10;

// Memoized CardDetail component
const MemoizedCardDetail = React.memo(CardDetail);

// --- DeckBuilder Component ---
export default function DeckBuilder() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deckIdParam = searchParams.get('deckId');

    // --- State ---
    const [isPotentialLoop, setIsPotentialLoop] = useState(false);
    const [cards, setCards] = useState<CardType[]>([]); // Cards for browsing
    const [selectedCard, setSelectedCard] = useState<CardType | null>(null); // Detail view
    const [loading, setLoading] = useState(!deckIdParam); // Loading card browser state
    const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading more cards state
    const [loadingDeck, setLoadingDeck] = useState(!!deckIdParam); // Loading existing deck state
    const [error, setError] = useState<string | null>(null); // Error message state
    const [searchQuery, setSearchQuery] = useState<string>(''); // Search input
    const [cardTypeFilter, setCardTypeFilter] = useState<string>(''); // Type filter dropdown
    const [showAllCards, setShowAllCards] = useState<boolean>(false); // Aspect toggle
    const [hideCardsInDeck, setHideCardsInDeck] = useState(true); // Hide added cards toggle
    const [showSaveDialog, setShowSaveDialog] = useState(false); // Save dialog visibility
    const [currentPage, setCurrentPage] = useState(1); // Card browser pagination
    const [totalPages, setTotalPages] = useState(1);
    const [hasMoreCards, setHasMoreCards] = useState(true);

    // --- Refs ---
    const loadingRef = useRef(false); // Prevent concurrent card loads
    const observerRef = useRef<IntersectionObserver | null>(null); // Infinite scroll
    const lastCardElementRef = useRef<HTMLDivElement | null>(null); // Trigger element

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
        try { visitHistory = JSON.parse(sessionStorage.getItem('deckBuilderVisitHistory') || '[]'); }
        catch (e) { console.error("Failed to parse deckBuilderVisitHistory, resetting.", e); visitHistory = []; }

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
             try { currentHistory = JSON.parse(sessionStorage.getItem('deckBuilderVisitHistory') || '[]'); } catch {}
             const lastVisit = currentHistory[currentHistory.length - 1];
             if (lastVisit && Date.now() - lastVisit > LOOP_CHECK_WINDOW_MS) { sessionStorage.removeItem('deckBuilderVisitHistory'); }
         }, LOOP_CHECK_WINDOW_MS + 2000);
        return () => clearTimeout(clearTimer);
    }, []);

    // --- Callbacks for Card Browser ---
    const loadCards = useCallback(async (page = 1, append = false, currentSearch = searchQuery) => {
        if (loadingRef.current || (append && !hasMoreCards)) return;
        loadingRef.current = true;
        setError(null);
        if (page === 1 && !append) setLoading(true); else if (append) setIsLoadingMore(true);
        console.log(`[API] Fetching cards: Stage=${currentStage}, Page=${page}, Append=${append}, Search='${currentSearch}'`);
        const params: FetchCardsParams = { page: page.toString(), limit: CARDS_PER_PAGE.toString(), search: currentSearch || undefined, };
        if (currentStage === 'leaders') params.type = 'Leader';
        else if (currentStage === 'base') params.type = 'Base';
        else if (currentStage === 'cards') params.not_type = 'Leader,Base';
        try {
            const response = await fetchCards(params); // Using public fetchCards from api.ts
            const newCards = Array.isArray(response.data) ? response.data : [];
            const meta = response.meta || { pages: 1, total: newCards.length };
            setCards(prev => append ? [...prev, ...newCards] : newCards);
            setTotalPages(meta.pages || 1);
            setHasMoreCards(page < (meta.pages || 1));
            setCurrentPage(page);
        } catch (err: any) {
            console.error(`[Error] Failed loading cards (page ${page}):`, err);
            setError(`Failed to load cards: ${err.message || 'Network error'}`);
            setHasMoreCards(false);
        } finally {
            setLoading(false); setIsLoadingMore(false); loadingRef.current = false;
        }
    }, [currentStage, searchQuery, hasMoreCards]);

    const debouncedLoadCardsSearch = useCallback(debounce((query: string) => {
        console.log("[Search] Debounced search executing for:", query);
        setCurrentPage(1); setHasMoreCards(true); loadCards(1, false, query);
    }, SEARCH_DEBOUNCE_MS), [loadCards]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value; setSearchQuery(query); debouncedLoadCardsSearch(query);
    }, [debouncedLoadCardsSearch]);

    const loadMoreCardsHandler = useCallback(() => {
        if (hasMoreCards && !isLoadingMore && !loadingRef.current) {
            const nextPage = currentPage + 1; loadCards(nextPage, true, searchQuery);
        }
    }, [currentPage, hasMoreCards, isLoadingMore, searchQuery, loadCards]);

    // --- Effect for Initial Card Load / Stage Change (When NOT Editing) ---
    useEffect(() => {
        if (!deckIdParam && !isPotentialLoop) {
             console.log("Effect: Stage changed to", currentStage, "(Not editing/no loop)");
             setSearchQuery(''); setCurrentPage(1); setHasMoreCards(true); setCards([]); setError(null);
             loadCards(1, false, ''); // Load initial cards for the stage
        } else if (deckIdParam) { console.log("Effect: Stage Change - Deferred to loadExistingDeck effect."); }
        else if (isPotentialLoop) { console.warn("Effect: Stage Change - Halted due to potential loop detection."); }
     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStage, deckIdParam, isPotentialLoop]);

    // --- Effect for Infinite Scroll ---
    useEffect(() => {
        const currentObserverTarget = lastCardElementRef.current;
        if (isLoadingMore || !hasMoreCards || !currentObserverTarget) { /* ... disconnect observer ... */
             if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; } return;
        }
        if (!observerRef.current) {
            const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && !loadingRef.current) { loadMoreCardsHandler(); } },
                { rootMargin: '0px 0px 300px 0px', threshold: 0.1 });
            observer.observe(currentObserverTarget); observerRef.current = observer;
        }
        return () => { if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; } };
    }, [isLoadingMore, hasMoreCards, loadMoreCardsHandler]);

    // --- Effect for Loading Existing Deck (Corrected) ---
    useEffect(() => {
        // Pre-checks
        if (!deckIdParam) { setLoadingDeck(false); return; }
        if (isPotentialLoop) { console.warn('[DEBUG] loadExistingDeck Effect: Skipped due to potential loop detection.'); setError("Edit load cancelled due to rapid renders. Please try refreshing."); setLoadingDeck(false); return; }
        const processedDeckId = sessionStorage.getItem('processedDeckId');
        // Clear processed ID if it's different from the current param
        if (processedDeckId && processedDeckId !== deckIdParam) {
            console.log(`[DEBUG] New deck ID detected (${deckIdParam}). Clearing processed flag for ${processedDeckId}.`);
            sessionStorage.removeItem('processedDeckId');
        } else if (processedDeckId === deckIdParam) {
             console.log('[DEBUG] loadExistingDeck Effect: Already processed this deck ID, skipping reload.');
             setLoadingDeck(false);
             // Still ensure stage is correct, context might have been reset elsewhere
             if (currentStage !== 'cards') { contextSetCurrentStage('cards'); }
             return;
        }

        console.log('[DEBUG] loadExistingDeck Effect: Starting load for deck ID:', deckIdParam);

        const loadExistingDeck = async () => {
            setLoadingDeck(true); setError(null);
            try {
                sessionStorage.setItem('processedDeckId', deckIdParam); // Mark as processing *now*
                let attempts = 0; const maxAttempts = 3; let deckData: LoadedDeckData | null = null;

                while (attempts < maxAttempts && !deckData) {
                    attempts++;
                    try {
                        console.log(`[API] Load Deck Attempt ${attempts} for deck: ${deckIdParam}`);
                        // *** USE fetchWithAuth ***
                        console.log('[DeckBuilder] Calling fetchWithAuth for deck ID:', deckIdParam);
                        // fetchWithAuth returns parsed data (SavedDeck/LoadedDeckData) or throws error
                        const fetchedData = await fetchWithAuth(
                            `/api/me/get-deck?id=${encodeURIComponent(deckIdParam)}`
                        );
                        // *** END USE fetchWithAuth ***

                        console.log('[DEBUG] loadExistingDeck: Received raw data:', JSON.stringify(fetchedData, null, 2));

                        // Basic validation (structure check)
                        if (fetchedData && typeof fetchedData === 'object' && fetchedData.id === deckIdParam && Array.isArray(fetchedData.leaders) && typeof fetchedData.base !== 'undefined' && Array.isArray(fetchedData.cards)) {
                            deckData = fetchedData as LoadedDeckData; // Assert type
                            break; // Success
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
                    console.log('[DEBUG] loadExistingDeck: Context state BEFORE:', { name: deckName, leaders: leaders.length, base: !!base, cards: deckCards.length, stage: currentStage });
                    resetDeck();
                    setDeckName(deckData.name || "Untitled Deck");
                    // Add Leaders, Base, Cards using context functions
                    deckData.leaders.forEach((leader: CardType) => { if (leader?.id) addLeader(leader); else console.error("[DEBUG] Invalid leader format:", leader); });
                    if (deckData.base?.id) { setBaseContext(deckData.base); } else { setBaseContext(null); }
                    deckData.cards.forEach((item: DeckCardItem) => { if (item?.card?.id) addCard(item.card); else console.error("[DEBUG] Invalid card format:", item); });
                    contextSetCurrentStage('cards'); // Set stage last
                    console.log("[DEBUG] loadExistingDeck: Context updated and stage set to 'cards'");
                    setTimeout(() => { console.log('[DEBUG] loadExistingDeck: Context state AFTER (delayed):', { name: deckName, leaders: leaders.length, base: !!base, cards: deckCards.length, stage: currentStage }); }, 100);
                } else {
                    throw new Error("Failed to fetch valid deck data after multiple attempts.");
                }
            } catch (err) {
                console.error('[DEBUG] Final error in loadExistingDeck process:', err);
                 if (err instanceof Error && err.message?.includes('(401)')) { setError('Unauthorized loading deck. Please log in again.'); }
                 else { setError(`Failed to load deck: ${err instanceof Error ? err.message : 'Unknown error'}`); }
                sessionStorage.removeItem('processedDeckId'); // Allow retry if load failed
            } finally {
                setLoadingDeck(false);
            }
        };
        loadExistingDeck();

        // Cleanup
        return () => { console.log('[DEBUG] Cleanup for loadExistingDeck effect'); };
     // Ensure dependencies include all context functions used inside if they aren't guaranteed stable
     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deckIdParam, isPotentialLoop, resetDeck, setDeckName, addLeader, setBaseContext, addCard, contextSetCurrentStage]);


    // --- Client-Side Filtering (Memoized) ---
    const displayedCards = useMemo(() => {
        let filtered = cards;
        if (currentStage === 'cards' && hideCardsInDeck) { const deckCardIds = new Set(deckCards.map(dc => dc.card.id)); filtered = filtered.filter(card => !deckCardIds.has(card.id)); }
        if (currentStage === 'cards' && !showAllCards && leaders.length === 2 && base) { filtered = filtered.filter(card => isCardInAspect(card)); }
        if (cardTypeFilter && cardTypeFilter !== 'All') { filtered = filtered.filter(card => card.type?.toLowerCase() === cardTypeFilter.toLowerCase()); }
        return filtered;
    }, [cards, hideCardsInDeck, deckCards, currentStage, showAllCards, leaders, base, cardTypeFilter, isCardInAspect]);

    // --- Other Interaction Handlers (Memoized) ---
    const handleCardClick = useCallback((card: CardType) => { setSelectedCard(card); }, []);
    const handleCardDoubleClick = useCallback((card: CardType) => {
        if (currentStage === 'leaders') { if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) addLeader(card); }
        else if (currentStage === 'base') { if (card.type === 'Base' && !base) setBaseContext(card); }
        else if (currentStage === 'cards') { if (!isCardIdInDeck(card.id)) addCard(card); }
    }, [currentStage, leaders, base, addLeader, setBaseContext, addCard, isCardIdInDeck]);
    const handleAddToDeck = useCallback((card: CardType) => { handleCardDoubleClick(card); }, [handleCardDoubleClick]);
    const handleRemoveFromDeck = useCallback((cardId: string) => {
        if (leaders.some(l => l.id === cardId)) removeLeader(cardId);
        else if (base?.id === cardId) setBaseContext(null);
        else removeCard(cardId);
        if (selectedCard?.id === cardId) setSelectedCard(null);
    }, [leaders, base, removeLeader, setBaseContext, removeCard, selectedCard]);


    // --- UI Rendering Logic ---
    const getStageInfo = useCallback(() => { /* ... switch statement ... */
        switch (currentStage) {
            case 'leaders': return { title: 'Select Leaders', description: 'Choose two leaders for your deck.', progress: leaders.length / 2 };
            case 'base': return { title: 'Select Base', description: 'Choose a base for your deck.', progress: base ? 1 : 0 };
            case 'cards': return { title: 'Add Cards', description: 'Build your deck (Twin Suns: Max 1 copy of each card).', progress: Math.min(deckCards.length / 30, 1) };
            default: return { title: 'Build Your Deck', description: 'Start building your Twin Suns deck.', progress: 0 };
        }
     }, [currentStage, leaders.length, base, deckCards.length]);
    const stageInfo = getStageInfo();
    const renderLeaderSelectionArea = useCallback(() => ( /* ... JSX ... */ <Card className="bg-gray-900 border-gray-800"><CardHeader className="border-b border-gray-800 p-4"><CardTitle className="text-xl">Selected Leaders ({leaders.length}/2)</CardTitle></CardHeader><CardContent className="p-4"><LeaderSelection leaders={leaders} onRemoveLeader={handleRemoveFromDeck} onSelectLeader={setSelectedCard} /><div className="mt-6 flex justify-between"><Button onClick={resetDeck} variant="destructive">Reset Deck</Button><Button onClick={() => contextSetCurrentStage('base')} disabled={leaders.length !== 2} className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90 disabled:opacity-50">Next: Select Base</Button></div></CardContent></Card>), [leaders, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard]);
    const renderBaseSelectionArea = useCallback(() => ( /* ... JSX ... */ <Card className="bg-gray-900 border-gray-800"><CardHeader className="border-b border-gray-800 p-4"><CardTitle className="text-xl">Selected Base</CardTitle></CardHeader><CardContent className="p-4"><div className="flex justify-center mb-4 min-h-[200px]">{base ? (<div className="relative max-w-xs group cursor-pointer" onClick={() => setSelectedCard(base)}><div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500 bg-gray-800"><img src={base.image_uri ?? base.image_url ?? '/placeholder-card.png'} alt={base.name} className="w-full h-full object-contain" onError={(e) => { const target = e.target as HTMLImageElement; target.src = '/placeholder-card.png'; }}/></div><button className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => { e.stopPropagation(); handleRemoveFromDeck(base.id); }}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button><div className="mt-2 text-center"><h3 className="font-medium truncate" title={base.name}>{base.name}</h3></div></div>) : (<div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-xs w-full text-gray-500">Select a Base</div>)}</div><div className="mt-6 flex justify-between"><Button onClick={() => contextSetCurrentStage('leaders')} variant="outline">Back</Button><Button onClick={resetDeck} variant="destructive">Reset Deck</Button><Button onClick={() => contextSetCurrentStage('cards')} disabled={!base} className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90 disabled:opacity-50">Next: Add Cards</Button></div></CardContent></Card>), [base, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard]);
    const renderCardsSelectionArea = useCallback(() => ( /* ... JSX ... */ <Card className="bg-gray-900 border-gray-800"><CardHeader className="border-b border-gray-800 p-4"><CardTitle className="text-xl">Your Deck ({deckCards.length})</CardTitle></CardHeader><CardContent className="p-4">{deckCards.length > 0 ? (<div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 gap-2">{deckCards.map((item: DeckCardItem) => { const card = item.card; if (!card) return null; return (<div key={`deck-${card.id}`} className="relative group cursor-pointer" onClick={() => setSelectedCard(card)}><div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors bg-gray-800"><img src={card.image_uri ?? card.image_url ?? '/placeholder-card.png'} alt={card.name} className="w-full h-full object-contain" onError={(e) => { const target = e.target as HTMLImageElement; target.src = '/placeholder-card.png'; }}/><button className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => { e.stopPropagation(); handleRemoveFromDeck(card.id); }}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button><div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1 truncate">{card.name}</div></div></div>);})}</div>) : (<div className="h-40 flex items-center justify-center text-gray-500">Add cards to your deck.</div>)}<div className="mt-6 flex flex-wrap justify-between items-start gap-4"><div><Button onClick={() => contextSetCurrentStage('base')} variant="outline" className="mr-2">Back</Button><Button onClick={resetDeck} variant="destructive">Reset Deck</Button></div><Button onClick={() => setShowSaveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white" disabled={leaders.length !== 2 || !base }>Save Deck</Button></div>{(leaders.length > 0 || base || deckCards.length > 0) && (<div className="mt-6"><DeckStats /></div>)}</CardContent></Card>), [deckCards, handleRemoveFromDeck, resetDeck, contextSetCurrentStage, setSelectedCard, leaders, base]);


    // --- Main Return JSX ---
    if (isPotentialLoop) { /* ... Loop Error UI ... */
        return (<div className="min-h-screen bg-black text-white flex items-center justify-center p-8"><div className="text-center bg-red-900/50 border border-red-500 p-6 rounded-lg max-w-md"><h2 className="text-2xl text-red-300 mb-4">Potential Loop Detected</h2><p className="text-red-200 mb-4">Too many rapid page renders occurred. Deck loading has been halted to prevent issues. Please try refreshing the page.</p><Button variant="destructive" onClick={() => window.location.reload()}>Refresh Page</Button></div></div>);
    }
    if (loadingDeck && deckIdParam) { /* ... Loading Deck UI ... */
        return (<div className="min-h-screen bg-black text-white flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div><p className="mt-4 text-2xl text-gray-300">Loading your deck...</p></div></div>);
    }
     if (error) { /* ... General Error UI ... */
        return (<div className="min-h-screen bg-black text-white flex items-center justify-center p-8"><div className="text-center bg-gray-900 border border-red-500 p-6 rounded-lg max-w-md"><h2 className="text-2xl text-red-400 mb-4">An Error Occurred</h2><p className="text-red-300 mb-4 whitespace-pre-wrap">{error}</p><Button onClick={() => window.location.reload()} variant="outline" className="mr-2">Refresh</Button><Button onClick={() => router.push('/profile')}>Go to Profile</Button></div></div>);
    }

    // --- Normal Deck Builder UI ---
    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <section className="py-8 px-4">
                 <div className="max-w-7xl mx-auto">
                     <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">Twin Suns</span> Deck Builder {deckIdParam ? `(Editing: ${deckName || '...'})` : ''}
                    </h1>
                     <p className="text-xl text-gray-300 max-w-3xl">{stageInfo.description}</p>
                 </div>
             </section>

            {/* Progress */}
            <section className="py-4 px-4 bg-gray-950 sticky top-0 z-10 border-b border-gray-800">
                 <div className="max-w-7xl mx-auto">
                     <div className="flex items-center mb-2"> {/* Progress Bar */} <div className={`h-2 rounded-l-full w-1/3 transition-colors duration-300 ${currentStage === 'leaders' ? 'bg-purple-500' : (leaders.length === 2 ? 'bg-green-500' : 'bg-gray-700')}`}></div><div className={`h-2 w-1/3 transition-colors duration-300 ${currentStage === 'base' ? 'bg-purple-500' : (base ? 'bg-green-500' : 'bg-gray-700')}`}></div><div className={`h-2 rounded-r-full w-1/3 transition-colors duration-300 ${currentStage === 'cards' ? 'bg-purple-500' : 'bg-gray-700'}`}></div></div>
                     <div className="flex text-xs text-gray-400"> {/* Stage Text */} <div className={`w-1/3 text-center ${currentStage === 'leaders' ? 'text-purple-400 font-bold' : (leaders.length === 2 ? 'text-green-400' : '')}`}>1. Leaders ({leaders.length}/2)</div><div className={`w-1/3 text-center ${currentStage === 'base' ? 'text-purple-400 font-bold' : (base ? 'text-green-400' : '')}`}>2. Base {base ? '(Selected)' : ''}</div><div className={`w-1/3 text-center ${currentStage === 'cards' ? 'text-purple-400 font-bold' : ''}`}>3. Cards ({deckCards.length})</div></div>
                </div>
            </section>

            {/* Main Content Grid */}
            <section className="py-6 px-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left/Middle Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Card Browser */}
                        <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                             <CardHeader className="border-b border-gray-800 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-xl whitespace-nowrap">{currentStage === 'leaders' ? 'Browse Leaders' : currentStage === 'base' ? 'Browse Bases' : 'Browse Cards'}</CardTitle><div className="flex flex-wrap items-center gap-2"><input type="text" placeholder="Search available cards..." className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-purple-500 focus:border-purple-500" value={searchQuery} onChange={handleSearchChange} />{currentStage === 'cards' && (<><select className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-purple-500 focus:border-purple-500" value={cardTypeFilter} onChange={(e) => setCardTypeFilter(e.target.value)}><option value="">All Types</option><option value="Unit">Unit</option><option value="Event">Event</option><option value="Upgrade">Upgrade</option></select>{leaders.length === 2 && base && (<><div className="flex items-center space-x-2"><Switch id="show-all-cards" checked={showAllCards} onCheckedChange={setShowAllCards} /><Label htmlFor="show-all-cards" className="text-sm text-gray-300 whitespace-nowrap">Show all aspects</Label></div><div className="flex items-center space-x-2"><Switch id="hide-cards-in-deck" checked={hideCardsInDeck} onCheckedChange={setHideCardsInDeck} /><Label htmlFor="hide-cards-in-deck" className="text-sm text-gray-300 whitespace-nowrap">Hide added cards</Label></div></>)}</>)}</div></div></CardHeader>
                             <CardContent className="p-0">{loading && !isLoadingMore ? (<div className="h-96 flex items-center justify-center text-purple-400">Loading available cards...</div>) : displayedCards.length === 0 && !loading ? (<div className="h-96 flex items-center justify-center text-gray-400 p-4 text-center">{searchQuery ? `No cards found matching "${searchQuery}".` : `No ${currentStage === 'leaders' ? 'leaders' : currentStage === 'base' ? 'bases' : 'cards'} available for this stage.`}</div>) : (<div className="max-h-[60vh] overflow-y-auto p-4"><CardGrid key={`card-grid-${currentStage}-${searchQuery}-${cardTypeFilter}-${showAllCards}-${hideCardsInDeck}`} cards={displayedCards} onCardClick={handleCardClick} onDoubleClick={handleCardDoubleClick} selectedCardId={selectedCard?.id} isCompatible={isCardInAspect} isInDeck={isCardIdInDeck} currentStage={currentStage} /><>{hasMoreCards && displayedCards.length > 0 && (<div ref={lastCardElementRef} style={{ height: '10px', background: 'transparent' }} />)}</></div>)}{hasMoreCards && !loading && displayedCards.length > 0 && (<div className="p-4 flex justify-center border-t border-gray-800"><Button onClick={loadMoreCardsHandler} variant="outline" disabled={isLoadingMore} className="bg-gray-800 hover:bg-gray-700 text-white">{isLoadingMore ? (<><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>Loading...</>) : ('Load More')}</Button></div>)}{!loading && !hasMoreCards && cards.length > 0 && (<div className="p-4 text-center text-gray-500 text-sm border-t border-gray-800">End of results.</div>)}</CardContent>
                        </Card>

                        {/* Stage-specific Selection Area */}
                        {currentStage === 'leaders' && renderLeaderSelectionArea()}
                        {currentStage === 'base' && renderBaseSelectionArea()}
                        {currentStage === 'cards' && renderCardsSelectionArea()}
                    </div>

                    {/* Right Column: Card Detail */}
                    <div className="lg:col-span-1">
                        <Card className="bg-gray-900 border-gray-800 h-full sticky top-24">
                           <CardHeader className="border-b border-gray-800 p-4"><CardTitle className="text-xl">Card Details</CardTitle></CardHeader>
                           <CardContent className="p-0 max-h-[calc(100vh-10rem)] overflow-y-auto">{selectedCard ? (<MemoizedCardDetail key={selectedCard.id} card={selectedCard} onAddToDeck={handleAddToDeck} onRemoveFromDeck={handleRemoveFromDeck} isInDeck={isCardIdInDeck(selectedCard.id)} isCompatible={currentStage === 'cards' ? isCardInAspect(selectedCard) : true} currentStage={currentStage} />) : (<div className="h-full flex items-center justify-center p-4 text-gray-500">Select a card to view details</div>)}</CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Save Dialog */}
            <SaveDeckDialog
                isOpen={showSaveDialog}
                onClose={() => setShowSaveDialog(false)}
                onSuccess={(savedDeckId) => {
                    setShowSaveDialog(false);
                    console.log("SaveDeckDialog onSuccess triggered with ID:", savedDeckId);
                    sessionStorage.removeItem('processedDeckId'); // Clear flags
                    sessionStorage.removeItem('editingDeck');
                    router.push(`/decks/${savedDeckId}`); // Navigate to view page
                }}
                // Pass existingDeckId if SaveDeckDialog handles updates differently
                // existingDeckId={deckIdParam || undefined}
            />
        </div>
    );
}