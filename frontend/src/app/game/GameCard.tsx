'use client';
import React from 'react';
import type { CardInstance } from '@/lib/game-engine/types';

interface GameCardProps {
  instance: CardInstance;
  selected?: boolean;
  /** Highlight as a valid attack target */
  targeted?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function GameCard({ instance, selected, targeted, faceDown, onClick, size = 'md' }: GameCardProps) {
  const { card, exhausted, damage, shieldTokens } = instance;
  const w = size === 'sm' ? 70 : 88;
  const h = Math.round(w * 1.4);

  const maxHp = card.health ?? 0;
  const remainingHp = Math.max(0, maxHp - damage);
  const hpPct = maxHp > 0 ? remainingHp / maxHp : 1;
  const hpColor = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';

  const borderColor = selected  ? '#f0c040'
                    : targeted  ? '#ff6b6b'
                    : 'transparent';

  return (
    <div
      onClick={onClick}
      title={faceDown ? '?' : `${card.name}${damage > 0 ? ` (${remainingHp}/${maxHp} HP)` : ''}`}
      style={{
        width:      w,
        height:     h,
        position:   'relative',
        flexShrink: 0,
        cursor:     onClick ? 'pointer' : 'default',
        opacity:    exhausted ? 0.72 : 1,
        transform:  exhausted ? 'rotate(6deg)' : 'none',
        transition: 'all 0.18s ease',
        outline:    `2px solid ${borderColor}`,
        outlineOffset: 2,
        borderRadius:  4,
        overflow:   'hidden',
        boxShadow:  selected  ? '0 0 14px rgba(240,192,64,0.55)'
                  : targeted  ? '0 0 14px rgba(255,80,80,0.45)'
                  : '0 4px 10px rgba(0,0,0,0.45)',
      }}
    >
      {faceDown ? (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(145deg, #1c2340, #12192e)',
          border: '1px solid rgba(255,255,255,0.08)',
        }} />
      ) : (
        <>
          {/* Art */}
          <img
            src={card.image_uri || card.image_url || undefined}
            alt={card.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
          />

          {/* Damage badge */}
          {damage > 0 && (
            <div style={{
              position: 'absolute', top: 3, left: 3,
              background: 'rgba(200,40,40,0.92)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '1px 5px', borderRadius: 3, lineHeight: 1.4,
            }}>
              -{damage}
            </div>
          )}

          {/* Shield tokens */}
          {shieldTokens > 0 && (
            <div style={{
              position: 'absolute', top: 3, right: 3,
              background: 'rgba(80,140,230,0.92)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '1px 5px', borderRadius: 3, lineHeight: 1.4,
            }}>
              ◈{shieldTokens}
            </div>
          )}

          {/* HP bar */}
          {maxHp > 0 && (
            <div style={{
              position: 'absolute', bottom: 18, left: 2, right: 2, height: 3,
              background: 'rgba(0,0,0,0.5)',
            }}>
              <div style={{ height: '100%', width: `${hpPct * 100}%`, background: hpColor, transition: 'width 0.3s' }} />
            </div>
          )}

          {/* Name plate */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(10,8,5,0.88)', padding: '2px 4px',
          }}>
            <div style={{
              fontFamily: 'var(--ts-font-mono, monospace)',
              fontSize: 7, color: '#d4c5a9', lineHeight: 1.3,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {card.name}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
