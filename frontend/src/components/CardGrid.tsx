// Fixed CardGrid - Trust backend grouping, don't re-group on frontend
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

// Define alternate art structure
interface AlternateArt {
  id: string;
  image_uri: string;
  set_name: string;
  set_code: string;
  card_number: string;
  rarity: string;
  artist: string;
}

// Extended interface for cards that may have alternate arts from backend
interface ApiCardWithAlternates extends ApiCard {
  alternate_arts?: AlternateArt[];
}

// Extended interface for display cards
interface DisplayCard extends ApiCardWithAlternates {
  hasMultipleVariants: boolean;
  currentVariantIndex: number;
  variants: ApiCard[];
}

export function CardGrid({ 
  cards, 
  onCardClickAction, 
  isInCollection,
  hideCardsInDeck = false,
  isInDeck,
  compatibleCards
}: CardGridProps) {
  // Track selected art variants for each unique card (by ID, not name)
  const [selectedArtVariants, setSelectedArtVariants] = useState<Record<string, number>>({});
  
  // Convert backend-grouped cards to display format
  const displayCards: DisplayCard[] = cards.map((card) => {
    const cardWithAlternates = card as ApiCardWithAlternates;
    const hasAlternateArts = cardWithAlternates.alternate_arts && cardWithAlternates.alternate_arts.length > 0;
    
    // If card has alternate arts, create variants array including main card
    if (hasAlternateArts) {
      const variants = [
        card, // Main card first
        ...cardWithAlternates.alternate_arts!.map((alt: AlternateArt) => ({
          ...card, // Copy all properties from main card
          id: alt.id, // Override with alternate art's ID and image
          image_uri: alt.image_uri,
          set_name: alt.set_name,
          set_code: alt.set_code,
          card_number: alt.card_number,
          rarity: alt.rarity,
          artist: alt.artist,
        }))
      ];
      
      return {
        ...cardWithAlternates,
        hasMultipleVariants: true,
        variants,
        currentVariantIndex: selectedArtVariants[card.id] || 0
      };
    }
    
    // Single card with no variants
    return {
      ...cardWithAlternates,
      hasMultipleVariants: false,
      variants: [card],
      currentVariantIndex: 0
    };
  });

  // Get the currently selected variant for a card
  const getSelectedVariant = useCallback((cardId: string, variants: ApiCard[]) => {
    const selectedIndex = selectedArtVariants[cardId] || 0;
    return variants[Math.min(selectedIndex, variants.length - 1)];
  }, [selectedArtVariants]);

  // Handle art variant cycling
  const cycleArtVariant = useCallback((cardId: string, variants: ApiCard[], direction: 'next' | 'prev') => {
    const currentIndex = selectedArtVariants[cardId] || 0;
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % variants.length;
    } else {
      newIndex = currentIndex === 0 ? variants.length - 1 : currentIndex - 1;
    }
    
    setSelectedArtVariants(prev => ({
      ...prev,
      [cardId]: newIndex
    }));
  }, [selectedArtVariants]);

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
        // Get the currently displayed variant
        const currentVariant = displayCard.hasMultipleVariants 
          ? getSelectedVariant(displayCard.id, displayCard.variants)
          : displayCard;
          
        const inCollection = isInCollection ? isInCollection(currentVariant.id) : false;
        const inDeck = isInDeck ? isInDeck(currentVariant.id) : false;
        const compatible = compatibleCards ? compatibleCards.has(currentVariant.id) : true;

        return (
          <div key={displayCard.id} className="group relative">
            <div
              className={`
                relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer
                ${inCollection ? 'border-green-500/50' : 'border-gray-700'}
                ${inDeck ? 'ring-2 ring-red-500/50' : ''}
                ${compatible ? 'hover:border-purple-500/50' : 'border-red-500/50'}
                ${inCollection ? 'bg-green-900/10' : ''}
                ${inDeck ? 'bg-red-900/10' : ''}
                ${!compatible ? 'bg-red-900/10' : ''}
                ${inCollection && !inDeck ? 'ring-2 ring-green-500/50' : ''}
                group-hover:shadow-lg group-hover:shadow-purple-500/20
              `}
              onClick={() => onCardClickAction(currentVariant)}
            >
              {/* Card Image */}
              <div className="aspect-[7/10] relative">
                {currentVariant.image_uri ? (
                  <img
                    src={currentVariant.image_uri}
                    alt={currentVariant.name}
                    className={`w-full h-full ${currentVariant.type === 'Leader' || currentVariant.type === 'Base' ? 'object-contain' : 'object-cover'}`}
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
                          cycleArtVariant(displayCard.id, displayCard.variants, 'prev');
                        }}
                        title="Previous art variant"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      <button
                        className="p-1 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleArtVariant(displayCard.id, displayCard.variants, 'next');
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
                              [displayCard.id]: index
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
                  {currentVariant.type}
                </div>
              </div>

              {/* Card Info */}
              <div className="p-2 bg-gray-900">
                <h3 className="text-xs font-medium text-white truncate">{currentVariant.name}</h3>
                {currentVariant.subtitle && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{currentVariant.subtitle}</p>
                )}
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">{currentVariant.set_name || 'Unknown Set'}</span>
                  {currentVariant.energy_cost !== null && currentVariant.energy_cost !== undefined && (
                    <span className="text-xs font-bold text-yellow-400">
                      {currentVariant.energy_cost}
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
                          ? 'border-purple-500' 
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArtVariants(prev => ({
                          ...prev,
                          [displayCard.id]: index
                        }));
                      }}
                      title={`${variant.set_name} - ${variant.artist || 'Unknown Artist'}`}
                    >
                      {variant.image_uri && (
                        <img
                          src={variant.image_uri}
                          alt={`${variant.name} variant`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}