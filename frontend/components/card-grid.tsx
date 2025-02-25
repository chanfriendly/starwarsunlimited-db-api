"use client"

import * as React from "react"
import { Card } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Check, AlertCircle } from "lucide-react"

interface CardGridProps {
  cards: Card[]
  onCardClick?: (card: Card) => void
  selectedCardId?: string
  getCompatibilityStatus?: (card: Card) => { compatible: boolean; compatibility: 'full' | 'partial' | 'none' }
}

export function CardGrid({ cards, onCardClick, selectedCardId, getCompatibilityStatus }: CardGridProps) {
  return (
    <div className="w-full" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
      gap: '1rem' 
    }}>
      {cards.map((card) => {
        const isSelected = selectedCardId === card.id;
        const compatibilityStatus = getCompatibilityStatus ? getCompatibilityStatus(card) : { 
          compatible: true, 
          compatibility: 'full' as const 
        };
        
        // Determine border color based on compatibility
        let borderColorClass = "border-transparent";
        
        if (isSelected) {
          borderColorClass = "border-primary";
        } else if (getCompatibilityStatus && !compatibilityStatus.compatible) {
          borderColorClass = "border-amber-500/50";
        }
        
        return (
          <div
            key={card.id}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-lg bg-black/30 transition-all duration-200",
              "border-2",
              borderColorClass,
              !compatibilityStatus.compatible && "opacity-70",
              "hover:scale-105 hover:shadow-lg hover:shadow-primary/10"
            )}
            onClick={() => onCardClick?.(card)}
          >
            {/* Card image */}
            <div style={{ 
              aspectRatio: card.type === "Base" || card.type === "Leader" ? '4/3' : '7/10',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {card.image_uri ? (
                <img
                  src={card.image_uri}
                  alt={card.name}
                  className="object-contain w-full h-full transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/50 text-muted-foreground">
                  No Image
                </div>
              )}
              
              {/* Selection Overlay */}
              <div className={cn(
                "absolute inset-0 bg-primary/10 flex items-center justify-center transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50"
              )}>
                {isSelected && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
              
              {/* Compatibility Indicator */}
              {getCompatibilityStatus && (
                <div className="absolute top-2 right-2">
                  {compatibilityStatus.compatibility === 'full' && (
                    <Badge className="bg-green-500/20 hover:bg-green-500/30 border-green-500 text-green-400">
                      <Check className="h-3 w-3 mr-1" />
                      Compatible
                    </Badge>
                  )}
                  {compatibilityStatus.compatibility === 'partial' && (
                    <Badge className="bg-amber-500/20 hover:bg-amber-500/30 border-amber-500 text-amber-400">
                      Partial
                    </Badge>
                  )}
                  {compatibilityStatus.compatibility === 'none' && (
                    <Badge className="bg-red-500/20 hover:bg-red-500/30 border-red-500 text-red-400">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Incompatible
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Card Type Badge */}
              <div className="absolute bottom-2 left-2">
                <Badge variant="outline" className="bg-black/70 text-xs border-zinc-700">
                  {card.type}
                </Badge>
              </div>
            </div>
            
            {/* Card Name */}
            <div className="px-2 py-1 text-center">
              <p className="text-sm truncate font-medium">{card.name}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}