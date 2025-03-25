'use client';

import React, { useState, useEffect } from 'react';
import { fetchCards, fetchAspects, fetchTypes, fetchKeywords, fetchSets, ApiCard } from '@/lib/api';
import { CardGrid } from '@/components/CardGrid';
import { CardFilters } from '@/components/CardFilters';
import { CardDetailDialog } from '@/components/CardDetailDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';

export default function CardBrowser() {
  // State
  const [cards, setCards] = useState<ApiCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<ApiCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<ApiCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [aspects, setAspects] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sets, setSets] = useState<string[]>([]);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    types: [] as string[],
    aspects: [] as string[],
    keywords: [] as string[],
    costMin: 0,
    costMax: 10,
    sets: [] as string[],
  });

  // Fetch data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch cards with large limit for browsing
        const cardsData = await fetchCards({ limit: '100' });
        setCards(cardsData);
        setFilteredCards(cardsData);
        
        // Fetch filter options
        const [aspectsData, typesData, keywordsData, setsData] = await Promise.all([
          fetchAspects(),
          fetchTypes(),
          fetchKeywords(),
          fetchSets()
        ]);
        
        setAspects(aspectsData);
        setTypes(typesData);
        setKeywords(keywordsData);
        setSets(setsData);
      } catch (err) {
        console.error('Error loading cards:', err);
        setError('Failed to load cards. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Apply filters when filters state changes
  useEffect(() => {
    let result = [...cards];
    
    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(
        card => card.name.toLowerCase().includes(searchTerm) || 
               (card.text && card.text.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply type filter
    if (filters.types.length > 0) {
      result = result.filter(card => filters.types.includes(card.type));
    }
    
    // Apply aspect filter
    if (filters.aspects.length > 0) {
      result = result.filter(card => 
        card.aspects?.some(aspect => 
          filters.aspects.includes(aspect.aspect_name)
        )
      );
    }
    
    // Apply keyword filter
    if (filters.keywords.length > 0) {
      result = result.filter(card => 
        card.keywords?.some(keyword => 
          filters.keywords.includes(keyword)
        )
      );
    }
    
    // Apply cost filter - using both energy_cost and cost fields for compatibility
    result = result.filter(card => {
      const cost = card.energy_cost !== undefined ? card.energy_cost : 
                  (card.cost !== undefined ? card.cost : 0);
      return cost >= filters.costMin && cost <= filters.costMax;
    });
    
    // Apply set filter
    if (filters.sets.length > 0) {
      result = result.filter(card => {
        const cardSet = card.set_code || card.set_name || '';
        return filters.sets.includes(cardSet);
      });
    }
    
    setFilteredCards(result);
  }, [filters, cards]);

  // Handle card selection
  const handleCardClick = (card: ApiCard) => {
    setSelectedCard(card);
    setShowDetail(true);
  };

  // Handle updating filters
  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Section */}
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              Card Browser
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Explore the complete Star Wars Unlimited card collection. Use the filters to find exactly what you need for your next deck.
          </p>
        </div>
      </section>

      {/* Search and Filters Section */}
      <section className="py-4 px-4 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search Box */}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by card name or text..."
                className="w-full bg-gray-900 border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-white"
                value={filters.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
              />
            </div>
            
            {/* Filter Toggle Button (Mobile) */}
            <Button 
              className="md:hidden w-full flex items-center justify-center space-x-2 bg-purple-600"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </Button>
            
            {/* Card Count */}
            <div className="text-gray-300 text-sm">
              {loading ? 'Loading...' : `${filteredCards.length} cards found`}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-6 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Filters Sidebar (Desktop) */}
          <div className="hidden md:block">
            <CardFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              aspects={aspects}
              types={types}
              keywords={keywords}
              sets={sets}
            />
          </div>
          
          {/* Mobile Filters (Dialog) */}
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <DialogContent className="bg-gray-900 text-white border border-gray-800 sm:max-w-md">
              <CardFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                aspects={aspects}
                types={types}
                keywords={keywords}
                sets={sets}
                onClose={() => setShowFilters(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Card Grid */}
          <div className="md:col-span-3">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
                <p className="text-red-400 mb-3">{error}</p>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="border-red-700 hover:bg-red-800/30"
                >
                  Try Again
                </Button>
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-10 text-center">
                <p className="text-gray-400 mb-3">No cards found matching your filters.</p>
                <Button 
                  onClick={() => setFilters({
                    search: '',
                    types: [],
                    aspects: [],
                    keywords: [],
                    costMin: 0,
                    costMax: 10,
                    sets: []
                  })} 
                  variant="outline"
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <CardGrid
                cards={filteredCards}
                onCardClick={handleCardClick}
              />
            )}
          </div>
        </div>
      </section>

      {/* Card Detail Modal */}
      {selectedCard && (
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="bg-gray-900 text-white border border-gray-800 sm:max-w-lg">
            <CardDetailDialog
              card={selectedCard}
              onClose={() => setShowDetail(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}