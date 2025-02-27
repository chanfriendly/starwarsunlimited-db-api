"use client"

import * as React from "react"
import { Card } from "@/lib/api"
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
        
        return (
          <div
            key={card.id}
            onClick={() => onCardClick?.(card)}
            style={{
              border: isSelected ? '2px solid #0ea5e9' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: 'rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Card image container */}
            <div style={{ 
              width: '100%',
              height: '0',
              paddingBottom: card.type === "Base" || card.type === "Leader" ? '75%' : '140%',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {card.image_uri ? (
                <img
                  src={card.image_uri}
                  alt={card.name}
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                  loading="lazy"
                />
              ) : (
                <div style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.5)'
                }}>
                  No Image
                </div>
              )}
              
              {/* Type badge - simple styling */}
              <div style={{
                position: 'absolute',
                bottom: '5px',
                left: '5px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'rgba(255,255,255,0.8)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                {card.type}
              </div>
              
              {/* Compatibility indicator (if applicable) */}
              {getCompatibilityStatus && (
                <div style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  {getCompatibilityStatus(card).compatibility === 'none' && 
                    <span style={{color: '#f87171'}}>Incompatible</span>}
                  {getCompatibilityStatus(card).compatibility === 'partial' && 
                    <span style={{color: '#fbbf24'}}>Partial</span>}
                  {getCompatibilityStatus(card).compatibility === 'full' && 
                    <span style={{color: '#34d399'}}>Compatible</span>}
                </div>
              )}
            </div>
            
            {/* Card name container */}
            <div style={{
              padding: '6px 8px',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {card.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}