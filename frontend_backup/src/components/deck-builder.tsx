"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { CardFilters } from "@/components/card-filters"
import { CardPreview } from "@/components/card-preview"
import { DeckList } from "@/components/deck-list"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

export function DeckBuilder() {
  const [searchQuery, setSearchQuery] = React.useState("")

  return (
    <div className="h-[calc(100vh-3.5rem)] flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full items-stretch">
        {/* Left Panel - Search & Filters */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
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
            <CardFilters />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Card Preview */}
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full flex-col">
            <CardPreview />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Deck List */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="flex h-full flex-col bg-muted/20">
            <DeckList />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

