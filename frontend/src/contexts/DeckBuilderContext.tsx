'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
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

  // Function to directly set the current stage
  const setCurrentStage = (stage: DeckBuildingStage) => {
    console.log(`Setting stage from ${currentStage} to ${stage}`);
    // If going back to leaders stage, reset base
    if (stage === 'leaders' && currentStage !== 'leaders') {
      setBaseState(null);
    }
    setCurrentStageState(stage);
  };

  const addLeader = (leader: Card) => {
    // Check if this leader is already in the deck
    if (leaders.some(l => l.id === leader.id)) {
      console.log(`Leader ${leader.name} is already in the deck`);
      return;
    }
    
    if (leaders.length < 2) {
      setLeaders([...leaders, leader]);
      
      // Auto-progress if we've selected 2 leaders
      if (leaders.length === 1) {
        setCurrentStageState('base');
      }
    }
  };

  const removeLeader = (leaderId: string) => {
    setLeaders(leaders.filter(leader => leader.id !== leaderId));
    // If we remove a leader, go back to the leaders stage
    if (currentStage !== 'leaders') {
      setCurrentStageState('leaders');
      // Also reset base if we're going back to selecting leaders
      setBaseState(null);
    }
  };

  const setBase = (newBase: Card | null) => {
    console.log("Setting base:", newBase?.name);
    setBaseState(newBase);
    // Auto-progress if we've selected a base
    if (newBase && currentStage === 'base') {
      setCurrentStageState('cards');
    }
  };

  // Check if a card is already in the deck (leaders, base, or regular cards)
  const isCardInDeck = (cardId: string): boolean => {
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
  };

  // Modified to enforce Twin Suns format rule (no duplicates)
  const addCard = (card: Card) => {
    // First check if the card is already in the deck (leaders, base, or regular cards)
    if (isCardInDeck(card.id)) {
      console.log(`Card ${card.name} is already in the deck and cannot be added again in Twin Suns format`);
      return;
    }
    
    // In Twin Suns format, we always add with quantity 1
    setDeckCards([...deckCards, { card, quantity: 1 }]);
  };

  const removeCard = (cardId: string) => {
    setDeckCards(deckCards.filter(item => item.card.id !== cardId));
  };

  // This function is mostly for compatibility with non-Twin Suns formats
  // In Twin Suns, we generally won't use this as quantities should always be 1
  const updateCardQuantity = (cardId: string, quantity: number) => {
    // In Twin Suns format, quantity should always be 1 for regular cards
    const maxQuantity = 1;
    const actualQuantity = Math.min(quantity, maxQuantity);
    
    if (actualQuantity === 0) {
      // If quantity is set to 0, remove the card
      removeCard(cardId);
      return;
    }
    
    setDeckCards(
      deckCards.map(item => 
        item.card.id === cardId ? { ...item, quantity: actualQuantity } : item
      )
    );
  };

  // Update the setDeckName function to properly update state
  const setDeckName = (name: string) => {
    setDeckNameState(name);
  };

  const progressStage = () => {
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
  };

  const resetDeck = () => {
    setLeaders([]);
    setBaseState(null);
    setDeckCards([]);
    setDeckNameState('New Deck');
    setCurrentStageState('leaders');
  };

  // Function to check if a card is compatible with the current deck aspects
  const isCardInAspect = (card: Card): boolean => {
    if (leaders.length < 2 || !base) return true; // If deck isn't complete, all cards are "in aspect"
    
    // Get all aspects from leaders and base
    const deckAspects: Record<string, number> = {};
    
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
  };

  return (
    <DeckBuilderContext.Provider
      value={{
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
      }}
    >
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