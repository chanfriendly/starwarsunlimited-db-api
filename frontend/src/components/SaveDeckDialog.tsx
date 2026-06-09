'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { saveUserDeck, updateUserDeck } from '@/lib/api';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';

interface SaveDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deckId: string) => void;
  existingDeckId?: string;
}

const SaveDeckDialog = ({ isOpen, onClose, onSuccess, existingDeckId }: SaveDeckDialogProps) => {
  const { leaders, base, deckCards, deckName, setDeckName } = useDeckBuilder();
  const router = useRouter();
  const [name, setName] = useState(deckName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpdate = !!existingDeckId;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a deck name');
      return;
    }

    if (leaders.length !== 2) {
      setError('A deck must have exactly 2 leaders');
      return;
    }

    if (!base) {
      setError('A deck must have a base card');
      return;
    }

    if (deckCards.length < 10) {
      setError('Your deck should have at least 10 cards');
      return;
    }

    const payload = {
      name: name.trim(),
      leaders: leaders.map(leader => leader.id),
      base: base.id,
      cards: deckCards.map(item => ({
        card_id: item.card.id,
        quantity: item.quantity,
      })),
    };

    setIsSaving(true);
    setError(null);

    try {
      const savedDeck = isUpdate
        ? await updateUserDeck(existingDeckId, payload)
        : await saveUserDeck(payload);

      if (savedDeck) {
        setDeckName(name.trim());
        onSuccess(savedDeck.id);
      } else {
        setError('Failed to save deck. Please try again.');
      }
    } catch (err) {
      console.error('Save deck error:', err);
      if (err instanceof Error && err.message.includes('authentication token')) {
        onClose();
        router.push('/login?redirect=/deck-builder');
        return;
      }
      setError('An error occurred while saving the deck. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em',
    color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8,
  };
  const totalCards = deckCards.reduce((sum, item) => sum + item.quantity, 0);
  const summaryRows: Array<[string, string]> = [
    ['Leaders', `${leaders.length} / 2`],
    ['Base', base ? '1 / 1' : '0 / 1'],
    ['Total Cards', `${totalCards}`],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', color: 'var(--ts-ink)', borderRadius: 0 }}
      >
        <DialogHeader>
          <div className="ts-eyebrow" style={{ marginBottom: 8 }}>Twin Suns · {isUpdate ? 'Update' : 'Save'} Deck</div>
          <DialogTitle style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, fontWeight: 400, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
            {isUpdate ? 'Update Deck' : 'Save Deck'}
          </DialogTitle>
          <DialogDescription style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ts-ink-3)', marginTop: 4 }}>
            {isUpdate ? 'Save your changes to this deck.' : 'Give your deck a name to save it to your profile.'}
          </DialogDescription>
        </DialogHeader>

        <div className="ts-rule" style={{ margin: '4px 0 16px' }} />

        <div>
          <label htmlFor="deck-name" style={labelStyle}>Name</label>
          <input
            id="deck-name"
            className="ts-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter deck name..."
            autoFocus
            style={{ borderColor: error && !name.trim() ? 'var(--ts-red)' : undefined }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !isSaving) handleSave(); }}
          />

          {/* Deck summary */}
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--ts-bg-3)', border: '1px solid var(--ts-line)' }}>
            {summaryRows.map(([label, value], i) => (
              <div
                key={label}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < summaryRows.length - 1 ? 8 : 0 }}
              >
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ts-ink-3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, letterSpacing: '0.06em', color: 'var(--ts-amber)' }}>{value}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.08)', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.06em', color: 'rgba(255,100,90,0.95)', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>

        <div className="ts-rule" style={{ margin: '20px 0 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="ts-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="ts-btn ts-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? 'Saving…' : isUpdate ? 'Update Deck' : 'Save Deck'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveDeckDialog;