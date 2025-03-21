'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardGrid } from '@/components/CardGrid';
import { CardDetail } from '@/components/CardDetail';
import { LeaderSelection } from '@/components/LeaderSelection';
import { DeckStats } from '../../components/DeckStats';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
import { Card as CardType, fetchCards } from '@/lib/api';

export default function DeckBuilder() {
  // State
  const [cards, setCards] = useState<CardType[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardType[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Use the DeckBuilder context
  const {
    currentStage,
    leaders,
    base,
    deckCards,
    addLeader,
    removeLeader,
    setBase,
    addCard,
    removeCard,
    isCardInAspect,
    progressStage,
    resetDeck,
    setDeckName,
  } = useDeckBuilder();
  
  // For typescript safety, define a setCurrentStage function that interfaces with the context
  const setCurrentStage = (stage: 'leaders' | 'base' | 'cards') => {
    if (stage === 'leaders') {
      // Reset state when going back to leaders
      setBase(null);
    }
    // Use context methods to update stage in a controlled way
    if (stage === 'base' && leaders.length === 2) {
      progressStage();
    } else if (stage === 'cards' && base) {
      progressStage();
    }
  };

  // Fetch cards from API
  useEffect(() => {
    const loadCards = async () => {
      try {
        setLoading(true);
        console.log('Fetching cards...');
        
        // Use our adapter function to fetch and convert cards
        const cardsData = await fetchCards();
        
        if (cardsData.length === 0) {
          console.warn('No cards returned from API');
        } else {
          console.log(`Loaded ${cardsData.length} cards`);
          console.log('Sample card:', cardsData[0]);
        }
        
        setCards(cardsData);
        setFilteredCards(cardsData);
      } catch (err) {
        console.error('Error loading cards:', err);
        setError('Failed to load cards. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, []);

  // Filter cards based on stage and search/type filters
// Add this updated filtering logic to the useEffect for card filtering in page.tsx

useEffect(() => {
    let result = [...cards];
    
    // Stage-based filtering
    if (currentStage === 'leaders') {
        result = result.filter(card => card.type === 'Leader');
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
           // Debug base card filtering
      console.log('Checking for base cards...');
      const baseCards = cards.filter(card => card.type === 'Base');
      console.log('Base cards found:', baseCards.length);
      if (baseCards.length === 0) {
        console.log('Sample card types:', cards.slice(0, 5).map(c => c.type));
      } 
      result = result.filter(card => card.type === 'Base');
          // If no base cards are found, let's check for case sensitivity issues
        if (result.length === 0) {
            result = cards.filter(card => 
            card.type?.toLowerCase() === 'base' || 
            card.type?.toLowerCase().includes('base')
            );
            console.log('Base cards after case-insensitive search:', result.length);
        }
    }
    
    // Additional filters
    if (cardTypeFilter && cardTypeFilter !== 'All' && currentStage === 'cards') {
      result = result.filter(card => card.type === cardTypeFilter);
    }
    
    // Search query filtering
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(card => 
        card.name?.toLowerCase().includes(query) ||
        (card.text && card.text.toLowerCase().includes(query))
      );
    }
    
    console.log('Filtered cards:', result.length);
    setFilteredCards(result);
  }, [cards, currentStage, cardTypeFilter, searchQuery, leaders]);

  // Handle card selection
  const handleCardClick = (card: CardType) => {
    console.log('Card clicked:', card.name);
    setSelectedCard(card);
    
    // Auto-add leaders when clicked (if in leaders stage and we have room)
    if (currentStage === 'leaders' && leaders.length < 2 && !leaders.some(l => l.id === card.id)) {
      console.log('Auto-adding leader on click');
      addLeader(card);
    }
  };
  
  // Handle double-clicking to add card to deck
  const handleCardDoubleClick = (card: CardType) => {
    console.log('Card double-clicked:', card.name);
    handleAddToDeck(card);
  };

  // Handle adding card to deck
  const handleAddToDeck = (card: CardType) => {
    console.log(`Adding ${card.type} to deck:`, card.name);
    
    if (currentStage === 'leaders') {
      if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) {
        console.log('Adding leader to deck');
        addLeader(card);
      } else {
        console.log('Not adding leader - already have 2 or leader already selected');
      }
    } else if (currentStage === 'base') {
      console.log('Setting base');
      setBase(card);
    } else {
      console.log('Adding card to deck');
      addCard(card);
    }
  };

  // Handle removing card from deck
  const handleRemoveFromDeck = (cardId: string) => {
    console.log('Removing card from deck:', cardId);
    
    if (currentStage === 'leaders') {
      removeLeader(cardId);
    } else if (currentStage === 'base' && base?.id === cardId) {
      setBase(null);
    } else {
      removeCard(cardId);
    }
  };

  // Helper to check if card is in deck
  const isCardInDeck = (cardId: string): boolean => {
    if (currentStage === 'leaders') {
      return leaders.some(leader => leader.id === cardId);
    } else if (currentStage === 'base') {
      return base?.id === cardId;
    } else {
      return deckCards.some(item => item.card.id === cardId);
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
          description: 'Add cards to complete your deck.',
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
              onClick={progressStage}
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
                  {base.image_uri ? (
                    <img
                      src={base.image_uri}
                      alt={base.name}
                      className="w-full h-full object-contain"
                      onClick={() => setSelectedCard(base)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <span className="text-sm text-center p-2">{base.name}</span>
                    </div>
                  )}
                  <button 
                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full"
                    onClick={() => setBase(null)}
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
              onClick={() => setCurrentStage('leaders')}
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
              onClick={progressStage}
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
                  <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors">
                    {deckCard.card.image_uri ? (
                      <img
                        src={deckCard.card.image_uri}
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
                    {deckCard.quantity > 1 && (
                      <div className="absolute top-0 left-0 bg-purple-500 text-white rounded-br text-xs font-bold px-1">
                        x{deckCard.quantity}
                      </div>
                    )}
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
            <Button 
              onClick={() => setCurrentStage('base')}
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

  // For debugging purposes
  useEffect(() => {
    console.log('Current leaders:', leaders.map(l => l?.name));
  }, [leaders]);

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
                  <CardTitle className="text-xl">Card Browser</CardTitle>
                  
                  {/* Search and Filter Controls */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Search cards..."
                      className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    
                    {currentStage === 'cards' && (
                      <select 
                        className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                        value={cardTypeFilter}
                        onChange={(e) => setCardTypeFilter(e.target.value)}
                      >
                        <option value="">All Types</option>
                        <option value="Unit">Units</option>
                        <option value="Event">Events</option>
                        <option value="Upgrade">Upgrades</option>
                        <option value="Plot">Plots</option>
                      </select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0"> {/* Removed padding to allow CardGrid to control spacing */}
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
                      isCompatible={currentStage === 'cards' ? isCardInAspect : undefined}
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
                <CardDetail 
                  card={selectedCard} 
                  onAddToDeck={handleAddToDeck}
                  onRemoveFromDeck={handleRemoveFromDeck}
                  isInDeck={selectedCard ? isCardInDeck(selectedCard.id) : false}
                  isCompatible={selectedCard && currentStage === 'cards' ? isCardInAspect(selectedCard) : true}
                  currentStage={currentStage}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}