'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch'; 
import { Label } from '@/components/ui/label'; 
import { cn } from '@/lib/utils';
import {
    BookOpen,
    Library,
    LayoutDashboard,
    Users,
    UserCircle,
    PlusCircle,
    Edit,
    Trash2,
    Search,
    ChevronRight,
    AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
    SavedDeck,
    fetchUserDecks,
    fetchUserCollection,
    deleteUserDeck
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetch-utils';

// Update CollectionItem interface to include in_collection property
interface CollectionItem {
    card: {
        id: string;
        name: string;
        type?: string;
        image_uri?: string;
        image_url?: string;
        set_name?: string;
        set_code?: string;
        card_number?: string;
        aspects?: Array<{
            aspect_name: string;
            aspect_color?: string;
        }>;
    };
    count: number;
    in_collection?: boolean;
}

// Default user profile data
const defaultUserProfile = {
    id: '1',
    username: 'GalacticGamer77',
    avatarUrl: 'https://placehold.co/100x100/EEE/31343C?text=GG&font=Montserrat',
    createdAt: '2023-01-15'
};

// Component to display a single deck
const DeckCard = ({ deck, onDelete }: { deck: SavedDeck, onDelete: (deckId: string) => void }) => {
    // ... DeckCard code (unchanged)
    const aspectColors: Record<string, string> = {
        'Command': 'border-red-600 bg-red-900/20 text-red-400',
        'Heroism': 'border-blue-600 bg-blue-900/20 text-blue-400',
        'Villainy': 'border-gray-600 bg-gray-900/40 text-gray-300',
        'Force': 'border-purple-600 bg-purple-900/20 text-purple-400',
        'Cunning': 'border-amber-600 bg-amber-900/20 text-amber-400',
        'Aggression': 'border-orange-600 bg-orange-900/20 text-orange-400',
    };
    
    // Extract unique aspects from the leaders and base
    const deckAspects = new Set<string>();
    
    // Add aspects from leaders (with safety checks)
    if (deck.leaders && Array.isArray(deck.leaders)) {
        deck.leaders.forEach(leader => {
            if (leader && leader.aspects && Array.isArray(leader.aspects)) {
                leader.aspects.forEach(aspect => {
                    if (aspect && aspect.aspect_name) {
                        deckAspects.add(aspect.aspect_name);
                    }
                });
            }
        });
    }
    
    // Add aspects from base if it exists (with safety checks)
    if (deck.base && deck.base.aspects && Array.isArray(deck.base.aspects)) {
        deck.base.aspects.forEach(aspect => {
            if (aspect && aspect.aspect_name) {
                deckAspects.add(aspect.aspect_name);
            }
        });
    }
    
    // Calculate total cards
    const totalCards = deck.cards ? deck.cards.reduce((sum, item) => sum + item.quantity, 0) : 0;
    
    // Format date
    const formattedDate = deck.updated_at ? 
        new Date(deck.updated_at).getTime() > 0 ?
            new Date(deck.updated_at).toLocaleDateString() : 
            "Recently" : 
        "Recently";   

    return (
        <motion.div
            whileHover={{ scale: 1.03, boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)" }}
            transition={{ duration: 0.2 }}
            className="group"
        >
            <Card className="bg-gray-800 border-gray-700 hover:border-purple-500 transition-colors duration-200
                       hover:shadow-lg hover:shadow-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-semibold text-white">{deck.name}</CardTitle>
                    <Badge
                        variant="secondary"
                        className="bg-gray-700 text-gray-300 border-gray-600 group-hover:bg-purple-500 group-hover:text-white
                                group-hover:border-purple-500 transition-colors duration-200"
                    >
                        {totalCards} Cards
                    </Badge>
                </CardHeader>
                <CardContent>
                <div className="flex gap-2 mb-2">
                    {deck.leaders.map((leader) => (
                        <div key={leader.id} className="w-12 h-12 relative rounded-full overflow-hidden border border-gray-700">
                        <img 
                            src={leader.image_uri || leader.image_url || `https://placehold.co/100x100/EEE/31343C?text=${leader.name.charAt(0)}`} 
                            alt={leader.name}
                            className="w-full h-full object-cover object-center" 
                            style={{ objectPosition: '50% 30%' }} // Focus on upper portion of the card
                        />
                        </div>
                    ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {Array.from(deckAspects).map((aspect) => (
                            <Badge
                                key={aspect}
                                variant="outline"
                                className={cn("text-xs border", aspectColors[aspect] || "border-gray-600 bg-gray-900/50 text-gray-300")}
                            >
                                {aspect}
                            </Badge>
                        ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        Last Updated: {formattedDate}
                    </div>
                    <Button
                        variant="outline"
                        className="mt-4 w-full bg-gray-900/50 text-gray-300 border-gray-700 hover:bg-purple-500 hover:text-white
                                hover:border-purple-500 transition-colors duration-200"
                        asChild
                    >
                        <Link href={`/decks/${deck.id}`}>
                            View Deck <ChevronRight className="ml-2 w-4 h-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    );
};

// Component to display a single card in a collection - MOVED OUTSIDE
const CollectionCard = ({ 
    collectionItem,
    onAddToCollection 
}: { 
    collectionItem: CollectionItem;
    onAddToCollection: (cardId: string, quantity?: number) => Promise<void>;
}) => {
    const { card, count, in_collection = false } = collectionItem;
    
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={`group ${!in_collection ? 'opacity-60 hover:opacity-90' : ''}`}
        >
            <Card className={`bg-gray-800 border-gray-700 hover:border-purple-500 transition-colors duration-200
                    hover:shadow-lg hover:shadow-purple-500/20 flex flex-col h-full ${!in_collection ? 'grayscale-[30%]' : ''}`}>
                <CardHeader className="p-2">
                    <div className="aspect-[2/3] relative rounded-lg overflow-hidden border border-gray-700">
                        <img
                            src={card.image_uri || card.image_url || `https://placehold.co/200x300/EEE/31343C?text=${card.name}`}
                            alt={card.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-2 flex-grow flex flex-col justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold text-white truncate">{card.name}</CardTitle>
                        <div className="text-xs text-gray-400">{card.type}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {card.aspects && card.aspects.map((aspect) => (
                                <Badge
                                    key={aspect.aspect_name}
                                    variant="outline"
                                    className="text-xs border border-gray-600 bg-gray-900/50"
                                    style={{
                                        borderColor: aspect.aspect_color,
                                        backgroundColor: `${aspect.aspect_color}20`,
                                        color: aspect.aspect_color
                                    }}
                                >
                                    {aspect.aspect_name}
                                </Badge>
                            ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {/* Handle both possible property names */}
                            {card.set_name || card.set_code ? 
                                `Set: ${card.set_name || card.set_code}` : 
                                `Card #: ${card.card_number || 'Unknown'}`
                            }
                        </div>
                    </div>
                    
                    {/* For cards in collection, show the count */}
                    {in_collection ? (
                        <Badge
                            variant="secondary"
                            className="mt-2 self-start bg-gray-700 text-gray-300 border-gray-600 group-hover:bg-purple-500 group-hover:text-white
                                group-hover:border-purple-500 transition-colors duration-200"
                        >
                            x{count}
                        </Badge>
                    ) : (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2 self-start text-xs"
                            onClick={() => onAddToCollection(card.id)}
                        >
                            Add to Collection
                        </Button>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

const ErrorMessage = ({ message, retryFn }: { message: string, retryFn: () => void }) => (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
        <div className="flex justify-center mb-2">
            <AlertTriangle className="text-red-500 h-8 w-8" />
        </div>
        <p className="text-red-400 mb-3">{message}</p>
        <Button onClick={retryFn} variant="outline" className="border-red-700 hover:bg-red-800/30">
            Try Again
        </Button>
    </div>
);

interface UserProfileData {
    id: string;
    username: string;
    avatarUrl?: string;
    createdAt: string;
}

const UserProfilePage = () => {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    
    // State
    const [decks, setDecks] = useState<SavedDeck[]>([]);
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(true);  
    const [userProfile, setUserProfile] = useState<UserProfileData>(user ? {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at || defaultUserProfile.createdAt
    } : defaultUserProfile);   
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('decks'); // 'decks', 'collection', etc.
    const [formData, setFormData] = useState({
        username: userProfile.username,
    });
    const [error, setError] = useState<string | null>(null);
    const [showAllCards, setShowAllCards] = useState(false);


    // Define loadData function inside the component
    const loadData = async () => {
        setIsPageLoading(true);
        setError(null);
        
        try {
          console.log('[Profile] Fetching user data...');
          
          // Fetch decks and collection from Next.js API routes
          let decksData = [];
          let collectionData = [];
          
          try {
            // Use the Next.js API routes (which will forward the cookies)
            const fetchedDecks = await fetchWithAuth(`/api/decks`);
            
            // Directly use the returned data (it's already JSON)
            if (Array.isArray(fetchedDecks)) {
              decksData = fetchedDecks;
              console.log("[Profile] Fetched decks:", decksData.length);
            } else if (fetchedDecks && typeof fetchedDecks === 'object' && fetchedDecks.detail) {
              // Handle error object response
              console.warn('[Profile] API error:', fetchedDecks.detail);
              setError(fetchedDecks.detail);
            } else {
              console.warn('[Profile] Unexpected response format:', fetchedDecks);
              setError('Unexpected response format from server');
            }
          } catch (deckError) {
            console.error('[Profile] Error fetching decks:', deckError);
          }
          
          try {
            // Add the all_cards parameter to the URL
            const collectionUrl = `/api/me/collection${showAllCards ? '?all_cards=true' : ''}`;
            const collectionResponse = await fetch(collectionUrl);
            
            if (collectionResponse.ok) {
              collectionData = await collectionResponse.json();
              console.log("[Profile] Fetched collection:", collectionData.length);
            } else if (collectionResponse.status === 401) {
              console.warn('[Profile] Not authenticated for collection');
              setError('Authentication required');
            } else {
              console.warn('[Profile] Failed to fetch collection:', collectionResponse.status);
            }
          } catch (collectionError) {
            console.error('[Profile] Error fetching collection:', collectionError);
          }
          
          setDecks(decksData);
          setCollection(collectionData);
        } catch (err) {
          console.error('[Profile] Error loading profile data:', err);
          setError('Failed to load profile data. Please check your connection and try again.');
        } finally {
          setIsPageLoading(false);
        }
      };

    // Duplicate function removed. The correct handleAddToCollection function inside UserProfilePage is used.

    // Effect to load data when authentication state changes or showAllCards changes
    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            loadData();
        }
    }, [isAuthenticated, authLoading, showAllCards]);

    // Redirect if not authenticated, but only after auth is done loading
    useEffect(() => {
        console.log('[Profile] Auth state:', { 
            isAuthenticated, 
            authLoading, 
            token: localStorage.getItem('auth_token') ? "exists" : "missing"
        });
        
        if (authLoading) {
            console.log('[Profile] Auth still loading, waiting...');
            return;
        }
        
        if (!isAuthenticated) {
            console.log('[Profile] Not authenticated, redirecting to login');
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    // Effect to update user profile when user data changes
    useEffect(() => {
        if (user) {
            setUserProfile({
                id: user.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                createdAt: user.created_at || defaultUserProfile.createdAt
            });
            setFormData({
                username: user.username
            });
        }
    }, [user]);

    // Handlers for editing profile
    const handleEditProfile = () => {
        setIsEditing(true);
    };
    
    const handleSaveProfile = () => {
        setUserProfile({
            ...userProfile,
            username: formData.username,
        });
        setIsEditing(false);
    };
    
    const handleCancelEdit = () => {
        setFormData({ username: userProfile.username });
        setIsEditing(false);
    };
    
    const handleDeleteDeck = async (deckId: string) => {
        if (window.confirm('Are you sure you want to delete this deck?')) {
            try {
                const success = await deleteUserDeck(deckId);
                if (success) {
                    setDecks(decks.filter(deck => deck.id !== deckId));
                } else {
                    throw new Error('Failed to delete deck');
                }
            } catch (err) {
                console.error('Error deleting deck:', err);
                alert('Failed to delete deck. Please try again.');
            }
        }
    };

    // Handle form changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    // Filtered collection based on search
    const filteredCollection = collection.filter((item) =>
        item.card.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Profile Header */}
            <header className="bg-gray-900 py-6 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={userProfile.avatarUrl} alt={userProfile.username} />
                            <AvatarFallback>{userProfile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            {isEditing ? (
                                <Input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    className="bg-gray-800 border border-gray-700 rounded text-white text-xl font-semibold px-2 py-1"
                                />
                            ) : (
                                <h1 className="text-2xl font-semibold">{userProfile.username}</h1>
                            )}
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                                <UserCircle className="w-4 h-4" />
                                <span>
                                    Member Since: {new Date(userProfile.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    {isEditing ? (
                        <div className="flex gap-2">
                            <Button
                                onClick={handleSaveProfile}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Save
                            </Button>
                            <Button
                                onClick={handleCancelEdit}
                                className="bg-gray-600 hover:bg-gray-700 text-white"
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={handleEditProfile}
                            className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                        >
                            <Edit className="mr-2 w-4 h-4" />
                            Edit Profile
                        </Button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Tabs defaultValue="decks" className="w-full" onValueChange={setSelectedTab}>
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-900 border-b border-gray-800">
                        <TabsTrigger
                            value="decks"
                            className={cn(
                                "text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-gray-800",
                                "data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white",
                                "transition-colors duration-200 py-4 px-6",
                                "flex items-center gap-2"
                            )}
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            My Decks
                        </TabsTrigger>
                        <TabsTrigger
                            value="collection"
                            className={cn(
                                "text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-gray-800",
                                "data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white",
                                "transition-colors duration-200 py-4 px-6",
                                "flex items-center gap-2"
                            )}
                        >
                            <Library className="w-5 h-5" />
                            My Collection
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="decks">
                        <div className="mb-8 flex justify-between items-start">
                            <h2 className="text-2xl font-semibold">My Decks</h2>
                            <Button
                                className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                                asChild
                            >
                                <Link href="/deck-builder">
                                    <PlusCircle className="w-5 h-5" />
                                    Create Deck
                                </Link>
                            </Button>
                        </div>
                        
                        {error && selectedTab === 'decks' ? (
                            <ErrorMessage message={error} retryFn={loadData} />
                        ) : isPageLoading ? (
                            <div className="text-center py-16">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                                <p className="mt-4 text-gray-400">Loading your decks...</p>
                            </div>
                        ) : decks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {decks.map((deck) => (
                                    <div key={deck.id} className="relative group">
                                        <DeckCard deck={deck} onDelete={handleDeleteDeck} />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 bg-red-600/50 hover:bg-red-700 text-white opacity-0
                                                       group-hover:opacity-100 transition-opacity duration-200 z-10"
                                            onClick={() => handleDeleteDeck(deck.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-center py-16 bg-gray-900/50 rounded-lg border border-gray-800">
                                <div className="mb-4">
                                    <LayoutDashboard className="w-12 h-12 mx-auto text-gray-600" />
                                </div>
                                <p className="mb-6">You haven't created any decks yet.</p>
                                <Button className="bg-purple-600 hover:bg-purple-700" asChild>
                                    <Link href="/deck-builder">
                                        Create Your First Deck
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="collection">
                        <div className="mb-8 flex justify-between items-start">
                            <h2 className="text-2xl font-semibold">My Collection</h2>
                            <div className="flex gap-2 items-center">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="show-all-cards"
                                        checked={showAllCards}
                                        onCheckedChange={setShowAllCards}
                                    />
                                    <Label htmlFor="show-all-cards">
                                        Show all cards
                                    </Label>
                                </div>
                                <Input
                                    type="text"
                                    placeholder="Search Collection..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-gray-800 border-gray-700 text-white w-64"
                                />
                                <Button
                                    className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                                    asChild
                                >
                                    <Link href="/cards">
                                        <PlusCircle className="w-5 h-5" />
                                        Add Cards
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        
                        {error && selectedTab === 'collection' ? (
                            <ErrorMessage message={error} retryFn={loadData} />
                        ) : isPageLoading ? (
                            <div className="text-center py-16">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                                <p className="mt-4 text-gray-400">Loading your collection...</p>
                            </div>
                        ) : filteredCollection.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filteredCollection.map((collectionItem) => (
                                    <CollectionCard 
                                        key={collectionItem.card.id} 
                                        collectionItem={collectionItem}
                                        onAddToCollection={(cardId, quantity) => handleAddToCollection(cardId, quantity, loadData)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-center py-16 bg-gray-900/50 rounded-lg border border-gray-800">
                                <div className="mb-4">
                                    <Library className="w-12 h-12 mx-auto text-gray-600" />
                                </div>
                                {searchTerm ? (
                                    <p>No cards found matching "{searchTerm}".</p>
                                ) : (
                                    <>
                                        <p className="mb-6">Your collection is empty.</p>
                                        <Button className="bg-purple-600 hover:bg-purple-700" asChild>
                                            <Link href="/cards">
                                                Browse Cards
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

const handleAddToCollection = async (cardId: string, quantity: number = 1, reloadData: () => Promise<void>) => {
  try {
    // Use the Next.js API route instead of direct backend call
    const response = await fetchWithAuth('/api/me/collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        card_id: cardId,
        count: quantity
      })
    });
    
    if (response.ok) {
      // Reload collection data
      reloadData();
    } else {
      console.error('Failed to update collection:', await response.text());
    }
  } catch (error) {
    console.error('Error updating collection:', error);
  }
};

export default UserProfilePage;