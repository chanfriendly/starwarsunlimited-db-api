'use client';
import { useMemo } from 'react';
import { buildRegistry, type GameConfig, type PlayerId } from '@/lib/engine-v2';
import { ALL_CARDS, W1_BASES } from '@/lib/engine-v2/__fixtures__';
import { Board } from '../Board';

const DECK = [
  'W2_001', 'W2_002', 'W2_003', 'W2_004', 'W2_005', 'W2_007', 'W2_008', 'W2_010',
  'W1_001', 'W1_002', 'W1_005', 'W1_006', 'W1_007', 'W1_009', 'W1_010',
  'W1_001', 'W1_005', 'W1_006', 'W2_001', 'W2_003', 'W2_007', 'W2_008',
  'W1_002', 'W1_007', 'W1_009', 'W1_010', 'W1_001', 'W1_002', 'W1_007', 'W1_009',
];

export function SmokeClient() {
  const reg = useMemo(() => buildRegistry(ALL_CARDS, W1_BASES), []);
  const config: GameConfig = useMemo(() => ({
    gameId: 'smoke',
    players: [
      { playerId: 'p1', displayName: 'P1', baseId: 'B_001', deckCardIds: DECK, leaderIds: ['W4_001'] },
      { playerId: 'p2', displayName: 'P2', baseId: 'B_002', deckCardIds: DECK, leaderIds: ['W5_003'] },
    ],
  }), []);
  const aiPlayers: Set<PlayerId> = useMemo(() => new Set(['p1', 'p2']), []);
  return (
    <Board
      config={config}
      registry={reg}
      aiPlayers={aiPlayers}
      localPlayer="p1"
      onGameEnd={() => {}}
      onRestart={() => {}}
      onExit={() => {}}
    />
  );
}
