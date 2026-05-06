// src/app/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';

const ASPECT_COLORS: Record<string, string> = {
  Command: '#c2453a', Aggression: '#d96f2d', Cunning: '#e2b342',
  Heroism: '#ead7a8', Vigilance: '#4a90c4', Villainy: '#2c2a26',
};

const SPOTLIGHT = {
  title: "Sabine's Mandalorian Strike",
  tier: 'S',
  aspects: ['Aggression', 'Cunning'],
  subline: 'RA × CU · AGGRO',
  winRate: '64.2%', winN: 'n=1,418',
  avgCost: '2.1', avgLabel: 'curve',
  pilot: 'Ezra_S.', pilotLabel: "GCS '26",
  units: 32, events: 14, upgrades: 4, total: 50,
};

const TRAINING_TRACKS = [
  { rank: 'K1', label: 'Cadet',       desc: 'Build your first deck and simulate an opening hand.', progress: 100, complete: true },
  { rank: 'K2', label: 'Pilot',       desc: 'Save three decks and run five mulligan sessions.',     progress: 60,  complete: false },
  { rank: 'K3', label: 'Flight Lead', desc: 'Build a deck in each of the six aspects.',             progress: 33,  complete: false },
  { rank: 'K4', label: 'Squadron',    desc: 'Log a tournament result and reach 20 deck saves.',     progress: 0,   complete: false },
];

const ASPECTS_GRID = [
  { name: 'Command',    desc: 'Resources · Stability' },
  { name: 'Aggression', desc: 'Damage · Tempo' },
  { name: 'Cunning',    desc: 'Tricks · Value' },
  { name: 'Heroism',    desc: 'Protection · Bond' },
  { name: 'Vigilance',  desc: 'Control · Defense' },
  { name: 'Villainy',   desc: 'Power · Fear' },
];

const COMING_SOON = [
  { label: 'Collection Tracker', desc: 'Mark cards owned, track completion %' },
  { label: 'Achievements',       desc: 'Pilot training milestones and seasonal tracks' },
  { label: 'Tournament Log',     desc: 'Event results, ELO, head-to-head records' },
  { label: 'Wishlist',           desc: 'Wishlist and trade binder management' },
];

const FEATURES = [
  {
    eyebrow: 'Intelligence', title: 'Card Codex', href: '/cards', cta: 'Open Codex',
    accent: 'var(--ts-amber)',
    body: '2,360+ cards indexed across all sets. Filter by aspect, type, trait, keyword, and arena. Every variant catalogued.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    eyebrow: 'Construction', title: 'Deck Atelier', href: '/deck-builder', cta: 'Enter Atelier',
    accent: 'var(--ts-blue)',
    body: 'Three-stage build flow — leader, base, cards. Resource curve analysis, composition breakdown, and hand simulation.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>,
  },
  {
    eyebrow: 'Training', title: 'Hand Simulator', href: '/deck-builder', cta: 'Run Simulation',
    accent: 'var(--ts-green)',
    body: 'Draw opening hands from any saved deck. Mulligan trainer scores hands against veteran criteria: one-drops, early units, curve.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>,
  },
];

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ts-bg)' }}>

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: 640 }}>

        {/* Amber sun — large, full-bleed behind content */}
        <div style={{
          position: 'absolute', top: -120, right: '12%',
          width: 560, height: 560, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 38%, #ffd98a, #ffb454 48%, #b86c10 80%)',
          opacity: 0.93, zIndex: 1,
        }} />

        {/* Red sun — smaller, upper-right corner */}
        <div style={{
          position: 'absolute', top: -100, right: '-1%',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle at 42% 36%, #ff8f85, #ff3d2e 52%, #8b1409 85%)',
          opacity: 0.88, zIndex: 2,
        }} />

        {/* Scanlines over suns */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(10,8,4,0.2) 2px, rgba(10,8,4,0.2) 3px)',
        }} />

        {/* Left vignette — keeps text readable */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
          background: 'linear-gradient(to right, var(--ts-bg) 38%, rgba(26,22,17,0.75) 58%, rgba(26,22,17,0.1) 75%, transparent)',
        }} />

        {/* Content grid */}
        <div style={{
          position: 'relative', zIndex: 5,
          maxWidth: 1320, margin: '0 auto', padding: '80px 48px 88px',
          display: 'grid', gridTemplateColumns: '1fr 460px', gap: 48,
          alignItems: 'center', minHeight: 640,
        }}>

          {/* Left — copy */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 28, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ts-amber)', fontSize: 10 }}>◇</span>
              FIELD MANUAL · VOL. III · 34 ABY · 05.05
            </div>
            <h1 style={{
              fontFamily: 'var(--ts-font-display)',
              fontSize: 'clamp(56px, 6.5vw, 92px)',
              lineHeight: 1.0, color: 'var(--ts-ink)', fontWeight: 600,
              margin: '0 0 28px', letterSpacing: '-0.01em',
            }}>
              Build like a{' '}
              <em style={{ color: 'var(--ts-amber)', fontStyle: 'italic' }}>Jedi.</em>{' '}
              Win like a smuggler.
            </h1>
            <p style={{
              fontFamily: 'var(--ts-font-body)', fontSize: 17, lineHeight: 1.75,
              color: 'var(--ts-ink-2)', maxWidth: 520, margin: '0 0 44px',
            }}>
              Twin Suns is the deck atelier and field guide for veterans of{' '}
              <strong style={{ color: 'var(--ts-ink)', fontWeight: 500 }}>Star Wars: Unlimited.</strong>{' '}
              Pore over every printing, sweat the curve, drill mulligans, and post your list to the holonet.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/deck-builder" className="ts-btn ts-btn-primary" style={{ fontSize: 12, letterSpacing: '0.22em', padding: '12px 24px' }}>
                OPEN ATELIER →
              </Link>
              <Link href="/cards" className="ts-btn" style={{ fontSize: 12, letterSpacing: '0.22em', padding: '12px 24px' }}>
                BROWSE THE ARCHIVE
              </Link>
            </div>
          </div>

          {/* Right — spotlight card floats over suns */}
          <div style={{ alignSelf: 'flex-end' }}>
            <div style={{
              background: 'rgba(20,16,10,0.92)', border: '1px solid var(--ts-line-2)',
              padding: '22px 24px 20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div className="ts-eyebrow">Deck of the Cycle</div>
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', border: '1px solid var(--ts-red)', color: 'var(--ts-red)', padding: '2px 8px' }}>
                  TIER {SPOTLIGHT.tier}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-ink)', lineHeight: 1.1, marginBottom: 10 }}>
                {SPOTLIGHT.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                {SPOTLIGHT.aspects.map(a => (
                  <span key={a} style={{ width: 20, height: 20, background: ASPECT_COLORS[a] ?? '#555', clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)', display: 'inline-block', flexShrink: 0 }} />
                ))}
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--ts-ink-3)', textTransform: 'uppercase' }}>
                  {SPOTLIGHT.subline}
                </span>
              </div>
              <div className="ts-rule" style={{ margin: '0 0 14px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                {[
                  { label: 'Win Rate', value: SPOTLIGHT.winRate, sub: SPOTLIGHT.winN },
                  { label: 'Avg Cost', value: SPOTLIGHT.avgCost, sub: SPOTLIGHT.avgLabel },
                  { label: 'Pilot',    value: SPOTLIGHT.pilot,   sub: SPOTLIGHT.pilotLabel },
                ].map(s => (
                  <div key={s.label}>
                    <div className="ts-eyebrow" style={{ marginBottom: 2, fontSize: 8 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink)', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', marginTop: 2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="ts-rule" style={{ margin: '0 0 12px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {[
                  { label: 'Units',    n: SPOTLIGHT.units },
                  { label: 'Events',   n: SPOTLIGHT.events },
                  { label: 'Upgrades', n: SPOTLIGHT.upgrades },
                  { label: 'Total',    n: SPOTLIGHT.total },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: row.label === 'Total' ? 'var(--ts-ink-2)' : 'var(--ts-ink-3)', letterSpacing: '0.08em' }}>
                    <span>{row.label}</span>
                    <span>{String(row.n).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
              <button className="ts-btn ts-btn-blue" style={{ width: '100%', justifyContent: 'center', fontSize: 10, letterSpacing: '0.22em' }} disabled>
                OPEN DECK →
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ══ FEATURE PANELS ═══════════════════════════════════════════════ */}
      <section style={{ borderTop: '1px solid var(--ts-line)', borderBottom: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 48px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} style={{ padding: '48px 40px', borderRight: i < FEATURES.length - 1 ? '1px solid var(--ts-line)' : undefined }}>
              <div style={{ width: 44, height: 44, border: `1px solid ${f.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.accent, marginBottom: 22 }}>
                {f.icon}
              </div>
              <div className="ts-eyebrow" style={{ marginBottom: 8 }}>{f.eyebrow}</div>
              <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)', marginBottom: 12, lineHeight: 1.1 }}>{f.title}</div>
              <p style={{ color: 'var(--ts-ink-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 28, fontFamily: 'var(--ts-font-body)' }}>{f.body}</p>
              <Link href={f.href} style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: f.accent, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {f.cta} <span style={{ fontSize: 14 }}>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PILOT TRAINING ═══════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '80px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 72, alignItems: 'start' }}>
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 16 }}>Pilot Training</div>
            <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 38, color: 'var(--ts-ink)', lineHeight: 1.05, marginBottom: 20 }}>
              Earn your wings, Commander.
            </div>
            <p style={{ color: 'var(--ts-ink-2)', fontSize: 14, lineHeight: 1.75, fontFamily: 'var(--ts-font-body)', marginBottom: 28 }}>
              Advance through ranks by building decks, drilling mulligans, and logging tournament results. Each rank unlocks profile badges and new field intel.
            </p>
            <Link href="/profile" className="ts-btn" style={{ fontSize: 10, letterSpacing: '0.2em' }}>
              View Pilot Profile →
            </Link>
            <div style={{ marginTop: 24, padding: '12px 16px', background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              ◈ Sign in to track your progress
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--ts-line)' }}>
            {TRAINING_TRACKS.map((track, i) => (
              <div key={track.rank} style={{ background: track.complete ? 'var(--ts-bg-2)' : 'var(--ts-bg)', padding: '20px 24px', display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 20, alignItems: 'center', opacity: i > 1 ? 0.55 : 1 }}>
                <div style={{ width: 44, height: 44, border: `1px solid ${track.complete ? 'var(--ts-amber)' : 'var(--ts-line-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.1em', color: track.complete ? 'var(--ts-amber)' : 'var(--ts-ink-3)' }}>
                  {track.rank}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 18, color: 'var(--ts-ink)' }}>{track.label}</span>
                    {track.complete && (
                      <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--ts-amber)', border: '1px solid var(--ts-amber)', padding: '1px 5px' }}>COMPLETE</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-3)', letterSpacing: '0.08em', marginBottom: 8 }}>{track.desc}</div>
                  <div style={{ height: 2, background: 'var(--ts-line)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${track.progress}%`, background: track.complete ? 'var(--ts-amber)' : 'var(--ts-blue)' }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: track.complete ? 'var(--ts-amber)' : 'var(--ts-ink-3)', minWidth: 48, textAlign: 'right' }}>
                  {track.progress}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ASPECTS ══════════════════════════════════════════════════════ */}
      <section style={{ borderTop: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)', padding: '72px 48px' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 16 }}>Aspects</div>
            <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 36, color: 'var(--ts-ink)', lineHeight: 1.1, marginBottom: 20 }}>
              Six aspects.<br />Infinite strategies.
            </div>
            <p style={{ color: 'var(--ts-ink-2)', fontSize: 14, lineHeight: 1.75, fontFamily: 'var(--ts-font-body)' }}>
              Every deck is defined by the aspects of its leader and base. Twin Suns rewards deep aspect knowledge — filter and build by aspect to find the synergies that win games.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--ts-line)' }}>
            {ASPECTS_GRID.map(a => (
              <div key={a.name} style={{ background: 'var(--ts-bg-2)', padding: '28px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span style={{ width: 18, height: 18, background: ASPECT_COLORS[a.name] ?? '#555', clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)', flexShrink: 0, marginTop: 3, display: 'inline-block' }} />
                <div>
                  <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 18, color: 'var(--ts-ink)', marginBottom: 4 }}>{a.name}</div>
                  <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMING SOON ══════════════════════════════════════════════════ */}
      <section style={{ borderTop: '1px solid var(--ts-line)', padding: '64px 48px' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 40 }}>
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 10 }}>On the Horizon</div>
              <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 32, color: 'var(--ts-ink)' }}>Incoming transmissions</div>
            </div>
            <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-4)', textTransform: 'uppercase' }}>In development</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--ts-line)' }}>
            {COMING_SOON.map(item => (
              <div key={item.label} style={{ background: 'var(--ts-bg)', padding: '28px 24px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 14, fontFamily: 'var(--ts-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--ts-ink-4)', border: '1px solid var(--ts-line-2)', padding: '2px 6px' }}>SOON</div>
                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink-2)', marginBottom: 8 }}>{item.label}</div>
                <p style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-4)', letterSpacing: '0.08em', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER CTA ═══════════════════════════════════════════════════ */}
      <section style={{ borderTop: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)', padding: '80px 48px', textAlign: 'center' }}>
        <div className="ts-eyebrow" style={{ marginBottom: 20 }}>Begin your briefing</div>
        <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 'clamp(32px, 4vw, 52px)', color: 'var(--ts-ink)', marginBottom: 36, lineHeight: 1.1 }}>
          Ready to build your roster?
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/deck-builder" className="ts-btn ts-btn-primary" style={{ fontSize: 12, letterSpacing: '0.22em', padding: '12px 24px' }}>
            OPEN DECK ATELIER →
          </Link>
          <Link href="/signup" className="ts-btn" style={{ fontSize: 12, letterSpacing: '0.22em', padding: '12px 24px' }}>
            CREATE ACCOUNT
          </Link>
        </div>
        <p style={{ marginTop: 32, fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Free · No ads · Star Wars Unlimited · Twin Suns Format
        </p>
      </section>

    </div>
  );
}
