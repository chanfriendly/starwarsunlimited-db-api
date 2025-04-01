// frontend/src/app/cards/page.tsx - Update the component with pagination support

'use client';

import React, { useState, useEffect } from 'react';
import { fetchCards, fetchAspects, fetchTypes, fetchKeywords, fetchSets, ApiCard } from '@/lib/api';
import { CardGrid } from '@/components/CardGrid';
import { CardFilters } from '@/components/CardFilters';
import { CardDetailDialog } from '@/components/CardDetailDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Filter, Loader } from 'lucide-react';

export default function CardBrowser() {
  // State
  const [cards, setCards] = useState<ApiCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<ApiCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [aspects, setAspects] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sets, setSets] = useState<string[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  
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

  // Fetch filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [aspectsData, typesData, keywordsData, setsData] = await Promise.all([
          fetchAspects(),
          fetchTypes(),
          fetchKeywords(),
          fetchSets()
        ]);
        
      // Extract aspect names for the filter options
      setAspects(aspectsData.map(aspect => aspect.aspect_name));
      setTypes(typesData);
      setKeywords(keywordsData);
      setSets(setsData);
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  loadFilterOptions();
}, []);

  // Fetch cards when filters or page changes
  useEffect(() => {
    const loadCards = async () => {
      try {
        if (currentPage === 1) {
          setLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        
        // Prepare filter parameters for the API
        const params = {
          limit: '24',  // Show 24 cards per page for better grid layout
          page: currentPage.toString(),
          search: filters.search,
          type: filters.types.length > 0 ? filters.types.join(',') : undefined,
          aspect: filters.aspects.length > 0 ? filters.aspects.join(',') : undefined,
          costMin: filters.costMin.toString(),
          costMax: filters.costMax.toString(),
          keyword: filters.keywords.length > 0 ? filters.keywords.join(',') : undefined,
          set: filters.sets.length > 0 ? filters.sets.join(',') : undefined
        };
        
        const response = await fetchCards({ 
            ...params,
            structured: true // Request structured response with pagination
          });        
        // If it's page 1, replace the cards
        // If it's past page 1, append the new cards
        if (currentPage === 1) {
          setCards(response.data);
        } else {
          setCards(prevCards => [...prevCards, ...response.data]);
        }
        
        // Update pagination information
        setTotalPages(response.meta.pages);
        setTotalCards(response.meta.total);
        
      } catch (err) {
        console.error('Error loading cards:', err);
        setError('Failed to load cards. Please try again later.');
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    };

    loadCards();
  }, [currentPage, filters]);

  // Handle card selection
  const handleCardClick = (card: ApiCard) => {
    setSelectedCard(card);
    setShowDetail(true);
  };

  // Handle updating filters
  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters });
    setCurrentPage(1); // Reset to first page when filters change
  };
  
  // Load more cards
  const handleLoadMore = () => {
    setCurrentPage(prev => prev + 1);
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
              {loading && currentPage === 1 ? 'Loading...' : `${totalCards} cards found`}
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
            {loading && currentPage === 1 ? (
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
            ) : cards.length === 0 ? (
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
              <>
                <CardGrid
                  cards={cards}
                  onCardClick={handleCardClick}
                />
                
                {/* Pagination/Load More */}
                {currentPage < totalPages && (
                  <div className="flex justify-center mt-8">
                    <Button
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isLoadingMore ? (
                        <span className="flex items-center">
                          <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                          Loading more cards...
                        </span>
                      ) : (
                        'Load More Cards'
                      )}
                    </Button>
                  </div>
                )}
              </>
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