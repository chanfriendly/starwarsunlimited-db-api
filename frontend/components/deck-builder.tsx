"use client"

import * as React from "react"
import { Search, Save, Download } from 'lucide-react'
import { getCards, Card } from "@/lib/api"

import { Input } from "@/components/ui/input"
import { CardFilters } from "@/components/card-filters"
import { CardPreview } from "@/components/card-preview"
import { CardGrid } from "@/components/card-grid"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

interface DeckCard extends Card {
  quantity: number;
}

interface DeckStats {
  total: number;
  characters: number;
  vehicles: number;
  events: number;
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

  const deckStats = React.useMemo(() => {
    return deck.reduce<DeckStats>(
      (stats, card) => {
        stats.total += card.quantity
        if (card.type === "Character") stats.characters += card.quantity
        if (card.type === "Vehicle") stats.vehicles += card.quantity
        if (card.type === "Event") stats.events += card.quantity
        return stats
      },
      { total: 0, characters: 0, vehicles: 0, events: 0 }
    )
  }, [deck])

  const loadCards = React.useCallback(async () => {
    try {
      setLoading(true)
      const response = await getCards({
        search: searchQuery || undefined,
        type: selectedType || undefined,
        aspect: selectedAspect || undefined,
        page,
        limit: 20,
      })
      setCards(response.cards)
      setTotal(response.total)
    } catch (error) {
      console.error("Failed to load cards:", error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedType, selectedAspect, page])

  React.useEffect(() => {
    setPage(1)
    loadCards()
  }, [searchQuery, selectedType, selectedAspect])

  React.useEffect(() => {
    loadCards()
  }, [page])

  const addCardToDeck = (card: Card) => {
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
    <div className="h-[calc(100vh-3.5rem)] flex-1 overflow-hidden">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full items-stretch"
      >
        {/* Left Panel - Search & Filters */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="flex h-full flex-col bg-muted/20">
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
            <div className="flex-1 overflow-auto">
              <CardGrid
                cards={cards}
                selectedCardId={selectedCard?.id}
                onCardClick={(card) => {
                  setSelectedCard(card)
                  addCardToDeck(card)
                }}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Card Preview */}
        <ResizablePanel defaultSize={45}>
          <div className="flex h-full flex-col">
            <CardPreview card={selectedCard} />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Deck List */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="flex h-full flex-col bg-muted/20">
            <div className="p-4 border-b">
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
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Deck
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={exportDeck}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
            <div className="p-4 border-b">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Cards</p>
                  <p className="font-medium">{deckStats.total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Characters</p>
                  <p className="font-medium">{deckStats.characters}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicles</p>
                  <p className="font-medium">{deckStats.vehicles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Events</p>
                  <p className="font-medium">{deckStats.events}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}