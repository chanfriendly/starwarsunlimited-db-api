'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
import { Card as CardType } from '@/lib/api';

// Define types for our deck cards
interface DeckCard {
  card: CardType;
  quantity: number;
}

export function DeckStats() {
  const { leaders, base, deckCards } = useDeckBuilder();

  // Count cards by type
  const countByType = () => {
    const counts: Record<string, number> = {};
    
    deckCards.forEach((deckCard) => {
      const type = deckCard.card.type;
      counts[type] = (counts[type] || 0) + deckCard.quantity;
    });
    
    return counts;
  };

  // Count cards by energy cost
  const countByEnergyCost = () => {
    const counts: Record<string, number> = {};
    
    deckCards.forEach((deckCard) => {
      if (deckCard.card.energy_cost !== undefined) {
        const cost = deckCard.card.energy_cost;
        const costKey = cost >= 7 ? '7+' : cost.toString();
        counts[costKey] = (counts[costKey] || 0) + deckCard.quantity;
      }
    });
    
    return counts;
  };

  // Count cards by aspect
  const countByAspect = () => {
    const counts: Record<string, { count: number, color: string }> = {};
    
    // Add leaders' aspects
    leaders.forEach((leader) => {
      leader.aspects?.forEach((aspect) => {
        if (!counts[aspect.aspect_name]) {
          counts[aspect.aspect_name] = { count: 0, color: aspect.aspect_color };
        }
      });
    });
    
    // Add base aspects
    if (base) {
      base.aspects?.forEach((aspect) => {
        if (!counts[aspect.aspect_name]) {
          counts[aspect.aspect_name] = { count: 0, color: aspect.aspect_color };
        }
      });
    }
    
    // Count cards by aspect
    deckCards.forEach((deckCard) => {
      deckCard.card.aspects?.forEach((aspect) => {
        if (counts[aspect.aspect_name]) {
          counts[aspect.aspect_name].count += deckCard.quantity;
        }
      });
    });
    
    return counts;
  };

  // Calculate total cards in deck
  const totalCards = deckCards.reduce((sum, deckCard) => sum + deckCard.quantity, 0);

  const typeStats = countByType();
  const costStats = countByEnergyCost();
  const aspectStats = countByAspect();

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="border-b border-gray-800">
        <CardTitle className="text-xl">Deck Statistics</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Card Count</h3>
          <div className="flex items-center">
            <div className="w-full bg-gray-800 rounded-full h-4">
              <div 
                className="bg-purple-500 h-4 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (totalCards / 40) * 100)}%` }}
              ></div>
            </div>
            <span className="ml-2 text-white">{totalCards}/40</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Card types distribution */}
          <div>
            <h3 className="text-lg font-medium mb-2">Card Types</h3>
            <div className="space-y-2">
              {Object.entries(typeStats).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{type}</span>
                  <span className="text-sm font-medium bg-purple-500/20 px-2 py-0.5 rounded">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Energy cost distribution */}
          <div>
            <h3 className="text-lg font-medium mb-2">Energy Cost</h3>
            <div className="space-y-2">
              {Object.entries(costStats)
                .sort((a, b) => {
                  // Sort by energy cost, with "7+" at the end
                  if (a[0] === "7+") return 1;
                  if (b[0] === "7+") return -1;
                  return parseInt(a[0]) - parseInt(b[0]);
                })
                .map(([cost, count]) => (
                  <div key={cost} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{cost}</span>
                    <span className="text-sm font-medium bg-purple-500/20 px-2 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Aspect distribution */}
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Aspects</h3>
          <div className="space-y-2">
            {Object.entries(aspectStats).map(([aspect, { count, color }]) => (
              <div key={aspect} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: color || 'purple' }}
                  ></div>
                  <span className="text-sm text-gray-300">{aspect}</span>
                </div>
                <span className="text-sm font-medium bg-purple-500/20 px-2 py-0.5 rounded">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}