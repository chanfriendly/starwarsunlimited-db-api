"use client"

import * as React from "react"
import { Card } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CardGridProps {
  cards: Card[]
  onCardClick?: (card: Card) => void
  selectedCardId?: string
}

export function CardGrid({ cards, onCardClick, selectedCardId }: CardGridProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => onCardClick?.(card)}
          style={{
            width: '143px',
            height: card.type === "Base" || card.type === "Leader" ? '102px' : '200px',
            cursor: 'pointer',
            borderRadius: '8px',
            overflow: 'hidden',
            border: selectedCardId === card.id ? '2px solid white' : '2px solid transparent'
          }}
        >
          {card.image_uri && (
            <img
              src={card.image_uri}
              alt={card.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}