'use client';
import React from 'react';
import type { CardInstance, LeaderInstance, BaseInstance } from '@/lib/game-engine/types';

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface PlayCardData {
  iid?: string;
  name: string;
  subtitle?: string;
  type?: string;
  cost?: number;
  aspects: string[];      // Title Case: "Command", "Cunning", etc.
  power?: number;
  hp?: number;
  maxHp?: number;
  damage: number;
  exhausted: boolean;
  upgrades: { name: string }[];
  fresh?: boolean;
  image_uri?: string;
  /** Raw ability text for hover preview */
  text?: string;
  /** Keyword list for hover preview */
  keywords?: string[];
}

export interface BaseData {
  name: string;
  hp: number;
  maxHp: number;
  color?: string;
  image_uri?: string;
  text?: string;
}

export interface LeaderData {
  name: string;
  aspects: string[];
  power?: number;
  hp?: number;
  deployed: boolean;
  /** True when the leader ability was used this round */
  exhausted?: boolean;
  image_uri?: string;
  text?: string;
}

// ── Adapters from engine types ────────────────────────────────────────────────

export function toPlayCardProps(ci: CardInstance): PlayCardData {
  return {
    iid: ci.iid,
    name: ci.card.name,
    subtitle: ci.card.subtitle,
    type: ci.card.type,
    cost: ci.card.energy_cost ?? ci.card.cost,
    aspects: (ci.card.aspects ?? []).map(a => a.aspect_name),
    power: ci.card.attack,
    hp: ci.card.health,
    maxHp: ci.card.health,
    damage: ci.damage,
    exhausted: ci.exhausted,
    upgrades: (ci.upgrades ?? []).map(u => ({ name: u.card.name })),
    fresh: ci.deployedThisTurn,
    image_uri: ci.card.image_uri ?? ci.card.image_url,
    text: ci.card.text,
    keywords: ci.card.keywords,
  };
}

export function toBaseData(base: BaseInstance): BaseData {
  const maxHp = base.card.health ?? 30;
  return {
    name: base.card.name,
    hp: Math.max(0, maxHp - base.damage),
    maxHp,
    color: 'var(--saber-amber)',
    image_uri: base.card.image_uri ?? base.card.image_url,
    text: base.card.text,
  };
}

export function toLeaderData(li: LeaderInstance): LeaderData {
  return {
    name: li.card.name,
    aspects: (li.card.aspects ?? []).map(a => a.aspect_name),
    power: li.card.attack,
    hp: li.card.health,
    deployed: li.isDeployed,
    exhausted: li.exhausted ?? false,
    image_uri: li.card.image_uri ?? li.card.image_url,
    text: li.card.text,
  };
}

// ── Hover preview event bus ───────────────────────────────────────────────────

export interface HoverPayload {
  card: PlayCardData;
  label?: string;
  x: number;
  y: number;
}

export function emitHoverCard(payload: HoverPayload | null): void {
  window.dispatchEvent(new CustomEvent('twin-suns:hover-card', { detail: payload }));
}

function hoverHandlers(card: PlayCardData) {
  return {
    onMouseEnter: (e: React.MouseEvent) => emitHoverCard({ card, x: e.clientX, y: e.clientY }),
    onMouseMove:  (e: React.MouseEvent) => emitHoverCard({ card, x: e.clientX, y: e.clientY }),
    onMouseLeave: ()                     => emitHoverCard(null),
  };
}

// ── Card art fill (gradient fallback when no image) ───────────────────────────

function CardArtFill({ aspects }: { aspects: string[] }) {
  const lower = aspects.map(a => a.toLowerCase());
  const stops = lower.length === 0
    ? ['var(--panel-2)', 'var(--panel)']
    : lower.length === 1
    ? [`var(--aspect-${lower[0]})`, 'var(--panel-2)']
    : lower.map(a => `var(--aspect-${a})`);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(155deg, ${stops.join(', ')})`,
      opacity: 0.65,
    }} />
  );
}

// ── PlayCard ──────────────────────────────────────────────────────────────────

interface PlayCardProps {
  card: PlayCardData;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  target?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  hoverable?: boolean;
}

const DIMS = {
  sm: { w: 64,  h: 90  },
  md: { w: 86,  h: 120 },
  lg: { w: 110, h: 154 },
};

export function PlayCard({
  card,
  size = 'md',
  selected = false,
  target = false,
  clickable = false,
  onClick,
  hoverable = true,
}: PlayCardProps) {
  const dims = DIMS[size];

  const cls = [
    'pcard',
    card.exhausted ? 'is-exhausted' : '',
    selected       ? 'is-selected'  : '',
    target         ? 'is-target'    : '',
    card.fresh     ? 'is-fresh'     : '',
  ].filter(Boolean).join(' ');

  const dmg     = card.damage ?? 0;
  const maxHp   = card.maxHp ?? card.hp ?? 0;
  const remaining = Math.max(0, maxHp - dmg);
  const hpPct   = maxHp > 0 ? remaining / maxHp : 1;
  const dmgLevel = hpPct > 0.66 ? 'hi' : hpPct > 0.33 ? 'mid' : 'low';

  const hover = hoverable ? hoverHandlers(card) : {};

  return (
    <div
      className={cls}
      style={{ width: dims.w, height: dims.h }}
      data-clickable={clickable ? 1 : 0}
      onClick={clickable ? onClick : undefined}
      {...hover}
    >
      {/* Art */}
      <div className="pcard-art">
        {card.image_uri
          ? <img src={card.image_uri} alt={card.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <CardArtFill aspects={card.aspects} />}
      </div>

      {/* Cost */}
      {card.cost !== undefined && <div className="pcard-cost">{card.cost}</div>}

      {/* Aspect pips */}
      <div className="pcard-aspects">
        {card.aspects.map((a, i) => (
          <span key={i} className="ts-aspect-pip" data-aspect={a} />
        ))}
      </div>

      {/* Upgrade tabs */}
      {card.upgrades.length > 0 && (
        <div className="pcard-upgrades">
          {card.upgrades.slice(0, 3).map((u, i) => (
            <div key={i} className="pcard-upgrade" title={u.name} />
          ))}
        </div>
      )}

      {/* Damage bar */}
      {maxHp > 0 && dmg > 0 && (
        <div className="pcard-dmg">
          <div className="pcard-dmg-fill" data-dmg={dmgLevel} style={{ width: `${hpPct * 100}%` }} />
          <span className="pcard-dmg-num">-{dmg}</span>
        </div>
      )}

      {/* Name */}
      <div className="pcard-name">{card.name}</div>

      {/* Stats footer */}
      <div className="pcard-stats">
        <div className="pcard-type">{(card.type ?? 'Unit').toUpperCase()}</div>
        <div className="pcard-pwhp">
          {card.power !== undefined && <span className="pcard-power">{card.power}</span>}
          {maxHp > 0 && (
            <span className="pcard-hp">
              {dmg > 0 ? `${remaining}/${maxHp}` : maxHp}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CardBack ──────────────────────────────────────────────────────────────────

const BACK_DIMS = {
  xs: { w: 48,  h: 68  },
  sm: { w: 64,  h: 90  },
  md: { w: 86,  h: 120 },
  lg: { w: 110, h: 154 },
};

export function CardBack({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const d = BACK_DIMS[size];
  const showText = size !== 'xs';
  const W = d.w;
  const H = d.h;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <div className="cback" style={{ width: W, height: H }}>
      <div className="cback-stars" />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="sglow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="sbeam1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="40%" stopColor="rgba(180,210,255,0.85)" />
            <stop offset="60%" stopColor="rgba(180,210,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="sbeam2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="40%" stopColor="rgba(200,220,255,0.8)" />
            <stop offset="60%" stopColor="rgba(200,220,255,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* Crossed saber beams */}
        <line x1={W * 0.12} y1={H * 0.08} x2={W * 0.88} y2={H * 0.92}
          stroke="url(#sbeam1)" strokeWidth="2.5" filter="url(#sglow)" />
        <line x1={W * 0.88} y1={H * 0.08} x2={W * 0.12} y2={H * 0.92}
          stroke="url(#sbeam2)" strokeWidth="2.5" filter="url(#sglow)" />
        {/* Intersection glow */}
        <circle cx={cx} cy={cy} r={W * 0.08}
          fill="rgba(180,210,255,0.18)" filter="url(#sglow)" />
        {/* Outer frame */}
        <rect x={W * 0.06} y={H * 0.05} width={W * 0.88} height={H * 0.9}
          fill="none" stroke="rgba(180,200,255,0.22)" strokeWidth="0.8" rx="1" />
        <rect x={W * 0.09} y={H * 0.07} width={W * 0.82} height={H * 0.86}
          fill="none" stroke="rgba(180,200,255,0.12)" strokeWidth="0.5" rx="1" />
        {/* "STAR WARS UNLIMITED" text */}
        {showText && (
          <>
            <text
              x={cx} y={cy - H * 0.08}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="var(--font-display), sans-serif"
              fontSize={W * 0.11} fontWeight="700"
              fill="rgba(230,240,255,0.82)" letterSpacing="0.06em"
            >
              STAR WARS
            </text>
            <text
              x={cx} y={cy + H * 0.08}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="var(--font-mono), monospace"
              fontSize={W * 0.08} fontWeight="400"
              fill="rgba(180,210,255,0.65)" letterSpacing="0.18em"
            >
              UNLIMITED
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ── BaseCard — native landscape layout ────────────────────────────────────────

interface BaseCardProps {
  base: BaseData;
  isTarget?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

// Landscape: width > height
const BASE_DIMS = {
  sm: { w: 122, h: 76  },
  md: { w: 140, h: 86  },
  lg: { w: 164, h: 100 },
};

export function BaseCard({ base, isTarget = false, onClick, size = 'md', hoverable = true }: BaseCardProps) {
  const dims = BASE_DIMS[size];
  const hpPct    = base.maxHp > 0 ? base.hp / base.maxHp : 0;
  const dmgColor = hpPct > 0.66 ? 'var(--saber-green)' : hpPct > 0.33 ? 'var(--saber-amber)' : 'var(--saber-red)';

  const hoverData: PlayCardData = {
    name: base.name, type: 'Base', aspects: [], hp: base.hp, maxHp: base.maxHp,
    damage: base.maxHp - base.hp, exhausted: false, upgrades: [],
    image_uri: base.image_uri, text: base.text,
  };
  const hover = hoverable ? hoverHandlers(hoverData) : {};

  return (
    <div
      style={{
        width: dims.w, height: dims.h,
        position: 'relative',
        overflow: 'hidden',
        border: `1.5px solid ${isTarget ? 'var(--saber-red)' : 'rgba(255,180,84,0.45)'}`,
        borderRadius: 3,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        background: 'var(--panel-2)',
        boxShadow: isTarget ? '0 0 16px var(--saber-red-glow)' : undefined,
        animation: isTarget ? 'target-pulse 1.5s ease-in-out infinite' : undefined,
      }}
      onClick={onClick}
      {...hover}
    >
      {/* Full-bleed art */}
      {base.image_uri
        ? <img src={base.image_uri} alt={base.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        : (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${base.color ?? 'var(--saber-amber)'}, var(--panel))`,
              opacity: 0.4,
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--ink-2)',
              textAlign: 'center', padding: '0 8px',
            }}>
              {base.name}
            </div>
          </>
        )
      }
      {/* HP overlay bar at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '3px 6px',
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          flex: 1, height: 3,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{ height: '100%', width: `${hpPct * 100}%`, background: dmgColor, transition: 'width 0.4s' }} />
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: dmgColor, lineHeight: 1, whiteSpace: 'nowrap',
        }}>
          {base.hp}/{base.maxHp}
        </span>
      </div>
    </div>
  );
}

// ── LeaderCard — native landscape layout ──────────────────────────────────────

interface LeaderCardProps {
  leader: LeaderData;
  size?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

// Landscape: width > height (real SWU leaders are horizontal cards)
const LEADER_DIMS = {
  sm: { w: 120, h: 70  },
  md: { w: 140, h: 82  },
  lg: { w: 162, h: 96  },
};

export function LeaderCard({ leader, size = 'md', hoverable = true }: LeaderCardProps) {
  const dims = LEADER_DIMS[size];

  const hoverData: PlayCardData = {
    name: leader.name, type: 'Leader', aspects: leader.aspects,
    power: leader.power, hp: leader.hp, maxHp: leader.hp,
    damage: 0, exhausted: false, upgrades: [],
    image_uri: leader.image_uri, text: leader.text,
  };
  const hover = hoverable ? hoverHandlers(hoverData) : {};

  return (
    <div
      style={{
        width: dims.w, height: dims.h,
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${leader.exhausted && !leader.deployed ? 'rgba(255,180,84,0.3)' : 'var(--saber-amber)'}`,
        borderRadius: 3,
        flexShrink: 0,
        background: 'var(--panel-2)',
        opacity: leader.deployed ? 0.45 : leader.exhausted ? 0.6 : 1,
        transition: 'opacity 0.3s, border-color 0.3s',
      }}
      {...hover}
    >
      {/* Full-bleed art */}
      {leader.image_uri
        ? <img src={leader.image_uri} alt={leader.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        : (
          <>
            <CardArtFill aspects={leader.aspects} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--ink-2)',
              textAlign: 'center', padding: '0 6px',
            }}>
              {leader.name}
            </div>
          </>
        )
      }
      {/* Deployed overlay */}
      {leader.deployed && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.22em',
          color: 'var(--saber-amber)', textTransform: 'uppercase',
        }}>
          Deployed
        </div>
      )}
      {/* Exhausted overlay (ability used) */}
      {!leader.deployed && leader.exhausted && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '2px 4px',
          background: 'rgba(0,0,0,0.7)',
          fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em',
          color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'center',
        }}>
          exhausted
        </div>
      )}
    </div>
  );
}

// ── InitToken ─────────────────────────────────────────────────────────────────

export function InitToken({ hasInit, round }: { hasInit: boolean; round: number }) {
  return (
    <div className={'init-token' + (hasInit ? ' is-active' : '')} title={hasInit ? 'Holds initiative' : ''}>
      <div className="init-token-inner">
        {hasInit ? (
          <>
            <div style={{ fontSize: 7, color: 'var(--ink-3)', letterSpacing: '0.2em' }}>INIT</div>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--saber-amber)', lineHeight: 1, marginTop: 2 }}>◆</div>
            <div style={{ fontSize: 7, color: 'var(--ink-3)', letterSpacing: '0.2em', marginTop: 2 }}>R{round}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 7, letterSpacing: '0.2em' }}>INIT</div>
            <div style={{ fontSize: 16, color: 'var(--ink-4)', lineHeight: 1, marginTop: 2 }}>◇</div>
          </>
        )}
      </div>
    </div>
  );
}
