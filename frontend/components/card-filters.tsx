"use client"

import * as React from "react"
import { getTypes } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface CardFiltersProps {
  onTypeChange?: (type: string | null) => void
  onAspectChange?: (aspect: string | null) => void
  selectedType?: string | null
  selectedAspect?: string | null
}

export function CardFilters({
  onTypeChange,
  onAspectChange,
  selectedType,
  selectedAspect,
}: CardFiltersProps) {
  const [types, setTypes] = React.useState<string[]>([])

  React.useEffect(() => {
    const loadTypes = async () => {
      try {
        const typesData = await getTypes()
        setTypes(typesData)
      } catch (error) {
        console.error("Failed to load types:", error)
      }
    }
    loadTypes()
  }, [])

  return (
    <div className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Card Type</h3>
          <RadioGroup
            value={selectedType || ""}
            onValueChange={(value) => onTypeChange?.(value || null)}
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="" id="all-types" />
                <Label htmlFor="all-types">All Types</Label>
              </div>
              {types.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={type.toLowerCase()} />
                  <Label htmlFor={type.toLowerCase()}>{type}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Cost</h3>
          <div className="flex flex-wrap gap-2">
            {["1-3", "4-6", "7+"].map((cost) => (
              <Button
                key={cost}
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1",
                  false && "bg-primary text-primary-foreground"
                )}
              >
                {cost}
              </Button>
            ))}
          </div>
        </div>

        <Button className="w-full" variant="secondary">
          Apply Filters
        </Button>
      </div>
    </div>
  )
}

