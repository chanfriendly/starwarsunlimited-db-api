"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Deck, deleteDeck, getUserDecks } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Plus, Users, User, Clock, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function DecksPage() {
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

  // Function to get aspect color
  const getAspectColor = (aspect: string) => {
    const aspectColors: Record<string, string> = {
      'Command': '#e74c3c',
      'Heroism': '#2ecc71',
      'Villainy': '#1c1c1c',
      'Force': '#3498db',
      'Aggression': '#e67e22',
      'Cunning': '#9b59b6',
    };
    return aspectColors[aspect] || '#7f8c8d';
  };

  // Function to get aspects from a deck
  const getDeckAspects = (deck: Deck) => {
    // Get leader and base cards
    const leaderCards = deck.cards.filter(card => card.is_leader);
    const baseCard = deck.cards.find(card => card.is_base);
    
    // Get all aspects from cards
    const aspectCounts: Record<string, number> = {};
    
    // Count aspects
    [...leaderCards, baseCard].filter(Boolean).forEach(card => {
      if (card?.card?.aspects) {
        card.card.aspects.forEach(aspectObj => {
          const aspectName = aspectObj.aspect_name;
          aspectCounts[aspectName] = (aspectCounts[aspectName] || 0) + 1;
        });
      }
    });
    
    return Object.entries(aspectCounts).map(([name, count]) => ({ name, count }));
  };

  if (loading) {
    return (
      <div className="container py-16 flex justify-center items-center min-h-[calc(100vh-80px)]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-40 bg-muted rounded mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 bg-background rounded-lg border border-muted"></div>
            ))}
          </div>
        </div>
      </div>
    );
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
        <div className="text-center py-16 bg-background border border-border rounded-lg">
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
          {decks.map(deck => {
            const deckAspects = getDeckAspects(deck);
            const leaderCards = deck.cards.filter(card => card.is_leader);
            const baseCard = deck.cards.find(card => card.is_base);
            
            return (
              <Card key={deck.id} className="overflow-hidden flex flex-col bg-background/80 backdrop-blur-sm border-muted">
                <CardHeader className="pb-3">
                  <CardTitle>{deck.name}</CardTitle>
                  <CardDescription className="flex items-center text-sm">
                    <Clock className="h-3 w-3 mr-1" /> {new Date(deck.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  {deck.description && (
                    <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{deck.description}</p>
                  )}
                  
                  {/* Cards Preview */}
                  <div className="flex flex-col gap-3">
                    {/* Leaders section */}
                    <div>
                      <div className="flex items-center mb-1">
                        <Shield className="h-4 w-4 mr-1 text-primary" />
                        <span className="text-sm font-medium">Leaders:</span>
                      </div>
                      <div className="flex gap-2">
                        {leaderCards.map(cardItem => (
                          <div key={cardItem.id} className="relative w-16 h-20 rounded-md border overflow-hidden">
                            {cardItem.card?.image_url ? (
                              <Image 
                                src={cardItem.card.image_url}
                                alt={cardItem.card.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <User className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Base section */}
                    {baseCard && (
                      <div>
                        <div className="flex items-center mb-1">
                          <Users className="h-4 w-4 mr-1 text-primary" />
                          <span className="text-sm font-medium">Base:</span>
                        </div>
                        <div className="relative w-16 h-20 rounded-md border overflow-hidden">
                          {baseCard.card?.image_url ? (
                            <Image 
                              src={baseCard.card.image_url}
                              alt={baseCard.card.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Users className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Aspects */}
                  <div className="mt-4">
                    <div className="flex items-center mb-2 text-sm font-medium">Aspects:</div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {deckAspects.map(aspect => (
                        <Badge 
                          key={aspect.name} 
                          variant="outline" 
                          style={{
                            backgroundColor: `${getAspectColor(aspect.name)}30`,
                            borderColor: getAspectColor(aspect.name),
                            color: getAspectColor(aspect.name)
                          }}
                        >
                          {aspect.name} x{aspect.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="flex justify-between pt-3 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/deck-builder?deck=${deck.id}`}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteDeck(deck.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}