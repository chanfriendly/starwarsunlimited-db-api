"use client"

import * as React from "react"
import { Card } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CardPreviewProps {
  card?: Card
}

export function CardPreview({ card }: CardPreviewProps) {
  if (!card) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Select a card to view details
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{card.name}</h2>
          {card.subtitle && (
            <p className="text-sm text-muted-foreground">{card.subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {card.aspects.map((aspect) => (
            <Badge
              key={aspect.aspect_name}
              style={{ backgroundColor: aspect.aspect_color }}
              className="text-white"
            >
              {aspect.aspect_name}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Type</p>
            <p className="text-sm text-muted-foreground">{card.type}</p>
          </div>
          {card.rarity && (
            <div>
              <p className="text-sm font-medium">Rarity</p>
              <p className="text-sm text-muted-foreground">{card.rarity}</p>
            </div>
          )}
          {card.energy_cost !== undefined && (
            <div>
              <p className="text-sm font-medium">Energy Cost</p>
              <p className="text-sm text-muted-foreground">{card.energy_cost}</p>
            </div>
          )}
          {card.attack !== undefined && (
            <div>
              <p className="text-sm font-medium">Attack</p>
              <p className="text-sm text-muted-foreground">{card.attack}</p>
            </div>
          )}
          {card.health !== undefined && (
            <div>
              <p className="text-sm font-medium">Health</p>
              <p className="text-sm text-muted-foreground">{card.health}</p>
            </div>
          )}
        </div>

        {card.text && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Card Text</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {card.text}
              </p>
            </div>
          </>
        )}

        {card.epic_action && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Epic Action</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {card.epic_action}
              </p>
            </div>
          </>
        )}

        {card.keywords.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Keywords</p>
              <div className="flex flex-wrap gap-2">
                {card.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {card.traits.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Traits</p>
              <div className="flex flex-wrap gap-2">
                {card.traits.map((trait) => (
                  <Badge key={trait} variant="outline">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {card.arenas.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Arenas</p>
              <div className="flex flex-wrap gap-2">
                {card.arenas.map((arena) => (
                  <Badge key={arena} variant="secondary">
                    {arena}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  )
}

