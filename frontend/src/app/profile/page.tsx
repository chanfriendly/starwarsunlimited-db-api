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

// ── Coming Soon placeholder panel ─────────────────────────
function ComingSoonPanel({
    title,
    description,
    features,
}: {
    title: string;
    description: string;
    features: string[];
}) {
    return (
        <div
            style={{
                position: 'relative',
                minHeight: 400,
                border: '1px solid var(--ts-line)',
                background: 'var(--ts-panel)',
                overflow: 'hidden',
            }}
        >
            {/* Ghost preview content */}
            <div style={{ padding: 32, opacity: 0.15, pointerEvents: 'none', userSelect: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div
                            key={i}
                            style={{
                                height: 96,
                                background: 'var(--ts-panel-2)',
                                border: '1px solid var(--ts-line-2)',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(26,22,17,0.90)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 40,
                    textAlign: 'center',
                }}
            >
                {/* Stamp */}
                <div
                    style={{
                        fontFamily: 'var(--ts-font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.28em',
                        textTransform: 'uppercase',
                        color: 'var(--ts-amber)',
                        border: '1.5px solid var(--ts-amber)',
                        padding: '4px 14px',
                        marginBottom: 24,
                        transform: 'rotate(-1deg)',
                        opacity: 0.9,
                    }}
                >
                    Coming Soon
                </div>

                <div
                    style={{
                        fontFamily: 'var(--ts-font-display)',
                        fontSize: 32,
                        color: 'var(--ts-ink)',
                        marginBottom: 12,
                        letterSpacing: '0.02em',
                    }}
                >
                    {title}
                </div>

                <p
                    style={{
                        color: 'var(--ts-ink-2)',
                        fontSize: 14,
                        lineHeight: 1.7,
                        maxWidth: 540,
                        margin: '0 0 28px',
                    }}
                >
                    {description}
                </p>

                {/* Feature list */}
                <div
                    style={{
                        border: '1px solid var(--ts-line-2)',
                        padding: '16px 24px',
                        textAlign: 'left',
                        maxWidth: 480,
                        width: '100%',
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--ts-font-mono)',
                            fontSize: 9,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: 'var(--ts-ink-3)',
                            marginBottom: 12,
                        }}
                    >
                        Planned Features
                    </div>
                    {features.map(f => (
                        <div
                            key={f}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                marginBottom: 8,
                                fontFamily: 'var(--ts-font-mono)',
                                fontSize: 11,
                                color: 'var(--ts-ink-2)',
                                lineHeight: 1.5,
                            }}
                        >
                            <span style={{ color: 'var(--ts-amber)', flexShrink: 0, marginTop: 1 }}>◈</span>
                            {f}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

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

interface WishlistItem {
    card: {
        id: string;
        name: string;
        type?: string;
        image_uri?: string;
        energy_cost?: number;
        set_name?: string;
        aspects?: Array<{ aspect_name: string; aspect_color?: string }>;
    };
    added_at: string | null;
}

const ASPECT_COLORS: Record<string, string> = {
    Command: '#c2453a', Aggression: '#d96f2d', Cunning: '#e2b342',
    Heroism: '#ead7a8', Vigilance: '#4a90c4', Villainy: '#2c2a26',
};

function WishlistCard({ item, onRemove }: { item: WishlistItem; onRemove: (cardId: string) => void }) {
    const { card } = item;
    const aspects = card.aspects ?? [];
    const bg =
        aspects.length === 1
            ? `linear-gradient(155deg, ${ASPECT_COLORS[aspects[0].aspect_name] ?? '#2c251a'}, #2c251a)`
            : aspects.length >= 2
            ? `linear-gradient(155deg, ${aspects.map(a => ASPECT_COLORS[a.aspect_name] ?? '#2c251a').join(', ')})`
            : 'linear-gradient(155deg, #2c251a, #1f1a12)';

    return (
        <div
            style={{
                background: bg,
                border: '1px solid var(--ts-line-2)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            }}
        >
            {/* Card art / placeholder */}
            <div style={{ aspectRatio: '5/7', position: 'relative', overflow: 'hidden' }}>
                {card.image_uri ? (
                    <img
                        src={card.image_uri}
                        alt={card.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'rgba(255,255,255,0.15)' }}>
                            {card.name[0]}
                        </span>
                    </div>
                )}
                {/* Remove button */}
                <button
                    onClick={() => onRemove(card.id)}
                    style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        background: 'rgba(10,8,4,0.82)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'var(--ts-red)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        lineHeight: 1,
                    }}
                    title="Remove from wishlist"
                >
                    ✕
                </button>
            </div>

            {/* Name plate */}
            <div
                style={{
                    padding: '6px 8px',
                    background: 'rgba(20,16,10,0.92)',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <div
                    style={{
                        fontFamily: 'var(--ts-font-display)',
                        fontSize: 11,
                        color: '#e8dcc4',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3,
                    }}
                >
                    {card.name}
                </div>
                <div
                    style={{
                        fontFamily: 'var(--ts-font-mono)',
                        fontSize: 8,
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        marginTop: 2,
                    }}
                >
                    {card.type}
                </div>
            </div>
        </div>
    );
}

const UserProfilePage = () => {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();

    // State
    const [decks, setDecks] = useState<SavedDeck[]>([]);
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
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
          
          let wishlistData: WishlistItem[] = [];
          try {
            const wishlistResponse = await fetch('/api/me/wishlist');
            if (wishlistResponse.ok) {
              wishlistData = await wishlistResponse.json();
            }
          } catch (wishlistError) {
            console.error('[Profile] Error fetching wishlist:', wishlistError);
          }

          setDecks(decksData);
          setCollection(collectionData);
          setWishlist(wishlistData);
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

    const handleRemoveFromWishlist = async (cardId: string) => {
        try {
            const res = await fetch(`/api/me/wishlist/${cardId}`, { method: 'DELETE' });
            if (res.ok || res.status === 204) {
                setWishlist(prev => prev.filter(item => item.card.id !== cardId));
            }
        } catch (err) {
            console.error('Error removing from wishlist:', err);
        }
    };

    // Filtered collection based on search
    const filteredCollection = collection.filter((item) =>
        item.card.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Collection completion stats (available when showAllCards=true)
    const ownedCount = collection.filter(item => item.in_collection).length;
    const totalCount = collection.length;
    const completionPct = totalCount > 0 ? ((ownedCount / totalCount) * 100).toFixed(1) : null;

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
                        {/* Collection completion stat */}
                        {completionPct !== null && (
                            <div style={{ marginLeft: 24, padding: '10px 18px', background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--ts-ink-4)', textTransform: 'uppercase' }}>
                                    Collection
                                </div>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-amber)', lineHeight: 1 }}>
                                    {completionPct}%
                                </div>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', letterSpacing: '0.1em' }}>
                                    {ownedCount} / {totalCount} cards
                                </div>
                            </div>
                        )}
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
                    <TabsList className="grid w-full grid-cols-5 mb-8 bg-gray-900 border-b border-gray-800">
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
                        <TabsTrigger
                            value="achievements"
                            className={cn(
                                "text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-gray-800",
                                "data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white",
                                "transition-colors duration-200 py-4 px-6",
                                "flex items-center gap-2"
                            )}
                        >
                            Achievements
                        </TabsTrigger>
                        <TabsTrigger
                            value="tournaments"
                            className={cn(
                                "text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-gray-800",
                                "data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white",
                                "transition-colors duration-200 py-4 px-6",
                                "flex items-center gap-2"
                            )}
                        >
                            Tournaments
                        </TabsTrigger>
                        <TabsTrigger
                            value="wishlist"
                            className={cn(
                                "text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-gray-800",
                                "data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white",
                                "transition-colors duration-200 py-4 px-6",
                                "flex items-center gap-2"
                            )}
                        >
                            Wishlist
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

                    {/* ── Achievements — Coming Soon ─────────────────────── */}
                    <TabsContent value="achievements">
                        <ComingSoonPanel
                            title="Achievements & Pilot Training"
                            description="Earn badges for deck-building milestones, tournament finishes, and collection goals. Pilot Training will guide new players through Twin Suns fundamentals with guided challenges."
                            features={[
                                'Milestone badges (first deck, first win, 100-card collection…)',
                                'Pilot Training — guided challenges for new Twin Suns players',
                                'Seasonal achievement tracks',
                                'Badge showcase on your public profile',
                            ]}
                        />
                    </TabsContent>

                    {/* ── Tournament History — Coming Soon ──────────────── */}
                    <TabsContent value="tournaments">
                        <ComingSoonPanel
                            title="Tournament History"
                            description="Track your event results, ELO rating, and head-to-head records. Requires a tournament-reporting integration — planned for a future release."
                            features={[
                                'Event results with placement and record',
                                'ELO / ranking history over time',
                                'Head-to-head records vs opponents',
                                'Deck used per event with performance breakdown',
                            ]}
                        />
                    </TabsContent>

                    {/* ── Wishlist ─────────────────────────────────────── */}
                    <TabsContent value="wishlist">
                        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Acquisition List</div>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)' }}>
                                    Wishlist
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {wishlist.length > 0 && (
                                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.14em' }}>
                                        {wishlist.length} {wishlist.length === 1 ? 'card' : 'cards'}
                                    </div>
                                )}
                                <a
                                    href="/cards"
                                    className="ts-btn ts-btn-primary ts-btn-sm"
                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    + Browse Cards
                                </a>
                            </div>
                        </div>

                        {isPageLoading ? (
                            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--ts-ink-3)', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.16em' }}>
                                LOADING…
                            </div>
                        ) : wishlist.length === 0 ? (
                            <div
                                style={{
                                    border: '1px solid var(--ts-line)',
                                    padding: '64px 32px',
                                    textAlign: 'center',
                                    background: 'var(--ts-bg-2)',
                                }}
                            >
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    Nothing on the list yet.
                                </div>
                                <p style={{ color: 'var(--ts-ink-3)', fontSize: 13, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                                    Browse the card catalogue and add cards you're hunting to your wishlist.
                                </p>
                                <a
                                    href="/cards"
                                    className="ts-btn ts-btn-primary"
                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    Browse Cards →
                                </a>
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                    gap: 12,
                                }}
                            >
                                {wishlist.map(item => (
                                    <WishlistCard
                                        key={item.card.id}
                                        item={item}
                                        onRemove={handleRemoveFromWishlist}
                                    />
                                ))}
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