// frontend/src/components/DeckStats.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
// Make sure CardType is correctly imported and matches the structure used in DeckBuilderContext
// It should include 'cost', 'energy_cost' (if applicable), 'type', 'aspects' properties
import { Card as CardType } from '@/lib/api';

// Define type for items expected in deckCards from context
// Ensure this matches the structure in your DeckBuilderContext
interface DeckItem {
  card: CardType;
  quantity: number; // Assuming quantity is always 1 for Twin Suns, but handled generically here
}

// Interface for Aspect data, ensure this matches CardType's aspect structure
interface AspectInfo {
    aspect_name: string;
    aspect_color?: string | null; // Color might be optional or null
}

export function DeckStats() {
  const { leaders, base, deckCards } = useDeckBuilder();

  // Memoize calculations to avoid re-computing on every render unless dependencies change
  const stats = React.useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const costCounts: Record<string, number> = {};
    const aspectData: Record<string, { count: number, color: string }> = {};


    // --- Calculate Type Counts ---
    deckCards.forEach((item: DeckItem) => {
      // Handle potential missing type property
      const type = item.card.type ?? 'Unknown'; // Default to 'Unknown' if type is null/undefined
      typeCounts[type] = (typeCounts[type] || 0) + item.quantity;
    });

    // --- Calculate Cost Counts ---
    deckCards.forEach((item: DeckItem) => {
      // Use nullish coalescing (?? 0) to safely get cost, preferring energy_cost if present
      // This treats null and undefined cost as 0 for stats purposes
      const cost = (item.card.energy_cost ?? item.card.cost ?? 0);

      // Group costs, treating 7+ as one category
      const costKey = cost >= 7 ? '7+' : String(cost);
      costCounts[costKey] = (costCounts[costKey] || 0) + item.quantity;
    });

    // --- Aggregate Aspect Info (Colors and Counts) ---
    const processAspects = (card: CardType | null, quantity: number = 1) => {
        card?.aspects?.forEach((aspect: AspectInfo) => {
            const aspectName = aspect.aspect_name;
            if (!aspectData[aspectName]) {
                // Initialize with default color if needed
                aspectData[aspectName] = { count: 0, color: aspect.aspect_color || '#94a3b8' }; // Default grey
            }
            // Update color if a non-null/non-default one is found (optional, first one found wins)
            if (aspect.aspect_color && aspectData[aspectName].color === '#94a3b8') {
                 aspectData[aspectName].color = aspect.aspect_color;
            }
            // Increment count only for deck cards (leaders/base don't add to card aspect counts)
            if (quantity > 0) { // Only add count if quantity > 0 (i.e., it's from deckCards)
                 aspectData[aspectName].count += quantity;
            }
        });
    };

    // Initialize aspects from Leaders and Base (to get colors primarily)
    leaders.forEach(leader => processAspects(leader, 0)); // quantity 0 prevents counting leaders
    processAspects(base, 0); // quantity 0 prevents counting base

    // Count aspects from Deck Cards
    deckCards.forEach(item => processAspects(item.card, item.quantity));


    // --- Calculate Total Cards ---
    const totalCards = deckCards.reduce((sum, item) => sum + item.quantity, 0);

    // Sort cost stats
    const sortedCostStats = Object.entries(costCounts)
        .sort(([costA], [costB]) => {
            const numA = costA === '7+' ? Infinity : parseInt(costA, 10);
            const numB = costB === '7+' ? Infinity : parseInt(costB, 10);
            return numA - numB;
        });

    // Sort aspect stats alphabetically
    const sortedAspectStats = Object.entries(aspectData)
        .sort(([aspectA], [aspectB]) => aspectA.localeCompare(aspectB));

    return {
      totalCards,
      typeStats: typeCounts,
      costStats: sortedCostStats, // Use the sorted array
      aspectStats: sortedAspectStats, // Use the sorted array
    };
  }, [leaders, base, deckCards]); // Dependencies for useMemo


  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="border-b border-gray-800">
        <CardTitle className="text-xl text-white">Deck Statistics</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Card Count Progress Bar */}
        <div className="mb-4">
          <h3 className="text-lg text-white font-medium mb-2">Card Count</h3>
          <div className="flex items-center">
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden"> {/* Changed bg color */}
              <div
                className="bg-purple-500 h-4 rounded-full transition-all duration-500"
                // Assuming Twin Suns target is 30 cards (Leader + Base + 30)
                style={{ width: `${Math.min(100, (stats.totalCards / 30) * 100)}%` }}
              ></div>
            </div>
            {/* Display count vs target */}
            <span className="ml-3 text-sm text-white whitespace-nowrap">{stats.totalCards} / 30</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4"> {/* Adjusted grid layout */}
          {/* Card Types Distribution */}
          {Object.keys(stats.typeStats).length > 0 && (
            <div>
              <h3 className="text-lg text-white font-medium mb-2">Card Types</h3>
              <div className="space-y-1.5"> {/* Slightly reduced spacing */}
                {Object.entries(stats.typeStats).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{type}</span>
                    <span className="text-sm font-medium text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded"> {/* Adjusted colors */}
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Energy Cost Distribution */}
          {stats.costStats.length > 0 && (
            <div>
              <h3 className="text-lg text-white font-medium mb-2">Cost Curve</h3>
              <div className="space-y-1.5">
                {stats.costStats.map(([cost, count]) => (
                    <div key={cost} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 w-8 text-center">{cost}</span> {/* Align cost keys */}
                      {/* Simple bar representation */}
                      <div className="flex-1 bg-gray-700 h-3 rounded mx-2 overflow-hidden">
                         <div className="bg-teal-500 h-full rounded" style={{width: `${Math.min(100, (count / Math.max(...stats.costStats.map(c => c[1]), 1)) * 100)}%` }}></div> {/* Relative bar width */}
                      </div>
                      <span className="text-sm font-medium text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded w-8 text-center"> {/* Adjusted colors & width*/}
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Aspect Distribution */}
        {stats.aspectStats.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Aspects Breakdown</h3>
            <div className="space-y-1.5">
              {stats.aspectStats.map(([aspect, { count, color }]) => (
                <div key={aspect} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2 border border-gray-500" // Added border
                      style={{ backgroundColor: color }} // Use calculated color
                    ></div>
                    <span className="text-sm text-gray-300">{aspect}</span>
                  </div>
                  <span className="text-sm font-medium text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded"> {/* Adjusted colors */}
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}