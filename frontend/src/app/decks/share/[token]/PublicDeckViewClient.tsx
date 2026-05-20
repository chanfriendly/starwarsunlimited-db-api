'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SavedDeck, fetchSharedDeck } from '@/lib/api';
import { DeckAnalysisPanel } from '@/components/DeckAnalysisPanel';

export function PublicDeckViewClient({ shareToken }: { shareToken: string }) {
  const [deck, setDeck] = useState<SavedDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedDeck(shareToken)
      .then(data => { setDeck(data); setLoading(false); })
      .catch(() => {
        setError('This deck link may be invalid or has been revoked.');
        setLoading(false);
      });
  }, [shareToken]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32,
            border: '2px solid var(--ts-line-2)',
            borderTopColor: 'var(--ts-amber)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div className="ts-eyebrow">Loading deck…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{
            fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.28em',
            textTransform: 'uppercase', color: 'var(--ts-red)', border: '1px solid var(--ts-red)',
            padding: '4px 14px', marginBottom: 20, display: 'inline-block',
          }}>
            Not Found
          </div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 26, color: 'var(--ts-ink)', marginBottom: 12 }}>
            Deck Unavailable
          </div>
          <p style={{ color: 'var(--ts-ink-3)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            {error}
          </p>
          <Link href="/" className="ts-btn" style={{ textDecoration: 'none' }}>← Home</Link>
        </div>
      </div>
    );
  }

  const totalCards = deck.cards.reduce((s, item) => s + (item.quantity || 1), 0);
  const formattedCreated = deck.created_at
    ? new Date(deck.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Unknown';

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: 16,
        marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid var(--ts-line)',
      }}>
        <div>
          <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Shared Deck</div>
          <h1 style={{ fontFamily: 'var(--ts-font-display)', fontSize: 'clamp(24px,3.5vw,40px)', color: 'var(--ts-ink)', margin: 0 }}>
            {deck.name}
          </h1>
        </div>
        <Link href="/" className="ts-btn ts-btn-sm" style={{ textDecoration: 'none' }}>
          Twin Suns ↗
        </Link>
      </div>

      {/* Summary row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 40,
      }}>
        {/* Leaders */}
        <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Leaders</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {deck.leaders?.map(leader => (
              <div key={leader.id} style={{ textAlign: 'center', width: 120 }}>
                <div style={{ width: 120, height: 168, overflow: 'hidden', border: '1px solid var(--ts-line-2)', marginBottom: 6 }}>
                  <img
                    src={leader.image_uri || leader.image_url || ''}
                    alt={leader.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-3)', maxWidth: 120, wordBreak: 'break-word' }}>
                  {leader.name}
                </div>
              </div>
            ))}
            {(!deck.leaders || deck.leaders.length === 0) && (
              <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-4)' }}>None</span>
            )}
          </div>
        </div>

        {/* Base */}
        <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Base</div>
          {deck.base ? (
            <div style={{ textAlign: 'center', width: 120 }}>
              <div style={{ width: 120, height: 168, overflow: 'hidden', border: '1px solid var(--ts-line-2)', marginBottom: 6 }}>
                <img
                  src={deck.base.image_uri || deck.base.image_url || ''}
                  alt={deck.base.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-3)', maxWidth: 120, wordBreak: 'break-word' }}>
                {deck.base.name}
              </div>
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-4)' }}>None</span>
          )}
        </div>

        {/* Stats */}
        <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Deck Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Format', 'Twin Suns'],
              ['Cards', `${totalCards}`],
              ['Created', formattedCreated],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-2)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards section */}
      <div>
        <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-ink)', marginBottom: 16 }}>
          Cards <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 14, color: 'var(--ts-ink-3)' }}>({totalCards})</span>
        </div>

        {deck.cards && deck.cards.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 10,
          }}>
            {deck.cards.map(item => (
              <div key={item.card.id} style={{ position: 'relative' }}>
                <div style={{
                  aspectRatio: '2/3',
                  overflow: 'hidden',
                  border: '1px solid var(--ts-line)',
                  background: 'var(--ts-panel)',
                }}>
                  <img
                    src={item.card.image_uri || item.card.image_url || ''}
                    alt={item.card.name || 'Card'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                {item.quantity > 1 && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(10,8,5,0.8)',
                    fontFamily: 'var(--ts-font-mono)', fontSize: 9,
                    color: 'var(--ts-amber)', padding: '1px 5px',
                    border: '1px solid var(--ts-amber)',
                  }}>×{item.quantity}</div>
                )}
                <div style={{
                  fontFamily: 'var(--ts-font-mono)', fontSize: 8,
                  color: 'var(--ts-ink-3)', marginTop: 4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  letterSpacing: '0.04em',
                }}>
                  {item.card.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            border: '1px solid var(--ts-line)', background: 'var(--ts-panel)',
            padding: '48px 24px', textAlign: 'center',
          }}>
            <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-ink-4)' }}>
              No cards in this deck.
            </span>
          </div>
        )}
      </div>

      {/* Analysis panel */}
      <DeckAnalysisPanel deck={deck} />

      {/* Join CTA */}
      <div style={{
        marginTop: 48,
        border: '1px solid var(--ts-line)',
        background: 'var(--ts-panel)',
        padding: '32px 28px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
      }}>
        <div>
          <div className="ts-eyebrow" style={{ marginBottom: 8 }}>Twin Suns Deck Builder</div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-ink)', marginBottom: 8 }}>
            Build your own deck
          </div>
          <p style={{ fontFamily: 'var(--ts-font-body)', fontSize: 13, color: 'var(--ts-ink-3)', lineHeight: 1.7, margin: 0, maxWidth: 400 }}>
            Browse 2,300+ cards, track your collection, and build Twin Suns format decks — free to use.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/signup" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
            Create Account
          </Link>
          <Link href="/login" className="ts-btn ts-btn-sm" style={{ textDecoration: 'none' }}>
            Log In
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
