'use client';

import React, { useState, useCallback } from 'react';

interface CardFilters {
  search: string;
  types: string[];
  aspects: string[];
  keywords: string[];
  costMin: string;
  costMax: string;
  sets: string[];
}

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

export function CardSearch({
  searchTerm,
  filters,
  onFiltersChange,
  availableAspects,
  availableTypes,
  availableKeywords,
  availableSets,
  isLoading = false,
}: CardSearchProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const updateFilters = useCallback(
    (newFilters: Partial<CardFilters>) => {
      onFiltersChange({ ...filters, ...newFilters });
    },
    [filters, onFiltersChange]
  );

  const toggleFilterItem = (filterKey: keyof CardFilters, item: string) => {
    const currentArray = filters[filterKey] as string[];
    const newArray = currentArray.includes(item)
      ? currentArray.filter((i) => i !== item)
      : [...currentArray, item];
    updateFilters({ [filterKey]: newArray });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: searchTerm,
      types: [],
      aspects: [],
      keywords: [],
      costMin: '',
      costMax: '',
      sets: [],
    });
  };

  const activeFilterCount =
    filters.types.length +
    filters.aspects.length +
    filters.keywords.length +
    filters.sets.length +
    (filters.costMin ? 1 : 0) +
    (filters.costMax ? 1 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--ts-ink-4)',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          ⌕
        </span>
        <input
          type="text"
          placeholder="Search cards by name…"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          disabled={isLoading}
          className="ts-input"
          style={{ paddingLeft: 34, paddingRight: isLoading ? 36 : 12 }}
        />
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              border: '2px solid var(--ts-line-2)',
              borderTopColor: 'var(--ts-amber)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
      </div>

      {/* Filter toggle + clear row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="ts-btn ts-btn-sm"
          style={{
            borderColor: showFilters ? 'var(--ts-amber)' : undefined,
            color: showFilters ? 'var(--ts-amber)' : undefined,
          }}
        >
          {showFilters ? '▲' : '▼'} Filters
          {activeFilterCount > 0 && (
            <span
              className="ts-chip"
              style={{
                marginLeft: 4,
                borderColor: 'var(--ts-amber)',
                color: 'var(--ts-amber)',
                padding: '1px 5px',
                fontSize: 9,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button onClick={clearAllFilters} className="ts-btn ts-btn-sm">
            Clear All
          </button>
        )}
      </div>

      {/* Expanded filter panel — mobile/inline */}
      {showFilters && (
        <div
          style={{
            background: 'var(--ts-panel)',
            border: '1px solid var(--ts-line)',
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {/* Cost range */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Cost Range</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Min"
                value={filters.costMin}
                onChange={(e) => updateFilters({ costMin: e.target.value })}
                className="ts-input"
                style={{ width: 64, padding: '5px 8px', fontSize: 13 }}
                min="0"
                max="20"
              />
              <span style={{ color: 'var(--ts-ink-4)', fontSize: 12 }}>–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.costMax}
                onChange={(e) => updateFilters({ costMax: e.target.value })}
                className="ts-input"
                style={{ width: 64, padding: '5px 8px', fontSize: 13 }}
                min="0"
                max="20"
              />
            </div>
          </div>

          {/* Types */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Card Types</div>
            <select
              onChange={(e) => { if (e.target.value) toggleFilterItem('types', e.target.value); e.target.value = ''; }}
              className="ts-input"
              style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6 }}
            >
              <option value="">Select type…</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {filters.types.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleFilterItem('types', t)}
                  className="ts-filter-pill is-active"
                  style={{ fontSize: 9 }}
                >
                  {t} ×
                </button>
              ))}
            </div>
          </div>

          {/* Aspects */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Aspects</div>
            <select
              onChange={(e) => { if (e.target.value) toggleFilterItem('aspects', e.target.value); e.target.value = ''; }}
              className="ts-input"
              style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6 }}
            >
              <option value="">Select aspect…</option>
              {availableAspects.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {filters.aspects.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleFilterItem('aspects', a)}
                  className="ts-filter-pill is-active"
                  style={{ fontSize: 9 }}
                >
                  {a} ×
                </button>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Keywords</div>
            <select
              onChange={(e) => { if (e.target.value) toggleFilterItem('keywords', e.target.value); e.target.value = ''; }}
              className="ts-input"
              style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6 }}
            >
              <option value="">Select keyword…</option>
              {availableKeywords.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {filters.keywords.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleFilterItem('keywords', k)}
                  className="ts-filter-pill is-active"
                  style={{ fontSize: 9 }}
                >
                  {k} ×
                </button>
              ))}
            </div>
          </div>

          {/* Sets */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Sets</div>
            <select
              onChange={(e) => { if (e.target.value) toggleFilterItem('sets', e.target.value); e.target.value = ''; }}
              className="ts-input"
              style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6 }}
            >
              <option value="">Select set…</option>
              {availableSets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {filters.sets.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleFilterItem('sets', s)}
                  className="ts-filter-pill is-active"
                  style={{ fontSize: 9 }}
                >
                  {s} ×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active filter pills row */}
      {activeFilterCount > 0 && !showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {filters.types.map((t) => (
            <button key={`t-${t}`} onClick={() => toggleFilterItem('types', t)} className="ts-filter-pill is-active" style={{ fontSize: 9 }}>
              {t} ×
            </button>
          ))}
          {filters.aspects.map((a) => (
            <button key={`a-${a}`} onClick={() => toggleFilterItem('aspects', a)} className="ts-filter-pill is-active" style={{ fontSize: 9 }}>
              {a} ×
            </button>
          ))}
          {filters.keywords.map((k) => (
            <button key={`k-${k}`} onClick={() => toggleFilterItem('keywords', k)} className="ts-filter-pill is-active" style={{ fontSize: 9 }}>
              {k} ×
            </button>
          ))}
          {filters.sets.map((s) => (
            <button key={`s-${s}`} onClick={() => toggleFilterItem('sets', s)} className="ts-filter-pill is-active" style={{ fontSize: 9 }}>
              {s} ×
            </button>
          ))}
          {filters.costMin && (
            <button onClick={() => updateFilters({ costMin: '' })} className="ts-filter-pill is-active" style={{ fontSize: 9 }}>
              Min: {filters.costMin} ×
            </button>
          )}
          {filters.costMax && (
            <button onClick={() => updateFilters({ costMax: '' })} className="ts-filter-pill is-active" style={{ fontSize: 9 }}>
              Max: {filters.costMax} ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CardSearch;
