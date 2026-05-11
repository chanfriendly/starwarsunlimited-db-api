'use client';

import React from 'react';

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
  onClose?: () => void;
}

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
  { value: '10', label: '10+' },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="ts-eyebrow" style={{ marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--ts-line)' }}>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 13,
          height: 13,
          border: `1px solid ${checked ? 'var(--ts-amber)' : 'var(--ts-line-2)'}`,
          background: checked ? 'var(--ts-amber)' : 'transparent',
          flexShrink: 0,
          transition: 'background 0.12s, border-color 0.12s',
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontFamily: 'var(--ts-font-body)',
          color: checked ? 'var(--ts-ink)' : 'var(--ts-ink-2)',
          transition: 'color 0.12s',
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function CardFilters({
  filters,
  onFiltersChangeAction,
  aspects,
  types,
  keywords,
  sets,
  onClose,
}: CardFiltersProps) {
  const toggleArrayFilter = (filterName: string, value: string) => {
    const currentValues = filters[filterName as keyof typeof filters] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    onFiltersChangeAction({ ...filters, [filterName]: newValues });
  };

  const handleCostMinChange = (value: string) =>
    onFiltersChangeAction({ ...filters, costMin: value === 'any' ? '' : value });

  const handleCostMaxChange = (value: string) =>
    onFiltersChangeAction({ ...filters, costMax: value === 'any' ? '' : value });

  const resetFilters = () =>
    onFiltersChangeAction({
      search: '',
      types: [],
      aspects: [],
      keywords: [],
      costMin: '',
      costMax: '',
      sets: [],
    });

  const activeCount =
    filters.types.length +
    filters.aspects.length +
    filters.keywords.length +
    filters.sets.length +
    (filters.costMin ? 1 : 0) +
    (filters.costMax ? 1 : 0);

  return (
    <div
      style={{
        background: 'var(--ts-panel)',
        borderRight: '1px solid var(--ts-line)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--ts-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: 'var(--ts-font-display)',
              fontSize: 20,
              color: 'var(--ts-ink)',
            }}
          >
            Filters
          </span>
          {activeCount > 0 && (
            <span className="ts-chip" style={{ color: 'var(--ts-amber)', borderColor: 'var(--ts-amber)' }}>
              {activeCount} active
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ts-ink-3)',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Card Types */}
        <div>
          <SectionHeader>Card Types</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {types.map((type) => (
              <CheckRow
                key={type}
                label={type}
                checked={filters.types.includes(type)}
                onToggle={() => toggleArrayFilter('types', type)}
              />
            ))}
          </div>
        </div>

        {/* Aspects */}
        <div>
          <SectionHeader>Aspects</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {aspects.map((aspect) => (
              <CheckRow
                key={aspect}
                label={aspect}
                checked={filters.aspects.includes(aspect)}
                onToggle={() => toggleArrayFilter('aspects', aspect)}
              />
            ))}
          </div>
        </div>

        {/* Resource Cost */}
        <div>
          <SectionHeader>Resource Cost</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Min</div>
              <select
                value={filters.costMin || 'any'}
                onChange={(e) => handleCostMinChange(e.target.value)}
                className="ts-input"
                style={{ fontSize: 13, padding: '6px 10px' }}
              >
                {COST_OPTIONS.map((o) => (
                  <option key={`min-${o.value}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Max</div>
              <select
                value={filters.costMax || 'any'}
                onChange={(e) => handleCostMaxChange(e.target.value)}
                className="ts-input"
                style={{ fontSize: 13, padding: '6px 10px' }}
              >
                {COST_OPTIONS.map((o) => (
                  <option key={`max-${o.value}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {(filters.costMin || filters.costMax) && (
              <div
                className="ts-eyebrow"
                style={{ color: 'var(--ts-amber)' }}
              >
                {filters.costMin || 'Any'} – {filters.costMax || 'Any'}
              </div>
            )}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <SectionHeader>Keywords</SectionHeader>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {keywords.map((keyword) => (
              <CheckRow
                key={keyword}
                label={keyword}
                checked={filters.keywords.includes(keyword)}
                onToggle={() => toggleArrayFilter('keywords', keyword)}
              />
            ))}
          </div>
        </div>

        {/* Sets */}
        <div>
          <SectionHeader>Sets</SectionHeader>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 160,
              overflowY: 'auto',
            }}
          >
            {sets.map((set) => (
              <CheckRow
                key={set}
                label={set}
                checked={filters.sets.includes(set)}
                onToggle={() => toggleArrayFilter('sets', set)}
              />
            ))}
          </div>
        </div>

        {/* Reset */}
        <button onClick={resetFilters} className="ts-btn" style={{ width: '100%', justifyContent: 'center' }}>
          Reset All Filters
        </button>
      </div>
    </div>
  );
}
