// frontend/src/components/CardGrid.tsx - Improved with mobile tap-to-add

'use client';
import React, { useCallback, useState, useEffect } from 'react';
import { Card } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Plus, Check, Eye } from 'lucide-react';

interface CardGridProps {
  cards: Card[];
  onCardClickAction: (card: Card) => void; // Changed from onCardClick
  selectedCardId?: string;
  isCompatible?: (card: Card) => boolean;
  isInDeck?: (cardId: string) => boolean;
  onDoubleClickAction?: (card: Card) => void; // Changed from onDoubleClick
  currentStage?: 'leaders' | 'base' | 'cards';
  hideCardsInDeck?: boolean;
  isInCollection?: (cardId: string) => boolean;
  onAddToCollectionAction?: (cardId: string) => Promise<void>; // Changed from onAddToCollection
}

export function CardGrid({ 
  cards, 
  onCardClickAction: onCardClick, // Rename for internal use
  selectedCardId, 
  isCompatible,
  isInDeck,
  onDoubleClickAction: onDoubleClick, // Rename for internal use
  currentStage = 'cards',
  hideCardsInDeck = false,
  isInCollection,
  onAddToCollectionAction: onAddToCollection // Rename for internal use
}: CardGridProps) {
  
  const [isMobile, setIsMobile] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState<Set<string>>(new Set());
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Detect if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle card interaction - different behavior for mobile vs desktop
  const handleCardInteraction = useCallback(async (card: Card, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (isMobile) {
      // On mobile, single tap adds to collection/deck or shows details
      if (onAddToCollection && !isInCollection?.(card.id)) {
        // Add to collection on mobile
        try {
          setAddingToCollection(prev => new Set([...prev, card.id]));
          await onAddToCollection(card.id);
          setRecentlyAdded(prev => new Set([...prev, card.id]));
          
          // Clear the "recently added" status after 2 seconds
          setTimeout(() => {
            setRecentlyAdded(prev => {
              const newSet = new Set(prev);
              newSet.delete(card.id);
              return newSet;
            });
          }, 2000);
        } catch (error) {
          console.error('Error adding to collection:', error);
        } finally {
          setAddingToCollection(prev => {
            const newSet = new Set(prev);
            newSet.delete(card.id);
            return newSet;
          });
        }
      } else if (onDoubleClick && currentStage !== 'cards') {
        // For deck building stages, add to deck
        onDoubleClick(card);
      } else {
        // Otherwise show card details
        onCardClick(card);
      }
    } else {
      // On desktop, click shows details
      onCardClick(card);
    }
  }, [isMobile, onAddToCollection, isInCollection, onDoubleClick, currentStage, onCardClick]);

  // Handle double click for desktop
  const handleDoubleClick = useCallback((card: Card) => {
    if (!isMobile && onDoubleClick) {
      onDoubleClick(card);
    }
  }, [isMobile, onDoubleClick]);

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
        const owned = isInCollection ? isInCollection(card.id) : false;
        const isAdding = addingToCollection.has(card.id);
        const wasRecentlyAdded = recentlyAdded.has(card.id);
        
        return (
          <div
            key={`${card.id}-${index}`}
            className={cn(
              "relative cursor-pointer overflow-hidden rounded-lg transition-all duration-200",
              "border-2 flex-shrink-0 group", 
              isSelected ? "border-purple-500" : "border-gray-800",
              !compatible && "opacity-60",
              inDeck && "opacity-50",
              isMobile ? "active:scale-95" : "hover:scale-105"
            )}
            onClick={(e) => handleCardInteraction(card, e)}
            onDoubleClick={() => handleDoubleClick(card)}
          >
            {/* Collection Status Indicators */}
            {owned && (
              <div className="absolute top-1 right-1 z-20 bg-green-600 text-white text-xs font-bold py-0.5 px-2 rounded shadow-md">
                Owned
              </div>
            )}

            {wasRecentlyAdded && (
              <div className="absolute top-1 left-1 z-20 bg-green-500 text-white text-xs font-bold py-0.5 px-2 rounded shadow-md flex items-center gap-1">
                <Check className="w-3 h-3" />
                Added!
              </div>
            )}

            {/* Mobile Action Overlay */}
            {isMobile && (
              <div className="absolute inset-0 bg-black/0 group-active:bg-black/30 flex items-center justify-center opacity-0 group-active:opacity-100 transition-all z-10">
                <div className="bg-white/90 text-gray-900 text-sm font-medium px-3 py-2 rounded-full flex items-center gap-2">
                  {onAddToCollection && !owned ? (
                    <>
                      {isAdding ? (
                        <div className="animate-spin w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {isAdding ? 'Adding...' : 'Add to Collection'}
                    </>
                  ) : currentStage !== 'cards' && onDoubleClick ? (
                    <>
                      <Plus className="w-4 h-4" />
                      Add to Deck
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      View Details
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Hover Tooltip */}
            {!isMobile && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-80 transition-opacity z-10">
                <div className="text-white text-sm font-medium px-2 py-1 rounded text-center">
                  {onDoubleClick ? (
                    <>
                      Click to view details<br />
                      Double-click to {currentStage === 'leaders' ? 'select leader' : currentStage === 'base' ? 'select base' : 'add to deck'}
                    </>
                  ) : (
                    'Click to view details'
                  )}
                </div>
              </div>
            )}
            
            <div className="aspect-[7/10] w-full h-auto relative">
              {card.image_uri || card.image_url ? (
                <img
                  src={card.image_uri || card.image_url || ''}
                  alt={card.name || 'Card'}
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
                  {isMobile ? 'Tap' : 'Click'} to Select
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