"use client"

import * as React from "react"
import { getTypes, getAspects } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface CardFiltersProps {
  onTypeChange?: (type: string | null) => void
  onAspectChange?: (aspect: string | null) => void
  onCostChange?: (cost: string | null) => void
  selectedType?: string | null
  selectedAspect?: string | null
  selectedCost?: string | null
}

export function CardFilters({
  onTypeChange,
  onAspectChange,
  onCostChange,
  selectedType,
  selectedAspect,
  selectedCost,
}: CardFiltersProps) {
  const [types, setTypes] = React.useState<string[]>([])
  const [aspects, setAspects] = React.useState<Array<{aspect_name: string; aspect_color: string}>>([])

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [typesData, aspectsData] = await Promise.all([
          getTypes(),
          getAspects()
        ])
        setTypes(typesData)
        setAspects(aspectsData)
      } catch (error) {
        console.error("Failed to load filter data:", error)
      }
    }
    loadData()
  }, [])

  return (
    <div className="p-4">
      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-sm font-medium">Aspects</h3>
          <div className="flex flex-wrap gap-2">
            {aspects.map((aspect) => (
              <Badge
                key={aspect.aspect_name}
                variant="outline"
                className={cn(
                  "cursor-pointer hover:opacity-80",
                  selectedAspect === aspect.aspect_name && "ring-2 ring-primary"
                )}
                style={{ 
                  backgroundColor: selectedAspect === aspect.aspect_name ? aspect.aspect_color : 'transparent',
                  color: selectedAspect === aspect.aspect_name ? 'white' : aspect.aspect_color,
                  borderColor: aspect.aspect_color
                }}
                onClick={() => onAspectChange?.(
                  selectedAspect === aspect.aspect_name ? null : aspect.aspect_name
                )}
              >
                {aspect.aspect_name}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-medium">Card Type</h3>
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
          <h3 className="mb-4 text-sm font-medium">Cost</h3>
          <div className="flex flex-wrap gap-2">
            {["1-3", "4-6", "7+"].map((cost) => (
              <Button
                key={cost}
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1",
                  selectedCost === cost && "bg-primary text-primary-foreground"
                )}
                onClick={() => onCostChange?.(selectedCost === cost ? null : cost)}
              >
                {cost}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

