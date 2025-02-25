// components/card-details.tsx
import { Card } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { 
  CreditCard, 
  Swords, 
  Heart, 
  Tag, 
  Layers, 
  BookOpen, 
  Award, 
  Info,
  RotateCw
} from "lucide-react"

// Aspect colors (mapping aspect names to their official colors)
const ASPECT_COLORS = {
  'Command': '#e74c3c', // Red
  'Vigilance': '#3498db', // Blue
  'Aggression': '#e67e22', // Orange
  'Cunning': '#9b59b6', // Purple
  'Heroism': '#2ecc71', // Green
  'Villainy': '#1c1c1c', // Black
};

interface CardDetailsProps {
  card: Card
}

export function CardDetails({ card }: CardDetailsProps) {
  const [showBackSide, setShowBackSide] = useState(false);
  const hasBackSide = card.type === "Leader" && card.image_back_uri;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Card Image with glow effect */}
        <div 
          className="aspect-[7/5] relative rounded-lg overflow-hidden border border-zinc-800 shadow-xl"
          style={{
            boxShadow: card.aspects && card.aspects.length > 0 
              ? `0 0 20px ${ASPECT_COLORS[card.aspects[0].aspect_name as keyof typeof ASPECT_COLORS] || '#6c757d'}40` 
              : 'none'
          }}
          onMouseEnter={() => hasBackSide && setShowBackSide(true)}
          onMouseLeave={() => hasBackSide && setShowBackSide(false)}
        >
          {hasBackSide && (
            <button 
              className="absolute top-2 right-2 z-10 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowBackSide(!showBackSide);
              }}
              title="Flip card"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          )}
          
          {hasBackSide && showBackSide && card.image_back_uri ? (
            <img
              src={card.image_back_uri}
              alt={`${card.name} (back)`}
              className="object-contain w-full h-full transition-opacity"
            />
          ) : card.image_uri ? (
            <img
              src={card.image_uri}
              alt={card.name}
              className="object-contain w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-black/50 text-muted-foreground">
              No Image Available
            </div>
          )}
        </div>

        {/* Card Title and Subtitle */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{card.name}</h2>
          {card.subtitle && (
            <p className="text-sm text-muted-foreground">{card.subtitle}</p>
          )}
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-zinc-700 bg-zinc-800/50">
              {card.type}
            </Badge>
            {card.arenas?.map(arena => (
              <Badge 
                key={arena} 
                variant="outline" 
                className="border-blue-700 bg-blue-900/30 text-blue-400"
              >
                {arena}
              </Badge>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        {(card.energy_cost !== undefined || card.attack !== undefined || card.health !== undefined) && (
          <div className="grid grid-cols-3 gap-4 bg-black/30 rounded-lg p-3 border border-zinc-800/50">
            {card.energy_cost !== undefined && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center">
                  <CreditCard className="h-3 w-3 mr-1" />
                  Cost
                </p>
                <p className="text-xl font-bold text-amber-400">{card.energy_cost}</p>
              </div>
            )}
            {card.attack !== undefined && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center">
                  <Swords className="h-3 w-3 mr-1" />
                  Attack
                </p>
                <p className="text-xl font-bold text-red-400">{card.attack}</p>
              </div>
            )}
            {card.health !== undefined && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center">
                  <Heart className="h-3 w-3 mr-1" />
                  Health
                </p>
                <p className="text-xl font-bold text-green-400">{card.health}</p>
              </div>
            )}
          </div>
        )}

        {/* Aspects */}
        {card.aspects?.length > 0 && (
          <div className="bg-black/30 rounded-lg p-3 border border-zinc-800/50">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <Layers className="h-4 w-4 mr-2" />
              Aspects
            </h3>
            <div className="flex flex-wrap gap-2">
              {card.aspects.map((aspect) => {
                const aspectColor = ASPECT_COLORS[aspect.aspect_name as keyof typeof ASPECT_COLORS] || '#7f8c8d';
                return (
                  <TooltipProvider key={aspect.aspect_name}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="outline"
                          className="cursor-help"
                          style={{
                            backgroundColor: `${aspectColor}30`,
                            borderColor: aspectColor,
                            color: aspectColor
                          }}
                        >
                          {aspect.aspect_name}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{aspect.aspect_name} aspect - {getAspectDescription(aspect.aspect_name)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        )}

        {/* Card Text */}
        {card.text && (
          <div className="bg-black/30 rounded-lg p-3 border border-zinc-800/50">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <BookOpen className="h-4 w-4 mr-2" />
              Card Text
            </h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{card.text}</p>
          </div>
        )}

        {/* Keywords and Traits */}
        {(card.keywords?.length > 0 || card.traits?.length > 0) && (
          <div className="bg-black/30 rounded-lg p-3 border border-zinc-800/50">
            {card.keywords?.length > 0 && (
              <div className="mb-3">
                <h3 className="text-sm font-medium mb-2 flex items-center">
                  <Award className="h-4 w-4 mr-2" />
                  Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {card.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="bg-indigo-900/30 text-indigo-300 border-indigo-800">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {card.traits?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center">
                  <Tag className="h-4 w-4 mr-2" />
                  Traits
                </h3>
                <div className="flex flex-wrap gap-2">
                  {card.traits.map((trait) => (
                    <Badge key={trait} variant="outline" className="bg-zinc-900/50 border-zinc-700">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card Details */}
        <div className="bg-black/30 rounded-lg p-3 border border-zinc-800/50">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            Card Details
          </h3>
          <div className="space-y-2 text-sm">
            {card.set_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Set</span>
                <span>{card.set_name}</span>
              </div>
            )}
            {card.card_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card #</span>
                <span>{card.card_number}</span>
              </div>
            )}
            {card.rarity && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rarity</span>
                <Badge variant="outline" className={getRarityColor(card.rarity)}>
                  {card.rarity}
                </Badge>
              </div>
            )}
            {/* Using type assertion to avoid the artist property error */}
            {(card as any).artist && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artist</span>
                <span>{(card as any).artist}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

function getAspectDescription(aspectName: string): string {
  const descriptions: Record<string, string> = {
    'Command': 'Military leadership and tactical prowess',
    'Vigilance': 'Defense, protection, and endurance',
    'Aggression': 'Direct conflict and overwhelming force',
    'Cunning': 'Trickery, deception, and resourcefulness',
    'Heroism': 'Selflessness, bravery, and inspiration',
    'Villainy': 'Cruelty, power, and domination'
  };
  return descriptions[aspectName] || 'No description available';
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    'Common': 'border-zinc-500 text-zinc-400',
    'Uncommon': 'border-green-500 bg-green-900/20 text-green-400',
    'Rare': 'border-blue-500 bg-blue-900/20 text-blue-400',
    'Epic': 'border-purple-500 bg-purple-900/20 text-purple-400',
    'Legendary': 'border-amber-500 bg-amber-900/20 text-amber-400'
  };
  return colors[rarity] || 'border-zinc-500 text-zinc-400';
}