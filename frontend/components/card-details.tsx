// components/card-details.tsx
import { Card } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface CardDetailsProps {
  card: Card
}

export function CardDetails({ card }: CardDetailsProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Card Image */}
        <div className="aspect-[7/5] relative rounded-lg overflow-hidden">
          {card.image_uri && (
            <img
              src={card.image_uri}
              alt={card.name}
              className="object-contain w-full h-full"
            />
          )}
        </div>

        {/* Card Title and Subtitle */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{card.name}</h2>
          {card.subtitle && (
            <p className="text-sm text-muted-foreground">{card.subtitle}</p>
          )}
          <p className="text-sm text-muted-foreground">{card.type}</p>
        </div>

        {/* Stats Section */}
        {(card.energy_cost !== undefined || card.attack !== undefined || card.health !== undefined) && (
          <div className="grid grid-cols-3 gap-4">
            {card.energy_cost !== undefined && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-xl font-bold">{card.energy_cost}</p>
              </div>
            )}
            {card.attack !== undefined && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Attack</p>
                <p className="text-xl font-bold">{card.attack}</p>
              </div>
            )}
            {card.health !== undefined && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Health</p>
                <p className="text-xl font-bold">{card.health}</p>
              </div>
            )}
          </div>
        )}

        {/* Aspects */}
        {card.aspects?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Aspects</h3>
            <div className="flex flex-wrap gap-2">
              {card.aspects.map((aspect) => (
                <Badge 
                  key={aspect.aspect_name}
                  variant="outline"
                  style={{
                    backgroundColor: `${aspect.aspect_color}20`,
                    borderColor: aspect.aspect_color
                  }}
                >
                  {aspect.aspect_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Card Text */}
        {card.text && (
          <div>
            <h3 className="text-sm font-medium mb-1">Card Text</h3>
            <p className="text-sm whitespace-pre-wrap">{card.text}</p>
          </div>
        )}

        {/* Keywords */}
        {card.keywords?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {card.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Set Information */}
        {(card.set_name || card.card_number) && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              {[card.set_name, card.card_number].filter(Boolean).join(' • ')}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}