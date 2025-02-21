'use client';

import * as React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { CardDetails } from "@/components/card-details"
import { CardGrid } from "@/components/card-grid"
import { CardFilters } from "@/components/card-filters"
import { Card, getCards } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"

export default function DeckBuilder() {
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null)
  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showOutOfAspect, setShowOutOfAspect] = React.useState(false)
  const [leaders, setLeaders] = React.useState<Card[]>([])
  const [base, setBase] = React.useState<Card | null>(null)
  const [currentView, setCurrentView] = React.useState<'leaders' | 'base' | 'cards'>('leaders')

  React.useEffect(() => {
    const loadCards = async () => {
      setLoading(true)
      try {
        const response = await getCards({ 
          page: 1, 
          limit: 100,
          type: 'Leader' 
        })
        setCards(response.cards)
      } catch (error) {
        console.error("Failed to load cards:", error)
      } finally {
        setLoading(false)
      }
    }
    loadCards()
  }, [])

  const handleCardSelect = (card: Card) => {
    setSelectedCard(card)
    if (currentView === 'leaders' && leaders.length < 2) {
      setLeaders([...leaders, card])
      if (leaders.length === 1) setCurrentView('base')
    } else if (currentView === 'base' && !base) {
      setBase(card)
      setCurrentView('cards')
    }
  }

  const isCardInAspect = (card: Card): boolean => {
    if (!base || leaders.length < 2) return false
    
    // Get all aspects from leaders and base
    const deckAspects = [
      ...leaders.flatMap(leader => leader.aspects?.map(a => a.aspect_name) || []),
      ...(base.aspects?.map(a => a.aspect_name) || [])
    ]

    // Count aspects in deck
    const deckAspectCounts = deckAspects.reduce((acc, aspect) => {
      acc[aspect] = (acc[aspect] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Check if card's aspects are present in sufficient quantity
    const cardAspects = card.aspects?.map(a => a.aspect_name) || []
    const cardAspectCounts = cardAspects.reduce((acc, aspect) => {
      acc[aspect] = (acc[aspect] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(cardAspectCounts).every(([aspect, count]) => 
      (deckAspectCounts[aspect] || 0) >= count
    )
  }

  const displayCards = React.useMemo(() => {
    if (currentView === 'leaders') {
      return cards.filter(card => card.type === 'Leader')
    } else if (currentView === 'base') {
      return cards.filter(card => card.type === 'Base')
    } else {
      const filteredCards = cards.filter(card => 
        card.type !== 'Leader' && card.type !== 'Base'
      )
      return showOutOfAspect ? filteredCards : filteredCards.filter(isCardInAspect)
    }
  }, [cards, currentView, showOutOfAspect, base, leaders])

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-screen">
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        <div className="h-full border-r bg-muted/20 p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Selected Leaders ({leaders.length}/2)</h3>
              {leaders.map(leader => (
                <div key={leader.id} className="text-sm">{leader.name}</div>
              ))}
            </div>
            {base && (
              <div>
                <h3 className="font-medium mb-2">Selected Base</h3>
                <div className="text-sm">{base.name}</div>
              </div>
            )}
            {currentView === 'cards' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                    id="showAll"
                    checked={showOutOfAspect}
                    onCheckedChange={(checked: boolean | "indeterminate") => setShowOutOfAspect(checked as boolean)}
                  />
                <label htmlFor="showAll" className="text-sm font-medium">
                  Show out of aspect cards
                </label>
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={55}>
        <ScrollArea className="h-full">
          <div className="p-6">
            <CardGrid
              cards={displayCards}
              onCardClick={handleCardSelect}
              selectedCardId={selectedCard?.id}
            />
          </div>
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
        <div className="h-full border-l bg-muted/20">
          {selectedCard ? (
            <CardDetails card={selectedCard} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Select a card to view details
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}