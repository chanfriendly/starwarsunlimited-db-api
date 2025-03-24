// src/components/CardDetailDialog.tsx
'use client';

import React, { useState } from 'react';
import { ApiCard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

export interface CardDetailDialogProps {
  card: ApiCard;
  onClose: () => void;
}

export function CardDetailDialog({ card, onClose }: CardDetailDialogProps) {
  const router = useRouter();
  const [showBackSide, setShowBackSide] = useState(false);
  
  // Only allow flipping for cards with a back side (mainly Leaders)
  const canFlip = card?.image_back_uri !== undefined && card?.image_back_uri !== null;
  
  const currentImage = showBackSide && card.image_back_uri ? card.image_back_uri : card.image_uri;

  // Navigate to deck builder with this card pre-selected
  const buildDeckWithCard = () => {
    if (card.type === 'Leader') {
      router.push(`/deck-builder?preselect=${card.id}`);
    } else {
      // For non-leaders, we'll need to select a leader first
      router.push('/deck-builder');
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{card.name}</DialogTitle>
      </DialogHeader>
      
      <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Image */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="aspect-[7/10] rounded-lg overflow-hidden border border-gray-700">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={`${card.name} ${showBackSide ? '(back)' : '(front)'}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <span className="text-lg text-center p-4">{card.name}</span>
                </div>
              )}
            </div>
            
            {/* Flip button for cards with back side */}
            {canFlip && (
              <button 
                className="absolute top-2 right-2 p-2 bg-purple-500 rounded-full text-white"
                onClick={() => setShowBackSide(!showBackSide)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Card Details */}
        <div>
          {card.subtitle && (
            <p className="text-gray-400 mb-2">{card.subtitle}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            {card.aspects?.map((aspect) => (
              <Badge 
                key={aspect.aspect_name}
                style={{
                  backgroundColor: `${aspect.aspect_color}30`,
                  color: aspect.aspect_color,
                  borderColor: aspect.aspect_color
                }}
                variant="outline"
              >
                {aspect.aspect_name}
              </Badge>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4 bg-gray-800/50 p-3 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-gray-400">Type</p>
              <p className="text-sm font-bold">{card.type}</p>
            </div>
            {card.energy_cost !== undefined && (
              <div className="text-center">
                <p className="text-xs text-gray-400">Cost</p>
                <p className="text-sm font-bold text-amber-400">{card.energy_cost}</p>
              </div>
            )}
            {card.attack !== undefined && (
              <div className="text-center">
                <p className="text-xs text-gray-400">Attack</p>
                <p className="text-sm font-bold text-red-400">{card.attack}</p>
              </div>
            )}
            {card.health !== undefined && (
              <div className="text-center">
                <p className="text-xs text-gray-400">Health</p>
                <p className="text-sm font-bold text-green-400">{card.health}</p>
              </div>
            )}
          </div>
          
          {card.text && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-1">Card Text</h3>
              <p className="text-sm text-gray-300 bg-gray-800/50 p-3 rounded-lg whitespace-pre-line">{card.text}</p>
            </div>
          )}
          
          {card.keywords && card.keywords.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-1">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {card.keywords.map((keyword) => (
                  <Badge 
                    key={keyword}
                    variant="outline"
                    className="bg-purple-900/30 text-purple-300 border-purple-700"
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {card.set_name && (
            <div className="text-xs text-gray-400 mt-4">
              Set: {card.set_name} {card.set_code && `(${card.set_code})`}
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          onClick={buildDeckWithCard}
          className="bg-purple-600 hover:bg-purple-700 text-white mr-2"
        >
          Build Deck with this Card
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          className="border-gray-700 hover:bg-gray-800"
        >
          Close
        </Button>
      </DialogFooter>
    </>
  );
}