"use client"
import { Download, Save } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DeckList() {
  // This would be replaced with actual deck data
  const sampleDeck = [
    { name: "Darth Vader", quantity: 2, type: "Character" },
    { name: "TIE Fighter", quantity: 3, type: "Vehicle" },
    { name: "Force Choke", quantity: 4, type: "Event" },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-4">
        <Input placeholder="Deck Name" className="flex-1" />
        <Button variant="ghost" size="icon">
          <Save className="h-4 w-4" />
          <span className="sr-only">Save deck</span>
        </Button>
        <Button variant="ghost" size="icon">
          <Download className="h-4 w-4" />
          <span className="sr-only">Export deck</span>
        </Button>
      </div>
      <div className="flex-1">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleDeck.map((card) => (
                <TableRow key={card.name}>
                  <TableCell>{card.quantity}</TableCell>
                  <TableCell>{card.name}</TableCell>
                  <TableCell>{card.type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      <div className="border-t p-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Total Cards:</span>
            <span>9</span>
          </div>
          <div className="flex justify-between">
            <span>Characters:</span>
            <span>2</span>
          </div>
          <div className="flex justify-between">
            <span>Vehicles:</span>
            <span>3</span>
          </div>
          <div className="flex justify-between">
            <span>Events:</span>
            <span>4</span>
          </div>
        </div>
      </div>
    </div>
  )
}

