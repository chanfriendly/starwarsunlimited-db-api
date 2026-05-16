'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchCards, fetchAspects, fetchTypes, fetchKeywords, fetchSets, ApiCard, fetchUserCollection, CollectionItem } from '@/lib/api';
import { CardGrid } from '@/components/CardGrid';
import { CardFilters } from '@/components/CardFilters';
import { CardDetailDialog } from '@/components/CardDetailDialog';
import { CardSearch } from '@/components/CardSearch';
import { useAuth } from '@/contexts/AuthContext';
import { debounce } from 'lodash-es';

interface AspectResponse { aspect_name: string; aspect_color?: string; }
interface TypeResponse { type_name: string; }
interface KeywordResponse { keyword: string; }
interface SetResponse { set_name: string; set_code: string; }

interface CardFiltersState {
  search: string;
  types: string[];
  aspects: string[];
  keywords: string[];
  costMin: string;
  costMax: string;
  sets: string[];
}

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'cost_asc', label: 'Cost: Low → High' },
  { value: 'cost_desc', label: 'Cost: High → Low' },
  { value: 'type_asc', label: 'Type (A–Z)' },
  { value: 'set_newest', label: 'Set: Newest · Card # ↑' },
  { value: 'set_newest_desc', label: 'Set: Newest · Card # ↓' },
  { value: 'set_oldest', label: 'Set: Oldest · Card # ↑' },
  { value: 'set_oldest_desc', label: 'Set: Oldest · Card # ↓' },
  { value: 'rarity_rare', label: 'Rarity: Rare → Common' },
  { value: 'rarity_common', label: 'Rarity: Common → Rare' },
];

export default function CardBrowser() {
  const [cards, setCards] = useState<ApiCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<ApiCard | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

  const [aspects, setAspects] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sets, setSets] = useState<string[]>([]);
  // Maps canonical display name → all DB set names it covers (for weekly-play merging)
  const [setExpansionMap, setSetExpansionMap] = useState<Map<string, string[]>>(new Map());
  const [userCollection, setUserCollection] = useState<Set<string>>(new Set());
  const [userCollectionCounts, setUserCollectionCounts] = useState<Map<string, number>>(new Map());
  const [showOnlyOwned, setShowOnlyOwned] = useState(false);
  const [collectionCards, setCollectionCards] = useState<ApiCard[]>([]);
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [userWishlistIds, setUserWishlistIds] = useState<Set<string>>(new Set());

  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [sortBy, setSortBy] = useState('name_asc');

  const [filters, setFilters] = useState<CardFiltersState>({
    search: '',
    types: [],
    aspects: [],
    keywords: [],
    costMin: '',
    costMax: '',
    sets: [],
  });

  const searchAbortController = useRef<AbortController | null>(null);
  const isUnmounted = useRef(false);

  // Load filter options
  useEffect(() => {
    const load = async () => {
      try {
        const [aspectsData, typesData, keywordsData, setsData] = await Promise.all([
          fetchAspects(), fetchTypes(), fetchKeywords(), fetchSets(),
        ]);
        if (isUnmounted.current) return;
        setAspects(
          Array.isArray(aspectsData)
            ? [...new Set(aspectsData.map((i: AspectResponse | string) => (typeof i === 'string' ? i : i.aspect_name)))]
            : []
        );
        setTypes(
          Array.isArray(typesData)
            ? typesData.map((i: TypeResponse | string) => (typeof i === 'string' ? i : i.type_name))
            : []
        );
        setKeywords(
          Array.isArray(keywordsData)
            ? keywordsData.map((i: KeywordResponse | string) => (typeof i === 'string' ? i : i.keyword))
            : []
        );
        if (Array.isArray(setsData)) {
          const allSetNames = setsData.map((i: SetResponse | string) => (typeof i === 'string' ? i : i.set_name));
          const allSetNamesSet = new Set(allSetNames);
          const expansion = new Map<string, string[]>();
          const displayNames: string[] = [];
          for (const name of allSetNames) {
            const weeklyPlay = `${name} Weekly Play`;
            if (name.endsWith(' Weekly Play')) continue; // handled by parent
            if (allSetNamesSet.has(weeklyPlay)) {
              expansion.set(name, [name, weeklyPlay]);
            } else {
              expansion.set(name, [name]);
            }
            displayNames.push(name);
          }
          setSets(displayNames);
          setSetExpansionMap(expansion);
        }
        setFilterOptionsLoaded(true);
      } catch {
        if (!isUnmounted.current) {
          setFilterOptionsLoaded(true);
          setError('Failed to load filter options. Please refresh the page.');
        }
      }
    };
    load();
  }, []);

  // Load user collection
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setUserCollection(new Set());
      setUserCollectionCounts(new Map());
      setCollectionCards([]);
      setCollectionLoaded(false);
      setShowOnlyOwned(false);
      return;
    }
    fetchUserCollection()
      .then((c: CollectionItem[]) => {
        setUserCollection(new Set(c.map((item) => item.card.id)));
        setUserCollectionCounts(new Map(c.map((item) => [item.card.id, item.count])));
        setCollectionCards(c.map((item) => item.card));
        setCollectionLoaded(true);
      })
      .catch(() => {});
    fetch('/api/me/wishlist')
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ card: { id: string } }>) => {
        setUserWishlistIds(new Set(items.map(i => i.card.id)));
      })
      .catch(() => {});
  }, [isAuthenticated, authLoading]);

  const handleToggleOwned = useCallback(() => {
    setShowOnlyOwned(prev => !prev);
  }, []);

  // Initial card load after filter options ready
  useEffect(() => {
    if (filterOptionsLoaded) loadCards(1, false, filters, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOptionsLoaded]);

  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      searchAbortController.current?.abort();
    };
  }, []);

  const loadCards = useCallback(
    async (page = 1, append = false, searchFilters: CardFiltersState, sortOrder: string) => {
      if (!filterOptionsLoaded) return;
      searchAbortController.current?.abort();
      const controller = new AbortController();
      searchAbortController.current = controller;

      try {
        if (page === 1 && !append) { setLoading(true); setError(null); }
        else if (append) setIsLoadingMore(true);

        const params = {
          limit: '24',
          page: page.toString(),
          search: searchFilters.search.trim() || undefined,
          type: searchFilters.types.length > 0 ? searchFilters.types.join(',') : undefined,
          aspect: searchFilters.aspects.length > 0 ? searchFilters.aspects.join(',') : undefined,
          costMin: searchFilters.costMin || undefined,
          costMax: searchFilters.costMax || undefined,
          keyword: searchFilters.keywords.length > 0 ? searchFilters.keywords.join(',') : undefined,
          set: searchFilters.sets.length > 0
            ? searchFilters.sets.flatMap(s => setExpansionMap.get(s) ?? [s]).join(',')
            : undefined,
          sort: sortOrder,
          structured: true,
        };

        const response = await fetchCards(params);
        if (isUnmounted.current || controller.signal.aborted) return;

        if (page === 1 || !append) setCards(response.data || []);
        else setCards((prev) => [...prev, ...(response.data || [])]);

        setTotalPages(response.meta?.pages || 1);
        setTotalCards(response.meta?.total || 0);
        setCurrentPage(page);
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        if (!isUnmounted.current) setError('Failed to load cards. Please try again.');
      } finally {
        if (!isUnmounted.current) { setLoading(false); setIsLoadingMore(false); }
      }
    },
    [filterOptionsLoaded]
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((newFilters: CardFiltersState) => {
        loadCards(1, false, newFilters, sortBy);
      }, 500),
    [loadCards, sortBy]
  );

  const handleFiltersChange = useCallback(
    (newFilters: CardFiltersState) => {
      setFilters(newFilters);
      setCurrentPage(1);
      debouncedSearch(newFilters);
    },
    [debouncedSearch]
  );

  const handleSidebarFilterChange = useCallback(
    (newFilters: Partial<CardFiltersState>) => {
      const merged = { ...filters, ...newFilters };
      setFilters(merged);
      setCurrentPage(1);
      debouncedSearch(merged);
    },
    [debouncedSearch, filters]
  );

  const handleSortChange = useCallback(
    (newSort: string) => {
      setSortBy(newSort);
      loadCards(1, false, filters, newSort);
    },
    [filters, loadCards]
  );

  const handleCardSelect = useCallback((card: ApiCard) => {
    setSelectedCard(card);
    setShowDetail(true);
  }, []);

  const handleCardDoubleClick = useCallback(
    async (card: ApiCard) => {
      if (!isAuthenticated) return;
      try {
        const { addCardToCollection } = await import('@/lib/api');
        await addCardToCollection(card.id, 1);
        setUserCollection((prev) => new Set([...prev, card.id]));
        setUserCollectionCounts((prev) => {
          const next = new Map(prev);
          next.set(card.id, (next.get(card.id) ?? 0) + 1);
          return next;
        });
      } catch {}
    },
    [isAuthenticated]
  );

  const handleCollectionCountChange = useCallback((cardId: string, newCount: number) => {
    if (newCount <= 0) {
      setUserCollection(prev => { const next = new Set(prev); next.delete(cardId); return next; });
      setUserCollectionCounts(prev => { const next = new Map(prev); next.delete(cardId); return next; });
      if (showOnlyOwned) setCollectionCards(prev => prev.filter(c => c.id !== cardId));
    } else {
      setUserCollection(prev => new Set([...prev, cardId]));
      setUserCollectionCounts(prev => { const next = new Map(prev); next.set(cardId, newCount); return next; });
    }
  }, [showOnlyOwned]);

  const isInCollection = useCallback((cardId: string) => userCollection.has(cardId), [userCollection]);

  useEffect(() => () => { debouncedSearch.cancel(); }, [debouncedSearch]);

  // ── Loading state ──
  if (loading && !filterOptionsLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid var(--ts-line-2)',
              borderTopColor: 'var(--ts-amber)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <div className="ts-eyebrow">Loading card database…</div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && !cards.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--ts-red)', marginBottom: 16, fontFamily: 'var(--ts-font-mono)', fontSize: 13 }}>
            {error}
          </div>
          <button
            onClick={() => { setError(null); loadCards(1, false, filters, sortBy); }}
            className="ts-btn ts-btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Desktop sidebar */}
      <div
        className="xl-show"
        style={{
          width: 280,
          flexShrink: 0,
          height: '100vh',
          position: 'sticky',
          top: 0,
          overflowY: 'auto',
          display: 'none',
        }}
      >
        <CardFilters
          filters={filters}
          onFiltersChangeAction={handleSidebarFilterChange}
          aspects={aspects}
          types={types}
          keywords={keywords}
          sets={sets}
        />
      </div>

      {/* Mobile filter overlay */}
      {showMobileFilters && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            background: 'rgba(26,22,17,0.85)',
            display: 'flex',
          }}
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            style={{ width: 300, height: '100%', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardFilters
              filters={filters}
              onFiltersChangeAction={handleSidebarFilterChange}
              aspects={aspects}
              types={types}
              keywords={keywords}
              sets={sets}
              onClose={() => setShowMobileFilters(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, minHeight: '100vh', minWidth: 0 }}>
        <div style={{ padding: '24px 24px 40px' }}>
          {/* Page header */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '1px solid var(--ts-line)',
            }}
          >
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Star Wars Unlimited</div>
              <h1 style={{ fontFamily: 'var(--ts-font-display)', fontSize: 'clamp(28px,4vw,44px)', color: 'var(--ts-ink)', margin: 0 }}>
                Card Browser
              </h1>
              {showOnlyOwned ? (
                <div style={{ marginTop: 6, fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-amber)', letterSpacing: '0.1em' }}>
                  {collectionCards.length.toLocaleString()} owned cards
                </div>
              ) : totalCards > 0 && (
                <div style={{ marginTop: 6, fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-3)', letterSpacing: '0.1em' }}>
                  {totalCards.toLocaleString()} cards
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Mobile filters button */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="ts-btn ts-btn-sm xl-hide"
              >
                ≡ Filters
              </button>

              {/* My Collection toggle — only when authenticated */}
              {isAuthenticated && collectionLoaded && (
                <button
                  onClick={handleToggleOwned}
                  className="ts-btn ts-btn-sm"
                  style={{
                    borderColor: showOnlyOwned ? 'var(--ts-amber)' : undefined,
                    color: showOnlyOwned ? 'var(--ts-amber)' : undefined,
                    background: showOnlyOwned ? 'rgba(212,163,78,0.10)' : undefined,
                  }}
                  title={showOnlyOwned ? 'Show all cards' : 'Show only cards in your collection'}
                >
                  {showOnlyOwned ? '◈ My Collection' : '◇ My Collection'}
                </button>
              )}

              {/* Sort dropdown — hidden when showing collection (sort is fixed to collection order) */}
              {!showOnlyOwned && (
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="ts-input"
                  style={{ padding: '7px 12px', fontSize: 12, fontFamily: 'var(--ts-font-mono)', letterSpacing: '0.08em', cursor: 'pointer' }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: 20 }}>
            <CardSearch
              searchTerm={filters.search}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              availableAspects={aspects}
              availableTypes={types}
              availableKeywords={keywords}
              availableSets={sets}
              isLoading={loading}
            />
          </div>

          {/* Card grid */}
          {loading && !showOnlyOwned ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} style={{ border: '1px solid var(--ts-line)', overflow: 'hidden' }}>
                  <div className="ts-skeleton" style={{ aspectRatio: '2/3', width: '100%' }} />
                  <div style={{ padding: '6px 8px', background: 'var(--ts-bg-2)' }}>
                    <div className="ts-skeleton" style={{ height: 10, width: '70%', marginBottom: 4 }} />
                    <div className="ts-skeleton" style={{ height: 8, width: '45%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : showOnlyOwned && collectionCards.length === 0 ? (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-ink-4)' }}>
                Your collection is empty. Double-click any card to add it.
              </div>
            </div>
          ) : (
            <CardGrid
              cards={showOnlyOwned ? collectionCards : cards}
              onCardClickAction={handleCardSelect}
              onDoubleClickAction={handleCardDoubleClick}
              isInCollection={isInCollection}
            />
          )}

          {/* Load more — hidden in My Collection mode */}
          {!showOnlyOwned && currentPage < totalPages && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <button
                onClick={() => loadCards(currentPage + 1, true, filters, sortBy)}
                disabled={isLoadingMore}
                className="ts-btn ts-btn-primary"
              >
                {isLoadingMore ? 'Loading…' : 'Load More Cards'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card detail modal */}
      {showDetail && selectedCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26,22,17,0.92)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowDetail(false)}
        >
          <div
            style={{
              background: 'var(--ts-panel)',
              border: '1px solid var(--ts-line)',
              maxWidth: 820,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardDetailDialog
              card={selectedCard}
              onClose={() => setShowDetail(false)}
              collectionCount={userCollectionCounts.get(selectedCard.id) ?? 0}
              onCollectionChange={(newCount) => handleCollectionCountChange(selectedCard.id, newCount)}
              initialOnWishlist={userWishlistIds.has(selectedCard.id)}
              onWishlistChange={(cardId, isOnWishlist) => {
                setUserWishlistIds(prev => {
                  const next = new Set(prev);
                  if (isOnWishlist) next.add(cardId); else next.delete(cardId);
                  return next;
                });
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
