'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ApiCard } from '@/lib/api';

interface AlternateArt {
  id: string;
  image_uri: string;
  set_name: string;
  set_code: string;
  card_number: string;
  rarity: string;
  artist: string;
}

interface GroupedApiCard extends ApiCard {
  alternate_arts?: AlternateArt[];
}

interface CardDetailProps {
  card: GroupedApiCard | null;
  onAddToDeck?: (card: GroupedApiCard) => void;
  onRemoveFromDeck?: (cardId: string) => void;
  isInDeck?: boolean;
  isCompatible?: boolean;
  currentStage?: 'leaders' | 'base' | 'cards';
}

const ASPECT_COLORS: Record<string, string> = {
  Command: '#c2453a', Aggression: '#d96f2d', Cunning: '#e2b342',
  Heroism: '#ead7a8', Vigilance: '#4a90c4', Villainy: '#2c2a26',
};

export function CardDetail({
  card,
  onAddToDeck,
  onRemoveFromDeck,
  isInDeck = false,
  isCompatible = true,
  currentStage = 'cards',
}: CardDetailProps) {
  const [showBackSide, setShowBackSide] = useState(false);
  const [selectedArtIndex, setSelectedArtIndex] = useState(0);

  useEffect(() => {
    setSelectedArtIndex(0);
    setShowBackSide(false);
  }, [card?.id]);

  const allArtVariants = useMemo(() => {
    if (!card) return [];
    return [
      { id: card.id, image_uri: card.image_uri, set_name: card.set_name, set_code: card.set_code, card_number: card.card_number, rarity: card.rarity, artist: card.artist },
      ...(card.alternate_arts || []),
    ];
  }, [card]);

  const displayCard = useMemo(() => {
    if (!card || allArtVariants.length === 0) return null;
    const art = allArtVariants[selectedArtIndex];
    return { ...card, image_uri: art.image_uri, set_name: art.set_name, set_code: art.set_code, artist: art.artist, rarity: art.rarity };
  }, [card, allArtVariants, selectedArtIndex]);

  const navigatePrev = () => setSelectedArtIndex(i => i === 0 ? allArtVariants.length - 1 : i - 1);
  const navigateNext = () => setSelectedArtIndex(i => i === allArtVariants.length - 1 ? 0 : i + 1);

  const canFlip = !!(displayCard?.image_back_uri);
  const hasMultipleArts = allArtVariants.length > 1;

  if (!displayCard) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '1px solid var(--ts-line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 24, color: 'var(--ts-ink-4)' }}>?</span>
        </div>
        <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink-3)', marginBottom: 8 }}>No Card Selected</div>
        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-4)', letterSpacing: '0.12em' }}>
          Select a card to view its details
        </div>
      </div>
    );
  }

  const currentImage = showBackSide && displayCard.image_back_uri ? displayCard.image_back_uri : displayCard.image_uri;

  const isDisabled = !isCompatible || (currentStage === 'base' && displayCard.type !== 'Base');
  const buttonLabel = isInDeck
    ? `Remove ${currentStage === 'leaders' ? 'Leader' : currentStage === 'base' ? 'Base' : 'Card'}`
    : !isCompatible ? 'Incompatible with Deck'
    : currentStage === 'base' && displayCard.type !== 'Base' ? 'Not a Base Card'
    : `Add as ${currentStage === 'leaders' ? 'Leader' : currentStage === 'base' ? 'Base' : 'Card'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', height: '100%', overflowY: 'auto' }}>

      {/* Card image */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 220, marginBottom: 16 }}>
        <div
          style={{ position: 'relative', border: '1px solid var(--ts-line-2)', overflow: 'hidden', cursor: onAddToDeck && !isDisabled ? 'pointer' : 'default' }}
          onClick={() => {
            if (!displayCard || !onAddToDeck || !onRemoveFromDeck) return;
            if (isInDeck) onRemoveFromDeck(displayCard.id);
            else if (!isDisabled) onAddToDeck(displayCard);
          }}
        >
          {currentImage ? (
            <img src={currentImage} alt={displayCard.name} style={{ width: '100%', display: 'block', aspectRatio: '7/10', objectFit: 'contain', background: 'var(--ts-bg-3)' }} />
          ) : (
            <div style={{ aspectRatio: '7/10', background: 'var(--ts-bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 16, color: 'var(--ts-ink-3)', textAlign: 'center' }}>{displayCard.name}</span>
            </div>
          )}

          {/* Flip button */}
          {canFlip && (
            <button
              onClick={e => { e.stopPropagation(); setShowBackSide(b => !b); }}
              title={showBackSide ? 'Show front' : 'Show back'}
              style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, background: 'rgba(0,0,0,0.75)', border: '1px solid var(--ts-amber)', color: 'var(--ts-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
            >
              ↺
            </button>
          )}

          {/* Art variant counter */}
          {hasMultipleArts && (
            <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.8)', padding: '2px 7px', fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-2)', letterSpacing: '0.08em' }}>
              {selectedArtIndex + 1} / {allArtVariants.length}
              {allArtVariants[selectedArtIndex].set_code && ` · ${allArtVariants[selectedArtIndex].set_code}`}
            </div>
          )}

          {/* Art nav arrows */}
          {hasMultipleArts && (
            <>
              <button
                onClick={e => { e.stopPropagation(); navigatePrev(); }}
                style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, background: 'rgba(0,0,0,0.75)', border: '1px solid var(--ts-line-2)', color: 'var(--ts-ink-2)', cursor: 'pointer', fontFamily: 'var(--ts-font-mono)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Previous art"
              >‹</button>
              <button
                onClick={e => { e.stopPropagation(); navigateNext(); }}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, background: 'rgba(0,0,0,0.75)', border: '1px solid var(--ts-line-2)', color: 'var(--ts-ink-2)', cursor: 'pointer', fontFamily: 'var(--ts-font-mono)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Next art"
              >›</button>

              {/* Dot indicators */}
              <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                {allArtVariants.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setSelectedArtIndex(i); }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: i === selectedArtIndex ? 'var(--ts-amber)' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', padding: 0 }}
                    title={`Art ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Name + subtitle */}
      <div style={{ textAlign: 'center', marginBottom: 12, width: '100%' }}>
        <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink)', lineHeight: 1.15 }}>{displayCard.name}</div>
        {displayCard.subtitle && (
          <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>{displayCard.subtitle}</div>
        )}
      </div>

      {/* Aspects */}
      {displayCard.aspects && displayCard.aspects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
          {displayCard.aspects.map((a: any) => {
            const color = a.aspect_color || ASPECT_COLORS[a.aspect_name] || 'var(--ts-ink-3)';
            return (
              <div key={a.aspect_name} style={{ padding: '3px 10px', border: `1px solid ${color}`, color, fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', background: `${color}18` }}>
                {a.aspect_name}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {(displayCard.energy_cost != null || displayCard.attack != null || displayCard.health != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14, width: '100%', maxWidth: 220, background: 'var(--ts-bg-3)', border: '1px solid var(--ts-line)', padding: '10px 8px' }}>
          {displayCard.energy_cost != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>Cost</div>
              <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-amber)', lineHeight: 1 }}>{displayCard.energy_cost}</div>
            </div>
          )}
          {displayCard.attack != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>Atk</div>
              <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-red)', lineHeight: 1 }}>{displayCard.attack}</div>
            </div>
          )}
          {displayCard.health != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>HP</div>
              <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-green)', lineHeight: 1 }}>{displayCard.health}</div>
            </div>
          )}
        </div>
      )}

      {/* Card text */}
      {displayCard.text && (
        <div style={{ width: '100%', maxWidth: 220, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Card Text</div>
          <div style={{ fontFamily: 'var(--ts-font-body)', fontSize: 11, color: 'var(--ts-ink-2)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{displayCard.text}</div>
        </div>
      )}

      {/* Keywords */}
      {displayCard.keywords && displayCard.keywords.length > 0 && (
        <div style={{ width: '100%', maxWidth: 220, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Keywords</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {displayCard.keywords.map((kw: any) => (
              <span key={kw} style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ts-ink-3)', border: '1px solid var(--ts-line-2)', padding: '2px 8px' }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current art info */}
      {hasMultipleArts && (
        <div style={{ width: '100%', maxWidth: 220, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Current Art</div>
          <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', lineHeight: 1.8 }}>
            <span style={{ color: 'var(--ts-ink-2)' }}>Set: </span>{displayCard.set_name}<br />
            {displayCard.artist && <><span style={{ color: 'var(--ts-ink-2)' }}>Artist: </span>{displayCard.artist}<br /></>}
            <span style={{ color: 'var(--ts-ink-2)' }}>Rarity: </span>{displayCard.rarity}
          </div>
        </div>
      )}

      {/* Action button */}
      {onAddToDeck && onRemoveFromDeck && (
        <div style={{ width: '100%', maxWidth: 220, marginTop: 8 }}>
          <button
            onClick={() => {
              if (isInDeck) onRemoveFromDeck(displayCard.id);
              else if (!isDisabled) onAddToDeck(displayCard);
            }}
            disabled={isDisabled}
            className="ts-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: 9,
              letterSpacing: '0.2em',
              padding: '11px 16px',
              borderColor: isInDeck ? 'var(--ts-red)' : isDisabled ? 'var(--ts-line-2)' : 'var(--ts-amber)',
              color: isInDeck ? 'var(--ts-red)' : isDisabled ? 'var(--ts-ink-4)' : 'var(--ts-amber)',
              opacity: isDisabled ? 0.5 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {buttonLabel.toUpperCase()}
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(CardDetail);
