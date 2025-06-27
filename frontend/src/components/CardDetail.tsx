'use client';

import React, { useState } from 'react';
import { Card, GroupedCard, AlternateArt } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface CardDetailProps {
  card: GroupedCard | null;
  onAddToDeck?: (card: GroupedCard) => void;
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
  currentStage = 'cards',
}: CardDetailProps) {
  const [showBackSide, setShowBackSide] = useState(false);
  const [selectedArtId, setSelectedArtId] = useState<string | undefined>(card?.id);

  useEffect(() => {
    setSelectedArtId(card?.id);
  }, [card]);

  const displayCard = useMemo(() => {
    if (!card) return null;
    if (selectedArtId === card.id) return card;
    return card.alternate_arts?.find(art => art.id === selectedArtId) || card;
  }, [card, selectedArtId]);

  // Only allow flipping for cards with a back side (mainly Leaders)
  const canFlip = displayCard?.image_back_uri !== undefined && displayCard?.image_back_uri !== null;
  
  if (!displayCard) {
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

  const currentImage = showBackSide && displayCard.image_back_uri ? displayCard.image_back_uri : displayCard.image_uri;

  // Function to get the appropriate button text based on the card's stage and status
  const getButtonText = () => {
    if (isInDeck) {
      return `Remove ${currentStage === 'leaders' ? 'Leader' : currentStage === 'base' ? 'Base' : 'Card'}`;
    }

    if (!isCompatible) {
      return 'Incompatible with Deck';
    }

    if (currentStage === 'base' && displayCard.type !== 'Base') {
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
    if (currentStage === 'base' && displayCard.type !== 'Base') {
      return true;
    }

    return false;
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex flex-col items-center mb-6">
        {/* Card image with controlled size */}
        <div 
          className={`max-w-xs w-full mx-auto mb-4 relative ${
            onAddToDeck && onRemoveFromDeck ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
            if (onAddToDeck && onRemoveFromDeck && displayCard) {
              if (isInDeck) {
                onRemoveFromDeck(displayCard.id);
              } else if (!isButtonDisabled()) {
                onAddToDeck(displayCard);
              }
            }
          }}
        >
          <div className="aspect-[7/10] relative rounded-lg overflow-hidden border border-gray-700">
            {currentImage ? (
              <img
                src={currentImage}
                alt={`${displayCard.name} ${showBackSide ? '(back)' : '(front)'}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <span className="text-lg text-center p-4">{displayCard.name}</span>
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

          {/* Alternate Art Selector */}
          {card && card.alternate_arts && card.alternate_arts.length > 0 && (
            <div className="absolute top-2 left-2 z-10">
              <select
                className="bg-gray-900 text-white text-xs rounded-full px-1 py-0.5"
                value={selectedArtId}
                onChange={(e) => setSelectedArtId(e.target.value)}
              >
                <option value={card.id}>Main Art</option>
                {card.alternate_arts.map(art => (
                  <option key={art.id} value={art.id}>
                    Alt Art ({art.set_code || art.set_name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <h2 className="text-xl font-bold mb-1">{displayCard.name}</h2>
        {displayCard.subtitle && (
          <p className="text-gray-400 mb-2">{displayCard.subtitle}</p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {displayCard.aspects?.map((aspect) => (
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
          {displayCard.energy_cost !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Cost</p>
              <p className="text-lg font-bold text-amber-400">{displayCard.energy_cost}</p>
            </div>
          )}
          {displayCard.attack !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Attack</p>
              <p className="text-lg font-bold text-red-400">{displayCard.attack}</p>
            </div>
          )}
          {displayCard.health !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Health</p>
              <p className="text-lg font-bold text-green-400">{displayCard.health}</p>
            </div>
          )}
        </div>
        
        {displayCard.text && (
          <div className="mb-4 w-full max-w-xs">
            <h3 className="text-sm font-medium mb-1">Card Text</h3>
            <p className="text-sm text-gray-300 whitespace-pre-line">{displayCard.text}</p>
          </div>
        )}
        
        {displayCard.keywords && displayCard.keywords.length > 0 && (
          <div className="mb-4 w-full max-w-xs">
            <h3 className="text-sm font-medium mb-1">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {displayCard.keywords.map((keyword) => (
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
                onClick={() => onRemoveFromDeck(displayCard.id)}
                variant="destructive"
                className="w-full"
              >
                {getButtonText()}
              </Button>
            ) : (
              <Button 
                onClick={() => onAddToDeck(displayCard)}
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