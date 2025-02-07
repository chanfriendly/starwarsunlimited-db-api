"use client"

import * as React from "react"
import { Search } from 'lucide-react'
import { getCards, Card } from "@/lib/api"

import { Input } from "@/components/ui/input"
import { CardFilters } from "@/components/card-filters"
import { CardPreview } from "@/components/card-preview"
import { CardGrid } from "@/components/card-grid"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { toast } from "sonner"

export default function CardsPage() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [selectedAspect, setSelectedAspect] = React.useState<string | null>(null)
  const [cards, setCards] = React.useState<Card[]>([])
  const [selectedCard, setSelectedCard] = React.useState<Card | undefined>()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  const loadCards = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
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
      setError("Failed to load cards. Please try again later.")
      toast.error("Failed to load cards")
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

  if (error) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
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
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">
                    Loading cards...
                  </div>
                </div>
              ) : (
                <CardGrid
                  cards={cards}
                  selectedCardId={selectedCard?.id}
                  onCardClick={setSelectedCard}
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Card Preview */}
        <ResizablePanel defaultSize={75}>
          <div className="flex h-full flex-col">
            <CardPreview card={selectedCard} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
} 