"use client"

import * as React from "react"
import { Search } from 'lucide-react'
import { getCards, Card } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { CardFilters } from "@/components/card-filters"
import { CardPreview } from "@/components/card-preview"
import { CardGrid } from "@/components/card-grid"
import { Spinner } from "@/components/ui/spinner"
import { CardDetails } from "@/components/card-details"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function CardsPage() {
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [selectedAspect, setSelectedAspect] = React.useState<string | null>(null)
  const [selectedCost, setSelectedCost] = React.useState<string | null>(null)
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null)
  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)

  React.useEffect(() => {
    const loadCards = async () => {
      setLoading(true)
      try {
        const response = await getCards({
          page: currentPage,
          limit: 50
        })
        let filteredCards = response.cards

        if (selectedType) {
          filteredCards = filteredCards.filter(card => card.type === selectedType)
        }

        if (selectedAspect) {
          filteredCards = filteredCards.filter(card => 
            card.aspects.some(a => a.aspect_name === selectedAspect)
          )
        }

        if (selectedCost) {
          const [min, max] = selectedCost.split('-').map(Number)
          filteredCards = filteredCards.filter(card => {
            const cardCost = card.energy_cost || 0
            if (selectedCost === '7+') {
              return cardCost >= 7
            }
            return cardCost >= min && cardCost <= (max || min)
          })
        }

        setCards(filteredCards)
        setTotalPages(Math.ceil(response.total / 50))
      } catch (error) {
        console.error("Failed to load cards:", error)
      } finally {
        setLoading(false)
      }
    }
    loadCards()
  }, [selectedType, selectedAspect, selectedCost, currentPage])

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  return (
    <div className="grid grid-cols-[250px_1fr_300px] h-[calc(100vh-3.5rem)]">
      {/* Left sidebar */}
      <aside className="border-r bg-muted/20 p-4 space-y-4">
        <CardFilters
          selectedType={selectedType}
          selectedAspect={selectedAspect}
          selectedCost={selectedCost}
          onTypeChange={setSelectedType}
          onAspectChange={setSelectedAspect}
          onCostChange={setSelectedCost}
        />
      </aside>

      {/* Main content */}
      <main className="flex flex-col">
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : (
            <CardGrid
              cards={cards}
              onCardClick={setSelectedCard}
              selectedCardId={selectedCard?.id}
            />
          )}
        </div>
        
        <div className="border-t p-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </main>

      {/* Right sidebar */}
      <aside className="border-l bg-muted/20 h-full overflow-hidden">
        {selectedCard ? (
          <CardDetails card={selectedCard} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a card to view details
          </div>
        )}
      </aside>
    </div>
  )
} 