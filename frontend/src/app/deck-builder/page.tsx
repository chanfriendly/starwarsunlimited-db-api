'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardGrid } from '@/components/CardGrid';
import { CardDetail } from '@/components/CardDetail';
import { LeaderSelection } from '@/components/LeaderSelection';
import { DeckStats } from '@/components/DeckStats';
import SaveDeckDialog from '@/components/SaveDeckDialog';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
import { Card as CardType, fetchCards, fetchBaseCards, fetchRegularCards, fetchDeckById } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function DeckBuilder() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deckIdParam = searchParams.get('deckId');
    
    // State
    const [cards, setCards] = useState<CardType[]>([]);
    const [filteredCards, setFilteredCards] = useState<CardType[]>([]);
    const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingDeck, setLoadingDeck] = useState(!!deckIdParam);
    const [error, setError] = useState<string | null>(null);
    const [cardTypeFilter, setCardTypeFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [baseCards, setBaseCards] = useState<CardType[]>([]);
    const [loadingBaseCards, setLoadingBaseCards] = useState(false);
    const [showAllCards, setShowAllCards] = useState<boolean>(false);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [hideCardsInDeck, setHideCardsInDeck] = useState(true);

    // Use the DeckBuilder context with the direct setCurrentStage function
    const {
        currentStage,
        leaders,
        base,
        deckCards,
        addLeader,
        removeLeader,
        setBase: setBaseContext,
        addCard,
        removeCard,
        isCardInDeck,
        isCardInAspect,
        resetDeck,
        setDeckName,
        setCurrentStage: contextSetCurrentStage
    } = useDeckBuilder();

    // Load existing deck if deckId is provided
    useEffect(() => {
        if (deckIdParam) {
            const loadExistingDeck = async () => {
                try {
                    setLoadingDeck(true);
                    const deck = await fetchDeckById(deckIdParam);
                    
                    if (!deck) {
                        setError('Deck not found');
                        return;
                    }
                    
                    // Reset current deck
                    resetDeck();
                    
                    // Set deck name
                    setDeckName(deck.name);
                    
                    // Add leaders
                    deck.leaders.forEach(leader => {
                        addLeader(leader);
                    });
                    
                    // Set base if it exists
                    if (deck.base) {
                        setBaseContext(deck.base);
                    }
                    
                    // Add cards
                    deck.cards.forEach(item => {
                        addCard(item.card);
                    });
                    
                    // Navigate to the cards stage
                    contextSetCurrentStage('cards');
                    
                } catch (err) {
                    console.error('Error loading deck:', err);
                    setError('Failed to load deck. Please try again later.');
                } finally {
                    setLoadingDeck(false);
                }
            };
            
            loadExistingDeck();
        }
    }, [deckIdParam, addLeader, addCard, resetDeck, setDeckName, contextSetCurrentStage, setBaseContext]);

    // Fetch cards from API
    useEffect(() => {
        const loadCards = async () => {
            try {
                setLoading(true);
                console.log(`Fetching cards for stage: ${currentStage}`);
    
                let fetchedCards: CardType[] = [];
    
                if (currentStage === 'leaders') {
                    // For leaders, fetch all cards and then filter for leaders only
                    const response = await fetchCards();
                    // Extract the cards array from the response
                    fetchedCards = response.data || response;
                    console.log(`Loaded ${fetchedCards.length} cards, filtering for leaders...`);
                    setCards(fetchedCards);
                } else if (currentStage === 'base') {
                    // For base selection, specifically fetch base cards
                    const response = await fetchBaseCards();
                    // The fetchBaseCards function should also be updated to handle the new format
                    fetchedCards = Array.isArray(response) ? response : response.data || [];
                    console.log(`Loaded ${fetchedCards.length} base cards`);
                    setBaseCards(fetchedCards);
                    setFilteredCards(fetchedCards); // Directly set filtered cards
                } else if (currentStage === 'cards') {
                    // For regular cards, use the new function that excludes leaders and bases
                    const response = await fetchRegularCards();
                    // The fetchRegularCards function should also be updated to handle the new format
                    fetchedCards = Array.isArray(response) ? response : response.data || [];
                    console.log(`Loaded ${fetchedCards.length} regular cards (non-Leader, non-Base)`);
                    setCards(fetchedCards);
                }
    
                if (fetchedCards.length === 0) {
                    console.warn('No cards returned from API for stage:', currentStage);
                    if (currentStage === 'cards') {
                        // As a fallback for cards stage, try loading all cards
                        console.log('Trying fallback method for cards stage...');
                        const allCardsResponse = await fetchCards({ limit: '200' });
                        const allCards = allCardsResponse.data || allCardsResponse;
                        const regularCards = allCards.filter((card: CardType) => 
                            card.type !== 'Leader' && card.type !== 'Base'
                        );
                        console.log(`Fallback found ${regularCards.length} regular cards`);
                        setCards(regularCards);
                    }
                }
            } catch (err) {
                console.error('Error loading cards:', err);
                setError('Failed to load cards. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
    
        loadCards();
    }, [currentStage]);

    // Filter cards based on stage and search/type filters
    useEffect(() => {
        let result: CardType[] = [];
    
        // Stage-based filtering
        if (currentStage === 'leaders') {
            // Filter for leaders only
            result = cards.filter(card => card.type === 'Leader');
            console.log('Leaders found:', result.length);
    
            // If we already have one leader selected, filter for compatible leaders only
            if (leaders.length === 1) {
                const firstLeader = leaders[0];
                const firstLeaderAspects = firstLeader.aspects?.map(a => a.aspect_name) || [];
    
                // Filter for leaders that share either Heroism or Villainy aspect
                result = result.filter(card => {
                    const cardAspects = card.aspects?.map(a => a.aspect_name) || [];
    
                    // Check if card has Heroism and first leader has Heroism OR
                    // card has Villainy and first leader has Villainy
                    return (
                        (cardAspects.includes('Heroism') && firstLeaderAspects.includes('Heroism')) ||
                        (cardAspects.includes('Villainy') && firstLeaderAspects.includes('Villainy'))
                    );
                });
    
                // Also exclude the already selected leader
                result = result.filter(card => card.id !== firstLeader.id);
            }
        } else if (currentStage === 'base') {
            // For base stage, directly use the baseCards state
            result = baseCards;
            console.log('Base cards found:', result.length);
        } else if (currentStage === 'cards') {
            // For cards stage, use the cards that have already been filtered by fetchRegularCards
            result = cards;
            console.log('Regular cards found:', result.length);
            
            // Log the types of cards we have for debugging
            const typeCounts: Record<string, number> = {};
            result.forEach(card => {
                typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
            });
            console.log('Card types distribution:', typeCounts);
            
            // If we have chosen leaders and a base, filter by aspect compatibility
            if (leaders.length === 2 && base && !showAllCards) {
                // Filter for compatible aspects
                result = result.filter(card => isCardInAspect(card));
                
                console.log('Compatible cards after aspect filtering:', result.length);
            } else {
                console.log('Showing all cards, bypassing aspect filter');
            }
        }
    
        // Additional filters
        if (cardTypeFilter && cardTypeFilter !== 'All') {
            result = result.filter(card => card.type === cardTypeFilter);
            console.log(`After type filter (${cardTypeFilter}):`, result.length);
        }
    
        // Search query filtering
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(card =>
                card.name?.toLowerCase().includes(query) ||
                (card.text && card.text.toLowerCase().includes(query))
            );
            console.log(`After search filter (${searchQuery}):`, result.length);
        }
    
        console.log('Final filtered cards:', result.length);
        setFilteredCards(result);
    }, [cards, currentStage, cardTypeFilter, searchQuery, leaders, baseCards, base, showAllCards, isCardInAspect]);

    // Handle card selection
    // frontend/src/app/deck-builder/page.tsx - Just fixing the function with the 'any' type

// Update the function to have proper type annotation
const handleCardClick = (card: CardType) => {
    console.log('Card clicked:', card.name, 'Type:', card.type, 'Current stage:', currentStage);
    
    // If the card is already in the deck, we don't want to add it again
    if (currentStage === 'cards' && isCardInDeck(card.id)) {
        console.log('Card already in deck, not adding again');
        // Still set it as selected to show details
        setSelectedCard(card);
        return;
    }
    
    setSelectedCard(card);

    // Auto-add leaders when clicked (if in leaders stage and we have room)
    if (currentStage === 'leaders' && leaders.length < 2 && !leaders.some(l => l.id === card.id)) {
        console.log('Auto-adding leader on click');
        addLeader(card);
    }
    
    // Auto-add base when clicked (if in base stage and no base is selected)
    if (currentStage === 'base' && !base && card.type === 'Base') {
        console.log('Auto-adding base on click');
        setBaseContext(card);
    }
};

// Update other functions that need type fixing
const handleCardDoubleClick = (card: CardType) => {
    console.log('Card double-clicked:', card.name);
    
    // Don't add if already in deck
    if (isCardInDeck(card.id)) {
        console.log('Card already in deck, not adding again');
        return;
    }
    
    handleAddToDeck(card);
};

// Handle adding card to deck
const handleAddToDeck = (card: CardType) => {
    console.log(`Adding ${card.type} to deck:`, card.name, 'Current stage:', currentStage);

    if (currentStage === 'leaders') {
        if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) {
            console.log('Adding leader to deck');
            addLeader(card);
        } else {
            console.log('Not adding leader - already have 2 or leader already selected');
        }
    } else if (currentStage === 'base') {
        if (card.type === 'Base') {
            console.log('Setting base');
            setBaseContext(card);
        } else {
            console.log('Not setting base - wrong card type:', card.type);
        }
    } else {
        if (!isCardInDeck(card.id)) {
            console.log('Adding card to deck');
            addCard(card);
        } else {
            console.log('Card already in deck, not adding again');
        }
    }
};

    // Handle removing card from deck
    const handleRemoveFromDeck = (cardId: string) => {
        console.log('Removing card from deck:', cardId);

        if (currentStage === 'leaders') {
            removeLeader(cardId);
        } else if (currentStage === 'base' && base?.id === cardId) {
            setBaseContext(null);
        } else {
            removeCard(cardId);
        }
    };

    // Get stage display info
    const getStageInfo = () => {
        switch (currentStage) {
            case 'leaders':
                return {
                    title: 'Select Leaders',
                    description: 'Choose two leaders for your deck. These define your aspects.',
                    progress: leaders.length / 2
                };
            case 'base':
                return {
                    title: 'Select Base',
                    description: 'Choose a base for your deck.',
                    progress: base ? 1 : 0
                };
            case 'cards':
                return {
                    title: 'Add Cards',
                    description: 'Add cards to complete your deck. In Twin Suns format, you can only add each card once.',
                    progress: Math.min(deckCards.length / 40, 1) // Assuming 40 cards is a full deck
                };
            default:
                return {
                    title: 'Build Your Deck',
                    description: 'Create a Twin Suns format deck.',
                    progress: 0
                };
        }
    };

    const stageInfo = getStageInfo();

    // Render leader selection area for leaders stage
    const renderLeaderSelectionArea = () => {
        return (
            <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                    <CardTitle className="text-xl">Selected Leaders</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <LeaderSelection
                        leaders={leaders}
                        onRemoveLeader={removeLeader}
                        onSelectLeader={setSelectedCard}
                    />

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex justify-between">
                        <Button
                            onClick={resetDeck}
                            variant="destructive"
                        >
                            Reset Deck
                        </Button>

                        <Button
                            onClick={() => contextSetCurrentStage('base')}
                            disabled={leaders.length < 2}
                            className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90"
                        >
                            Next Step
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Render base selection area for base stage
    const renderBaseSelectionArea = () => {
        return (
            <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                    <CardTitle className="text-xl">Selected Base</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex justify-center">
                        {base ? (
                            <div className="relative max-w-xs">
                                <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500">
                                    {base.image_uri || base.image_url ? (
                                        <img
                                            src={base.image_uri || base.image_url}
                                            alt={base.name}
                                            className="w-full h-full object-contain cursor-pointer"
                                            onClick={() => setSelectedCard(base)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                            <span className="text-sm text-center p-2">{base.name}</span>
                                        </div>
                                    )}

                                    {/* Remove button */}
                                    <button
                                        className="absolute top-2 right-2 p-1 bg-red-500 rounded-full"
                                        onClick={() => setBaseContext(null)}
                                    >
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="mt-2 text-center">
                                    <h3 className="font-medium">{base.name}</h3>
                                </div>
                            </div>
                        ) : (
                            <div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-xs w-full">
                                <span className="text-gray-500">Select a Base</span>
                            </div>
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex justify-between">
                        <Button
                            onClick={() => contextSetCurrentStage('leaders')}
                            variant="outline"
                        >
                            Back
                        </Button>

                        <Button
                            onClick={resetDeck}
                            variant="destructive"
                        >
                            Reset Deck
                        </Button>

                        <Button
                            onClick={() => contextSetCurrentStage('cards')}
                            disabled={!base}
                            className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90"
                        >
                            Next Step
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Render cards selection area for cards stage
    const renderCardsSelectionArea = () => {
        return (
            <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                    <CardTitle className="text-xl">Your Deck</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {deckCards.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {deckCards.map((deckCard) => (
                                <div key={deckCard.card.id} className="relative">
                                    <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors cursor-pointer">
                                        {deckCard.card.image_uri || deckCard.card.image_url ? (
                                            <img
                                                src={deckCard.card.image_uri || deckCard.card.image_url}
                                                alt={deckCard.card.name}
                                                className="w-full h-full object-contain"
                                                onClick={() => setSelectedCard(deckCard.card)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                                <span className="text-xs text-center p-1">{deckCard.card.name}</span>
                                            </div>
                                        )}
                                        <button
                                            className="absolute top-1 right-1 p-1 bg-red-500 rounded-full"
                                            onClick={() => removeCard(deckCard.card.id)}
                                        >
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1 truncate">
                                            {deckCard.card.name}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center">
                            <span className="text-gray-500">No cards added yet</span>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex justify-between">
                        <div>
                            <Button
                                onClick={() => contextSetCurrentStage('base')}
                                variant="outline"
                                className="mr-2"
                            >
                                Back
                            </Button>

                            <Button
                                onClick={resetDeck}
                                variant="destructive"
                            >
                                Reset Deck
                            </Button>
                        </div>
                        
                        <Button
                            onClick={() => setShowSaveDialog(true)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={deckCards.length < 10}
                        >
                            Save Deck
                        </Button>
                    </div>

                    {/* Deck Stats */}
                    {deckCards.length > 0 && (
                        <div className="mt-6">
                            <DeckStats />
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    // Dedicated hook for loading base cards when entering the base selection stage
    useEffect(() => {
        if (currentStage === 'base') {
            console.log('Entered base selection stage, loading base cards...');
            
            const loadBaseCards = async () => {
                setLoadingBaseCards(true);
                try {
                    // Use the dedicated function to fetch base cards
                    const bases = await fetchBaseCards();
                    
                    if (bases.length > 0) {
                        console.log(`Successfully loaded ${bases.length} base cards`);
                        
                        // Update both the base cards state and filtered cards
                        setBaseCards(bases);
                        setFilteredCards(bases);
                    } else {
                        console.warn('No base cards returned from the API');
                        setError('No base cards found. They may not exist in the database or may have an incorrect type.');
                    }
                } catch (err) {
                    console.error('Error loading base cards:', err);
                    setError('Failed to load base cards from the backend');
                } finally {
                    setLoadingBaseCards(false);
                }
            };
            
            loadBaseCards();
        }
    }, [currentStage]);

    // For debugging purposes
    useEffect(() => {
        console.log('Current leaders:', leaders.map(l => l?.name));
    }, [leaders]);

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
                    <p className="text-xl text-gray-300 max-w-3xl">
                        Create your deck for the Twin Suns format. Start by selecting your leaders, then a base, and finally add cards that match your aspects.
                    </p>
                </div>
            </section>
            {/* Progress Indicator */}
            <section className="py-4 px-4 bg-gray-950">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">{stageInfo.title}</h2>
                        <div className="flex items-center space-x-2">
                            <div className="text-sm text-gray-400">{stageInfo.description}</div>
                        </div>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center mb-6">
                        <div className={`h-2 rounded-l-full w-1/3 ${currentStage === 'leaders' ? 'bg-purple-500' : (leaders.length === 2 ? 'bg-green-500' : 'bg-gray-700')}`}></div>
                        <div className={`h-2 w-1/3 ${currentStage === 'base' ? 'bg-purple-500' : (base ? 'bg-green-500' : 'bg-gray-700')}`}></div>
                        <div className={`h-2 rounded-r-full w-1/3 ${currentStage === 'cards' ? 'bg-purple-500' : 'bg-gray-700'}`}></div>
                    </div>

                    {/* Stage Labels */}
                    <div className="flex text-xs mb-6">
                        <div className="w-1/3 text-center">
                            <span className={currentStage === 'leaders' ? 'text-purple-400 font-bold' : (leaders.length === 2 ? 'text-green-400' : 'text-gray-400')}>
                                1. Leaders ({leaders.length}/2)
                            </span>
                        </div>
                        <div className="w-1/3 text-center">
                            <span className={currentStage === 'base' ? 'text-purple-400 font-bold' : (base ? 'text-green-400' : 'text-gray-400')}>
                                2. Base {base ? '(Selected)' : ''}
                            </span>
                        </div>
                        <div className="w-1/3 text-center">
                            <span className={currentStage === 'cards' ? 'text-purple-400 font-bold' : 'text-gray-400'}>
                                3. Cards ({deckCards.length})
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-6 px-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Card Browser and Selection Area - Left and Middle Columns */}
                    <div className="lg:col-span-2">
                        {/* Card Browser */}
                        <Card className="bg-gray-900 border-gray-800 mb-6 overflow-hidden">
                            <CardHeader className="border-b border-gray-800">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xl">
                                        {currentStage === 'leaders' ? 'Select Leaders' : 
                                        currentStage === 'base' ? 'Select Base' : 
                                        'Add Cards to Deck'}
                                    </CardTitle>

                                    {/* Search and Filter Controls */}
                                    <div className="flex space-x-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Search cards..."
                                            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />

                                        {(currentStage === 'cards' || currentStage === 'base') && (
                                            <select
                                                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                                value={cardTypeFilter}
                                                onChange={(e) => setCardTypeFilter(e.target.value)}
                                            >
                                                <option value="">All Types</option>
                                                {currentStage === 'cards' && (
                                                    <>
                                                        <option value="Unit">Units</option>
                                                        <option value="Event">Events</option>
                                                        <option value="Upgrade">Upgrades</option>
                                                    </>
                                                )}
                                                {currentStage === 'base' && <option value="Base">Bases</option>}
                                            </select>
                                        )}
                                        
                                        {currentStage === 'cards' && (
                                            <>
                                                <div className="flex items-center ml-2">
                                                    <Label htmlFor="show-all-cards" className="mr-2 text-sm text-gray-300">
                                                        Show all cards
                                                    </Label>
                                                    <Switch
                                                        id="show-all-cards"
                                                        checked={showAllCards}
                                                        onCheckedChange={setShowAllCards}
                                                    />
                                                </div>
                                                <div className="flex items-center ml-2">
                                                    <Label htmlFor="hide-cards-in-deck" className="mr-2 text-sm text-gray-300">
                                                        Hide cards in deck
                                                    </Label>
                                                    <Switch
                                                        id="hide-cards-in-deck"
                                                        checked={hideCardsInDeck}
                                                        onCheckedChange={setHideCardsInDeck}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="h-96 flex items-center justify-center">
                                        <div className="text-purple-400">Loading cards...</div>
                                    </div>
                                ) : error ? (
                                    <div className="h-96 flex items-center justify-center">
                                        <div className="text-red-400">{error}</div>
                                    </div>
                                ) : filteredCards.length === 0 ? (
                                    <div className="h-96 flex items-center justify-center">
                                        <div className="text-gray-400">No cards found matching your criteria.</div>
                                    </div>
                                ) : (
                                    <div className="max-h-[600px] overflow-auto">
                                        <CardGrid
                                            cards={filteredCards}
                                            onCardClick={handleCardClick}
                                            onDoubleClick={handleCardDoubleClick}
                                            selectedCardId={selectedCard?.id}
                                            isCompatible={isCardInAspect}
                                            isInDeck={isCardInDeck}
                                            hideCardsInDeck={currentStage === 'cards' && hideCardsInDeck}
                                            currentStage={currentStage}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Stage-specific Selection Area */}
                        {currentStage === 'leaders' && renderLeaderSelectionArea()}
                        {currentStage === 'base' && renderBaseSelectionArea()}
                        {currentStage === 'cards' && renderCardsSelectionArea()}
                    </div>

                    {/* Card Detail Panel - Right Column */}
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
                                        isInDeck={isCardInDeck(selectedCard.id)}
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