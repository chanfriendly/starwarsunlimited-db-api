'use client';

import React from 'react';
import { Card as CardType } from '@/lib/api';

interface LeaderSelectionProps {
  leaders: CardType[];
  onRemoveLeader: (leaderId: string) => void;
  onSelectLeader?: (leader: CardType) => void;
}

export function LeaderSelection({ leaders, onRemoveLeader, onSelectLeader }: LeaderSelectionProps) {
  return (
    <div className="grid grid-cols-2 gap-8 mt-4 justify-center">
      {/* First leader slot */}
      <div className="flex justify-center">
        {leaders.length > 0 ? (
          <div className="relative">
            <div className="aspect-[10/7] relative rounded-lg overflow-hidden border-2 border-purple-500 max-w-[220px]">
              {leaders[0].image_uri ? (
                <img
                  src={leaders[0].image_uri}
                  alt={leaders[0].name}
                  className="w-full h-full object-contain rotate-90 transform scale-[125%]"
                  onClick={() => onSelectLeader?.(leaders[0])}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <span className="text-sm text-center p-2">{leaders[0].name}</span>
                </div>
              )}
              <button 
                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full z-10"
                onClick={() => onRemoveLeader(leaders[0].id)}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-2 text-center">
              <h3 className="font-medium text-sm">{leaders[0].name}</h3>
            </div>
          </div>
        ) : (
          <div className="aspect-[10/7] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-[220px] w-full">
            <span className="text-gray-500">Select a Leader</span>
          </div>
        )}
      </div>

      {/* Second leader slot */}
      <div className="flex justify-center">
        {leaders.length > 1 ? (
          <div className="relative">
            <div className="aspect-[10/7] relative rounded-lg overflow-hidden border-2 border-purple-500 max-w-[220px]">
              {leaders[1].image_uri ? (
                <img
                  src={leaders[1].image_uri}
                  alt={leaders[1].name}
                  className="w-full h-full object-contain rotate-90 transform scale-[125%]"
                  onClick={() => onSelectLeader?.(leaders[1])}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <span className="text-sm text-center p-2">{leaders[1].name}</span>
                </div>
              )}
              <button 
                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full z-10"
                onClick={() => onRemoveLeader(leaders[1].id)}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-2 text-center">
              <h3 className="font-medium text-sm">{leaders[1].name}</h3>
            </div>
          </div>
        ) : (
          <div className="aspect-[10/7] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-[220px] w-full">
            <span className="text-gray-500">Select a Leader</span>
          </div>
        )}
      </div>
    </div>
  );
}