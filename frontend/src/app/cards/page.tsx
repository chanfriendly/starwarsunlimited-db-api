// frontend/src/app/cards/page.tsx - Improved version with better error handling

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchCards, fetchAspects, fetchTypes, fetchKeywords, fetchSets, ApiCard, fetchUserCollection } from '@/lib/api';
import { CardGrid } from '@/components/CardGrid';
import { CardFilters } from '@/components/CardFilters';
import { CardDetailDialog } from '@/components/CardDetailDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Filter, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { debounce } from 'lodash-es';

interface Aspect {
  aspect_name: string;
  aspect_color?: string;
}

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
  const [userCollection, setUserCollection] = useState<Set<string>>(new Set());
  const { isAuthenticated } = useAuth();

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

  // Refs for cleanup and preventing race conditions
  const searchAbortController = useRef<AbortController | null>(null);
  const isUnmounted = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  // Auth check
  useEffect(() => {
    const checkAuthOnLoad = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
          });
          
          if (!response.ok) {
            localStorage.removeItem('auth_token');
          }
        } catch (e) {
          console.error('Error checking auth on page load:', e);
        }
      }
    };
    
    checkAuthOnLoad();
  }, []);

  // Load user collection
  useEffect(() => {
    const loadUserCollection = async () => {
      try {
        const storedCollection = localStorage.getItem('user_collection');
        if (storedCollection) {
          try {
            const parsed = JSON.parse(storedCollection);
            if (Array.isArray(parsed)) {
              setUserCollection(new Set(parsed));
            }
          } catch (e) {
            console.error('Error parsing stored collection:', e);
          }
        }
        
        if (isAuthenticated) {
          try {
            const collection = await fetchUserCollection();
            if (collection && Array.isArray(collection)) {
              const collectionIds = collection.map(item => item.card.id);
              localStorage.setItem('user_collection', JSON.stringify(collectionIds));
              setUserCollection(new Set(collectionIds));
            }
          } catch (err) {
            console.error('Error fetching collection from API:', err);
          }
        }
      } catch (err) {
        console.error('Error in collection loading:', err);
      }
    };
    
    loadUserCollection();
  }, [isAuthenticated]);

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [aspectsData, typesData, keywordsData, setsData] = await Promise.all([
          fetchAspects(),
          fetchTypes(),
          fetchKeywords(),
          fetchSets()
        ]);
        
        if (Array.isArray(aspectsData)) {
          if (aspectsData.length === 0) {
            setAspects([]);
          } else if (typeof aspectsData[0] === 'string') {
            setAspects(aspectsData as unknown as string[]);
          } else {
            const aspectNames: string[] = [];
            for (const aspect of aspectsData) {
              if (aspect && typeof aspect === 'object' && 'aspect_name' in aspect) {
                aspectNames.push((aspect as any).aspect_name);
              }
            }
            setAspects(aspectNames);
          }
        }
        
        if (Array.isArray(typesData)) setTypes(typesData);
        if (Array.isArray(keywordsData)) setKeywords(keywordsData);
        if (Array.isArray(setsData)) setSets(setsData);
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };

    loadFilterOptions();
  }, []);

  // Improved card loading with better error handling
  const loadCards = useCallback(async (page = 1, append = false, searchFilters = filters) => {
    // Abort previous request if it exists
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    searchAbortController.current = controller;

    try {
      if (page === 1 && !append) {
        setLoading(true);
        setError(null);
      } else if (append) {
        setIsLoadingMore(true);
      }
      
      // Prepare filter parameters with better sanitization
      const params = {
        limit: '24',
        page: page.toString(),
        search: searchFilters.search.trim() || undefined,
        type: searchFilters.types.length > 0 ? searchFilters.types.join(',') : undefined,
        aspect: searchFilters.aspects.length > 0 ? searchFilters.aspects.join(',') : undefined,
        costMin: searchFilters.costMin.toString(),
        costMax: searchFilters.costMax.toString(),
        keyword: searchFilters.keywords.length > 0 ? searchFilters.keywords.join(',') : undefined,
        set: searchFilters.sets.length > 0 ? searchFilters.sets.join(',') : undefined
      };
      
      const response = await fetchCards({ 
        ...params,
        structured: true
      });

      // Check if component is still mounted and request wasn't aborted
      if (isUnmounted.current || controller.signal.aborted) {
        return;
      }
      
      if (page === 1 || !append) {
        setCards(response.data);
      } else {
        setCards(prevCards => [...prevCards, ...response.data]);
      }
      
      setTotalPages(response.meta.pages);
      setTotalCards(response.meta.total);
      setCurrentPage(page);
      
    } catch (err: any) {
      // Don't show error if request was aborted (normal behavior)
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      
      console.error('Error loading cards:', err);
      if (!isUnmounted.current) {
        setError('Failed to load cards. Please try again later.');
      }
    } finally {
      if (!isUnmounted.current) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [filters]);

  // Improved debounced search with cleanup
  const debouncedLoadCards = useMemo(
    () => debounce((newFilters: typeof filters) => {
      setCurrentPage(1);
      loadCards(1, false, newFilters);
    }, 400),
    [loadCards]
  );

  // Cleanup debounced function
  useEffect(() => {
    return () => {
      debouncedLoadCards.cancel();
    };
  }, [debouncedLoadCards]);

  // Load cards when filters change
  useEffect(() => {
    debouncedLoadCards(filters);
  }, [filters, debouncedLoadCards]);

  // Card selection handlers
  const handleCardClick = useCallback((card: ApiCard) => {
    setSelectedCard(card);
    setShowDetail(true);
  }, []);

  const handleFilterChange = useCallback((newFilters: any) => {
    setFilters(prevFilters => ({ ...prevFilters, ...newFilters }));
  }, []);
  
  const handleLoadMore = useCallback(() => {
    if (currentPage < totalPages && !isLoadingMore) {
      loadCards(currentPage + 1, true, filters);
    }
  }, [currentPage, totalPages, isLoadingMore, loadCards, filters]);

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
            
            <Button 
              className="md:hidden w-full flex items-center justify-center space-x-2 bg-purple-600"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </Button>
            
            <div className="text-gray-300 text-sm">
              {loading && currentPage === 1 ? 'Loading...' : `${totalCards} cards found`}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-6 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="hidden md:block">
            <CardFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              aspects={aspects}
              types={types}
              keywords={keywords}
              sets={sets}
              onClose={() => setShowFilters(false)}
            />
          </div>
          
          {/* Mobile Filters Dialog */}
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
                  onClick={() => {
                    setError(null);
                    loadCards(1, false, filters);
                  }} 
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
                  onCardClickAction={handleCardClick}
                  isInCollection={(cardId) => userCollection.has(cardId)}
                />
        
                {/* Load More Button */}
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