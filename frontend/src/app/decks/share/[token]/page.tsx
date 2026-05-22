import { PublicDeckViewClient } from './PublicDeckViewClient';

export default async function SharedDeckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicDeckViewClient shareToken={token} />;
}
