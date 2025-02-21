import { Card } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CardDetailsProps {
  card: Card
}

export function CardDetails({ card }: CardDetailsProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="aspect-[7/5] relative rounded-lg overflow-hidden">
          {card.image_uri && (
            <img
              src={card.image_uri}
              alt={card.name}
              className="object-contain w-full h-full"
            />
          )}
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{card.name}</h2>
          {card.subtitle && (
            <p className="text-sm text-muted-foreground">{card.subtitle}</p>
          )}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Type: {card.type}</p>
            {card.energy_cost !== undefined && (
              <p>Cost: {card.energy_cost}</p>
            )}
            {card.attack !== undefined && (
              <p>Attack: {card.attack}</p>
            )}
            {card.health !== undefined && (
              <p>Health: {card.health}</p>
            )}
            {card.aspects?.length > 0 && (
              <p>Aspects: {card.aspects.map(a => a.aspect_name).join(', ')}</p>
            )}
            {card.text && (
              <div className="mt-4">
                <p className="font-medium mb-1">Card Text:</p>
                <p className="whitespace-pre-wrap">{card.text}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
} 