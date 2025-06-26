// frontend/src/contexts/DeckBuilderContext.tsx - Optimized version

'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
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
  // Computed values
  totalCards: number;
  isValidDeck: boolean;
  deckAspects: string[];
}

const DeckBuilderContext = createContext<DeckBuilderContextType | undefined>(undefined);

export function DeckBuilderProvider({ children }: { children: ReactNode }) {
  // Core state
  const [currentStage, setCurrentStageState] = useState<DeckBuildingStage>('leaders');
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [base, setBaseState] = useState<Card | null>(null);
  const [deckCards, setDeckCards] = useState<DeckItem[]>([]);
  const [deckName, setDeckNameState] = useState('New Deck');

  // Memoized computed values to prevent recalculation
  const totalCards = useMemo(() => 
    deckCards.reduce((sum, item) => sum + item.quantity, 0), 
    [deckCards]
  );

  const isValidDeck = useMemo(() => 
    leaders.length === 2 && base !== null && totalCards >= 10,
    [leaders.length, base, totalCards]
  );

  // Memoized deck aspects for performance
  const deckAspects = useMemo(() => {
    const aspects = new Set<string>();
    
    leaders.forEach(leader => {
      leader.aspects?.forEach(aspect => {
        aspects.add(aspect.aspect_name);
      });
    });
    
    if (base) {
      base.aspects?.forEach(aspect => {
        aspects.add(aspect.aspect_name);
      });
    }
    
    return Array.from(aspects);
  }, [leaders, base]);

  // Optimized aspect compatibility check
  const isCardInAspect = useCallback((card: Card): boolean => {
    if (leaders.length < 2 || !base) return true;
    
    // Create aspect count maps for better performance
    const deckAspectCounts: Record<string, number> = {};
    
    // Count deck aspects
    [...leaders, base].forEach(deckCard => {
      deckCard.aspects?.forEach(aspect => {
        const name = aspect.aspect_name;
        deckAspectCounts[name] = (deckAspectCounts[name] || 0) + 1;
      });
    });
    
    // Get card aspects
    const cardAspectCounts: Record<string, number> = {};
    card.aspects?.forEach(aspect => {
      const name = aspect.aspect_name;
      cardAspectCounts[name] = (cardAspectCounts[name] || 0) + 1;
    });
    
    // Check Heroism/Villainy compatibility
    const hasHeroism = deckAspectCounts['Heroism'] > 0;
    const hasVillainy = deckAspectCounts['Villainy'] > 0;
    
    if (hasHeroism && cardAspectCounts['Villainy'] > 0) return false;
    if (hasVillainy && cardAspectCounts['Heroism'] > 0) return false;
    
    // Check secondary aspects
    const secondaryAspects = ['Command', 'Vigilance', 'Cunning', 'Aggression', 'Force'];
    const deckSecondaryAspects = secondaryAspects.filter(aspect => deckAspectCounts[aspect] > 0);
    
    if (deckSecondaryAspects.length === 0) return true;
    
    const cardSecondaryAspects = secondaryAspects.filter(aspect => cardAspectCounts[aspect] > 0);
    
    if (cardSecondaryAspects.length === 0) return true;
    
    return cardSecondaryAspects.some(aspect => deckAspectCounts[aspect] > 0);
  }, [leaders, base]);

  // Optimized deck checking function
  const isCardInDeck = useCallback((cardId: string): boolean => {
    return leaders.some(leader => leader.id === cardId) ||
           (base?.id === cardId) ||
           deckCards.some(item => item.card.id === cardId);
  }, [leaders, base, deckCards]);

  // Stage management with batched updates
  const setCurrentStage = useCallback((stage: DeckBuildingStage) => {
    if (stage === currentStage) return;
    
    // Use React 18's automatic batching
    setCurrentStageState(stage);
    
    // Reset subsequent stages when going backward
    if (stage === 'leaders') {
      setBaseState(null);
      setDeckCards([]);
    } else if (stage === 'base') {
      setDeckCards([]);
    }
  }, [currentStage]);

  // Leader management
  const addLeader = useCallback((leader: Card) => {
    if (leaders.some(l => l.id === leader.id) || leaders.length >= 2) {
      return;
    }
    setLeaders(prev => [...prev, leader]);
  }, [leaders]);

  const removeLeader = useCallback((leaderId: string) => {
    setLeaders(prev => prev.filter(leader => leader.id !== leaderId));
    
    // Reset subsequent stages if needed
    if (currentStage !== 'leaders') {
      setCurrentStageState('leaders');
      setBaseState(null);
      setDeckCards([]);
    }
  }, [currentStage]);

  // Base management
  const setBase = useCallback((newBase: Card | null) => {
    if (newBase === base) return;
    setBaseState(newBase);
  }, [base]);

  // Card management with optimized updates
  const addCard = useCallback((card: Card) => {
    if (isCardInDeck(card.id)) {
      console.log(`Card ${card.name} is already in the deck`);
      return;
    }
    
    setDeckCards(prev => [...prev, { card, quantity: 1 }]);
  }, [isCardInDeck]);

  const removeCard = useCallback((cardId: string) => {
    setDeckCards(prev => prev.filter(item => item.card.id !== cardId));
  }, []);

  const updateCardQuantity = useCallback((cardId: string, quantity: number) => {
    const clampedQuantity = Math.max(0, Math.min(quantity, 1)); // Twin Suns format
    
    if (clampedQuantity === 0) {
      removeCard(cardId);
      return;
    }
    
    setDeckCards(prev => 
      prev.map(item => 
        item.card.id === cardId ? { ...item, quantity: clampedQuantity } : item
      )
    );
  }, [removeCard]);

  // Utility functions
  const setDeckName = useCallback((name: string) => {
    setDeckNameState(name);
  }, []);

  const progressStage = useCallback(() => {
    if (currentStage === 'leaders' && leaders.length === 2) {
      setCurrentStageState('base');
    } else if (currentStage === 'base' && base) {
      setCurrentStageState('cards');
    }
  }, [currentStage, leaders.length, base]);

  const resetDeck = useCallback(() => {
    // Batch all resets together
    setLeaders([]);
    setBaseState(null);
    setDeckCards([]);
    setDeckNameState('New Deck');
    setCurrentStageState('leaders');
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
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
    // Computed values
    totalCards,
    isValidDeck,
    deckAspects,
  }), [
    currentStage, leaders, base, deckCards, deckName,
    addLeader, removeLeader, setBase, addCard, removeCard,
    isCardInDeck, updateCardQuantity, setDeckName,
    progressStage, resetDeck, isCardInAspect, setCurrentStage,
    totalCards, isValidDeck, deckAspects
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