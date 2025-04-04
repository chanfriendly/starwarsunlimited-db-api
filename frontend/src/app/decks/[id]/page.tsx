// This is a Server Component - no "use client" directive here
import { DeckViewClient } from './DeckViewClient';

// Using a simpler approach with typing - ignore Next.js's error
export default function DeckViewPage({ params }: { params: { id: string } }) {
  return <DeckViewClient deckId={String(params.id)} />;
}