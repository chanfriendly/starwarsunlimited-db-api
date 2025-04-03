'use client';

import React, { useState } from 'react';
import { Card } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface CardDetailProps {
  card: Card | null;
  onAddToDeck?: (card: Card) => void;
  onRemoveFromDeck?: (cardId: string) => void;
  isInDeck?: boolean;
  isCompatible?: boolean;
  currentStage?: 'leaders' | 'base' | 'cards';
}

const MemoizedCardDetail = React.memo(CardDetail);


export function CardDetail({ 
  card, 
  onAddToDeck, 
  onRemoveFromDeck, 
  isInDeck = false,
  isCompatible = true,
  currentStage = 'cards'
}: CardDetailProps) {
  const [showBackSide, setShowBackSide] = useState(false);
  
  // Only allow flipping for cards with a back side (mainly Leaders)
  const canFlip = card?.image_back_uri !== undefined && card?.image_back_uri !== null;
  
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

  const currentImage = showBackSide && card.image_back_uri ? card.image_back_uri : card.image_uri;

  // Function to get the appropriate button text based on the card's stage and status
  const getButtonText = () => {
    if (isInDeck) {
      return `Remove ${currentStage === 'leaders' ? 'Leader' : currentStage === 'base' ? 'Base' : 'Card'}`;
    }

    if (!isCompatible) {
      return 'Incompatible with Deck';
    }

    if (currentStage === 'base' && card.type !== 'Base') {
      return 'Not a Base Card';
    }

    return `Add as ${currentStage === 'leaders' ? 'Leader' : currentStage === 'base' ? 'Base' : 'Card'}`;
  };

  // Get the button disabled state
  const isButtonDisabled = () => {
    if (isInDeck) {
      return false; // Can always remove
    }

    // Can't add incompatible cards
    if (!isCompatible) {
      return true;
    }

    // Can't add non-base cards as base
    if (currentStage === 'base' && card.type !== 'Base') {
      return true;
    }

    return false;
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex flex-col items-center mb-6">
        {/* Card image with controlled size */}
        <div className="max-w-xs w-full mx-auto mb-4 relative">
          <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700">
            {currentImage ? (
              <img
                src={currentImage}
                alt={`${card.name} ${showBackSide ? '(back)' : '(front)'}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <span className="text-lg text-center p-4">{card.name}</span>
              </div>
            )}
          </div>
          
          {/* Flip button for cards with back side */}
          {canFlip && (
            <button 
              className="absolute top-2 right-2 p-2 bg-purple-500 rounded-full text-white"
              onClick={() => setShowBackSide(!showBackSide)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
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
                {getButtonText()}
              </Button>
            ) : (
              <Button 
                onClick={() => onAddToDeck(card)}
                className={`w-full ${!isCompatible ? 'bg-gray-700' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                disabled={isButtonDisabled()}
              >
                {getButtonText()}
              </Button>
            )}
            
            {/* Special warning for already-in-deck in Twin Suns format */}
            {currentStage === 'cards' && isInDeck && (
              <p className="text-xs text-amber-400 mt-2 text-center">
                In Twin Suns format, each card can only appear once in a deck.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}