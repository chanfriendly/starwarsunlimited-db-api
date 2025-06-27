// Fixed frontend/src/app/cards/page.tsx 
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
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false); // FIXED: Only declare once

  // Filter options state
  const [aspects, setAspects] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sets, setSets] = useState<string[]>([]);
  // REMOVED: Duplicate filterOptionsLoaded declaration
  
  const [userCollection, setUserCollection] = useState<Set<string>>(new Set());
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  // STEP 1: Load filter options first
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
        
        setFilterOptionsLoaded(true);
        console.log('[Cards] Filter options loaded successfully');
      } catch (err) {
        console.error('[Cards] Error loading filter options:', err);
        setError('Failed to load filter options');
        // Set to true anyway so we can still load cards
        setFilterOptionsLoaded(true);
      }
    };

    loadFilterOptions();
  }, []);

  // STEP 2: Load user collection (parallel to filter options)
  useEffect(() => {
    const loadUserCollection = async () => {
      try {
        // Load from localStorage first for immediate UX
        const storedCollection = localStorage.getItem('user_collection');
        if (storedCollection) {
          try {
            const parsed = JSON.parse(storedCollection);
            if (Array.isArray(parsed)) {
              setUserCollection(new Set(parsed));
            }
          } catch (e) {
            console.error('[Cards] Error parsing stored collection:', e);
          }
        }
        
        // Then load from API if authenticated
        if (isAuthenticated && !authLoading) {
          try {
            const collection = await fetchUserCollection();
            if (collection && Array.isArray(collection)) {
              const collectionIds = collection.map(item => item.card.id);
              localStorage.setItem('user_collection', JSON.stringify(collectionIds));
              setUserCollection(new Set(collectionIds));
            }
          } catch (err) {
            console.error('[Cards] Error fetching collection from API:', err);
          }
        }
      } catch (err) {
        console.error('[Cards] Error in collection loading:', err);
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
      loadCards(1, false, filters);
    }
  }, [filterOptionsLoaded]); // Only depend on filterOptionsLoaded

  // Improved card loading with better error handling
  const loadCards = useCallback(async (page = 1, append = false, searchFilters = filters) => {
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
      
      console.log('[Cards] Loading cards with filters:', searchFilters);
      
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
  }, [filterOptionsLoaded, filters]);

  // Debounced search handling
  const debouncedSearch = useMemo(
    () => debounce((newFilters) => {
      console.log('[Cards] Debounced search triggered:', newFilters);
      loadCards(1, false, newFilters);
    }, 500),
    [loadCards]
  );

  // Handle filter changes - FIXED: proper filter merging
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    console.log('[Cards] Filter change received:', newFilters);
    console.log('[Cards] Current filters:', filters);
    
    // Merge new filters with existing ones
    const mergedFilters = { ...filters, ...newFilters };
    console.log('[Cards] Merged filters:', mergedFilters);
    
    setFilters(mergedFilters);
    setCurrentPage(1);
    debouncedSearch(mergedFilters);
  }, [debouncedSearch, filters]);

  // Handle card selection
  const handleCardSelect = useCallback((card: ApiCard) => {
    setSelectedCard(card);
    setShowDetail(true);
  }, []);

  // FIXED: Convert userCollection Set to isInCollection function for CardGrid
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
    );
  }

  // Error state UI
  if (error && !cards.length) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-lg font-medium text-red-600 mb-4">{error}</p>
            <Button 
              onClick={() => {
                setError(null);
                loadCards(1, false, filters);
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Card Browser</h1>
          <p className="text-muted-foreground mt-2">
            Browse all {totalCards.toLocaleString()} Star Wars Unlimited cards
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-8">
          <CardFilters
            filters={filters}
            onFiltersChangeAction={handleFilterChange}
            aspects={aspects}
            types={types}
            keywords={keywords}
            sets={sets}
          />
        </div>
      )}

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading cards...</p>
          </div>
        </div>
      ) : (
        <CardGrid
          cards={cards}
          onCardClickAction={handleCardSelect}
          isInCollection={isInCollection}
        />
      )}

      {/* Load More Button */}
      {currentPage < totalPages && !loading && (
        <div className="flex justify-center mt-8">
          <Button
            onClick={() => loadCards(currentPage + 1, true, filters)}
            disabled={isLoadingMore}
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

      {/* Card Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCard && (
            <CardDetailDialog
              card={selectedCard}
              onClose={() => setShowDetail(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}