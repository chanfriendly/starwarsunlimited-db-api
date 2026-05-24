'use client';
import React, { useState, useEffect } from 'react';
import type { HoverPayload } from './PlayCard';

const PREVIEW_W     = 240;
/** Estimated max height — used only for vertical position clamping. */
const PREVIEW_MAX_H = 340;
const MARGIN        = 18;

export function CardPreview() {
  const [payload, setPayload] = useState<HoverPayload | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      setPayload((e as CustomEvent<HoverPayload | null>).detail);
    }
    window.addEventListener('twin-suns:hover-card', handler);
    return () => window.removeEventListener('twin-suns:hover-card', handler);
  }, []);

  if (!payload) return null;

  const { x, y, card } = payload;

  // Position: prefer right of cursor, flip left if it would clip the viewport
  const left = x + MARGIN + PREVIEW_W > window.innerWidth
    ? x - PREVIEW_W - MARGIN
    : x + MARGIN;
  const top = Math.min(
    Math.max(MARGIN, y - PREVIEW_MAX_H / 3),
    window.innerHeight - PREVIEW_MAX_H - MARGIN,
  );

  return (
    <div
      className="card-preview"
      style={{
        left,
        top,
        width: PREVIEW_W,
        /* No fixed height — image drives its own aspect ratio so landscape
           base cards and portrait unit/leader cards both render undistorted. */
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
        background: 'var(--panel-2)',
        pointerEvents: 'none',
      }}
    >
      {card.image_uri ? (
        <img
          src={card.image_uri}
          alt={card.name}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      ) : (
        /* Fallback when no image is available — explicit height needed for text layout */
        <div style={{
          width: '100%', height: PREVIEW_MAX_H,
          background: card.aspects.length === 0
            ? 'var(--panel-2)'
            : card.aspects.length === 1
            ? `linear-gradient(155deg, var(--aspect-${card.aspects[0].toLowerCase()}), var(--panel-2))`
            : `linear-gradient(155deg, ${card.aspects.map(a => `var(--aspect-${a.toLowerCase()})`).join(', ')})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, padding: 16,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            {card.name}
          </div>
          {card.subtitle && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
              textAlign: 'center', letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              {card.subtitle}
            </div>
          )}
          {(card.power !== undefined || card.hp !== undefined) && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--saber-amber)',
              marginTop: 8,
            }}>
              {card.power ?? 0} / {card.hp ?? 0}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
