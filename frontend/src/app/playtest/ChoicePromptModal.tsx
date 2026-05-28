'use client';
// Modal overlay that surfaces a PendingChoice from the engine. Renders all
// three prompt kinds (choose_one, prompt_target, optional) and calls
// onResolve with the player's pick.
//
// Keyboard shortcuts:
//   choose_one  — number keys pick options; Esc declines if canPass.
//   optional    — y/Enter = yes, n/Esc = no.
//   prompt_target — number keys toggle candidates; Enter confirms; Esc declines.

import { useEffect, useState } from 'react';
import type {
  CardRegistry, ChoicePrompt, ChoiceResult, GameState, PlayerId, ResolvedTarget,
} from '@/lib/engine-v2';

export interface ChoicePromptModalProps {
  state: GameState;
  registry: CardRegistry;
  prompt: ChoicePrompt;
  onResolve: (result: ChoiceResult) => void;
}

export function ChoicePromptModal({ state, registry, prompt, onResolve }: ChoicePromptModalProps) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={eyebrowStyle}>{promptKindLabel(prompt.kind)} · {prompt.player}</div>
        <div style={promptTextStyle}>{prompt.prompt}</div>
        {prompt.kind === 'choose_one' && (
          <ChooseOnePicker prompt={prompt} onResolve={onResolve} />
        )}
        {prompt.kind === 'prompt_target' && (
          <PromptTargetPicker prompt={prompt} state={state} registry={registry} onResolve={onResolve} />
        )}
        {prompt.kind === 'optional' && (
          <OptionalPicker onResolve={onResolve} />
        )}
      </div>
    </div>
  );
}

// ── Sub-pickers ────────────────────────────────────────────────────────────

function ChooseOnePicker({
  prompt, onResolve,
}: { prompt: Extract<ChoicePrompt, { kind: 'choose_one' }>; onResolve: (r: ChoiceResult) => void }) {
  // Keyboard: 1-9 picks the n-th option; Esc declines if canPass.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < prompt.options.length) {
          e.preventDefault();
          onResolve({ kind: 'option', value: prompt.options[idx].value });
        }
      } else if (e.key === 'Escape' && prompt.canPass) {
        e.preventDefault();
        onResolve({ kind: 'pass' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onResolve]);

  return (
    <div style={pickerColStyle}>
      {prompt.options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onResolve({ kind: 'option', value: o.value })}
          style={pickerBtnStyle}
        >
          {i < 9 && <span style={modalShortcutChip}>{i + 1}</span>}
          {o.label}
        </button>
      ))}
      {prompt.canPass && (
        <button onClick={() => onResolve({ kind: 'pass' })} style={passBtnStyle}>
          <span style={modalShortcutChip}>esc</span>Pass / decline
        </button>
      )}
    </div>
  );
}

function OptionalPicker({ onResolve }: { onResolve: (r: ChoiceResult) => void }) {
  // Keyboard: y/Enter = yes, n/Esc = no.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        e.preventDefault();
        onResolve({ kind: 'yes' });
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
        e.preventDefault();
        onResolve({ kind: 'no' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResolve]);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => onResolve({ kind: 'yes' })} style={pickerBtnStyle}>
        <span style={modalShortcutChip}>y</span>Yes
      </button>
      <button onClick={() => onResolve({ kind: 'no' })}  style={passBtnStyle}>
        <span style={modalShortcutChip}>n</span>No
      </button>
    </div>
  );
}

function PromptTargetPicker({
  prompt, state, registry, onResolve,
}: {
  prompt: Extract<ChoicePrompt, { kind: 'prompt_target' }>;
  state: GameState;
  registry: CardRegistry;
  onResolve: (r: ChoiceResult) => void;
}) {
  const [picked, setPicked] = useState<ResolvedTarget[]>([]);
  const need = prompt.count;
  const min = prompt.minCount;

  const isPicked = (t: ResolvedTarget) => picked.some(p => sameTarget(p, t));
  const togglePick = (t: ResolvedTarget) => {
    if (isPicked(t)) {
      setPicked(prev => prev.filter(p => !sameTarget(p, t)));
    } else if (picked.length < need) {
      setPicked(prev => [...prev, t]);
    }
  };

  const canSubmit = picked.length >= min && picked.length <= need;

  // Keyboard: 1-9 toggles candidate, Enter confirms, Esc declines if canPass.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < prompt.candidates.length) {
          e.preventDefault();
          togglePick(prompt.candidates[idx]);
        }
      } else if (e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        onResolve({ kind: 'targets', targets: picked });
      } else if (e.key === 'Escape' && prompt.canPass) {
        e.preventDefault();
        onResolve({ kind: 'pass' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // togglePick changes on every render — depending on its identity instead
  // of `picked` would re-bind the listener constantly; we rely on the closure
  // over the latest `picked` via the deps list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, picked, canSubmit, onResolve]);

  return (
    <div style={pickerColStyle}>
      <div style={hintStyle}>
        Pick {min === need ? `${need}` : `${min}–${need}`} target{need === 1 ? '' : 's'}
        {prompt.canPass ? ' (or decline)' : ''}.
        {' '}Picked: {picked.length}/{need}.
        {' '}<kbd style={kbdStyle}>1-9</kbd> toggle · <kbd style={kbdStyle}>Enter</kbd> confirm{prompt.canPass ? <> · <kbd style={kbdStyle}>Esc</kbd> decline</> : null}
      </div>
      <div style={candidateGridStyle}>
        {prompt.candidates.map((t, i) => (
          <button
            key={i}
            onClick={() => togglePick(t)}
            style={candidateBtnStyle(isPicked(t))}
          >
            {i < 9 && <span style={modalShortcutChip}>{i + 1}</span>}
            {renderTarget(state, registry, t)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          disabled={!canSubmit}
          onClick={() => onResolve({ kind: 'targets', targets: picked })}
          style={canSubmit ? pickerBtnStyle : { ...pickerBtnStyle, opacity: 0.4, cursor: 'not-allowed' }}
        >
          <span style={modalShortcutChip}>↵</span>Confirm ({picked.length}/{need})
        </button>
        {prompt.canPass && (
          <button onClick={() => onResolve({ kind: 'pass' })} style={passBtnStyle}>
            <span style={modalShortcutChip}>esc</span>Decline
          </button>
        )}
      </div>
    </div>
  );
}

// ── Rendering helpers ──────────────────────────────────────────────────────

function renderTarget(state: GameState, registry: CardRegistry, t: ResolvedTarget): string {
  if (t.kind === 'base') {
    const p = state.players[t.controller];
    const baseSpec = registry.bases[p.base.cardId];
    return `${t.controller}'s ${baseSpec?.name ?? 'base'}`;
  }
  // Find the unit in either arena.
  for (const z of ['groundArena', 'spaceArena'] as const) {
    const found = state.players[t.controller][z].find(c => c.iid === t.iid);
    if (found) {
      const spec = registry.cards[found.cardId];
      return `${t.controller}'s ${spec?.name ?? t.iid}`;
    }
  }
  // Could also be in capture zone, upgrades, etc. — fall back to iid.
  return `${t.controller}/${t.iid}`;
}

function sameTarget(a: ResolvedTarget, b: ResolvedTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'base' && b.kind === 'base') return a.controller === b.controller;
  if (a.kind === 'unit' && b.kind === 'unit') return a.iid === b.iid;
  return false;
}

function promptKindLabel(kind: ChoicePrompt['kind']): string {
  switch (kind) {
    case 'choose_one':    return 'CHOOSE ONE';
    case 'prompt_target': return 'PICK TARGET';
    case 'optional':      return 'OPTIONAL';
  }
}

// (player IDs are passed in by the prompt; kept as a parameter for clarity but
//  also helpful as a type-narrow reminder for future updates.)
void (undefined as PlayerId | undefined);

// ── Styles ─────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  width: 'min(520px, 90vw)',
  padding: 20,
  background: '#1a1610',
  border: '1px solid rgba(200,160,40,0.5)',
  borderRadius: 6,
  color: '#e8dcc4',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  letterSpacing: '0.12em',
  color: '#f0c040',
};

const promptTextStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.4,
};

const pickerColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const candidateGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 6,
};

const pickerBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  background: 'rgba(200,160,40,0.2)',
  color: '#f0c040',
  border: '1px solid rgba(200,160,40,0.4)',
  borderRadius: 4,
  textAlign: 'left',
};

const passBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  textAlign: 'left',
};

function candidateBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
    background: active ? 'rgba(200,160,40,0.35)' : 'rgba(255,255,255,0.05)',
    color: active ? '#fff' : '#e8dcc4',
    border: `1px solid ${active ? '#f0c040' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 3,
    textAlign: 'left',
  };
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.5)',
  fontFamily: 'var(--ts-font-mono, monospace)',
};

const modalShortcutChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 20,
  padding: '0 4px',
  marginRight: 8,
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 10,
  background: 'rgba(0,0,0,0.3)',
  color: '#f0c040',
  border: '1px solid rgba(200,160,40,0.35)',
  borderRadius: 3,
};

const kbdStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  padding: '0 4px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 2,
};
