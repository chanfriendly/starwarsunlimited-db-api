// This is a Server Component - no "use client" directive here
import { DeckViewClient } from './DeckViewClient';

// The default export server component handles the params
export default function DeckViewPage({ params }: { params: { id: string } }) {
  // No need for React.use or await - just pass the id to the client component
  return <DeckViewClient deckId={params.id} />;
}