'use client';
// Game board — renders both players' mats, an action picker, and surfaces
// async choice prompts via a modal.

import type { CardRegistry, GameConfig, PlayerId } from '@/lib/engine-v2';
import { useGameV2 } from '@/lib/engine-v2-react';
import { PlayerMat } from './PlayerMat';
import { ActionPicker } from './ActionPicker';
import { ChoicePromptModal } from './ChoicePromptModal';
import { GameLog } from './GameLog';

export interface BoardProps {
  config: GameConfig;
  registry: CardRegistry;
  aiPlayers: Set<PlayerId>;
  localPlayer: PlayerId;
  onGameEnd: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function Board({ config, registry, aiPlayers, localPlayer, onRestart, onExit }: BoardProps) {
  const game = useGameV2({ config, registry, aiPlayers, localPlayer });
  const { state, pending, events, legalActions, isAiThinking, dispatch, resolveChoice } = game;

  // Determine opponent for the top half of the board.
  const opponentId = state.playerOrder.find(p => p !== localPlayer) ?? state.playerOrder[1];

  const headerLabel = state.winner
    ? `GAME OVER — winner: ${state.winner}`
    : `Round ${state.round} · ${state.phase}${state.regroupStep ? ' / ' + state.regroupStep : ''} · active: ${state.activePlayer}`;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontFamily: 'var(--ts-font-mono, monospace)', fontSize: 11, letterSpacing: '0.08em' }}>
          {headerLabel}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {state.winner && (
            <button onClick={onRestart} style={btnStyle('amber')}>PLAY AGAIN</button>
          )}
          <button onClick={onExit} style={btnStyle('neutral')}>EXIT</button>
        </div>
      </div>

      {/* Body: two mats stacked, action picker side panel */}
      <div style={bodyStyle}>
        <div style={matsCol}>
          <PlayerMat
            state={state}
            registry={registry}
            pid={opponentId}
            perspective="opponent"
          />
          <div style={separator} />
          <PlayerMat
            state={state}
            registry={registry}
            pid={localPlayer}
            perspective="self"
          />
        </div>
        <aside style={sideCol}>
          <ActionPicker
            state={state}
            registry={registry}
            actions={legalActions}
            disabled={!game.isMyTurn || isAiThinking || !!pending || !!state.winner}
            isAiThinking={isAiThinking}
            onPick={dispatch}
          />
          <EventTicker events={events} />
          <GameLog state={state} />
        </aside>
      </div>

      {/* Modal */}
      {pending && (
        <ChoicePromptModal
          state={state}
          registry={registry}
          prompt={pending.prompt}
          onResolve={resolveChoice}
        />
      )}
    </div>
  );
}

function EventTicker({ events }: { events: import('@/lib/engine-v2').GameEvent[] }) {
  // Surface only "noteworthy" events; suppress the firehose (RESOURCE_SPENT, etc.).
  const noteworthy = events.filter(e =>
    e.kind === 'DEFEATED' || e.kind === 'TOKEN_CREATED' || e.kind === 'CAPTURED'
    || e.kind === 'LEADER_DEPLOYED' || e.kind === 'LEADER_DEFEATED'
    || e.kind === 'DAMAGE_PREVENTED' || e.kind === 'GAME_ENDED'
    || e.kind === 'UPGRADE_ATTACHED' || e.kind === 'UPGRADE_DETACHED',
  );
  if (noteworthy.length === 0) return null;
  return (
    <div style={tickerStyle}>
      <div style={tickerLabelStyle}>LAST EVENTS</div>
      {noteworthy.map((e, i) => (
        <div key={i} style={tickerLineStyle}>
          {renderEvent(e)}
        </div>
      ))}
    </div>
  );
}

function renderEvent(e: import('@/lib/engine-v2').GameEvent): string {
  switch (e.kind) {
    case 'DEFEATED':          return `💀 ${e.lastKnown.cardId} defeated`;
    case 'TOKEN_CREATED':     return `✨ token ${e.tokenId} created`;
    case 'CAPTURED':          return `🔒 captured ${e.capturedIid}`;
    case 'LEADER_DEPLOYED':   return `👑 ${e.player} deployed leader`;
    case 'LEADER_DEFEATED':   return `↩ leader flipped back`;
    case 'DAMAGE_PREVENTED':  return `🛡 ${e.amount} damage prevented`;
    case 'GAME_ENDED':        return `🏁 game ended — winner: ${e.winner}`;
    case 'UPGRADE_ATTACHED':  return `📎 upgrade attached`;
    case 'UPGRADE_DETACHED':  return `✂ upgrade detached`;
    default:                  return e.kind;
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0e0c08',
  color: '#e8dcc4',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)',
  color: '#f0c040',
};

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  gap: 0,
};

const matsCol: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

const separator: React.CSSProperties = {
  height: 2,
  background: 'rgba(200,160,40,0.3)',
};

const sideCol: React.CSSProperties = {
  width: 360,
  borderLeft: '1px solid rgba(255,255,255,0.1)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  background: 'rgba(0,0,0,0.2)',
  overflow: 'auto',
  maxHeight: 'calc(100vh - 44px)',
};

function btnStyle(variant: 'amber' | 'neutral'): React.CSSProperties {
  const amber = variant === 'amber';
  return {
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--ts-font-mono, monospace)',
    fontSize: 10,
    letterSpacing: '0.08em',
    background: amber ? 'rgba(200,160,40,0.2)' : 'rgba(255,255,255,0.05)',
    color: amber ? '#f0c040' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${amber ? 'rgba(200,160,40,0.4)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 3,
  };
}

const tickerStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.02)',
};

const tickerLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 6,
};

const tickerLineStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(232,220,196,0.8)',
  lineHeight: 1.6,
};
