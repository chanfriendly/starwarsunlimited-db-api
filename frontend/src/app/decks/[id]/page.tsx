// This is a Server Component - no "use client" directive here
import { DeckViewClient } from './DeckViewClient';

// The default export server component handles the params
export default function DeckViewPage({ params }: { params: { id: string } }) {
  return <DeckViewClient deckId={params.id} />;
}