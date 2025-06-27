// Fixed frontend/src/app/cards/page.tsx - Correct types and API calls
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchCards, fetchAspects, fetchTypes, fetchKeywords, fetchSets, ApiCard, fetchUserCollection } from '@/lib/api';
import { CardGrid } from '@/components/CardGrid';
import { CardFilters } from '@/components/CardFilters';
import { CardDetailDialog } from '@/components/CardDetailDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Loader, X, ArrowUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { debounce } from 'lodash-es';

// Types for API responses
interface AspectResponse {
  aspect_name: string;
  aspect_color?: string;
}

interface TypeResponse {
  type_name: string;
}

interface KeywordResponse {
  keyword: string;
}

interface SetResponse {
  set_name: string;
  set_code: string;
}

// Sort options for the dropdown
const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'cost_asc', label: 'Cost (Low to High)' },
  { value: 'cost_desc', label: 'Cost (High to Low)' },
  { value: 'type_asc', label: 'Type (A-Z)' },
  { value: 'set_newest', label: 'Set (Newest First)' },
  { value: 'set_oldest', label: 'Set (Oldest First)' },
  { value: 'rarity_rare', label: 'Rarity (Rare to Common)' },
  { value: 'rarity_common', label: 'Rarity (Common to Rare)' }
];

export default function CardBrowser() {
  // State
  const [cards, setCards] = useState<ApiCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<ApiCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

  // Filter options state - properly typed
  const [aspects, setAspects] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sets, setSets] = useState<string[]>([]);
  
  const [userCollection, setUserCollection] = useState<Set<string>>(new Set());
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  
  // Sort state
  const [sortBy, setSortBy] = useState('name_asc');
  
  // Filter state - using simple strings for costs
  const [filters, setFilters] = useState({
    search: '',
    types: [] as string[],
    aspects: [] as string[],
    keywords: [] as string[],
    costMin: '',
    costMax: '',
    sets: [] as string[],
  });

  // Refs for cleanup and preventing race conditions
  const searchAbortController = useRef<AbortController | null>(null);
  const isUnmounted = useRef(false);

  // STEP 1: Load filter options first - FIXED to handle API response structure
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        console.log('[Cards] Loading filter options...');
        
        const [aspectsData, typesData, keywordsData, setsData] = await Promise.all([
          fetchAspects(),
          fetchTypes(),
          fetchKeywords(),
          fetchSets()
        ]);

        if (!isUnmounted.current) {
          // FIXED: Handle both array of objects and array of strings
          const aspectNames = Array.isArray(aspectsData) 
            ? aspectsData.map((item: AspectResponse | string) => 
                typeof item === 'string' ? item : item.aspect_name
              )
            : [];
            
          const typeNames = Array.isArray(typesData)
            ? typesData.map((item: TypeResponse | string) => 
                typeof item === 'string' ? item : item.type_name
              )
            : [];
            
          const keywordNames = Array.isArray(keywordsData)
            ? keywordsData.map((item: KeywordResponse | string) => 
                typeof item === 'string' ? item : item.keyword
              )
            : [];
            
          const setNames = Array.isArray(setsData)
            ? setsData.map((item: SetResponse | string) => 
                typeof item === 'string' ? item : item.set_name
              )
            : [];

          setAspects(aspectNames);
          setTypes(typeNames);
          setKeywords(keywordNames);
          setSets(setNames);
          setFilterOptionsLoaded(true);
          
          console.log('[Cards] Filter options loaded successfully');
          console.log('Aspects:', aspectNames);
          console.log('Types:', typeNames);
        }
      } catch (err) {
        console.error('[Cards] Error loading filter options:', err);
        if (!isUnmounted.current) {
          setError('Failed to load filter options. Please refresh the page.');
        }
      }
    };

    loadFilterOptions();
  }, []);

  // STEP 2: Load user collection if authenticated
  useEffect(() => {
    const loadUserCollection = async () => {
      if (!isAuthenticated) {
        setUserCollection(new Set());
        return;
      }

      try {
        console.log('[Cards] Loading user collection...');
        const collection = await fetchUserCollection();
        setUserCollection(new Set(collection.map(item => item.card_id)));
        console.log('[Cards] User collection loaded:', collection.length, 'cards');
      } catch (err) {
        console.error('[Cards] Error loading user collection:', err);
      }
    };

    if (!authLoading) {
      loadUserCollection();
    }
  }, [isAuthenticated, authLoading]);

  // STEP 3: Load cards ONLY after filter options are ready
  useEffect(() => {
    if (filterOptionsLoaded) {
      console.log('[Cards] Filter options ready, loading initial cards...');
      loadCards(1, false, filters, sortBy);
    }
  }, [filterOptionsLoaded]);

  // Reload cards when sort changes
  // useEffect(() => {
  //   if (filterOptionsLoaded) {
  //     console.log('[Cards] Sort changed, reloading cards...');
  //     loadCards(1, false, filters, sortBy);
  //   }
  // }, [sortBy]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  // Improved card loading with sorting support
  const loadCards = useCallback(async (page = 1, append = false, searchFilters, sortOrder) => {
    // Don't start loading if filter options aren't ready yet
    if (!filterOptionsLoaded) {
      console.log('[Cards] Waiting for filter options before loading cards...');
      return;
    }

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
      
      console.log('[Cards] Loading cards with filters:', searchFilters, 'sort:', sortOrder);
      
      // Prepare filter parameters with better sanitization
      const params = {
        limit: '24',
        page: page.toString(),
        search: searchFilters.search.trim() || undefined,
        type: searchFilters.types.length > 0 ? searchFilters.types.join(',') : undefined,
        aspect: searchFilters.aspects.length > 0 ? searchFilters.aspects.join(',') : undefined,
        costMin: searchFilters.costMin || undefined,
        costMax: searchFilters.costMax || undefined,
        keyword: searchFilters.keywords.length > 0 ? searchFilters.keywords.join(',') : undefined,
        set: searchFilters.sets.length > 0 ? searchFilters.sets.join(',') : undefined,
        sort: sortOrder
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
        setCards(response.data || []);
      } else {
        setCards(prevCards => [...prevCards, ...(response.data || [])]);
      }
      
      setTotalPages(response.meta?.pages || 1);
      setTotalCards(response.meta?.total || 0);
      setCurrentPage(page);
      
      console.log('[Cards] Successfully loaded', response.data?.length || 0, 'cards');
      
    } catch (err: any) {
      // Don't show error if request was aborted (normal behavior)
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      
      console.error('[Cards] Error loading cards:', err);
      if (!isUnmounted.current) {
        setError('Failed to load cards. Please try again.');
      }
    } finally {
      if (!isUnmounted.current) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [filterOptionsLoaded]);

  // Debounced search handling
  const debouncedSearch = useMemo(
    () => debounce((newFilters) => {
      console.log('[Cards] Debounced search triggered:', newFilters);
      loadCards(1, false, newFilters, sortBy);
    }, 500),
    [loadCards, sortBy]
  );

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    console.log('[Cards] Filter change received:', newFilters);
    
    const mergedFilters = { ...filters, ...newFilters };
    console.log('[Cards] Merged filters:', mergedFilters);
    
    setFilters(mergedFilters);
    setCurrentPage(1);
    debouncedSearch(mergedFilters);
  }, [debouncedSearch, filters]);

  // Handle sort change
  const handleSortChange = useCallback((newSort: string) => {
    console.log('[Cards] Sort change:', newSort);
    setSortBy(newSort);
    loadCards(1, false, filters, newSort);
  }, [filters, loadCards]);

  // Handle card selection
  const handleCardSelect = useCallback((card: ApiCard) => {
    setSelectedCard(card);
    setShowDetail(true);
  }, []);

  // Convert userCollection Set to isInCollection function for CardGrid
  const isInCollection = useCallback((cardId: string) => {
    return userCollection.has(cardId);
  }, [userCollection]);

  // Cleanup debounced function
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Loading state UI
  if (loading && !filterOptionsLoaded) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium">Loading card database...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Preparing filters and card data
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state UI
  if (error && !cards.length) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-lg font-medium text-red-600 mb-4">{error}</p>
              <Button 
                onClick={() => {
                  setError(null);
                  loadCards(1, false, filters, sortBy);
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* DESKTOP SIDEBAR - Always visible on desktop, fixed positioning */}
        <div className="hidden xl:block w-80 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
          <CardFilters
            filters={filters}
            onFiltersChangeAction={handleFilterChange}
            aspects={aspects}
            types={types}
            keywords={keywords}
            sets={sets}
          />
        </div>

        {/* MOBILE FILTER OVERLAY */}
        {showMobileFilters && (
          <div className="xl:hidden fixed inset-0 z-50 bg-black bg-opacity-75">
            <div className="absolute inset-y-0 left-0 w-80 bg-gray-900 shadow-xl">
              <CardFilters
                filters={filters}
                onFiltersChangeAction={handleFilterChange}
                aspects={aspects}
                types={types}
                keywords={keywords}
                sets={sets}
                onClose={() => setShowMobileFilters(false)}
              />
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 min-h-screen">
          <div className="container mx-auto py-6 px-4">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Card Browser</h1>
                <p className="text-gray-400 mt-2">
                  Browse all {totalCards.toLocaleString()} Star Wars Unlimited cards
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                {/* MOBILE FILTER BUTTON */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobileFilters(true)}
                  className="xl:hidden gap-2 border-gray-700 text-gray-300 hover:text-white"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>

                {/* SORT DROPDOWN */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-400" />
                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-[200px] bg-gray-900 border-gray-700 text-white">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="text-white hover:bg-gray-800"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* CARDS GRID */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
                  <p className="text-white">Loading cards...</p>
                </div>
              </div>
            ) : (
              <CardGrid
                cards={cards}
                onCardClickAction={handleCardSelect}
                isInCollection={isInCollection}
              />
            )}

            {/* LOAD MORE BUTTON */}
            {currentPage < totalPages && !loading && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={() => loadCards(currentPage + 1, true, filters, sortBy)}
                  disabled={isLoadingMore}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More Cards'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* CARD DETAIL DIALOG */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
            {selectedCard && (
              <CardDetailDialog
                card={selectedCard}
                onClose={() => setShowDetail(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}