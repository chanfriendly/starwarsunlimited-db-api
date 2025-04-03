'use client';

import React from 'react';
import { Card } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CardGridProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  selectedCardId?: string;
  isCompatible?: (card: Card) => boolean;
  isInDeck?: (cardId: string) => boolean;
  onDoubleClick?: (card: Card) => void;
  currentStage?: 'leaders' | 'base' | 'cards';
  hideCardsInDeck?: boolean;
}

export function CardGrid({ 
  cards, 
  onCardClick, 
  selectedCardId, 
  isCompatible,
  isInDeck,
  onDoubleClick,
  currentStage = 'cards',
  hideCardsInDeck = false
}: CardGridProps) {
  
  // Handle double click to directly add card to deck
  const handleDoubleClick = (card: Card) => {
    if (onDoubleClick) {
      onDoubleClick(card);
    }
  };

  // Filter out cards that should be hidden
  const visibleCards = hideCardsInDeck && isInDeck 
    ? cards.filter(card => !isInDeck(card.id)) 
    : cards;
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-2">
      {visibleCards.map((card, index) => {
        const isSelected = card.id === selectedCardId;
        const compatible = isCompatible ? isCompatible(card) : true;
        const inDeck = isInDeck ? isInDeck(card.id) : false;
        
        return (
          <div
          key={`${card.id}-${index}`}
              className={cn(
              "relative cursor-pointer overflow-hidden rounded-lg transition-all duration-200",
              "border-2 flex-shrink-0", 
              isSelected ? "border-purple-500" : "border-gray-800",
              !compatible && "opacity-60",
              inDeck && "opacity-50",
              "hover:scale-105"
            )}
            onClick={() => onCardClick(card)}
            onDoubleClick={() => handleDoubleClick(card)}
          >
            <div className="aspect-[7/10] w-full h-auto relative">
              {card.image_uri ? (
                <img
                  src={card.image_uri}
                  alt={card.name}
                  className={cn(
                    "w-full h-full object-contain",
                    inDeck && "grayscale"
                  )}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <span className="text-xs text-center px-2">{card.name}</span>
                </div>
              )}
              
              {/* Selection overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                  <svg 
                    className="w-10 h-10 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M5 13l4 4L19 7" 
                    />
                  </svg>
                </div>
              )}
              
              {/* Action hint overlay for leaders and bases */}
              {(currentStage === 'leaders' || currentStage === 'base') && (
                <div className="absolute top-1 left-1 bg-purple-500/90 text-white text-xs py-0.5 px-1 rounded-full">
                  Click to Select
                </div>
              )}
              
              {/* Compatibility indicator */}
              {!compatible && (
                <div className="absolute top-1 right-1 bg-amber-600/90 text-white text-xs py-0.5 px-1 rounded-full">
                  Out of Aspect
                </div>
              )}

              {/* Already in Deck indicator */}
              {inDeck && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-full transform -rotate-12">
                    Already in Deck
                  </div>
                </div>
              )}
              
              {/* Card type badge */}
              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs py-0.5 px-1 rounded-full">
                {card.type}
              </div>
            </div>
            
            <div className="p-1 bg-gray-900 text-center">
              <h3 className="text-xs font-medium text-white truncate">{card.name}</h3>
            </div>
          </div>
        );
      })}

      {visibleCards.length === 0 && (
        <div className="col-span-full py-16 text-center text-gray-500">
          {hideCardsInDeck && isInDeck ? 
            "All available cards have been added to your deck." : 
            "No cards found matching your criteria."}
        </div>
      )}
    </div>
  );
}