// Fixed frontend/src/components/CardFilters.tsx - No Slider, Simple Dropdowns
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

interface CardFiltersProps {
  filters: {
    search: string;
    types: string[];
    aspects: string[];
    keywords: string[];
    costMin: string;
    costMax: string;
    sets: string[];
  };
  onFiltersChangeAction: (filters: any) => void;
  aspects: string[];
  types: string[];
  keywords: string[];
  sets: string[];
  onClose?: () => void; // Only used for mobile overlay
}

// Cost options for dropdowns - FIXED: No empty string values
const COST_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '10', label: '10+' }
];

export function CardFilters({ 
  filters, 
  onFiltersChangeAction,
  aspects, 
  types, 
  keywords, 
  sets,
  onClose
}: CardFiltersProps) {
  console.log("CardFilters - Current filters:", filters);
  
  // Toggle a filter value in array
  const toggleArrayFilter = (filterName: string, value: string) => {
    const currentValues = filters[filterName as keyof typeof filters] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    // Update the specific filter while preserving all other filters
    onFiltersChangeAction({ 
      ...filters,
      [filterName]: newValues 
    });
  };

  // Handle cost filter changes - FIXED: Handle 'any' value properly
  const handleCostMinChange = (value: string) => {
    onFiltersChangeAction({
      ...filters,
      costMin: value === 'any' ? '' : value
    });
  };

  const handleCostMaxChange = (value: string) => {
    onFiltersChangeAction({
      ...filters,
      costMax: value === 'any' ? '' : value
    });
  };

  // Reset all filters - FIXED: Use 'any' for cost defaults
  const resetFilters = () => {
    onFiltersChangeAction({
      search: '',
      types: [],
      aspects: [],
      keywords: [],
      costMin: '',
      costMax: '',
      sets: []
    });
  };
  
  return (
    <Card className="bg-gray-900 border-gray-800 h-full shadow-xl">
      <CardHeader className="border-b border-gray-800 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-white">Filters</CardTitle>
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
        {/* Card Types */}
        <div>
          <h3 className="text-white font-medium mb-3 text-sm uppercase tracking-wide">Card Types</h3>
          <div className="space-y-2">
            {types.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.types.includes(type)}
                  onCheckedChange={() => toggleArrayFilter('types', type)}
                  className="border-gray-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <Label
                  htmlFor={`type-${type}`}
                  className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Aspects */}
        <div>
          <h3 className="text-white font-medium mb-3 text-sm uppercase tracking-wide">Aspects</h3>
          <div className="space-y-2">
            {aspects.map((aspect) => (
              <div key={aspect} className="flex items-center space-x-2">
                <Checkbox
                  id={`aspect-${aspect}`}
                  checked={filters.aspects.includes(aspect)}
                  onCheckedChange={() => toggleArrayFilter('aspects', aspect)}
                  className="border-gray-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <Label
                  htmlFor={`aspect-${aspect}`}
                  className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  {aspect}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Cost - REPLACED SLIDER WITH DROPDOWNS */}
        <div>
          <h3 className="text-white font-medium mb-3 text-sm uppercase tracking-wide">Resource Cost</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Minimum Cost</Label>
              <Select value={filters.costMin || 'any'} onValueChange={handleCostMinChange}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white text-sm">
                  <SelectValue placeholder="Min cost" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {COST_OPTIONS.map((option) => (
                    <SelectItem 
                      key={`min-${option.value}`} 
                      value={option.value}
                      className="text-white hover:bg-gray-700"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Maximum Cost</Label>
              <Select value={filters.costMax || 'any'} onValueChange={handleCostMaxChange}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white text-sm">
                  <SelectValue placeholder="Max cost" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {COST_OPTIONS.map((option) => (
                    <SelectItem 
                      key={`max-${option.value}`} 
                      value={option.value}
                      className="text-white hover:bg-gray-700"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Display current filter - FIXED: Handle empty string display */}
            {(filters.costMin || filters.costMax) && (
              <div className="text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded">
                Cost: {filters.costMin || 'Any'} - {filters.costMax || 'Any'}
              </div>
            )}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <h3 className="text-white font-medium mb-3 text-sm uppercase tracking-wide">Keywords</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {keywords.map((keyword) => (
              <div key={keyword} className="flex items-center space-x-2">
                <Checkbox
                  id={`keyword-${keyword}`}
                  checked={filters.keywords.includes(keyword)}
                  onCheckedChange={() => toggleArrayFilter('keywords', keyword)}
                  className="border-gray-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <Label 
                  htmlFor={`keyword-${keyword}`}
                  className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  {keyword}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Sets */}
        <div>
          <h3 className="text-white font-medium mb-3 text-sm uppercase tracking-wide">Sets</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {sets.map((set) => (
              <div key={set} className="flex items-center space-x-2">
                <Checkbox
                  id={`set-${set}`}
                  checked={filters.sets.includes(set)}
                  onCheckedChange={() => toggleArrayFilter('sets', set)}
                  className="border-gray-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <Label
                  htmlFor={`set-${set}`}
                  className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  {set}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Active Filters Summary */}
        {(filters.types.length > 0 || filters.aspects.length > 0 || filters.keywords.length > 0 || filters.sets.length > 0 || filters.costMin || filters.costMax) && (
          <div className="border-t border-gray-800 pt-4">
            <h4 className="text-white font-medium mb-2 text-sm">Active Filters</h4>
            <div className="text-xs text-gray-400 space-y-1">
              {filters.types.length > 0 && <div>Types: {filters.types.length}</div>}
              {filters.aspects.length > 0 && <div>Aspects: {filters.aspects.length}</div>}
              {filters.keywords.length > 0 && <div>Keywords: {filters.keywords.length}</div>}
              {filters.sets.length > 0 && <div>Sets: {filters.sets.length}</div>}
              {(filters.costMin || filters.costMax) && <div>Cost Range: Yes</div>}
            </div>
          </div>
        )}

        {/* Reset Button */}
        <Button 
          onClick={resetFilters} 
          variant="outline" 
          className="w-full border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
        >
          Reset All Filters
        </Button>
      </CardContent>
    </Card>
  );
}