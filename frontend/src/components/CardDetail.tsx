'use client';

import React from 'react';
import { Card } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface CardDetailProps {
  card: Card | null;
  onAddToDeck?: (card: Card) => void;
  onRemoveFromDeck?: (cardId: string) => void;
  isInDeck?: boolean;
  isCompatible?: boolean;
  currentStage?: 'leaders' | 'base' | 'cards'; // Add this prop
}

export function CardDetail({ 
  card, 
  onAddToDeck, 
  onRemoveFromDeck, 
  isInDeck = false,
  isCompatible = true,
  currentStage = 'cards' // Default to 'cards'
}: CardDetailProps) {
  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="w-16 h-16 rounded-full bg-gray-800 mb-4 flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">No Card Selected</h3>
        <p className="text-gray-400 text-center">
          Select a card to view its details
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex flex-col items-center mb-6">
        {/* Card image with controlled size */}
        <div className="max-w-xs w-full mx-auto mb-4">
          <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700">
            {card.image_uri ? (
              <img
                src={card.image_uri}
                alt={card.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <span className="text-lg text-center p-4">{card.name}</span>
              </div>
            )}
          </div>
        </div>
        
        <h2 className="text-xl font-bold mb-1">{card.name}</h2>
        {card.subtitle && (
          <p className="text-gray-400 mb-2">{card.subtitle}</p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {card.aspects?.map((aspect) => (
            <div 
              key={aspect.aspect_name}
              className="px-2 py-1 text-xs rounded-full"
              style={{
                backgroundColor: `${aspect.aspect_color}30`,
                color: aspect.aspect_color,
                border: `1px solid ${aspect.aspect_color}`
              }}
            >
              {aspect.aspect_name}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4 bg-gray-800/50 p-3 rounded-lg w-full max-w-xs">
          {card.energy_cost !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Cost</p>
              <p className="text-lg font-bold text-amber-400">{card.energy_cost}</p>
            </div>
          )}
          {card.attack !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Attack</p>
              <p className="text-lg font-bold text-red-400">{card.attack}</p>
            </div>
          )}
          {card.health !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Health</p>
              <p className="text-lg font-bold text-green-400">{card.health}</p>
            </div>
          )}
        </div>
        
        {card.text && (
          <div className="mb-4 w-full max-w-xs">
            <h3 className="text-sm font-medium mb-1">Card Text</h3>
            <p className="text-sm text-gray-300 whitespace-pre-line">{card.text}</p>
          </div>
        )}
        
        {card.keywords && card.keywords.length > 0 && (
          <div className="mb-4 w-full max-w-xs">
            <h3 className="text-sm font-medium mb-1">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {card.keywords.map((keyword) => (
                <span 
                  key={keyword}
                  className="text-xs px-2 py-1 bg-purple-900/30 border border-purple-700 text-purple-300 rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {onAddToDeck && onRemoveFromDeck && (
          <div className="mt-4 w-full max-w-xs">
            {isInDeck ? (
              <Button 
                onClick={() => onRemoveFromDeck(card.id)}
                variant="destructive"
                className="w-full"
              >
                Remove {currentStage === 'leaders' ? 'Leader' : currentStage === 'base' ? 'Base' : 'Card'}
              </Button>
            ) : (
              <Button 
                onClick={() => onAddToDeck(card)}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                disabled={!isCompatible}
              >
                {!isCompatible ? 'Incompatible with Deck' : 
                  currentStage === 'leaders' ? 'Add as Leader' : 
                  currentStage === 'base' ? 'Add as Base' : 'Add to Deck'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}