"use client"

import * as React from "react"
import { Card } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

interface CardGridProps {
  cards: Card[]
  onCardClick?: (card: Card) => void
  selectedCardId?: string
  getCompatibilityStatus?: (card: Card) => { compatible: boolean; compatibility: 'full' | 'partial' | 'none' }
}

export function CardGrid({ cards, onCardClick, selectedCardId, getCompatibilityStatus }: CardGridProps) {
  // Group cards by type for different layout treatments
  const horizontalCards = cards.filter(card => 
    card.type === "Leader" || card.type === "Base"
  );
  
  const verticalCards = cards.filter(card => 
    card.type !== "Leader" && card.type !== "Base"
  );

  // Function to render a single card
  const renderCard = (card: Card, isHorizontal: boolean) => {
    const isSelected = selectedCardId === card.id;
    const compatibilityStatus = getCompatibilityStatus 
      ? getCompatibilityStatus(card) 
      : { compatible: true, compatibility: 'full' as const };
    
    return (
      <div
        key={card.id}
        className={cn(
          "cursor-pointer border-2 rounded-lg overflow-hidden",
          isSelected ? "border-primary" : "border-zinc-800/50",
          "hover:border-primary/50 transition-all",
        )}
        style={{ 
          width: "100%", 
          display: "inline-block"
        }}
        onClick={() => onCardClick?.(card)}
      >
        {/* Card image with appropriate aspect ratio */}
        <div 
          className="relative"
          style={{ 
            paddingBottom: isHorizontal ? "75%" : "140%",
            position: "relative"
          }}
        >
          {card.image_uri ? (
            <img
              src={card.image_uri}
              alt={card.name}
              className="absolute top-0 left-0 w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/30">
              No Image
            </div>
          )}
          
          {/* Card type badge */}
          <div className="absolute bottom-1 left-1">
            <Badge variant="outline" className="bg-black/60 text-xs">
              {card.type}
            </Badge>
          </div>
          
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>
        
        {/* Card name */}
        <div className="p-1 text-center bg-black/30">
          <p className="truncate text-sm font-medium">{card.name}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Display horizontal cards (Leaders/Bases) - 4 per row */}
      {horizontalCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {horizontalCards.map(card => renderCard(card, true))}
        </div>
      )}

      {/* Display vertical cards (all others) - 5 per row */}
      {verticalCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {verticalCards.map(card => renderCard(card, false))}
        </div>
      )}

      {/* Show message if no cards are available */}
      {cards.length === 0 && (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          No cards available
        </div>
      )}
    </div>
  );
}