'use client';

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

interface CardSearchProps {
  searchTerm: string;
  filters: CardFilters;
  onFiltersChange: (filters: CardFilters) => void;
  availableAspects: string[];
  availableTypes: string[];
  availableKeywords: string[];
  availableSets: string[];
  isLoading?: boolean;
}

interface CardFilters {
  search: string;
  types: string[];
  aspects: string[];
  keywords: string[];
  costMin: string;
  costMax: string;
  sets: string[];
}

export function CardSearch({
  searchTerm,
  filters,
  onFiltersChange,
  availableAspects,
  availableTypes,
  availableKeywords,
  availableSets,
  isLoading = false
}: CardSearchProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    // Update filters immediately for responsive UI
    const updatedFilters = { ...filters, search: value };
    onFiltersChange(updatedFilters);
  };

  // Handle filter changes
  const updateFilters = useCallback((newFilters: Partial<CardFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    onFiltersChange(updatedFilters);
  }, [filters, onFiltersChange]);

  // Add/remove items from array filters
  const toggleFilterItem = (filterKey: keyof CardFilters, item: string) => {
    const currentArray = filters[filterKey] as string[];
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    
    updateFilters({ [filterKey]: newArray });
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters: CardFilters = {
      search: searchTerm, // Keep the search term
      types: [],
      aspects: [],
      keywords: [],
      costMin: '',
      costMax: '',
      sets: []
    };
    onFiltersChange(clearedFilters);
  };

  // Count active filters
  const activeFilterCount = filters.types.length + 
                           filters.aspects.length + 
                           filters.keywords.length + 
                           filters.sets.length +
                           (filters.costMin ? 1 : 0) +
                           (filters.costMax ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search cards by name, text, or abilities..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-12"
          disabled={isLoading}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
          </div>
        )}
      </div>

      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" onClick={clearAllFilters} className="text-sm">
            Clear All
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
          {/* Cost Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cost Range</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.costMin}
                onChange={(e) => updateFilters({ costMin: e.target.value })}
                className="w-20"
                min="0"
                max="20"
              />
              <span className="flex items-center text-gray-500">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.costMax}
                onChange={(e) => updateFilters({ costMax: e.target.value })}
                className="w-20"
                min="0"
                max="20"
              />
            </div>
          </div>

          {/* Card Types */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Card Types</label>
            <Select onValueChange={(value) => toggleFilterItem('types', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select types..." />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.types.map(type => (
                <Badge key={type} variant="secondary" className="cursor-pointer" onClick={() => toggleFilterItem('types', type)}>
                  {type} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          {/* Aspects */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Aspects</label>
            <Select onValueChange={(value) => toggleFilterItem('aspects', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select aspects..." />
              </SelectTrigger>
              <SelectContent>
                {availableAspects.map(aspect => (
                  <SelectItem key={aspect} value={aspect}>
                    {aspect}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.aspects.map(aspect => (
                <Badge key={aspect} variant="secondary" className="cursor-pointer" onClick={() => toggleFilterItem('aspects', aspect)}>
                  {aspect} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Keywords</label>
            <Select onValueChange={(value) => toggleFilterItem('keywords', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select keywords..." />
              </SelectTrigger>
              <SelectContent>
                {availableKeywords.map(keyword => (
                  <SelectItem key={keyword} value={keyword}>
                    {keyword}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.keywords.map(keyword => (
                <Badge key={keyword} variant="secondary" className="cursor-pointer" onClick={() => toggleFilterItem('keywords', keyword)}>
                  {keyword} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          {/* Sets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sets</label>
            <Select onValueChange={(value) => toggleFilterItem('sets', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select sets..." />
              </SelectTrigger>
              <SelectContent>
                {availableSets.map(set => (
                  <SelectItem key={set} value={set}>
                    {set}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.sets.map(set => (
                <Badge key={set} variant="secondary" className="cursor-pointer" onClick={() => toggleFilterItem('sets', set)}>
                  {set} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Active filters:
          </span>
          {filters.types.map(type => (
            <Badge key={`type-${type}`} variant="outline" className="cursor-pointer" onClick={() => toggleFilterItem('types', type)}>
              Type: {type} <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
          {filters.aspects.map(aspect => (
            <Badge key={`aspect-${aspect}`} variant="outline" className="cursor-pointer" onClick={() => toggleFilterItem('aspects', aspect)}>
              {aspect} <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
          {filters.keywords.map(keyword => (
            <Badge key={`keyword-${keyword}`} variant="outline" className="cursor-pointer" onClick={() => toggleFilterItem('keywords', keyword)}>
              {keyword} <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
          {filters.sets.map(set => (
            <Badge key={`set-${set}`} variant="outline" className="cursor-pointer" onClick={() => toggleFilterItem('sets', set)}>
              {set} <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
          {filters.costMin && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => updateFilters({ costMin: '' })}>
              Min Cost: {filters.costMin} <X className="w-3 h-3 ml-1" />
            </Badge>
          )}
          {filters.costMax && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => updateFilters({ costMax: '' })}>
              Max Cost: {filters.costMax} <X className="w-3 h-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default CardSearch;