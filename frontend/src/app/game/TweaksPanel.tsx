'use client';
import React, { useState, useEffect } from 'react';

type Palette = 'desert' | 'imperial' | 'cantina';
type Vibe    = 'manual' | 'print' | 'holo';

interface Tweaks {
  palette:      Palette;
  vibe:         Vibe;
  exhaustAngle: number;
}

const DEFAULTS: Tweaks = { palette: 'desert', vibe: 'manual', exhaustAngle: 28 };
const STORAGE_KEY = 'twin_suns_play_tweaks';

function load(): Tweaks {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

function apply(t: Tweaks) {
  document.documentElement.dataset.palette = t.palette;
  document.documentElement.dataset.vibe    = t.vibe;
  document.documentElement.style.setProperty('--exhaust-angle', `${t.exhaustAngle}deg`);
}

export function TweaksPanel() {
  const [open,   setOpen]   = useState(false);
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULTS);

  useEffect(() => {
    const t = load();
    setTweaks(t);
    apply(t);
  }, []);

  function set<K extends keyof Tweaks>(key: K, value: Tweaks[K]) {
    setTweaks(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      apply(next);
      return next;
    });
  }

  return (
    <>
      <button onClick={() => setOpen(o => !o)} className="chrome-btn">
        ☰ STYLE
      </button>

      {open && (
        <div style={{
          position: 'fixed', right: 12, bottom: 50, zIndex: 2000,
          background: 'var(--panel-2)', border: '1px solid var(--line-2)',
          padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 210,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            Visual Style
          </div>

          {/* Palette */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Palette
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['desert', 'imperial', 'cantina'] as Palette[]).map(p => (
                <button
                  key={p}
                  onClick={() => set('palette', p)}
                  className={'div-btn' + (tweaks.palette === p ? ' is-active' : '')}
                  style={{ padding: '4px 8px', fontSize: 9 }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Vibe
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['manual', 'print', 'holo'] as Vibe[]).map(v => (
                <button
                  key={v}
                  onClick={() => set('vibe', v)}
                  className={'div-btn' + (tweaks.vibe === v ? ' is-active' : '')}
                  style={{ padding: '4px 8px', fontSize: 9 }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Exhaust angle */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Exhaust angle: {tweaks.exhaustAngle}°
            </div>
            <input
              type="range" min={0} max={45} value={tweaks.exhaustAngle}
              onChange={e => set('exhaustAngle', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button onClick={() => setOpen(false)} className="div-btn" style={{ fontSize: 9 }}>
            CLOSE
          </button>
        </div>
      )}
    </>
  );
}
