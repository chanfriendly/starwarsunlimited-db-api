'use client';
// Top-level client component for the v2 playtest harness. Three modes:
//   setup  — pick AI configuration, click Start.
//   playing — Board is rendered with active engine.
//   ended  — winner banner + Play Again.

import { useEffect, useMemo, useState } from 'react';
import { buildRegistry, type CardRegistry, type GameConfig, type PlayerId } from '@/lib/engine-v2';
import { ALL_CARDS, W1_BASES } from '@/lib/engine-v2/__fixtures__';
import { buildGameFromDecks } from '@/lib/engine-v2-data';
import { fetchWithAuth } from '@/lib/fetch-utils';
import type { SavedDeck } from '@/lib/api';
import { Board } from './Board';

type Mode = 'setup' | 'playing' | 'ended';
type AIMode = 'p2' | 'both' | 'none';
type DeckSource = 'fixtures' | 'mine';

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
  const [gameKey, setGameKey] = useState(0); // bump to remount Board → fresh game

  const [deckSource, setDeckSource] = useState<DeckSource>('fixtures');
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [myDeckId, setMyDeckId] = useState('');
  const [oppDeckId, setOppDeckId] = useState('');
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [deckError, setDeckError] = useState('');
  const [starting, setStarting] = useState(false);
  // The translated real-deck game (config + registry). Null when using fixtures.
  const [realGame, setRealGame] = useState<{ config: GameConfig; registry: CardRegistry } | null>(null);

  // Fixture registry — built once. Static imports, cheap.
  const fixtureRegistry = useMemo(() => buildRegistry(ALL_CARDS, W1_BASES), []);

  const fixtureConfig: GameConfig = useMemo(() => ({
    gameId: `playtest-${gameKey}`,
    players: [
      { playerId: 'p1', displayName: 'You',     baseId: 'B_001', deckCardIds: DECK_P1, leaderIds: ['W4_001'] },
      { playerId: 'p2', displayName: 'Opponent', baseId: 'B_002', deckCardIds: DECK_P2, leaderIds: ['W5_003'] },
    ],
  }), [gameKey]);

  const aiPlayers: Set<PlayerId> = useMemo(() => {
    if (aiMode === 'both') return new Set(['p1', 'p2']);
    if (aiMode === 'p2')   return new Set(['p2']);
    return new Set();
  }, [aiMode]);

  const localPlayer: PlayerId = 'p1';

  // Fetch the user's saved decks when they switch to the "my decks" source.
  useEffect(() => {
    if (deckSource !== 'mine' || decks.length > 0 || loadingDecks) return;
    setLoadingDecks(true);
    setDeckError('');
    fetchWithAuth('/api/decks')
      .then((data: SavedDeck[]) => {
        setDecks(data);
        const valid = data.filter(d => d.base && d.cards?.length);
        if (valid.length > 0) {
          setMyDeckId(valid[0].id);
          setOppDeckId(valid[0].id); // default opponent = mirror
        } else if (data.length > 0) {
          setMyDeckId(data[0].id);
          setOppDeckId(data[0].id);
        }
      })
      .catch(() => setDeckError('Could not load your decks. Are you logged in? You can still play with fixtures.'))
      .finally(() => setLoadingDecks(false));
  }, [deckSource, decks.length, loadingDecks]);

  const startFixtures = () => {
    setRealGame(null);
    setGameKey(k => k + 1);
    setMode('playing');
  };

  const startRealDecks = async () => {
    if (starting) return;
    setStarting(true);
    setDeckError('');
    try {
      // The list endpoint returns slim decks; fetch full detail for the chosen
      // deck(s) so card stats/keywords are present. Mirror match reuses one fetch.
      const myFull = await fetchWithAuth(`/api/decks/${myDeckId}`) as SavedDeck;
      const oppFull = oppDeckId === myDeckId
        ? myFull
        : await fetchWithAuth(`/api/decks/${oppDeckId}`) as SavedDeck;
      const built = buildGameFromDecks(myFull, oppFull, {
        p1Name: 'You',
        p2Name: 'Opponent',
        gameId: `realdeck-${Date.now()}`,
      });
      if (built.warnings.length > 0) {
        // Non-fatal — surface in console for debugging; game still starts.
        // eslint-disable-next-line no-console
        console.warn('[playtest] deck translation warnings:', built.warnings);
      }
      setRealGame(built);
      setGameKey(k => k + 1);
      setMode('playing');
    } catch (e) {
      setDeckError(e instanceof Error ? e.message : 'Failed to build a game from the selected decks.');
    } finally {
      setStarting(false);
    }
  };

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {/* Deck source */}
            <label style={labelStyle}>DECK SOURCE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeckSource('fixtures')} style={pillStyle(deckSource === 'fixtures')}>
                FIXTURE DECK
              </button>
              <button onClick={() => setDeckSource('mine')} style={pillStyle(deckSource === 'mine')}>
                MY SAVED DECKS
              </button>
            </div>

            {deckSource === 'fixtures' && (
              <p style={noteStyle}>
                30-card fixture set (W1–W6 mechanics). Keywords, leaders, upgrades, and
                triggered/constant abilities all fire.
              </p>
            )}

            {deckSource === 'mine' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={noteStyle}>
                  ⚠ Real cards play with correct <strong>stats and keywords</strong>, but card
                  <em> text</em> abilities are inert until the rules-text → spec pipeline lands.
                  Requires being logged in.
                </p>
                {loadingDecks && <div style={noteStyle}>Loading your decks…</div>}
                {!loadingDecks && decks.length > 0 && (
                  <>
                    <label style={labelStyle}>YOUR DECK</label>
                    <select value={myDeckId} onChange={e => setMyDeckId(e.target.value)} style={selectStyle}>
                      {decks.map(d => (
                        <option key={d.id} value={d.id} style={{ background: '#1a1610' }}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <label style={labelStyle}>OPPONENT DECK</label>
                    <select value={oppDeckId} onChange={e => setOppDeckId(e.target.value)} style={selectStyle}>
                      {decks.map(d => (
                        <option key={d.id} value={d.id} style={{ background: '#1a1610' }}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {!loadingDecks && decks.length === 0 && !deckError && (
                  <div style={noteStyle}>
                    No saved decks found. <a href="/deck-builder" style={inlineLink}>Build one →</a>
                  </div>
                )}
              </div>
            )}

            {deckError && <div style={errorStyle}>{deckError}</div>}

            {/* AI mode */}
            <label style={labelStyle}>AI MODE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['p2', 'both', 'none'] as AIMode[]).map(m => (
                <button key={m} onClick={() => setAiMode(m)} style={pillStyle(aiMode === m)}>
                  {m === 'p2' ? 'HUMAN vs AI' : m === 'both' ? 'AI vs AI' : 'HUMAN vs HUMAN'}
                </button>
              ))}
            </div>

            {deckSource === 'fixtures' ? (
              <button onClick={startFixtures} style={ctaStyle}>START GAME →</button>
            ) : (
              <button
                onClick={startRealDecks}
                disabled={starting || !myDeckId || decks.length === 0}
                style={(starting || !myDeckId || decks.length === 0)
                  ? { ...ctaStyle, opacity: 0.4, cursor: 'not-allowed' }
                  : ctaStyle}
              >
                {starting ? 'BUILDING…' : 'START GAME →'}
              </button>
            )}
            <a href="/" style={{ ...linkStyle, marginTop: 4 }}>← BACK</a>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'playing') {
    const active = (deckSource === 'mine' && realGame)
      ? realGame
      : { config: fixtureConfig, registry: fixtureRegistry };
    return (
      <Board
        key={gameKey}
        config={active.config}
        registry={active.registry}
        aiPlayers={aiPlayers}
        localPlayer={localPlayer}
        onGameEnd={() => setMode('ended')}
        onRestart={() => setGameKey(k => k + 1)}
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

const noteStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
  lineHeight: 1.5,
  margin: 0,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.06)',
  color: '#e8dcc4',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 12,
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#f08080',
  lineHeight: 1.5,
  padding: '8px 10px',
  border: '1px solid rgba(240,128,128,0.3)',
  borderRadius: 4,
  background: 'rgba(240,128,128,0.08)',
};

const inlineLink: React.CSSProperties = {
  color: '#f0c040',
  textDecoration: 'underline',
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
