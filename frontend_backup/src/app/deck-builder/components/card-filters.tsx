"use client"
import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

export function CardFilters() {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 pt-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filters</h2>
          <Button variant="ghost" size="icon">
            <Filter className="h-4 w-4" />
            <span className="sr-only">Reset filters</span>
          </Button>
        </div>
        <Separator className="my-4" />
        <Accordion type="multiple" defaultValue={["type", "faction"]}>
          <AccordionItem value="type">
            <AccordionTrigger>Card Type</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <RadioGroup defaultValue="all">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all-types" />
                    <Label htmlFor="all-types">All Types</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="character" id="character" />
                    <Label htmlFor="character">Character</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="vehicle" id="vehicle" />
                    <Label htmlFor="vehicle">Vehicle</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="event" id="event" />
                    <Label htmlFor="event">Event</Label>
                  </div>
                </RadioGroup>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faction">
            <AccordionTrigger>Faction</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <RadioGroup defaultValue="all">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all-factions" />
                    <Label htmlFor="all-factions">All Factions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rebel-alliance" id="rebel-alliance" />
                    <Label htmlFor="rebel-alliance">Rebel Alliance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="galactic-empire" id="galactic-empire" />
                    <Label htmlFor="galactic-empire">Galactic Empire</Label>
                  </div>
                </RadioGroup>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ScrollArea>
  )
}

