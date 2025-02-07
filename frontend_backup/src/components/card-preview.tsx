"use client"

import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

export function CardPreview() {
  // This would be replaced with actual card data
  const sampleCard = {
    name: "Darth Vader",
    image: "/placeholder.svg",
    type: "Character",
    faction: "Galactic Empire",
    cost: "4",
    power: "5",
    health: "5",
    text: "When Darth Vader enters the battlefield, you may destroy target character.",
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center p-6">
        <div className="relative aspect-[2.5/3.5] w-full max-w-[400px] overflow-hidden rounded-lg">
          <Image src="/placeholder.svg" alt={sampleCard.name} fill className="object-cover" />
        </div>
        <div className="mt-6 w-full max-w-[400px] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{sampleCard.name}</h2>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add to Deck
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Type</p>
              <p>{sampleCard.type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Faction</p>
              <p>{sampleCard.faction}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost</p>
              <p>{sampleCard.cost}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Power/Health</p>
              <p>
                {sampleCard.power}/{sampleCard.health}
              </p>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Card Text</p>
            <p className="mt-1">{sampleCard.text}</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

