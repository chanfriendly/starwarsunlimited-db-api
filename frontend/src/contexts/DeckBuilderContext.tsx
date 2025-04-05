// DeckBuilderContext.tsx - Updated version

'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Card } from '@/lib/api';

type DeckBuildingStage = 'leaders' | 'base' | 'cards';

interface DeckItem {
  card: Card;
  quantity: number;
}

interface DeckBuilderContextType {
  currentStage: DeckBuildingStage;
  leaders: Card[];
  base: Card | null;
  deckCards: DeckItem[];
  deckName: string;
  addLeader: (leader: Card) => void;
  removeLeader: (leaderId: string) => void;
  setBase: (base: Card | null) => void;
  addCard: (card: Card) => void;
  removeCard: (cardId: string) => void;
  isCardInDeck: (cardId: string) => boolean;
  updateCardQuantity: (cardId: string, quantity: number) => void;
  setDeckName: (name: string) => void;
  progressStage: () => void;
  resetDeck: () => void;
  isCardInAspect: (card: Card) => boolean;
  setCurrentStage: (stage: DeckBuildingStage) => void;
}

const DeckBuilderContext = createContext<DeckBuilderContextType | undefined>(undefined);

export function DeckBuilderProvider({ children }: { children: ReactNode }) {
  const [currentStage, setCurrentStageState] = useState<DeckBuildingStage>('leaders');
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [base, setBaseState] = useState<Card | null>(null);
  const [deckCards, setDeckCards] = useState<DeckItem[]>([]);
  const [deckName, setDeckNameState] = useState('New Deck');

  // Modified: Use useCallback to memoize functions and prevent recreation on every render
  const setCurrentStage = useCallback((stage: DeckBuildingStage) => {
    console.log(`Setting stage from ${currentStage} to ${stage}`);
    
    // Important: don't update state if it's the same value to prevent unnecessary re-renders
    if (stage === currentStage) return;
    
    // IMPORTANT CHANGE: Batch state updates to prevent multiple renders
    if (stage === 'leaders' && currentStage !== 'leaders') {
      // Using React 18's automatic batching to combine these updates
      setBaseState(null);
      setCurrentStageState(stage);
    } else {
      setCurrentStageState(stage);
    }
  }, [currentStage]);

  // Modified: Don't auto-progress stages to prevent cascading state updates
  const addLeader = useCallback((leader: Card) => {
    // Check if this leader is already in the deck
    if (leaders.some(l => l.id === leader.id)) {
      console.log(`Leader ${leader.name} is already in the deck`);
      return;
    }
    
    if (leaders.length < 2) {
      setLeaders(prev => [...prev, leader]);
      
      // REMOVED auto-progression to prevent cascading state updates
      // The progression should now be handled explicitly by the UI
    }
  }, [leaders]);

  const removeLeader = useCallback((leaderId: string) => {
    setLeaders(prev => prev.filter(leader => leader.id !== leaderId));
    
    // MODIFIED: Only change stage if needed to prevent unnecessary re-renders
    if (currentStage !== 'leaders') {
      // IMPORTANT: Batch state updates to prevent multiple renders
      setCurrentStageState('leaders');
      setBaseState(null);
    }
  }, [currentStage]);

  // Modified: Don't auto-progress to prevent cascading state updates
  const setBase = useCallback((newBase: Card | null) => {
    console.log("Setting base:", newBase?.name);
    
    // Important: don't update state if it's the same value
    if (newBase === base) return;
    
    setBaseState(newBase);
    
    // REMOVED auto-progression to prevent cascading state updates
    // The progression should now be handled explicitly by the UI
  }, [base]);

  const isCardInDeck = useCallback((cardId: string): boolean => {
    // Check if it's a leader
    if (leaders.some(leader => leader.id === cardId)) {
      return true;
    }
    
    // Check if it's the base
    if (base && base.id === cardId) {
      return true;
    }
    
    // Check if it's a regular card
    return deckCards.some(item => item.card.id === cardId);
  }, [leaders, base, deckCards]);

  const addCard = useCallback((card: Card) => {
    // First check if the card is already in the deck (leaders, base, or regular cards)
    if (isCardInDeck(card.id)) {
      console.log(`Card ${card.name} is already in the deck and cannot be added again in Twin Suns format`);
      return;
    }
    
    // In Twin Suns format, we always add with quantity 1
    setDeckCards(prev => [...prev, { card, quantity: 1 }]);
  }, [isCardInDeck]);

  const removeCard = useCallback((cardId: string) => {
    setDeckCards(prev => prev.filter(item => item.card.id !== cardId));
  }, []);

  const updateCardQuantity = useCallback((cardId: string, quantity: number) => {
    const maxQuantity = 1;
    const actualQuantity = Math.min(quantity, maxQuantity);
    
    if (actualQuantity === 0) {
      removeCard(cardId);
      return;
    }
    
    setDeckCards(prev => 
      prev.map(item => 
        item.card.id === cardId ? { ...item, quantity: actualQuantity } : item
      )
    );
  }, [removeCard]);

  const setDeckName = useCallback((name: string) => {
    setDeckNameState(name);
  }, []);

  const progressStage = useCallback(() => {
    console.log("Current stage:", currentStage);
    console.log("Leaders:", leaders.length);
    console.log("Base:", base?.name);
    
    if (currentStage === 'leaders' && leaders.length === 2) {
      console.log("Progressing from leaders to base");
      setCurrentStageState('base');
    } else if (currentStage === 'base' && base) {
      console.log("Progressing from base to cards");
      setCurrentStageState('cards');
    } else {
      console.log("Cannot progress: conditions not met");
    }
  }, [currentStage, leaders.length, base]);

  const resetDeck = useCallback(() => {
    // Batch all state updates to prevent multiple renders
    setLeaders([]);
    setBaseState(null);
    setDeckCards([]);
    setDeckNameState('New Deck');
    setCurrentStageState('leaders');
  }, []);

  const isCardInAspect = useCallback((card: Card): boolean => {
    if (leaders.length < 2 || !base) return true;
    
    // Get all aspects from leaders and base
    const deckAspects: Record<string, number> = {};
    
    // Rest of the function remains the same...
    // Count occurrences of each aspect in the deck
    leaders.forEach(leader => {
      leader.aspects?.forEach(aspect => {
        const name = aspect.aspect_name;
        deckAspects[name] = (deckAspects[name] || 0) + 1;
      });
    });
    
    // Add base aspects
    base.aspects?.forEach(aspect => {
      const name = aspect.aspect_name;
      deckAspects[name] = (deckAspects[name] || 0) + 1;
    });
    
    // Check if the deck has Heroism or Villainy
    const hasHeroism = deckAspects['Heroism'] > 0;
    const hasVillainy = deckAspects['Villainy'] > 0;
    
    // Get card aspects
    const cardAspects: Record<string, number> = {};
    card.aspects?.forEach(aspect => {
      const name = aspect.aspect_name;
      cardAspects[name] = (cardAspects[name] || 0) + 1;
    });
    
    // First check Heroism/Villainy compatibility
    if (hasHeroism && cardAspects['Villainy'] > 0) {
      return false;
    }
    
    if (hasVillainy && cardAspects['Heroism'] > 0) {
      return false;
    }
    
    // For other aspects, a card is compatible if it has AT LEAST ONE 
    // of the secondary aspects in the deck, OR has no secondary aspects at all
    
    // Get the secondary aspects from the deck
    const secondaryAspects = ['Command', 'Vigilance', 'Cunning', 'Aggression', 'Force'];
    const deckSecondaryAspects = secondaryAspects.filter(aspect => deckAspects[aspect] > 0);
    
    // If deck has no secondary aspects, all cards pass this check
    if (deckSecondaryAspects.length === 0) {
      return true;
    }
    
    // Get secondary aspects from the card
    const cardSecondaryAspects = secondaryAspects.filter(aspect => cardAspects[aspect] > 0);
    
    // If card has no secondary aspects, it's compatible
    if (cardSecondaryAspects.length === 0) {
      return true;
    }
    
    // Check if any of the card's secondary aspects are in the deck
    for (const aspect of cardSecondaryAspects) {
      if (deckAspects[aspect] > 0) {
        return true;
      }
    }
    
    // If we get here, the card has secondary aspects but none match the deck
    return false;
  }, [leaders, base]);

  // Memoize context value to prevent unnecessary renders of consumers
  const contextValue = React.useMemo(() => ({
    currentStage,
    leaders,
    base,
    deckCards,
    deckName,
    addLeader,
    removeLeader,
    setBase,
    addCard,
    removeCard,
    isCardInDeck,
    updateCardQuantity,
    setDeckName,
    progressStage,
    resetDeck,
    isCardInAspect,
    setCurrentStage,
  }), [
    currentStage, leaders, base, deckCards, deckName,
    addLeader, removeLeader, setBase, addCard, removeCard,
    isCardInDeck, updateCardQuantity, setDeckName,
    progressStage, resetDeck, isCardInAspect, setCurrentStage
  ]);

  return (
    <DeckBuilderContext.Provider value={contextValue}>
      {children}
    </DeckBuilderContext.Provider>
  );
}

export function useDeckBuilder() {
  const context = useContext(DeckBuilderContext);
  
  if (context === undefined) {
    throw new Error('useDeckBuilder must be used within a DeckBuilderProvider');
  }
  
  return context;
}