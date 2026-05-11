'use client';

import React, { useState, useCallback } from 'react';
import { ApiCard } from '@/lib/api';

interface CardGridProps {
  cards: ApiCard[];
  onCardClickAction: (card: ApiCard) => void;
  onDoubleClickAction?: (card: ApiCard) => void;
  isInCollection?: (cardId: string) => boolean;
  hideCardsInDeck?: boolean;
  isInDeck?: (cardId: string) => boolean;
  compatibleCards?: Set<string>;
}

interface AlternateArt {
  id: string;
  image_uri: string;
  set_name: string;
  set_code: string;
  card_number: string;
  rarity: string;
  artist: string;
}

interface ApiCardWithAlternates extends ApiCard {
  alternate_arts?: AlternateArt[];
}

interface DisplayCard extends ApiCardWithAlternates {
  hasMultipleVariants: boolean;
  currentVariantIndex: number;
  variants: ApiCard[];
}

export function CardGrid({
  cards,
  onCardClickAction,
  onDoubleClickAction,
  isInCollection,
  hideCardsInDeck = false,
  isInDeck,
  compatibleCards,
}: CardGridProps) {
  const [selectedArtVariants, setSelectedArtVariants] = useState<Record<string, number>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const displayCards: DisplayCard[] = cards.map((card) => {
    const cardWithAlternates = card as ApiCardWithAlternates;
    const hasAlternateArts = cardWithAlternates.alternate_arts && cardWithAlternates.alternate_arts.length > 0;

    if (hasAlternateArts) {
      const variants = [
        card,
        ...cardWithAlternates.alternate_arts!.map((alt: AlternateArt) => ({
          ...card,
          id: alt.id,
          image_uri: alt.image_uri,
          set_name: alt.set_name,
          set_code: alt.set_code,
          card_number: alt.card_number,
          rarity: alt.rarity,
          artist: alt.artist,
        })),
      ];
      return {
        ...cardWithAlternates,
        hasMultipleVariants: true,
        variants,
        currentVariantIndex: selectedArtVariants[card.id] || 0,
      };
    }

    return {
      ...cardWithAlternates,
      hasMultipleVariants: false,
      variants: [card],
      currentVariantIndex: 0,
    };
  });

  const getSelectedVariant = useCallback(
    (cardId: string, variants: ApiCard[]) => {
      const selectedIndex = selectedArtVariants[cardId] || 0;
      return variants[Math.min(selectedIndex, variants.length - 1)];
    },
    [selectedArtVariants]
  );

  const cycleArtVariant = useCallback(
    (cardId: string, variants: ApiCard[], direction: 'next' | 'prev') => {
      const currentIndex = selectedArtVariants[cardId] || 0;
      const newIndex =
        direction === 'next'
          ? (currentIndex + 1) % variants.length
          : currentIndex === 0
          ? variants.length - 1
          : currentIndex - 1;
      setSelectedArtVariants((prev) => ({ ...prev, [cardId]: newIndex }));
    },
    [selectedArtVariants]
  );

  const visibleCards = displayCards.filter((card) => {
    if (hideCardsInDeck && isInDeck) return !isInDeck(card.id);
    return true;
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12,
      }}
    >
      {visibleCards.map((displayCard) => {
        const currentVariant = displayCard.hasMultipleVariants
          ? getSelectedVariant(displayCard.id, displayCard.variants)
          : displayCard;

        const inCollection = isInCollection ? isInCollection(currentVariant.id) : false;
        const inDeck = isInDeck ? isInDeck(currentVariant.id) : false;
        const compatible = compatibleCards ? compatibleCards.has(currentVariant.id) : true;
        const isHovered = hoveredId === displayCard.id;

        return (
          <div
            key={displayCard.id}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredId(displayCard.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              style={{
                border: `1px solid ${
                  !compatible
                    ? 'var(--ts-red)'
                    : inCollection
                    ? 'var(--ts-amber)'
                    : isHovered
                    ? 'var(--ts-line-2)'
                    : 'var(--ts-line)'
                }`,
                background: 'var(--ts-panel)',
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isHovered ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={() => onCardClickAction(currentVariant)}
              onDoubleClick={onDoubleClickAction ? () => onDoubleClickAction(currentVariant) : undefined}
            >
              {/* Card Image */}
              <div style={{ aspectRatio: '7/10', position: 'relative', overflow: 'hidden' }}>
                {currentVariant.image_uri ? (
                  <img
                    src={currentVariant.image_uri}
                    alt={currentVariant.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit:
                        currentVariant.type === 'Leader' || currentVariant.type === 'Base'
                          ? 'contain'
                          : 'cover',
                      display: 'block',
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--ts-bg-2)',
                      color: 'var(--ts-ink-4)',
                      fontSize: 12,
                      fontFamily: 'var(--ts-font-mono)',
                    }}
                  >
                    NO ART
                  </div>
                )}

                {/* Variant counter */}
                {displayCard.hasMultipleVariants && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      background: 'rgba(26,22,17,0.85)',
                      border: '1px solid var(--ts-line-2)',
                      color: 'var(--ts-ink-3)',
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      padding: '2px 6px',
                    }}
                  >
                    {(selectedArtVariants[displayCard.id] || 0) + 1}/{displayCard.variants.length}
                  </div>
                )}

                {/* Variant arrows — shown on hover */}
                {displayCard.hasMultipleVariants && isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 4px',
                      pointerEvents: 'none',
                    }}
                  >
                    <button
                      style={{
                        background: 'rgba(26,22,17,0.85)',
                        border: '1px solid var(--ts-line-2)',
                        color: 'var(--ts-ink)',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleArtVariant(displayCard.id, displayCard.variants, 'prev');
                      }}
                    >
                      ‹
                    </button>
                    <button
                      style={{
                        background: 'rgba(26,22,17,0.85)',
                        border: '1px solid var(--ts-line-2)',
                        color: 'var(--ts-ink)',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleArtVariant(displayCard.id, displayCard.variants, 'next');
                      }}
                    >
                      ›
                    </button>
                  </div>
                )}

                {/* Collection badge */}
                {inCollection && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      background: 'var(--ts-amber)',
                      color: '#1a1611',
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 8,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      padding: '2px 5px',
                    }}
                  >
                    Owned
                  </div>
                )}

                {/* Out of aspect */}
                {!compatible && (
                  <div
                    style={{
                      position: 'absolute',
                      top: inCollection ? 26 : 6,
                      left: 6,
                      background: 'var(--ts-red)',
                      color: '#fff',
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 8,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      padding: '2px 5px',
                    }}
                  >
                    Off-Aspect
                  </div>
                )}

                {/* Already in deck overlay */}
                {inDeck && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(26,22,17,0.65)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className="ts-stamp"
                      style={{ fontSize: 9, transform: 'rotate(-12deg)' }}
                    >
                      In Deck
                    </span>
                  </div>
                )}

                {/* Type badge */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    background: 'rgba(26,22,17,0.8)',
                    color: 'var(--ts-ink-3)',
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '1px 4px',
                  }}
                >
                  {currentVariant.type}
                </div>
              </div>

              {/* Card info */}
              <div
                style={{
                  padding: '6px 8px',
                  background: 'var(--ts-panel)',
                  borderTop: '1px solid var(--ts-line)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--ts-font-body)',
                    fontSize: 12,
                    color: 'var(--ts-ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.3,
                  }}
                >
                  {currentVariant.name}
                </div>
                {currentVariant.subtitle && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--ts-ink-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {currentVariant.subtitle}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 9,
                      color: 'var(--ts-ink-4)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentVariant.set_code || '—'}
                  </span>
                  {currentVariant.energy_cost != null && (
                    <span
                      style={{
                        fontFamily: 'var(--ts-font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--ts-amber)',
                      }}
                    >
                      {currentVariant.energy_cost}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Variant dots — below card on hover */}
            {displayCard.hasMultipleVariants && isHovered && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 4,
                  marginTop: 4,
                }}
              >
                {displayCard.variants.slice(0, 5).map((_, index) => (
                  <button
                    key={index}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background:
                        index === (selectedArtVariants[displayCard.id] || 0)
                          ? 'var(--ts-amber)'
                          : 'var(--ts-line-2)',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArtVariants((prev) => ({ ...prev, [displayCard.id]: index }));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
