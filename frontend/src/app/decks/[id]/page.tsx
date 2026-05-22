// This is a Server Component - no "use client" directive here
import { DeckViewClient } from './DeckViewClient';

export default async function DeckViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeckViewClient deckId={id} />;
}