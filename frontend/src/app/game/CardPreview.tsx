'use client';
import React, { useState, useEffect } from 'react';
import type { HoverPayload } from './PlayCard';

const PREVIEW_W = 260;
const PREVIEW_H = 400;
const MARGIN    = 18;

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

  const { x, y, card, label } = payload;

  // Position: prefer right of cursor, flip left if it would clip the viewport
  const left = x + MARGIN + PREVIEW_W > window.innerWidth
    ? x - PREVIEW_W - MARGIN
    : x + MARGIN;
  const top = Math.min(
    Math.max(MARGIN, y - PREVIEW_H / 3),
    window.innerHeight - PREVIEW_H - MARGIN,
  );

  const dmg       = card.damage ?? 0;
  const maxHp     = card.maxHp ?? card.hp ?? 0;
  const remaining = Math.max(0, maxHp - dmg);
  const hpColor   = dmg === 0 ? 'var(--saber-green, #4ade80)'
                  : remaining / maxHp > 0.5 ? 'var(--saber-amber)'
                  : 'var(--saber-red)';

  return (
    <div
      className="card-preview"
      style={{
        left,
        top,
        width: PREVIEW_W,
        background: 'var(--bg)',
        border: '1px solid var(--line-2)',
        borderRadius: 4,
        boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Art */}
      <div style={{ position: 'relative', height: 170, flexShrink: 0, background: 'var(--panel-2)', overflow: 'hidden' }}>
        {card.image_uri
          ? <img
              src={card.image_uri}
              alt={card.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
          : (
            <div style={{
              position: 'absolute', inset: 0,
              background: card.aspects.length === 0
                ? 'var(--panel-2)'
                : card.aspects.length === 1
                ? `linear-gradient(155deg, var(--aspect-${card.aspects[0].toLowerCase()}), var(--panel-2))`
                : `linear-gradient(155deg, ${card.aspects.map(a => `var(--aspect-${a.toLowerCase()})`).join(', ')})`,
              opacity: 0.7,
            }} />
          )
        }
        {/* Cost badge */}
        {card.cost !== undefined && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            width: 28, height: 28,
            background: 'var(--bg)', border: '1px solid var(--saber-amber)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
            color: 'var(--saber-amber)',
            clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
          }}>
            {card.cost}
          </div>
        )}
        {/* Aspect pips */}
        <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {card.aspects.map((a, i) => (
            <span key={i} className="ts-aspect-pip" data-aspect={a}
              style={{ width: 16, height: 16, fontSize: 0 }} />
          ))}
        </div>
      </div>

      {/* Info panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px 12px', gap: 6, overflow: 'hidden' }}>
        {/* Name + subtitle */}
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 16, lineHeight: 1.1,
            color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {card.name}
          </div>
          {card.subtitle && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
              color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 2,
            }}>
              {card.subtitle}
            </div>
          )}
        </div>

        {/* Type row */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em',
          color: 'var(--ink-4)', textTransform: 'uppercase',
          borderBottom: '1px solid var(--line)',
          paddingBottom: 6,
        }}>
          {card.type ?? 'Unit'}
        </div>

        {/* Card text */}
        {card.text ? (
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: 1.5,
            color: 'var(--ink-2)',
            flex: 1,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {card.text}
          </div>
        ) : card.keywords && card.keywords.length > 0 ? (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6,
            color: 'var(--ink-3)', fontStyle: 'italic',
            flex: 1,
          }}>
            {card.keywords.join(' · ')}
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Stats footer */}
        {(card.power !== undefined || maxHp > 0) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderTop: '1px solid var(--line)',
            paddingTop: 8, marginTop: 4,
          }}>
            {card.power !== undefined ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
                  color: 'var(--saber-amber)', lineHeight: 1,
                }}>
                  {card.power}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>PWR</span>
              </div>
            ) : <div />}
            {maxHp > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>HP</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
                  color: hpColor, lineHeight: 1,
                }}>
                  {dmg > 0 ? `${remaining}/${maxHp}` : maxHp}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optional label (e.g. "In Hand", "Attacker") */}
      {label && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'var(--ink-4)',
          textAlign: 'center', padding: '4px 0 6px',
          borderTop: '1px solid var(--line)',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
