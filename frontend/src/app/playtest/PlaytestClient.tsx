'use client';
// Top-level client component for the v2 playtest harness. Three modes:
//   setup  — pick AI configuration, click Start.
//   playing — Board is rendered with active engine.
//   ended  — winner banner + Play Again.

import { useMemo, useState } from 'react';
import { buildRegistry, type GameConfig, type PlayerId } from '@/lib/engine-v2';
import { ALL_CARDS, W1_BASES } from '@/lib/engine-v2/__fixtures__';
import { Board } from './Board';

type Mode = 'setup' | 'playing' | 'ended';
type AIMode = 'p2' | 'both' | 'none';

// 30-card decks — mirrors the play_cli fixture set so the browser plays the
// same matchup as the CLI smoke tests.
const DECK_P1 = [
  'W2_001', 'W2_002', 'W2_003', 'W2_004', 'W2_005', 'W2_007', 'W2_008', 'W2_010',
  'W1_001', 'W1_002', 'W1_005', 'W1_006', 'W1_007', 'W1_009', 'W1_010',
  'W3_001', 'W3_002', 'W3_003',
  'W1_001', 'W1_005', 'W1_006',
  'W2_001', 'W2_003', 'W2_007', 'W2_008',
  'W1_002', 'W1_007', 'W1_009', 'W1_010', 'W1_001',
];

const DECK_P2 = [
  'W2_006', 'W2_009', 'W1_003', 'W1_004', 'W1_008', 'W2_005',
  'W1_003', 'W1_004', 'W1_008', 'W1_006', 'W1_009', 'W1_010',
  'W3_001', 'W3_002', 'W3_003',
  'W2_006', 'W2_009', 'W1_003', 'W1_004', 'W1_008',
  'W1_003', 'W1_004', 'W1_008', 'W1_006',
  'W1_009', 'W1_010', 'W2_006', 'W2_009', 'W1_003', 'W1_004',
];

export function PlaytestClient() {
  const [mode, setMode] = useState<Mode>('setup');
  const [aiMode, setAiMode] = useState<AIMode>('p2');
  const [seed, setSeed] = useState(0); // bump to force fresh game

  // Build the registry once — fixtures are static imports so this is cheap.
  const registry = useMemo(
    () => buildRegistry(ALL_CARDS, W1_BASES),
    [],
  );

  const config: GameConfig = useMemo(() => ({
    gameId: `playtest-${seed}`,
    players: [
      { playerId: 'p1', displayName: 'You',     baseId: 'B_001', deckCardIds: DECK_P1, leaderIds: ['W4_001'] },
      { playerId: 'p2', displayName: 'Opponent', baseId: 'B_002', deckCardIds: DECK_P2, leaderIds: ['W5_003'] },
    ],
  }), [seed]);

  const aiPlayers: Set<PlayerId> = useMemo(() => {
    if (aiMode === 'both') return new Set(['p1', 'p2']);
    if (aiMode === 'p2')   return new Set(['p2']);
    return new Set();
  }, [aiMode]);

  // Local player is p1 (the human seat); when aiMode='both' we still treat
  // p1 as "local perspective" for legal-actions display, but the AI auto-
  // dispatch will fire for both seats.
  const localPlayer: PlayerId = 'p1';

  if (mode === 'setup') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={eyebrowStyle}>TWIN SUNS · ENGINE V2 PLAYTEST</div>
          <h1 style={titleStyle}>Browser UAT</h1>
          <p style={bodyStyle}>
            This page runs the v2 engine end-to-end in the browser. Choice
            prompts surface via a modal; AI seats are auto-dispatched.
          </p>
          <p style={bodyStyle}>
            Deck: the same 30-card fixture set used by the CLI smoke tests.
            Cards span W1–W6 mechanics: keywords (Grit/Sentinel/Saboteur/Shielded/Ambush/Raid/Restore/Overwhelm),
            triggered abilities, constant auras, leader deploy, upgrades, divided damage, replacements.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            <label style={labelStyle}>AI MODE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['p2', 'both', 'none'] as AIMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setAiMode(m)}
                  style={pillStyle(aiMode === m)}
                >
                  {m === 'p2' ? 'HUMAN vs AI' : m === 'both' ? 'AI vs AI' : 'HUMAN vs HUMAN'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setSeed(s => s + 1); setMode('playing'); }}
              style={ctaStyle}
            >
              START GAME →
            </button>
            <a href="/" style={{ ...linkStyle, marginTop: 4 }}>← BACK</a>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'playing') {
    return (
      <Board
        config={config}
        registry={registry}
        aiPlayers={aiPlayers}
        localPlayer={localPlayer}
        onGameEnd={() => setMode('ended')}
        onRestart={() => { setSeed(s => s + 1); setMode('playing'); }}
        onExit={() => setMode('setup')}
      />
    );
  }

  // ended — Board handles the in-place end banner so we should never reach
  // here in practice. Kept for completeness.
  return null;
}

// ── Styles (inline, deliberately minimal) ──────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0e0c08',
  color: '#e8dcc4',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 540,
  padding: 32,
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  letterSpacing: '0.15em',
  marginBottom: 6,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-display, serif)',
  fontSize: 28,
  marginBottom: 12,
  marginTop: 0,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.7)',
  lineHeight: 1.5,
  marginBottom: 8,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  color: 'rgba(255,255,255,0.5)',
  letterSpacing: '0.1em',
};

const pillStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 0',
  cursor: 'pointer',
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 11,
  letterSpacing: '0.08em',
  background: active ? 'rgba(200,160,40,0.25)' : 'rgba(255,255,255,0.05)',
  color: active ? '#f0c040' : 'rgba(255,255,255,0.5)',
  border: `1px solid ${active ? 'rgba(200,160,40,0.5)' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: 4,
});

const ctaStyle: React.CSSProperties = {
  padding: '12px 0',
  cursor: 'pointer',
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 12,
  letterSpacing: '0.1em',
  background: 'rgba(200,160,40,0.2)',
  color: '#f0c040',
  border: '1px solid rgba(200,160,40,0.4)',
  borderRadius: 4,
  marginTop: 16,
};

const linkStyle: React.CSSProperties = {
  textAlign: 'center',
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  textDecoration: 'none',
};
