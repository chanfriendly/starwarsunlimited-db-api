// frontend/src/components/CardFilters.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface CardFiltersProps {
  filters: {
    search: string;
    types: string[];
    aspects: string[];
    keywords: string[];
    costMin: number;
    costMax: number;
    sets: string[];
  };
  onFilterChange: (filters: any) => void;
  aspects: string[];
  types: string[];
  keywords: string[];
  sets: string[];
  onClose?: () => void;
}

export function CardFilters({ 
  filters, 
  onFilterChange, 
  aspects, 
  types, 
  keywords, 
  sets,
  onClose
}: CardFiltersProps) {
  // Toggle a filter value in array
  const toggleArrayFilter = (filterName: string, value: string) => {
    const currentValues = filters[filterName as keyof typeof filters] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    onFilterChange({ [filterName]: newValues });
  };

  // Handle cost slider change
  const handleCostChange = (value: number[]) => {
    onFilterChange({ costMin: value[0], costMax: value[1] });
  };

  // Reset all filters
  const resetFilters = () => {
    onFilterChange({
      search: '',
      types: [],
      aspects: [],
      keywords: [],
      costMin: 0,
      costMax: 10,
      sets: []
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800 sticky top-4">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800">
        <CardTitle className="text-xl">Filters</CardTitle>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="py-4 max-h-[80vh] overflow-y-auto">
        {/* Card Types */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-2">Card Types</h3>
          <div className="grid grid-cols-2 gap-2">
            {types.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.types.includes(type)}
                  onCheckedChange={() => toggleArrayFilter('types', type)}
                />
                <Label
                  htmlFor={`type-${type}`}
                  className="text-sm cursor-pointer"
                >
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Aspects */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-2">Aspects</h3>
          <div className="grid grid-cols-2 gap-2">
            {aspects.map((aspect) => (
              <div key={aspect} className="flex items-center space-x-2">
                <Checkbox
                  id={`aspect-${aspect}`}
                  checked={filters.aspects.includes(aspect)}
                  onCheckedChange={() => toggleArrayFilter('aspects', aspect)}
                />
                <Label
                  htmlFor={`aspect-${aspect}`}
                  className="text-sm cursor-pointer"
                >
                  {aspect}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Energy Cost */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-2">Resource Cost</h3>
          <div className="px-2">
            <Slider
              defaultValue={[filters.costMin, filters.costMax]}
              min={0}
              max={10}
              step={1}
              onValueChange={handleCostChange}
              className="my-6"
            />
            <div className="flex justify-between text-sm text-gray-300">
                <span>{filters.costMin}</span>
                <span>{filters.costMax === 10 ? '10+' : filters.costMax}</span>
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-2">Keywords</h3>
          <div className="grid grid-cols-2 gap-2">
            {keywords.map((keyword) => (
              <div key={keyword} className="flex items-center space-x-2">
                <Checkbox
                  id={`keyword-${keyword}`}
                  checked={filters.keywords.includes(keyword)}
                  onCheckedChange={() => toggleArrayFilter('keywords', keyword)}
                />
                <Label 
                  htmlFor={`keyword-${keyword}`}
                  className="text-sm text-gray-300 cursor-pointer"
                >
                  {keyword}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Sets */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-2">Sets</h3>
          <div className="grid grid-cols-2 gap-2">
            {sets.map((set) => (
              <div key={set} className="flex items-center space-x-2">
                <Checkbox
                  id={`set-${set}`}
                  checked={filters.sets.includes(set)}
                  onCheckedChange={() => toggleArrayFilter('sets', set)}
                />
                <Label
                  htmlFor={`set-${set}`}
                  className="text-sm cursor-pointer"
                >
                  {set}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Reset Button */}
        <Button 
          onClick={resetFilters} 
          variant="outline" 
          className="w-full mt-4 border-gray-700 hover:bg-gray-800"
        >
          Reset Filters
        </Button>
      </CardContent>
    </Card>
  );
}