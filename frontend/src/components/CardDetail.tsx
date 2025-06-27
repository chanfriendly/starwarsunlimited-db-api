'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ApiCard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Define the alternate art structure based on backend grouping
interface AlternateArt {
  id: string;
  image_uri: string;
  set_name: string;
  set_code: string;
  card_number: string;
  rarity: string;
  artist: string;
}

// Extend ApiCard to include the alternate_arts that gets added by backend grouping
interface GroupedApiCard extends ApiCard {
  alternate_arts?: AlternateArt[];
}

interface CardDetailProps {
  card: GroupedApiCard | null;
  onAddToDeck?: (card: GroupedApiCard) => void;
  onRemoveFromDeck?: (cardId: string) => void;
  isInDeck?: boolean;
  isCompatible?: boolean;
  currentStage?: 'leaders' | 'base' | 'cards';
}

export function CardDetail({
  card,
  onAddToDeck,
  onRemoveFromDeck,
  isInDeck = false,
  isCompatible = true,
  currentStage = 'cards',
}: CardDetailProps) {
  const [showBackSide, setShowBackSide] = useState(false);
  const [selectedArtIndex, setSelectedArtIndex] = useState(0);

  // Reset art selection when card changes
  useEffect(() => {
    setSelectedArtIndex(0);
    setShowBackSide(false);
  }, [card?.id]);

  // Create array of all available art variants (main card + alternates)
  const allArtVariants = useMemo(() => {
    if (!card) return [];
    
    const variants = [
      // Main card as first variant
      {
        id: card.id,
        image_uri: card.image_uri,
        set_name: card.set_name,
        set_code: card.set_code,
        card_number: card.card_number,
        rarity: card.rarity,
        artist: card.artist,
        isMainCard: true,
      },
      // Add alternate arts
      ...(card.alternate_arts || []).map(art => ({
        ...art,
        isMainCard: false,
      }))
    ];
    
    return variants;
  }, [card]);

  // Get currently displayed card data (main card properties + selected art's image)
  const displayCard = useMemo(() => {
    if (!card || allArtVariants.length === 0) return null;
    
    const selectedArt = allArtVariants[selectedArtIndex];
    
    return {
      ...card, // Use main card's data for everything except image
      image_uri: selectedArt.image_uri, // Override with selected art's image
      set_name: selectedArt.set_name,
      set_code: selectedArt.set_code,
      artist: selectedArt.artist,
      rarity: selectedArt.rarity,
    };
  }, [card, allArtVariants, selectedArtIndex]);

  // Navigation functions
  const navigateToPreviousArt = () => {
    setSelectedArtIndex(prev => 
      prev === 0 ? allArtVariants.length - 1 : prev - 1
    );
  };

  const navigateToNextArt = () => {
    setSelectedArtIndex(prev => 
      prev === allArtVariants.length - 1 ? 0 : prev + 1
    );
  };

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
  const hasMultipleArts = allArtVariants.length > 1;

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

  const isButtonDisabled = () => {
    return !isCompatible || (currentStage === 'base' && displayCard.type !== 'Base');
  };

  return (
    <div className="flex flex-col items-center p-6 h-full overflow-y-auto">
      {/* Card Image Section */}
      <div className="relative mb-4">
        <div
          className={`relative ${
            onAddToDeck && onRemoveFromDeck && !isButtonDisabled() 
              ? 'cursor-pointer' : ''
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
              className="absolute top-2 right-2 p-2 bg-purple-500 rounded-full text-white hover:bg-purple-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowBackSide(!showBackSide);
              }}
              title={showBackSide ? "Show front side" : "Show back side"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          {/* Art Navigation Controls */}
          {hasMultipleArts && (
            <>
              {/* Art counter and info */}
              <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-2">
                <span>{selectedArtIndex + 1} / {allArtVariants.length}</span>
                {allArtVariants[selectedArtIndex].set_code && (
                  <span className="text-gray-300">
                    ({allArtVariants[selectedArtIndex].set_code})
                  </span>
                )}
              </div>

              {/* Navigation arrows */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
                <button
                  className="p-2 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToPreviousArt();
                  }}
                  title="Previous art variant"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <button
                  className="p-2 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToNextArt();
                  }}
                  title="Next art variant"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Art variant indicator dots */}
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                {allArtVariants.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === selectedArtIndex 
                        ? 'bg-white' 
                        : 'bg-white/50 hover:bg-white/70'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArtIndex(index);
                    }}
                    title={`Art variant ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
        
      {/* Card Information */}
      <h2 className="text-xl font-bold mb-1">{displayCard.name}</h2>
      {displayCard.subtitle && (
        <p className="text-gray-400 mb-2">{displayCard.subtitle}</p>
      )}
      
      {/* Aspects */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {displayCard.aspects?.map((aspect: any) => (
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
      
      {/* Stats */}
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
      
      {/* Card Text */}
      {displayCard.text && (
        <div className="mb-4 w-full max-w-xs">
          <h3 className="text-sm font-medium mb-1">Card Text</h3>
          <p className="text-sm text-gray-300 whitespace-pre-line">{displayCard.text}</p>
        </div>
      )}
      
      {/* Keywords */}
      {displayCard.keywords && displayCard.keywords.length > 0 && (
        <div className="mb-4 w-full max-w-xs">
          <h3 className="text-sm font-medium mb-1">Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {displayCard.keywords.map((keyword: any) => (
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

      {/* Current Art Information */}
      {hasMultipleArts && (
        <div className="mb-4 w-full max-w-xs">
          <h3 className="text-sm font-medium mb-1">Current Art</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p><span className="text-gray-300">Set:</span> {displayCard.set_name}</p>
            {displayCard.artist && (
              <p><span className="text-gray-300">Artist:</span> {displayCard.artist}</p>
            )}
            <p><span className="text-gray-300">Rarity:</span> {displayCard.rarity}</p>
          </div>
        </div>
      )}
      
      {/* Action Button */}
      {onAddToDeck && onRemoveFromDeck && (
        <div className="mt-4 w-full max-w-xs">
          <Button
            onClick={() => {
              if (isInDeck) {
                onRemoveFromDeck(displayCard.id);
              } else if (!isButtonDisabled()) {
                onAddToDeck(displayCard);
              }
            }}
            disabled={isButtonDisabled()}
            className={`w-full ${
              isInDeck
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : isButtonDisabled()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {getButtonText()}
          </Button>
        </div>
      )}
    </div>
  );
}

export default React.memo(CardDetail);