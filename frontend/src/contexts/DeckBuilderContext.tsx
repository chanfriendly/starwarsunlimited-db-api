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
  updateCardQuantity: (cardId: string, quantity: number) => void;
  setDeckName: (name: string) => void;
  progressStage: () => void;
  resetDeck: () => void;
  isCardInAspect: (card: Card) => boolean;
  setCurrentStage: (stage: DeckBuildingStage) => void; // Add this line
}

const DeckBuilderContext = createContext<DeckBuilderContextType | undefined>(undefined);

export function DeckBuilderProvider({ children }: { children: ReactNode }) {
  const [currentStage, setCurrentStageState] = useState<DeckBuildingStage>('leaders');
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [base, setBaseState] = useState<Card | null>(null);
  const [deckCards, setDeckCards] = useState<DeckItem[]>([]);
  const [deckName, setDeckName] = useState('New Deck');

  // Add a function to explicitly set the current stage
  const setCurrentStage = (stage: DeckBuildingStage) => {
    console.log(`Setting stage from ${currentStage} to ${stage}`);
    setCurrentStageState(stage);
  };

  const addLeader = (leader: Card) => {
    if (leaders.length < 2 && !leaders.some(l => l.id === leader.id)) {
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

  const addCard = (card: Card) => {
    const existingCard = deckCards.find(item => item.card.id === card.id);
    
    if (existingCard) {
      updateCardQuantity(card.id, existingCard.quantity + 1);
    } else {
      setDeckCards([...deckCards, { card, quantity: 1 }]);
    }
  };

  const removeCard = (cardId: string) => {
    setDeckCards(deckCards.filter(item => item.card.id !== cardId));
  };

  const updateCardQuantity = (cardId: string, quantity: number) => {
    setDeckCards(
      deckCards.map(item => 
        item.card.id === cardId ? { ...item, quantity } : item
      )
    );
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
    setDeckName('New Deck');
    setCurrentStageState('leaders');
  };

  // Check if a card is compatible with the current deck aspects
  const isCardInAspect = (card: Card): boolean => {
    if (leaders.length < 2 || !base) return false;
    
    // Get all aspects from the leaders and base
    const deckAspects = [
      ...leaders.flatMap(leader => leader.aspects?.map(a => a.aspect_name) || []),
      ...(base.aspects?.map(a => a.aspect_name) || [])
    ];
    
    // Check if any of the card's aspects are in the deck
    const cardAspects = card.aspects?.map(a => a.aspect_name) || [];
    
    return cardAspects.some(aspect => deckAspects.includes(aspect));
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
        updateCardQuantity,
        setDeckName,
        progressStage,
        resetDeck,
        isCardInAspect,
        setCurrentStage, // Add this line to include the function in the context
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