'use client';
// Renders the legal-actions list as a clickable button column. Simple but
// exhaustive — no contextual UI (click-to-play / click-to-attack) yet; this
// covers correctness first. Contextual interactions can layer on top later.
//
// Keyboard shortcuts:
//   1-9    — trigger the action with that index (numbered globally across groups)
//   p      — PASS if PASS is in the list

import { useEffect } from 'react';
import type { CardRegistry, GameState, PlayerAction } from '@/lib/engine-v2';
import { describeAction } from '@/lib/engine-v2';

export interface ActionPickerProps {
  state: GameState;
  registry: CardRegistry;
  actions: PlayerAction[];
  disabled: boolean;
  isAiThinking: boolean;
  onPick: (action: PlayerAction) => void;
}

export function ActionPicker({ state, registry, actions, disabled, isAiThinking, onPick }: ActionPickerProps) {
  // Group actions by kind so the wall of buttons is easier to scan. The
  // *display* groups are PLAY / DEPLOY / ABILITY / ATTACK / RESOURCE / OTHER;
  // the keyboard shortcut index is a single flat sequence across them so the
  // numbers shown in brackets are globally unique.
  const ordered: PlayerAction[] = [
    ...actions.filter(a => a.kind === 'PLAY_CARD'),
    ...actions.filter(a => a.kind === 'DEPLOY_LEADER'),
    ...actions.filter(a => a.kind === 'USE_ACTION_ABILITY'),
    ...actions.filter(a => a.kind === 'ATTACK'),
    ...actions.filter(a => a.kind === 'RESOURCE_CARD' || a.kind === 'DECLINE_RESOURCE'),
    ...actions.filter(a => a.kind === 'TAKE_COUNTER' || a.kind === 'PASS'),
  ];
  const indexOf = new Map<PlayerAction, number>();
  ordered.forEach((a, i) => indexOf.set(a, i));

  const groups: { label: string; actions: PlayerAction[] }[] = [
    { label: 'PLAY',     actions: actions.filter(a => a.kind === 'PLAY_CARD') },
    { label: 'DEPLOY',   actions: actions.filter(a => a.kind === 'DEPLOY_LEADER') },
    { label: 'ABILITY',  actions: actions.filter(a => a.kind === 'USE_ACTION_ABILITY') },
    { label: 'ATTACK',   actions: actions.filter(a => a.kind === 'ATTACK') },
    { label: 'RESOURCE', actions: actions.filter(a => a.kind === 'RESOURCE_CARD' || a.kind === 'DECLINE_RESOURCE') },
    { label: 'OTHER',    actions: actions.filter(a => a.kind === 'TAKE_COUNTER' || a.kind === 'PASS') },
  ].filter(g => g.actions.length > 0);

  // Keyboard shortcuts. 1-9 → numbered action; p → PASS.
  useEffect(() => {
    if (disabled || ordered.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't fire shortcuts while typing in inputs (defensive).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < ordered.length) {
          e.preventDefault();
          onPick(ordered[idx]);
        }
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        const pass = ordered.find(a => a.kind === 'PASS');
        if (pass) { e.preventDefault(); onPick(pass); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, ordered, onPick]);

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>
        LEGAL ACTIONS {disabled && !isAiThinking ? '(wait)' : ''}
        {isAiThinking && <span style={{ color: '#f0c040', marginLeft: 6 }}>⏳ AI thinking…</span>}
      </div>
      {actions.length === 0 && !isAiThinking && (
        <div style={emptyStyle}>No legal actions for you right now.</div>
      )}
      {!disabled && ordered.length > 0 && (
        <div style={hintStyle}>↑ Click or press the bracketed number / <kbd style={kbdStyle}>p</kbd> to pass.</div>
      )}
      {groups.map(g => (
        <div key={g.label} style={groupStyle}>
          <div style={groupLabelStyle}>{g.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.actions.map((a, i) => {
              const globalIdx = indexOf.get(a)!;
              const shortcut = globalIdx < 9 ? `${globalIdx + 1}` : '';
              return (
                <button
                  key={i}
                  onClick={() => onPick(a)}
                  disabled={disabled}
                  style={btnStyle(disabled)}
                  title={a.kind + (shortcut ? ` · press ${shortcut}` : '')}
                >
                  {shortcut && <span style={shortcutChip}>{shortcut}</span>}
                  {describeAction(state, registry, a)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.5)',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.35)',
  fontStyle: 'italic',
};

const groupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const groupLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  letterSpacing: '0.08em',
  color: 'rgba(200,160,40,0.5)',
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 11,
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
    color: disabled ? 'rgba(255,255,255,0.3)' : '#e8dcc4',
    border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 3,
    textAlign: 'left',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };
}

const shortcutChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  background: 'rgba(200,160,40,0.2)',
  color: '#f0c040',
  border: '1px solid rgba(200,160,40,0.35)',
  borderRadius: 3,
  flexShrink: 0,
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontStyle: 'italic',
};

const kbdStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  padding: '0 4px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 2,
};
