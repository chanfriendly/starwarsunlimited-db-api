'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SavedDeck, fetchUserDecks, deleteUserDeck } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const ASPECT_COLORS: Record<string, string> = {
  Command: '#c2453a', Aggression: '#d96f2d', Cunning: '#e2b342',
  Heroism: '#ead7a8', Vigilance: '#4a90c4', Villainy: '#2c2a26',
};

type SortMode = 'name_asc' | 'name_desc' | 'date_newest' | 'date_oldest';

function sortDecks(decks: SavedDeck[], mode: SortMode): SavedDeck[] {
  return [...decks].sort((a, b) => {
    switch (mode) {
      case 'name_asc':  return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'date_newest': return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      case 'date_oldest': return new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
    }
  });
}

function DeckCard({
  deck,
  onDelete,
}: {
  deck: SavedDeck;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const aspects = new Set<string>();
  deck.leaders?.forEach(l => l?.aspects?.forEach(a => { if (a?.aspect_name) aspects.add(a.aspect_name); }));
  deck.base?.aspects?.forEach(a => { if (a?.aspect_name) aspects.add(a.aspect_name); });

  const totalCards = deck.cards?.reduce((s, item) => s + item.quantity, 0) ?? 0;
  const formattedDate = deck.updated_at
    ? new Date(deck.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown';

  return (
    <div style={{
      background: 'var(--ts-panel)',
      border: '1px solid var(--ts-line)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      transition: 'border-color 0.15s',
    }}>
      {/* Leader images strip */}
      {deck.leaders && deck.leaders.length > 0 && (
        <div style={{ display: 'flex', height: 72, overflow: 'hidden', borderBottom: '1px solid var(--ts-line)' }}>
          {deck.leaders.map((leader, i) => (
            <div key={leader.id} style={{ flex: 1, overflow: 'hidden', borderRight: i < deck.leaders.length - 1 ? '1px solid var(--ts-line)' : 'none' }}>
              <img
                src={leader.image_uri || leader.image_url || ''}
                alt={leader.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Name + card count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{
            fontFamily: 'var(--ts-font-display)',
            fontSize: 18,
            color: 'var(--ts-ink)',
            lineHeight: 1.2,
            flex: 1,
          }}>
            {deck.name}
          </div>
          <div className="ts-chip" style={{ flexShrink: 0, fontSize: 10 }}>{totalCards} cards</div>
        </div>

        {/* Aspect pips */}
        {aspects.size > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {Array.from(aspects).map(aspect => (
              <span
                key={aspect}
                className="ts-aspect-pip"
                data-aspect={aspect}
                title={aspect}
                style={{ width: 18, height: 18, fontSize: 9 }}
              >
                {aspect[0]}
              </span>
            ))}
          </div>
        )}

        {/* Leader names */}
        {deck.leaders && deck.leaders.length > 0 && (
          <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.06em' }}>
            {deck.leaders.map(l => l.name).join(' · ')}
            {deck.base ? ` · ${deck.base.name}` : ''}
          </div>
        )}

        {/* Date */}
        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 'auto' }}>
          Updated {formattedDate}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Link
            href={`/decks/${deck.id}`}
            className="ts-btn ts-btn-sm"
            style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', textAlign: 'center' }}
          >
            View →
          </Link>
          <Link
            href={`/deck-builder?deckId=${deck.id}`}
            className="ts-btn ts-btn-sm"
            style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', textAlign: 'center' }}
          >
            Edit
          </Link>
          {confirmDelete ? (
            <button
              className="ts-btn ts-btn-sm"
              style={{ borderColor: 'var(--ts-red)', color: 'var(--ts-red)', flexShrink: 0 }}
              onClick={() => onDelete(deck.id)}
            >
              Confirm
            </button>
          ) : (
            <button
              className="ts-btn ts-btn-sm"
              style={{ flexShrink: 0, opacity: 0.7 }}
              onClick={() => setConfirmDelete(true)}
              title="Delete deck"
            >
              ✕
            </button>
          )}
        </div>

        {confirmDelete && (
          <button
            style={{
              background: 'none', border: 'none', fontFamily: 'var(--ts-font-mono)',
              fontSize: 10, color: 'var(--ts-ink-3)', cursor: 'pointer', textAlign: 'left',
              padding: 0, letterSpacing: '0.06em',
            }}
            onClick={() => setConfirmDelete(false)}
          >
            ← cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function DecksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date_newest');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { setLoading(false); return; }

    fetchUserDecks()
      .then(data => { setDecks(data); setLoading(false); })
      .catch(() => { setError('Failed to load decks.'); setLoading(false); });
  }, [isAuthenticated, authLoading]);

  const handleDelete = useCallback(async (deckId: string) => {
    try {
      await deleteUserDeck(deckId);
      setDecks(prev => prev.filter(d => d.id !== deckId));
    } catch {
      setError('Failed to delete deck. Please try again.');
    }
  }, []);

  const sorted = sortDecks(decks, sortMode);

  // ── Auth gate ──
  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Access Required</div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)', marginBottom: 16 }}>
            My Decks
          </div>
          <p style={{ color: 'var(--ts-ink-3)', fontFamily: 'var(--ts-font-body)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
            Log in to view and manage your saved decks.
          </p>
          <Link href="/login" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
            Log In
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──
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
          <div className="ts-eyebrow">Loading hangar…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 32,
        paddingBottom: 20,
        borderBottom: '1px solid var(--ts-line)',
      }}>
        <div>
          <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Twin Suns Format</div>
          <h1 style={{ fontFamily: 'var(--ts-font-display)', fontSize: 'clamp(28px,4vw,44px)', color: 'var(--ts-ink)', margin: 0 }}>
            My Decks
          </h1>
          {decks.length > 0 && (
            <div style={{ marginTop: 6, fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-3)', letterSpacing: '0.1em' }}>
              {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {decks.length > 1 && (
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="ts-input"
              style={{ padding: '7px 12px', fontSize: 12, fontFamily: 'var(--ts-font-mono)', letterSpacing: '0.08em', cursor: 'pointer' }}
            >
              <option value="date_newest">Date: Newest</option>
              <option value="date_oldest">Date: Oldest</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </select>
          )}
          <Link href="/deck-builder" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
            + New Deck
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(194,69,58,0.12)', border: '1px solid var(--ts-red)',
          padding: '12px 16px', marginBottom: 24,
          fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-red)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {error}
          <button style={{ background: 'none', border: 'none', color: 'var(--ts-red)', cursor: 'pointer', fontSize: 14 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 && !loading && (
        <div style={{
          border: '1px solid var(--ts-line)',
          background: 'var(--ts-panel)',
          padding: '64px 40px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.28em',
            textTransform: 'uppercase', color: 'var(--ts-amber)', border: '1.5px solid var(--ts-amber)',
            padding: '4px 14px', marginBottom: 24, display: 'inline-block', opacity: 0.9,
          }}>
            Hangar Empty
          </div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)', marginBottom: 12 }}>
            No Decks Yet
          </div>
          <p style={{ color: 'var(--ts-ink-2)', fontSize: 14, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 28px' }}>
            Build your first Twin Suns deck. Pick two leaders, a base, and ten cards to form your squadron.
          </p>
          <Link href="/deck-builder" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
            Build a Deck
          </Link>
        </div>
      )}

      {/* Deck grid */}
      {sorted.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {sorted.map(deck => (
            <DeckCard key={deck.id} deck={deck} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
