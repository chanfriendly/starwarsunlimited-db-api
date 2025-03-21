'use client';

import React from 'react';
import { Card } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CardGridProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  selectedCardId?: string;
  isCompatible?: (card: Card) => boolean;
  onDoubleClick?: (card: Card) => void; // Add double-click handler
  currentStage?: 'leaders' | 'base' | 'cards'; // Add current stage
}

export function CardGrid({ 
  cards, 
  onCardClick, 
  selectedCardId, 
  isCompatible,
  onDoubleClick,
  currentStage = 'cards'
}: CardGridProps) {
  
  // Handle double click to directly add card to deck
  const handleDoubleClick = (card: Card) => {
    if (onDoubleClick) {
      onDoubleClick(card);
    }
  };
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-2">
      {cards.map((card) => {
        const isSelected = card.id === selectedCardId;
        const compatible = isCompatible ? isCompatible(card) : true;
        
        return (
          <div
            key={card.id}
            className={cn(
              "relative cursor-pointer overflow-hidden rounded-lg transition-all duration-200",
              "border-2 flex-shrink-0", 
              isSelected ? "border-purple-500" : "border-gray-800",
              !compatible && "opacity-60",
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
                  className="w-full h-full object-contain"
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
              
              {/* Action hint overlay for leaders */}
              {currentStage === 'leaders' && (
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
    </div>
  );
}