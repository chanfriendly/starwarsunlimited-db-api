"use client"

import * as React from "react"
import Image from "next/image"
import { Card } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CardGridProps {
  cards: Card[]
  onCardClick?: (card: Card) => void
  selectedCardId?: string
}

export function CardGrid({ cards, onCardClick, selectedCardId }: CardGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className={cn(
            "relative aspect-[63/88] cursor-pointer rounded-lg overflow-hidden transition-all hover:ring-2 hover:ring-primary",
            selectedCardId === card.id && "ring-2 ring-primary"
          )}
          onClick={() => onCardClick?.(card)}
        >
          {card.image_uri ? (
            <Image
              src={card.image_uri}
              alt={card.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <span className="text-sm text-muted-foreground">{card.name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
} 