"use client"

import * as React from "react"
import { Search, Save, Download } from 'lucide-react'
import { getCards, Card } from "@/lib/api"
import { cn } from "@/lib/utils"

import { Input } from "@/components/ui/input"
import { CardFilters } from "@/components/card-filters"
import { CardGrid } from "@/components/card-grid"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog"

interface DeckCard extends Card {
  quantity: number;
}

interface DeckStats {
  total: number;
  characters: number;
  vehicles: number;
  events: number;
  bases: number;
  leaders: number;
}

interface CardDetailsDialogProps {
  card: Card | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCard: (card: Card) => void;
}

function CardDetailsDialog({ card, open, onOpenChange, onAddCard }: CardDetailsDialogProps) {
  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
          {card.subtitle && (
            <DialogDescription>{card.subtitle}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid grid-cols-[300px_1fr] gap-6">
          <div className="aspect-[5/7] relative rounded-lg overflow-hidden">
            {card.image_uri && (
              <img
                src={card.image_uri}
                alt={card.name}
                className="object-contain w-full h-full"
              />
            )}
          </div>
          <div className="space-y-4">
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
              <div>
                <p className="text-sm font-medium">Card Text</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{card.text}</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            onAddCard(card);
            onOpenChange(false);
          }}>
            Add to Deck
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeckBuilder() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [selectedAspect, setSelectedAspect] = React.useState<string | null>(null)
  const [cards, setCards] = React.useState<Card[]>([])
  const [selectedCard, setSelectedCard] = React.useState<Card | undefined>()
  const [loading, setLoading] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [deck, setDeck] = React.useState<DeckCard[]>([])
  const [deckName, setDeckName] = React.useState("")
  const [showCardDetails, setShowCardDetails] = React.useState(false)

  const deckStats = React.useMemo(() => {
    return deck.reduce<DeckStats>(
      (stats, card) => {
        stats.total += card.quantity
        if (card.type === "Character") stats.characters += card.quantity
        if (card.type === "Vehicle") stats.vehicles += card.quantity
        if (card.type === "Event") stats.events += card.quantity
        if (card.type === "Base") stats.bases += card.quantity
        if (card.type === "Leader") stats.leaders += card.quantity
        return stats
      },
      { total: 0, characters: 0, vehicles: 0, events: 0, bases: 0, leaders: 0 }
    )
  }, [deck])

  const loadCards = React.useCallback(async () => {
    try {
      setLoading(true)
      // First, get all bases and leaders without pagination
      const basesResponse = await getCards({
        type: "Base",
        search: searchQuery || undefined,
        aspect: selectedAspect || undefined,
        limit: 100 // High limit to get all bases
      })
      
      const leadersResponse = await getCards({
        type: "Leader",
        search: searchQuery || undefined,
        aspect: selectedAspect || undefined,
        limit: 100 // High limit to get all leaders
      })

      // Then get other cards with pagination
      const otherResponse = await getCards({
        search: searchQuery || undefined,
        aspect: selectedAspect || undefined,
        page,
        limit: 50,
        type: selectedType || undefined,
      })

      // Combine and sort the results
      const allCards = [
        ...basesResponse.cards.sort((a, b) => a.name.localeCompare(b.name)),
        ...leadersResponse.cards.sort((a, b) => a.name.localeCompare(b.name)),
        ...otherResponse.cards.filter(card => 
          card.type !== "Base" && card.type !== "Leader"
        ).sort((a, b) => a.name.localeCompare(b.name))
      ]

      setCards(allCards)
      // Update total count excluding bases and leaders for pagination
      setTotal(otherResponse.total)
    } catch (error) {
      console.error("Failed to load cards:", error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedType, selectedAspect, page])

  const sortedCards = React.useMemo(() => {
    if (!cards.length) return { bases: [], leaders: [], other: [] }

    return {
      bases: cards.filter(card => card.type === "Base"),
      leaders: cards.filter(card => card.type === "Leader"),
      other: cards.filter(card => card.type !== "Base" && card.type !== "Leader")
    }
  }, [cards])

  React.useEffect(() => {
    setPage(1)
    loadCards()
  }, [searchQuery, selectedType, selectedAspect])

  React.useEffect(() => {
    loadCards()
  }, [page])

  const canAddCard = (card: Card): boolean => {
    const existingCard = deck.find(c => c.id === card.id)
    
    // Check if card already exists
    if (existingCard) {
      // Don't allow duplicates of bases or leaders
      if (card.type === "Base" || card.type === "Leader") {
        return false
      }
      // For other cards, check the 3-card limit
      return existingCard.quantity < 3
    }

    // Check base and leader limits
    if (card.type === "Base" && deckStats.bases >= 1) {
      return false
    }
    if (card.type === "Leader" && deckStats.leaders >= 2) {
      return false
    }

    return true
  }

  const addCardToDeck = (card: Card) => {
    if (!canAddCard(card)) {
      // You might want to show a toast or message here
      console.warn("Cannot add more copies of this card")
      return
    }

    setDeck(prev => {
      const existingCard = prev.find(c => c.id === card.id)
      if (existingCard) {
        return prev.map(c =>
          c.id === card.id
            ? { ...c, quantity: Math.min(c.quantity + 1, 3) }
            : c
        )
      }
      return [...prev, { ...card, quantity: 1 }]
    })
  }

  const removeCardFromDeck = (cardId: string) => {
    setDeck(prev => {
      const existingCard = prev.find(c => c.id === cardId)
      if (existingCard && existingCard.quantity > 1) {
        return prev.map(c =>
          c.id === cardId
            ? { ...c, quantity: c.quantity - 1 }
            : c
        )
      }
      return prev.filter(c => c.id !== cardId)
    })
  }

  const saveDeck = () => {
    // Implement deck saving logic
    console.log("Saving deck:", { name: deckName, cards: deck })
  }

  const exportDeck = () => {
    // Implement deck export logic
    console.log("Exporting deck:", { name: deckName, cards: deck })
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[250px_1fr]">
      {/* Left sidebar - Filters and Deck */}
      <div className="border-r bg-muted/20 flex flex-col">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cards..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <CardFilters
          selectedType={selectedType}
          selectedAspect={selectedAspect}
          onTypeChange={setSelectedType}
          onAspectChange={setSelectedAspect}
        />
        <div className="border-t p-4">
          <Input
            placeholder="Deck Name"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="mb-4"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={saveDeck}
              disabled={deckStats.bases !== 1 || deckStats.leaders !== 2}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={exportDeck}
              disabled={deckStats.bases !== 1 || deckStats.leaders !== 2}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Cards:</span>
              <span>{deckStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className={cn(
                deckStats.bases === 1 && "text-green-500",
                deckStats.bases > 1 && "text-red-500"
              )}>Base:</span>
              <span>{deckStats.bases}/1</span>
            </div>
            <div className="flex justify-between">
              <span className={cn(
                deckStats.leaders === 2 && "text-green-500",
                deckStats.leaders > 2 && "text-red-500"
              )}>Leaders:</span>
              <span>{deckStats.leaders}/2</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 border-t">
          {deck.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{card.quantity}x</span>
                <span className="text-sm">{card.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCardFromDeck(card.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Main content - Card Grid */}
      <div className="overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <CardGrid
            cards={cards}
            onCardClick={(card) => {
              console.log("Card clicked:", card.name);
              setSelectedCard(card);
              setShowCardDetails(true);
              console.log("showCardDetails set to:", true);
            }}
            selectedCardId={selectedCard?.id}
          />
        )}
      </div>

      <CardDetailsDialog
        card={selectedCard}
        open={showCardDetails}
        onOpenChange={setShowCardDetails}
        onAddCard={addCardToDeck}
      />
    </div>
  );
}