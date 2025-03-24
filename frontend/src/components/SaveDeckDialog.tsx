'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { saveUserDeck } from '@/lib/api';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';

interface SaveDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deckId: string) => void;
}

const SaveDeckDialog = ({ isOpen, onClose, onSuccess }: SaveDeckDialogProps) => {
  const { leaders, base, deckCards, deckName } = useDeckBuilder();
  const [name, setName] = useState(deckName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Prepare deck data for saving
    const saveData = {
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
      const savedDeck = await saveUserDeck(saveData);
      if (savedDeck) {
        onSuccess(savedDeck.id);
      } else {
        setError('Failed to save deck. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while saving the deck');
      console.error('Save deck error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 text-white border border-gray-700 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Save Deck</DialogTitle>
          <DialogDescription className="text-gray-400">
            Give your deck a name to save it to your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deck-name" className="text-right">
              Name
            </Label>
            <Input
              id="deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter deck name..."
              className="col-span-3 bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Deck Info */}
          <div className="bg-gray-800 p-3 rounded-md text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-400">Leaders:</span>
              <span className="text-white">{leaders.length} / 2</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-400">Base:</span>
              <span className="text-white">{base ? '1 / 1' : '0 / 1'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Cards:</span>
              <span className="text-white">{deckCards.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-500/10 rounded-md border border-red-500/20">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-gray-600 hover:bg-gray-800 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSaving ? 'Saving...' : 'Save Deck'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveDeckDialog;
