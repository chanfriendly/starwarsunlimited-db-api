'use client';

import React, { useState } from 'react';
import { Card as CardType } from '@/lib/api';

interface LeaderSelectionProps {
    leaders: CardType[];
    onRemoveLeader: (leaderId: string) => void;
    onSelectLeader?: (leader: CardType) => void;
}

export function LeaderSelection({ leaders, onRemoveLeader, onSelectLeader }: LeaderSelectionProps) {
    // Add state to track which leaders are flipped
    const [flippedLeaders, setFlippedLeaders] = useState<{ [key: string]: boolean }>({});

    // Toggle flip state for a specific leader
    const toggleFlip = (leaderId: string) => {
        setFlippedLeaders(prev => ({
            ...prev,
            [leaderId]: !prev[leaderId]
        }));
    };

    return (
        <div className="grid grid-cols-2 gap-8 mt-4 justify-center">
            {/* First leader slot */}
            <div className="flex justify-center">
                {leaders.length > 0 ? (
                    <div className="relative">
                        <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500 max-w-[220px]">
                            {leaders[0].image_back_uri && !flippedLeaders[leaders[0].id] ? (
                                <img
                                    src={leaders[0].image_back_uri}
                                    alt={`${leaders[0].name} (back)`}
                                    className="w-full h-full object-contain cursor-pointer"
                                    onClick={() => onSelectLeader?.(leaders[0])}
                                />
                            ) : (
                                <img
                                    src={leaders[0].image_uri}
                                    alt={`${leaders[0].name} (front)`}
                                    className="w-full h-full object-contain cursor-pointer"
                                    onClick={() => onSelectLeader?.(leaders[0])}
                                />
                            )}

                            {/* Remove button */}
                            <button
                                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full z-10"
                                onClick={() => onRemoveLeader(leaders[0].id)}
                            >
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Flip button (only show if there's a back image) */}
                            {leaders[0].image_back_uri && (
                                <button
                                    className="absolute bottom-2 right-2 p-1 bg-purple-500 rounded-full z-10"
                                    onClick={() => toggleFlip(leaders[0].id)}
                                >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className="mt-2 text-center">
                            <h3 className="font-medium text-sm">{leaders[0].name}</h3>
                        </div>
                    </div>
                ) : (
                    <div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-[220px] w-full">
                        <span className="text-gray-500">Select a Leader</span>
                    </div>
                )}
            </div>

            {/* Second leader slot */}
            <div className="flex justify-center">
                {leaders.length > 1 ? (
                    <div className="relative">
                        <div className="aspect-[7/10] relative rounded-lg overflow-hidden border-2 border-purple-500 max-w-[220px]">
                           {leaders[1].image_back_uri && !flippedLeaders[leaders[1].id] ? (
                                <img
                                    src={leaders[1].image_back_uri}
                                    alt={`${leaders[1].name} (back)`}
                                    className="w-full h-full object-contain cursor-pointer"
                                     onClick={() => onSelectLeader?.(leaders[1])}
                                />
                            ) : (
                                <img
                                    src={leaders[1].image_uri}
                                    alt={`${leaders[1].name} (front)`}
                                    className="w-full h-full object-contain cursor-pointer"
                                    onClick={() => onSelectLeader?.(leaders[1])}
                                />
                            )}
                            {/* Remove button */}
                            <button
                                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full z-10"
                                onClick={() => onRemoveLeader(leaders[1].id)}
                            >
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Flip button (only show if there's a back image) */}
                            {leaders[1].image_back_uri && (
                                <button
                                    className="absolute bottom-2 right-2 p-1 bg-purple-500 rounded-full z-10"
                                    onClick={() => toggleFlip(leaders[1].id)}
                                >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className="mt-2 text-center">
                            <h3 className="font-medium text-sm">{leaders[1].name}</h3>
                        </div>
                    </div>
                ) : (
                    <div className="aspect-[7/10] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center max-w-[220px] w-full">
                        <span className="text-gray-500">Select a Leader</span>
                    </div>
                )}
            </div>
        </div>
    );
}

