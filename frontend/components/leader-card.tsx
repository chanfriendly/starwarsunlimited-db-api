"use client"

import * as React from "react"
import { Card } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Check, AlertCircle, RotateCw} from "lucide-react"

interface LeaderCardProps {
  card: Card
  onClick?: () => void
  isSelected?: boolean
}

export function LeaderCard({ card, onClick, isSelected }: LeaderCardProps) {
  const [showBackSide, setShowBackSide] = React.useState(false);
  
  // Only proceed if this is actually a leader card with a back side
  const hasBackSide = card.type === "Leader" && card.image_back_uri;
  
  return (
    <div
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-lg transition-all duration-200",
        "border-2",
        isSelected ? "border-primary" : "border-transparent",
        "hover:scale-105 hover:shadow-lg hover:shadow-primary/10"
      )}
      onClick={onClick}
      onMouseEnter={() => hasBackSide && setShowBackSide(true)}
      onMouseLeave={() => hasBackSide && setShowBackSide(false)}
      style={{ 
        width: '100%',
        maxWidth: '200px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {/* Show back side or front side based on hover state */}
        {hasBackSide && showBackSide ? (
          <img
            src={card.image_back_uri}
            alt={`${card.name} (back)`}
            className="object-contain w-full h-full transition-transform"
            loading="lazy"
          />
        ) : (
          <img
            src={card.image_uri}
            alt={card.name}
            className="object-contain w-full h-full transition-transform"
            loading="lazy"
          />
        )}
        
        {/* Flip indicator for leader cards */}
        {hasBackSide && (
          <div className="absolute top-2 left-2 bg-black/50 text-white p-1 rounded">
            <RotateCw className="h-4 w-4" />
          </div>
        )}
        
        {/* Selection Overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
      </div>
      
      <div className="px-2 py-1 text-center">
        <p className="text-sm truncate font-medium">{card.name}</p>
      </div>
    </div>
  )
}