'use client';

import React, { useState } from 'react';
import { ApiCard, addCardToCollection } from '@/lib/api';
import { useRouter } from 'next/navigation';

export interface CardDetailDialogProps {
  card: ApiCard;
  onClose: () => void;
  collectionCount?: number;
  onCollectionChange?: (newCount: number) => void;
  initialOnWishlist?: boolean;
  onWishlistChange?: (cardId: string, isOnWishlist: boolean) => void;
}

const ASPECT_COLORS: Record<string, string> = {
  Command: '#c2453a',
  Aggression: '#d96f2d',
  Cunning: '#e2b342',
  Heroism: '#ead7a8',
  Vigilance: '#4a90c4',
  Villainy: '#4a4038',
};

function AspectPip({ aspect }: { aspect: string }) {
  const initials: Record<string, string> = {
    Command: 'C', Aggression: 'A', Cunning: 'U',
    Heroism: 'H', Vigilance: 'V', Villainy: 'X',
  };
  return (
    <span
      className="ts-aspect-pip"
      data-aspect={aspect}
      title={aspect}
      style={{ width: 20, height: 20, fontSize: 9 }}
    >
      {initials[aspect] ?? aspect[0]}
    </span>
  );
}

export function CardDetailDialog({ card, onClose, collectionCount, onCollectionChange, initialOnWishlist, onWishlistChange }: CardDetailDialogProps) {
  const router = useRouter();
  const [showBackSide, setShowBackSide] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [localCount, setLocalCount] = useState(collectionCount ?? 0);
  const [addMessage, setAddMessage] = useState('');
  const [onWishlist, setOnWishlist] = useState(initialOnWishlist ?? false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const canFlip = !!card?.image_back_uri;
  const currentImage = showBackSide && card.image_back_uri ? card.image_back_uri : card.image_uri;

  const buildDeckWithCard = () => {
    onClose();
    if (card.type === 'Leader') {
      router.push(`/deck-builder?preselect=${card.id}`);
    } else {
      router.push('/deck-builder');
    }
  };

  const handleToggleWishlist = async () => {
    try {
      setWishlistLoading(true);
      if (onWishlist) {
        await fetch(`/api/me/wishlist/${card.id}`, { method: 'DELETE', credentials: 'include' });
        setOnWishlist(false);
        onWishlistChange?.(card.id, false);
      } else {
        await fetch('/api/me/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ card_id: card.id }),
        });
        setOnWishlist(true);
        onWishlistChange?.(card.id, true);
      }
    } catch (err) {
      console.error('Error toggling wishlist:', err);
    } finally {
      setWishlistLoading(false);
    }
  };

  const updateCollection = async (newCount: number) => {
    try {
      setAddingToCollection(true);
      const response = await fetch('/api/me/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, count: newCount }),
        credentials: 'include',
      });

      if (response.status === 401) {
        setAddMessage('Not authenticated — redirecting to login…');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }
      if (!response.ok) throw new Error('Failed to update collection');

      setLocalCount(newCount);
      onCollectionChange?.(newCount);
      setAddMessage(newCount === 0 ? 'Removed from collection' : newCount > localCount ? 'Added!' : '');
      setTimeout(() => setAddMessage(''), 2500);
    } catch {
      setAddMessage('Failed to update collection');
      setTimeout(() => setAddMessage(''), 3000);
    } finally {
      setAddingToCollection(false);
    }
  };

  return (
    <div>
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid var(--ts-line)',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--ts-font-display)',
              fontSize: 28,
              color: 'var(--ts-ink)',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {card.name}
          </h2>
          {card.subtitle && (
            <div
              style={{
                fontFamily: 'var(--ts-font-body)',
                fontSize: 14,
                color: 'var(--ts-ink-3)',
                marginTop: 4,
                fontStyle: 'italic',
              }}
            >
              {card.subtitle}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ts-ink-3)',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            flexShrink: 0,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* Body: image + details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
        }}
      >
        {/* Card image */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              aspectRatio: '7/10',
              width: '100%',
              maxWidth: 300,
              border: '1px solid var(--ts-line)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={`${card.name}${showBackSide ? ' (back)' : ''}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 12,
                }}
              >
                NO ART
              </div>
            )}
          </div>

          {/* Flip button */}
          {canFlip && (
            <button
              onClick={() => setShowBackSide(!showBackSide)}
              className="ts-btn ts-btn-sm"
              style={{ width: '100%', maxWidth: 300, justifyContent: 'center' }}
            >
              ↻ {showBackSide ? 'Show Front' : 'Show Back'}
            </button>
          )}
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Aspects */}
          {card.aspects && card.aspects.length > 0 && (
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 8 }}>Aspects</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {card.aspects.map((a) => (
                  <div key={a.aspect_name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AspectPip aspect={a.aspect_name} />
                    <span style={{ fontSize: 13, color: ASPECT_COLORS[a.aspect_name] ?? 'var(--ts-ink-2)' }}>
                      {a.aspect_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
              gap: 8,
            }}
          >
            <div
              style={{
                background: 'var(--ts-bg-2)',
                border: '1px solid var(--ts-line)',
                padding: '8px 6px',
                textAlign: 'center',
              }}
            >
              <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Type</div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink)' }}>
                {card.type}
              </div>
            </div>

            {card.energy_cost != null && (
              <div
                style={{
                  background: 'var(--ts-bg-2)',
                  border: '1px solid var(--ts-line)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Cost</div>
                <div
                  style={{
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--ts-amber)',
                  }}
                >
                  {card.energy_cost}
                </div>
              </div>
            )}

            {card.attack != null && (
              <div
                style={{
                  background: 'var(--ts-bg-2)',
                  border: '1px solid var(--ts-line)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Attack</div>
                <div
                  style={{
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--ts-red)',
                  }}
                >
                  {card.attack}
                </div>
              </div>
            )}

            {card.health != null && (
              <div
                style={{
                  background: 'var(--ts-bg-2)',
                  border: '1px solid var(--ts-line)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Health</div>
                <div
                  style={{
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--ts-green)',
                  }}
                >
                  {card.health}
                </div>
              </div>
            )}
          </div>

          {/* Card text */}
          {card.text && (
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Card Text</div>
              <div
                style={{
                  background: 'var(--ts-bg-2)',
                  border: '1px solid var(--ts-line)',
                  padding: '10px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--ts-font-body)',
                  color: 'var(--ts-ink-2)',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.55,
                }}
              >
                {card.text}
              </div>
            </div>
          )}

          {/* Keywords */}
          {card.keywords && card.keywords.length > 0 && (
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Keywords</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {card.keywords.map((kw) => (
                  <span key={kw} className="ts-chip">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Set info */}
          {card.set_name && (
            <div className="ts-eyebrow" style={{ color: 'var(--ts-ink-4)' }}>
              {card.set_name}{card.set_code ? ` · ${card.set_code}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid var(--ts-line)',
        }}
      >
        <button onClick={buildDeckWithCard} className="ts-btn ts-btn-primary">
          Build Deck with This Card
        </button>

        {localCount > 0 ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="ts-chip" style={{ borderColor: 'var(--ts-green)', color: 'var(--ts-green)', fontSize: 11 }}>
              ✓ Owned ×{localCount}
            </div>
            <button
              onClick={() => updateCollection(localCount + 1)}
              disabled={addingToCollection}
              className="ts-btn ts-btn-sm"
              title="Add another copy"
            >
              +
            </button>
            <button
              onClick={() => updateCollection(localCount - 1)}
              disabled={addingToCollection}
              className="ts-btn ts-btn-sm"
              style={{ borderColor: 'var(--ts-red)', color: 'var(--ts-red)' }}
              title={localCount === 1 ? 'Remove from collection' : 'Remove one copy'}
            >
              −
            </button>
          </div>
        ) : (
          <button
            onClick={() => updateCollection(1)}
            disabled={addingToCollection}
            className="ts-btn ts-btn-blue"
          >
            {addingToCollection ? 'Adding…' : '+ Add to Collection'}
          </button>
        )}

        <button
          onClick={handleToggleWishlist}
          disabled={wishlistLoading}
          className="ts-btn"
          style={{
            borderColor: onWishlist ? 'var(--ts-amber)' : undefined,
            color: onWishlist ? 'var(--ts-amber)' : undefined,
          }}
        >
          {onWishlist ? '★ On Wishlist' : '☆ Wishlist'}
        </button>

        {addMessage && (
          <span
            style={{
              alignSelf: 'center',
              fontFamily: 'var(--ts-font-mono)',
              fontSize: 11,
              color: addMessage.includes('fail') || addMessage.includes('Removed') ? 'var(--ts-red)' : 'var(--ts-green)',
              letterSpacing: '0.1em',
            }}
          >
            {addMessage}
          </span>
        )}
      </div>
    </div>
  );
}
