'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const DeckBuilderClient = dynamic(() => import('./DeckBuilderClient'), { ssr: false });

export default function DeckBuilderPage() {
  return (
    <Suspense fallback={<div>Loading Deck Builder...</div>}>
      <DeckBuilderClient />
    </Suspense>
  );
}