// Fixed frontend/src/components/CardGrid.tsx - Correct Property Names
'use client';

import React, { useState, useCallback } from 'react';
import { ApiCard } from '@/lib/api';
import { ChevronLeft, ChevronRight, Image } from 'lucide-react';

interface CardGridProps {
  cards: ApiCard[];
  onCardClickAction: (card: ApiCard) => void;
  isInCollection?: (cardId: string) => boolean;
  hideCardsInDeck?: boolean;
  isInDeck?: (cardId: string) => boolean;
  compatibleCards?: Set<string>;
}

export function CardGrid({ 
  cards, 
  onCardClickAction, 
  isInCollection,
  hideCardsInDeck = false,
  isInDeck,
  compatibleCards
}: CardGridProps) {
  // Track selected art variants for each card
  const [selectedArtVariants, setSelectedArtVariants] = useState<Record<string, number>>({});
  
  // Group cards by name to handle art variants
  const groupedCards = cards.reduce((acc, card) => {
    const key = card.name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(card);
    return acc;
  }, {} as Record<string, ApiCard[]>);

  // Get the currently selected variant for a card group
  const getSelectedVariant = useCallback((cardName: string, variants: ApiCard[]) => {
    const selectedIndex = selectedArtVariants[cardName] || 0;
    return variants[Math.min(selectedIndex, variants.length - 1)];
  }, [selectedArtVariants]);

  // Handle art variant cycling
  const cycleArtVariant = useCallback((cardName: string, variants: ApiCard[], direction: 'next' | 'prev') => {
    const currentIndex = selectedArtVariants[cardName] || 0;
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % variants.length;
    } else {
      newIndex = currentIndex === 0 ? variants.length - 1 : currentIndex - 1;
    }
    
    setSelectedArtVariants(prev => ({
      ...prev,
      [cardName]: newIndex
    }));
  }, [selectedArtVariants]);

  // Create display cards from grouped cards
  const displayCards = Object.entries(groupedCards).map(([cardName, variants]) => {
    const selectedCard = getSelectedVariant(cardName, variants);
    return {
      ...selectedCard,
      variants: variants,
      hasMultipleVariants: variants.length > 1,
      currentVariantIndex: selectedArtVariants[cardName] || 0
    };
  });

  // Filter cards based on deck status if needed
  const visibleCards = displayCards.filter(card => {
    if (hideCardsInDeck && isInDeck) {
      return !isInDeck(card.id);
    }
    return true;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {visibleCards.map((displayCard) => {
        const inCollection = isInCollection ? isInCollection(displayCard.id) : false;
        const inDeck = isInDeck ? isInDeck(displayCard.id) : false;
        const compatible = compatibleCards ? compatibleCards.has(displayCard.id) : true;
        
        return (
          <div
            key={`${displayCard.name}-${displayCard.currentVariantIndex}`}
            className="group relative"
          >
            {/* Main Card Container */}
            <div
              className={`
                relative bg-gray-800 rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer
                ${compatible ? 'border-gray-700 hover:border-purple-500' : 'border-red-500/50'}
                ${inCollection ? 'ring-2 ring-green-500/50' : ''}
                group-hover:shadow-lg group-hover:shadow-purple-500/20
              `}
              onClick={() => onCardClickAction(displayCard)}
            >
              {/* Card Image - FIXED: Use safe property access */}
              <div className="aspect-[7/10] relative">
                {displayCard.image_uri ? (
                  <img
                    src={displayCard.image_uri}
                    alt={displayCard.name}
                    className={`w-full h-full ${displayCard.type === 'Leader' || displayCard.type === 'Base' ? 'object-contain' : 'object-cover'}`}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
                    <Image className="w-8 h-8" />
                  </div>
                )}

                {/* Art Variant Indicators */}
                {displayCard.hasMultipleVariants && (
                  <>
                    {/* Variant Counter */}
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Image className="w-3 h-3" />
                      {displayCard.currentVariantIndex + 1}/{displayCard.variants.length}
                    </div>

                    {/* Art Cycling Controls - Show on Hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between px-2 pointer-events-none">
                      <button
                        className="p-1 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleArtVariant(displayCard.name, displayCard.variants, 'prev');
                        }}
                        title="Previous art variant"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      <button
                        className="p-1 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleArtVariant(displayCard.name, displayCard.variants, 'next');
                        }}
                        title="Next art variant"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Art Variant Dots */}
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                      {displayCard.variants.map((_, index) => (
                        <button
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === displayCard.currentVariantIndex 
                              ? 'bg-purple-500' 
                              : 'bg-gray-500 hover:bg-gray-400'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArtVariants(prev => ({
                              ...prev,
                              [displayCard.name]: index
                            }));
                          }}
                          title={`Art variant ${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Collection Status */}
                {inCollection && (
                  <div className="absolute top-2 left-2 bg-green-600/90 text-white text-xs py-0.5 px-2 rounded-full">
                    Owned
                  </div>
                )}

                {/* Touch indicator for mobile */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 sm:hidden">
                  <div className="bg-purple-600 text-white text-xs py-1 px-2 rounded-full">
                    {displayCard.hasMultipleVariants ? 'Tap for Details' : 'Tap to Select'}
                  </div>
                </div>

                {/* Compatibility indicator */}
                {!compatible && (
                  <div className="absolute top-1 right-1 bg-red-600/90 text-white text-xs py-0.5 px-1 rounded-full">
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
                  {displayCard.type}
                </div>
              </div>

              {/* Card Info - FIXED: Use safe property access */}
              <div className="p-2 bg-gray-900">
                <h3 className="text-xs font-medium text-white truncate">{displayCard.name}</h3>
                {displayCard.subtitle && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{displayCard.subtitle}</p>
                )}
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">{displayCard.set_name || 'Unknown Set'}</span>
                  {displayCard.energy_cost !== null && displayCard.energy_cost !== undefined && (
                    <span className="text-xs font-bold text-yellow-400">
                      {displayCard.energy_cost}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Art Variants Preview Thumbnails - Show on Hover for Desktop */}
            {displayCard.hasMultipleVariants && (
              <div className="absolute -bottom-16 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block pointer-events-none z-10">
                <div className="flex justify-center space-x-1 p-2 bg-black/90 rounded-lg backdrop-blur-sm">
                  {displayCard.variants.slice(0, 4).map((variant, index) => (
                    <div
                      key={variant.id}
                      className={`w-8 h-12 rounded border overflow-hidden cursor-pointer pointer-events-auto ${
                        index === displayCard.currentVariantIndex 
                          ? 'border-purple-500 ring-1 ring-purple-500' 
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArtVariants(prev => ({
                          ...prev,
                          [displayCard.name]: index
                        }));
                      }}
                      title={`Switch to variant ${index + 1}`}
                    >
                      <img
                        src={variant.image_uri || ''}
                        alt={`${variant.name} variant ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide broken images gracefully
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                  {displayCard.variants.length > 4 && (
                    <div className="w-8 h-12 rounded border border-gray-600 bg-gray-800 flex items-center justify-center text-gray-400 text-xs">
                      +{displayCard.variants.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
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