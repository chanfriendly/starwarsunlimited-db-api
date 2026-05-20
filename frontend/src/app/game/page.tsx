'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetch-utils';
import type { SavedDeck } from '@/lib/api';
import type { AIDifficulty } from '@/lib/game-engine/ai';
import { GameBoard } from './GameBoard';
import { useGame } from './useGame';

type Mode = 'setup' | 'playing' | 'ended';

// ── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (deck: SavedDeck, difficulty: AIDifficulty) => void }) {
  const [decks, setDecks]         = useState<SavedDeck[]>([]);
  const [deckId, setDeckId]       = useState('');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const [loading, setLoading]     = useState(true);
  const [starting, setStarting]   = useState(false);
  const [error, setError]         = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchWithAuth('/api/decks')
      .then((data: SavedDeck[]) => {
        setDecks(data);
        if (data.length > 0) setDeckId(data[0].id);
      })
      .catch(() => setError('Failed to load decks. Are you logged in?'))
      .finally(() => setLoading(false));
  }, []);

  const selectedDeck = decks.find(d => d.id === deckId);

  const canStart = !!selectedDeck &&
    selectedDeck.leaders.length >= 2 &&
    selectedDeck.base !== null &&
    selectedDeck.cards.length > 0;

  const handleStart = async () => {
    if (!selectedDeck || starting) return;
    setStarting(true);
    setError('');
    try {
      const fullDeck = await fetchWithAuth(`/api/decks/${selectedDeck.id}`);
      onStart(fullDeck as SavedDeck, difficulty);
    } catch {
      setError('Failed to load deck details. Please try again.');
      setStarting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--ts-bg, #0e0c08)', color: '#e8dcc4',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, padding: 32,
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
      }}>
        <div style={{ fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: 6 }}>
          TWIN SUNS SIMULATOR
        </div>
        <div style={{ fontFamily: 'var(--ts-font-display, serif)', fontSize: 28, marginBottom: 24 }}>
          Start a Game
        </div>

        {loading && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading decks…</div>}
        {error   && <div style={{ color: '#f44336', fontSize: 13 }}>{error}</div>}

        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Deck picker */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--ts-font-mono, monospace)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 6 }}>
                YOUR DECK
              </label>
              {decks.length === 0 ? (
                <div style={{ fontSize: 13, color: '#ff9800' }}>
                  No saved decks found.{' '}
                  <a href="/deck-builder" style={{ color: '#f0c040', textDecoration: 'underline' }}>Build one first →</a>
                </div>
              ) : (
                <select
                  value={deckId}
                  onChange={e => setDeckId(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'rgba(255,255,255,0.06)', color: '#e8dcc4',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
                    fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 12,
                  }}
                >
                  {decks.map(d => (
                    <option key={d.id} value={d.id} style={{ background: '#1a1610' }}>
                      {d.name} · {d.leaders.map(l => l.name).join(' & ')} ({d.cards.reduce((s, c) => s + c.quantity, 0)} cards)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Deck validation */}
            {selectedDeck && !canStart && (
              <div style={{ fontSize: 11, color: '#ff9800', fontFamily: 'var(--ts-font-mono, monospace)' }}>
                {selectedDeck.leaders.length < 2 && '⚠ Deck needs 2 leaders. '}
                {!selectedDeck.base && '⚠ Deck needs a base. '}
                {selectedDeck.cards.length === 0 && '⚠ Deck needs cards. '}
              </div>
            )}

            {/* Difficulty */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--ts-font-mono, monospace)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 6 }}>
                AI DIFFICULTY
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['easy', 'normal'] as AIDifficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={{
                      flex: 1, padding: '8px 0', cursor: 'pointer',
                      fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 11, letterSpacing: '0.08em',
                      background: difficulty === d ? 'rgba(200,160,40,0.25)' : 'rgba(255,255,255,0.05)',
                      color: difficulty === d ? '#f0c040' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${difficulty === d ? 'rgba(200,160,40,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 4,
                    }}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6, fontFamily: 'var(--ts-font-mono, monospace)' }}>
                Mirror match — the AI plays a copy of your deck (shuffled independently).
              </div>
            </div>

            {/* Start */}
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              style={{
                padding: '12px 0', cursor: (canStart && !starting) ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 12, letterSpacing: '0.1em',
                background: (canStart && !starting) ? 'rgba(200,160,40,0.2)' : 'rgba(255,255,255,0.05)',
                color: (canStart && !starting) ? '#f0c040' : 'rgba(255,255,255,0.25)',
                border: `1px solid ${(canStart && !starting) ? 'rgba(200,160,40,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 4,
              }}
            >
              {starting ? 'LOADING…' : 'START GAME →'}
            </button>

            <button onClick={() => router.back()} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer', fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 10,
            }}>
              ← BACK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── End screen ───────────────────────────────────────────────────────────────

function EndScreen({
  result, rounds, onPlayAgain, onBack,
}: { result: 'win' | 'loss' | 'draw'; rounds: number; onPlayAgain: () => void; onBack: () => void }) {
  const colors = { win: '#4caf50', loss: '#f44336', draw: '#ff9800' };
  const labels = { win: 'VICTORY', loss: 'DEFEAT', draw: 'DRAW' };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--ts-bg, #0e0c08)', color: '#e8dcc4',
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--ts-font-display, serif)', fontSize: 56, color: colors[result] }}>
          {labels[result]}
        </div>
        <div style={{ fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          Game ended in {rounds} round{rounds !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onPlayAgain} style={{
            padding: '10px 24px', cursor: 'pointer',
            fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 11, letterSpacing: '0.08em',
            background: 'rgba(200,160,40,0.2)', color: '#f0c040',
            border: '1px solid rgba(200,160,40,0.4)', borderRadius: 4,
          }}>
            PLAY AGAIN
          </button>
          <button onClick={onBack} style={{
            padding: '10px 24px', cursor: 'pointer',
            fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 11, letterSpacing: '0.08em',
            background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4,
          }}>
            MY DECKS
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Game orchestrator ─────────────────────────────────────────────────────────

interface ActiveGameProps {
  deck: SavedDeck;
  difficulty: AIDifficulty;
  playerName: string;
  onGameEnd: (result: 'win' | 'loss' | 'draw', rounds: number) => void;
}

function ActiveGame({ deck, difficulty, playerName, onGameEnd }: ActiveGameProps) {
  const game = useGame({ playerDeck: deck, aiDeck: deck, difficulty, playerName });
  const wrappedOnGameEnd = useCallback(
    (result: 'win' | 'loss' | 'draw') => onGameEnd(result, game.state.round),
    [game.state.round, onGameEnd],
  );
  return <GameBoard {...game} playerName={playerName} onGameEnd={wrappedOnGameEnd} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const [mode, setMode]           = useState<Mode>('setup');
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null);
  const [difficulty, setDifficulty]    = useState<AIDifficulty>('normal');
  const [gameResult, setGameResult]    = useState<{ result: 'win' | 'loss' | 'draw'; rounds: number } | null>(null);
  const [gameKey, setGameKey]          = useState(0);
  const router = useRouter();

  const handleStart = (deck: SavedDeck, diff: AIDifficulty) => {
    setSelectedDeck(deck);
    setDifficulty(diff);
    setMode('playing');
  };

  const handleGameEnd = useCallback((result: 'win' | 'loss' | 'draw', rounds: number) => {
    setGameResult({ result, rounds });
    if (selectedDeck) {
      const leaders = selectedDeck.leaders ?? [];
      fetchWithAuth('/api/me/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opponent_type: 'cpu',
          result,
          deck_id: selectedDeck.id,
          leader1_name: leaders[0]?.name ?? null,
          leader2_name: leaders[1]?.name ?? null,
          turns: rounds,
          difficulty,
          match_type: 'casual',
        }),
      }).catch(() => { /* non-critical — silently swallow */ });
    }
    setTimeout(() => setMode('ended'), 1500);
  }, [selectedDeck, difficulty]);

  const handlePlayAgain = () => {
    setGameKey(k => k + 1);
    setMode('playing');
  };

  if (mode === 'setup') {
    return <SetupScreen onStart={handleStart} />;
  }

  if (mode === 'playing' && selectedDeck) {
    return (
      <ActiveGame
        key={gameKey}
        deck={selectedDeck}
        difficulty={difficulty}
        playerName="You"
        onGameEnd={handleGameEnd}
      />
    );
  }

  if (mode === 'ended' && gameResult) {
    return (
      <EndScreen
        result={gameResult.result}
        rounds={gameResult.rounds}
        onPlayAgain={handlePlayAgain}
        onBack={() => router.push('/decks')}
      />
    );
  }

  return null;
}
