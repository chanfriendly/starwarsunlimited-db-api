import { PublicDeckViewClient } from './PublicDeckViewClient';

export default function SharedDeckPage({ params }: { params: { token: string } }) {
  return <PublicDeckViewClient shareToken={params.token} />;
}
