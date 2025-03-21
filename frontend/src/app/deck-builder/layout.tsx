'use client';

import React from 'react';
import { DeckBuilderProvider } from '@/contexts/DeckBuilderContext';

export default function DeckBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DeckBuilderProvider>
      {children}
    </DeckBuilderProvider>
  );
}