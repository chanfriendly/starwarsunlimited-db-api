"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Deck, deleteDeck, getUserDecks } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function MyDecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const loadDecks = async () => {
      try {
        const userDecks = await getUserDecks();
        setDecks(userDecks);
      } catch (error) {
        toast({
          title: "Error loading decks",
          description: "Failed to load your decks. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadDecks();
  }, [user, router, toast]);

  const handleDeleteDeck = async (deckId: string) => {
    if (confirm("Are you sure you want to delete this deck?")) {
      try {
        await deleteDeck(deckId);
        setDecks(decks.filter(deck => deck.id !== deckId));
        toast({
          title: "Deck deleted",
          description: "Your deck has been deleted successfully."
        });
      } catch (error) {
        toast({
          title: "Error deleting deck",
          description: "Failed to delete your deck. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading your decks...</div>;
  }

  return (
    <div className="container py-16 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Decks</h1>
        <Button asChild>
          <Link href="/deck-builder">
            <Plus className="mr-2 h-4 w-4" /> New Deck
          </Link>
        </Button>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-2xl font-medium text-muted-foreground mb-4">No decks found</h2>
          <p className="mb-8">You haven't created any decks yet.</p>
          <Button asChild>
            <Link href="/deck-builder">
              <Plus className="mr-2 h-4 w-4" /> Create Your First Deck
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map(deck => (
            <Card key={deck.id}>
              <CardHeader>
                <CardTitle>{deck.name}</CardTitle>
                <CardDescription>
                  Created {new Date(deck.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Cards: {deck.cards.reduce((sum, c) => sum + c.quantity, 0)}</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" asChild>
                  <Link href={`/deck-builder?deck=${deck.id}`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDeleteDeck(deck.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}