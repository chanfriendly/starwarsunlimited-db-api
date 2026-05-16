'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SavedDeck, deleteUserDeck } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetch-utils';

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
        aspects?: Array<{ aspect_name: string; aspect_color?: string }>;
    };
    count: number;
    in_collection?: boolean;
}

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

const defaultUserProfile: UserProfileData = {
    id: '',
    username: '',
    createdAt: '',
};

// ── DeckCard ────────────────────────────────────────────────────────────────

function DeckCard({ deck, onDelete }: { deck: SavedDeck; onDelete: (id: string) => void }) {
    const deckAspects = new Set<string>();
    if (deck.leaders && Array.isArray(deck.leaders)) {
        deck.leaders.forEach(leader => {
            if (leader?.aspects) leader.aspects.forEach(a => { if (a?.aspect_name) deckAspects.add(a.aspect_name); });
        });
    }
    if (deck.base?.aspects) {
        deck.base.aspects.forEach(a => { if (a?.aspect_name) deckAspects.add(a.aspect_name); });
    }

    const totalCards = deck.cards ? deck.cards.reduce((sum, item) => sum + item.quantity, 0) : 0;
    const formattedDate = deck.updated_at
        ? (new Date(deck.updated_at).getTime() > 0 ? new Date(deck.updated_at).toLocaleDateString() : 'Recently')
        : 'Recently';

    return (
        <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Title + card count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink)', lineHeight: 1.2 }}>
                    {deck.name}
                </div>
                <div className="ts-chip" style={{ flexShrink: 0 }}>{totalCards} cards</div>
            </div>

            {/* Leader thumbnails */}
            {deck.leaders && deck.leaders.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {deck.leaders.map(leader => (
                        <div key={leader.id} style={{ width: 40, height: 40, overflow: 'hidden', border: '1px solid var(--ts-line-2)', flexShrink: 0 }}>
                            <img
                                src={leader.image_uri || leader.image_url || ''}
                                alt={leader.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Aspect pips */}
            {deckAspects.size > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Array.from(deckAspects).map(aspect => (
                        <span key={aspect} className="ts-aspect-pip" data-aspect={aspect} title={aspect}>
                            {aspect[0]}
                        </span>
                    ))}
                </div>
            )}

            {/* Date */}
            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Updated {formattedDate}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Link
                    href={`/decks/${deck.id}`}
                    className="ts-btn ts-btn-sm"
                    style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
                >
                    View Deck →
                </Link>
                <button
                    onClick={() => onDelete(deck.id)}
                    className="ts-btn ts-btn-sm"
                    style={{ borderColor: 'var(--ts-red)', color: 'var(--ts-red)' }}
                    title="Delete deck"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// ── CollectionCard ──────────────────────────────────────────────────────────

function CollectionCard({
    collectionItem,
    onAddToCollection,
}: {
    collectionItem: CollectionItem;
    onAddToCollection: (cardId: string, quantity?: number) => Promise<void>;
}) {
    const { card, count, in_collection = false } = collectionItem;

    return (
        <div style={{
            background: 'var(--ts-panel)',
            border: '1px solid var(--ts-line)',
            opacity: in_collection ? 1 : 0.55,
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                <img
                    src={card.image_uri || card.image_url || ''}
                    alt={card.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
            </div>

            <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{
                    fontFamily: 'var(--ts-font-display)', fontSize: 11, color: 'var(--ts-ink)',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', lineHeight: 1.3,
                }}>
                    {card.name}
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'var(--ts-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {card.type}
                </div>
                {card.aspects && card.aspects.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {card.aspects.map(a => (
                            <span key={a.aspect_name} className="ts-aspect-pip" data-aspect={a.aspect_name} title={a.aspect_name} style={{ width: 14, height: 14, fontSize: 7 }}>
                                {a.aspect_name[0]}
                            </span>
                        ))}
                    </div>
                )}
                {in_collection ? (
                    <div className="ts-chip" style={{ alignSelf: 'flex-start', fontSize: 9, marginTop: 'auto' }}>×{count}</div>
                ) : (
                    <button
                        className="ts-btn ts-btn-sm"
                        style={{ fontSize: 8, padding: '4px 8px', marginTop: 'auto' }}
                        onClick={() => onAddToCollection(card.id)}
                    >
                        + Add
                    </button>
                )}
            </div>
        </div>
    );
}

// ── ComingSoonPanel ─────────────────────────────────────────────────────────

function ComingSoonPanel({ title, description, features }: { title: string; description: string; features: string[] }) {
    return (
        <div style={{ position: 'relative', minHeight: 400, border: '1px solid var(--ts-line)', background: 'var(--ts-panel)', overflow: 'hidden' }}>
            {/* Ghost preview */}
            <div style={{ padding: 32, opacity: 0.12, pointerEvents: 'none', userSelect: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} style={{ height: 96, background: 'var(--ts-panel-2)', border: '1px solid var(--ts-line-2)' }} />
                    ))}
                </div>
            </div>

            {/* Overlay */}
            <div style={{
                position: 'absolute', inset: 0, background: 'rgba(26,22,17,0.90)',
                backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center',
            }}>
                <div style={{
                    fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.28em',
                    textTransform: 'uppercase', color: 'var(--ts-amber)', border: '1.5px solid var(--ts-amber)',
                    padding: '4px 14px', marginBottom: 24, transform: 'rotate(-1deg)', opacity: 0.9,
                }}>
                    Coming Soon
                </div>

                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 32, color: 'var(--ts-ink)', marginBottom: 12, letterSpacing: '0.02em' }}>
                    {title}
                </div>

                <p style={{ color: 'var(--ts-ink-2)', fontSize: 14, lineHeight: 1.7, maxWidth: 540, margin: '0 0 28px' }}>
                    {description}
                </p>

                <div style={{ border: '1px solid var(--ts-line-2)', padding: '16px 24px', textAlign: 'left', maxWidth: 480, width: '100%' }}>
                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                        Planned Features
                    </div>
                    {features.map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-2)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--ts-amber)', flexShrink: 0, marginTop: 1 }}>◈</span>
                            {f}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── WishlistCard ────────────────────────────────────────────────────────────

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
        <div style={{ background: bg, border: '1px solid var(--ts-line-2)', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
            <div style={{ aspectRatio: '5/7', position: 'relative', overflow: 'hidden' }}>
                {card.image_uri ? (
                    <img src={card.image_uri} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'rgba(255,255,255,0.15)' }}>{card.name[0]}</span>
                    </div>
                )}
                <button
                    onClick={() => onRemove(card.id)}
                    style={{
                        position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                        background: 'rgba(10,8,4,0.82)', border: '1px solid rgba(255,255,255,0.2)',
                        color: 'var(--ts-red)', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1,
                    }}
                    title="Remove from wishlist"
                >
                    ✕
                </button>
            </div>

            <div style={{ padding: '6px 8px', background: 'rgba(20,16,10,0.92)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{
                    fontFamily: 'var(--ts-font-display)', fontSize: 11, color: '#e8dcc4',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', lineHeight: 1.3,
                }}>
                    {card.name}
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                    {card.type}
                </div>
            </div>
        </div>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────

const UserProfilePage = () => {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();

    const [decks, setDecks] = useState<SavedDeck[]>([]);
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfileData>(user ? {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at || defaultUserProfile.createdAt,
    } : defaultUserProfile);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('decks');
    const [formData, setFormData] = useState({ username: userProfile.username });
    const [error, setError] = useState<string | null>(null);
    const [showAllCards, setShowAllCards] = useState(false);

    const loadData = async () => {
        setIsPageLoading(true);
        setError(null);

        try {

            let decksData = [];
            let collectionData = [];

            try {
                const fetchedDecks = await fetchWithAuth(`/api/decks`);
                if (Array.isArray(fetchedDecks)) {
                    decksData = fetchedDecks;

                } else if (fetchedDecks && typeof fetchedDecks === 'object' && fetchedDecks.detail) {

                    setError(fetchedDecks.detail);
                } else {

                    setError('Unexpected response format from server');
                }
            } catch (deckError) {
                console.error('[Profile] Error fetching decks:', deckError);
            }

            try {
                const collectionUrl = `/api/me/collection${showAllCards ? '?all_cards=true' : ''}`;
                const collectionResponse = await fetch(collectionUrl);
                if (collectionResponse.ok) {
                    collectionData = await collectionResponse.json();

                } else if (collectionResponse.status === 401) {

                    setError('Authentication required');
                } else {

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

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            loadData();
        }
    }, [isAuthenticated, authLoading, showAllCards]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (user) {
            setUserProfile({
                id: user.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                createdAt: user.created_at || defaultUserProfile.createdAt,
            });
            setFormData({ username: user.username });
        }
    }, [user]);

    const handleEditProfile = () => setIsEditing(true);
    const handleSaveProfile = () => {
        setUserProfile({ ...userProfile, username: formData.username });
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
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

    const handleAddToCollection = async (cardId: string, quantity: number = 1) => {
        try {
            await fetchWithAuth('/api/me/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ card_id: cardId, count: quantity }),
            });
            loadData();
        } catch (err) {
            console.error('Error updating collection:', err);
        }
    };

    const filteredCollection = collection.filter(item =>
        item.card.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const ownedCount = collection.filter(item => item.in_collection).length;
    const totalCount = collection.length;
    const completionPct = totalCount > 0 ? ((ownedCount / totalCount) * 100).toFixed(1) : null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--ts-bg)' }}>

            {/* ── Profile Header ─────────────────────────────────────── */}
            <header style={{ background: 'var(--ts-panel)', borderBottom: '1px solid var(--ts-line)' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

                        {/* Avatar square */}
                        <div style={{ width: 56, height: 56, background: 'var(--ts-bg-3)', border: '1px solid var(--ts-line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--ts-font-display)', fontSize: 22, color: 'var(--ts-amber)' }}>
                                {userProfile.username.substring(0, 2).toUpperCase()}
                            </span>
                        </div>

                        {/* Name + member since */}
                        <div>
                            {isEditing ? (
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    className="ts-input"
                                    style={{ fontSize: 18, padding: '4px 10px', width: 'auto' }}
                                />
                            ) : (
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
                                    {userProfile.username}
                                </div>
                            )}
                            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 4 }}>
                                Member Since {new Date(userProfile.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Collection completion stat */}
                        {completionPct !== null && (
                            <div style={{ marginLeft: 8, padding: '10px 18px', background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', display: 'flex', flexDirection: 'column', gap: 2 }}>
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

                    {/* Edit controls */}
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleSaveProfile} className="ts-btn ts-btn-sm" style={{ borderColor: 'var(--ts-green)', color: 'var(--ts-green)' }}>
                                Save
                            </button>
                            <button onClick={handleCancelEdit} className="ts-btn ts-btn-sm">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleEditProfile} className="ts-btn ts-btn-sm">
                            Edit Profile
                        </button>
                    )}
                </div>
            </header>

            {/* ── Main Content ───────────────────────────────────────── */}
            <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
                <Tabs defaultValue="decks" className="w-full" onValueChange={setSelectedTab}>

                    <TabsList className="ts-tabs-list" style={{ marginBottom: 32 }}>
                        <TabsTrigger value="decks" className="ts-tab-trigger">My Decks</TabsTrigger>
                        <TabsTrigger value="collection" className="ts-tab-trigger">My Collection</TabsTrigger>
                        <TabsTrigger value="achievements" className="ts-tab-trigger">Achievements</TabsTrigger>
                        <TabsTrigger value="tournaments" className="ts-tab-trigger">Tournaments</TabsTrigger>
                        <TabsTrigger value="wishlist" className="ts-tab-trigger">Wishlist</TabsTrigger>
                    </TabsList>

                    {/* ── Decks ──────────────────────────────────────── */}
                    <TabsContent value="decks">
                        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Command Center</div>
                                <h2>My Decks</h2>
                            </div>
                            <Link href="/deck-builder" className="ts-btn ts-btn-primary ts-btn-sm" style={{ textDecoration: 'none' }}>
                                + New Deck
                            </Link>
                        </div>

                        {error && selectedTab === 'decks' ? (
                            <div style={{ border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.07)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ts-red)' }}>Error</div>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-ink-2)' }}>{error}</div>
                                <button onClick={loadData} className="ts-btn ts-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Retry</button>
                            </div>
                        ) : isPageLoading ? (
                            <div style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ts-ink-3)' }}>
                                LOADING…
                            </div>
                        ) : decks.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                                {decks.map(deck => (
                                    <DeckCard key={deck.id} deck={deck} onDelete={handleDeleteDeck} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ border: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)', padding: '64px 32px', textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    No decks yet.
                                </div>
                                <p style={{ color: 'var(--ts-ink-3)', fontSize: 13, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                                    Build your first Twin Suns deck to get started.
                                </p>
                                <Link href="/deck-builder" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
                                    Build a Deck →
                                </Link>
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Collection ─────────────────────────────────── */}
                    <TabsContent value="collection">
                        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Inventory</div>
                                <h2>My Collection</h2>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Show-all toggle */}
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--ts-font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ts-ink-3)' }}>
                                    <input
                                        type="checkbox"
                                        checked={showAllCards}
                                        onChange={e => setShowAllCards(e.target.checked)}
                                        style={{ accentColor: 'var(--ts-amber)', width: 14, height: 14 }}
                                    />
                                    Show All Cards
                                </label>

                                <input
                                    type="text"
                                    placeholder="Search collection…"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="ts-input"
                                    style={{ width: 220, padding: '7px 12px', fontSize: 13 }}
                                />

                                <Link href="/cards" className="ts-btn ts-btn-primary ts-btn-sm" style={{ textDecoration: 'none' }}>
                                    + Add Cards
                                </Link>
                            </div>
                        </div>

                        {error && selectedTab === 'collection' ? (
                            <div style={{ border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.07)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ts-red)' }}>Error</div>
                                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 12, color: 'var(--ts-ink-2)' }}>{error}</div>
                                <button onClick={loadData} className="ts-btn ts-btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Retry</button>
                            </div>
                        ) : isPageLoading ? (
                            <div style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ts-ink-3)' }}>
                                LOADING…
                            </div>
                        ) : filteredCollection.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                                {filteredCollection.map(item => (
                                    <CollectionCard
                                        key={item.card.id}
                                        collectionItem={item}
                                        onAddToCollection={handleAddToCollection}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{ border: '1px solid var(--ts-line)', background: 'var(--ts-bg-2)', padding: '64px 32px', textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    {searchTerm ? `No cards matching "${searchTerm}".` : 'Collection is empty.'}
                                </div>
                                {!searchTerm && (
                                    <Link href="/cards" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
                                        Browse Cards →
                                    </Link>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Achievements — Coming Soon ──────────────────── */}
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

                    {/* ── Tournaments — Coming Soon ───────────────────── */}
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
                                <h2>Wishlist</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {wishlist.length > 0 && (
                                    <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.14em' }}>
                                        {wishlist.length} {wishlist.length === 1 ? 'card' : 'cards'}
                                    </div>
                                )}
                                <Link href="/cards" className="ts-btn ts-btn-primary ts-btn-sm" style={{ textDecoration: 'none' }}>
                                    + Browse Cards
                                </Link>
                            </div>
                        </div>

                        {isPageLoading ? (
                            <div style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'var(--ts-font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ts-ink-3)' }}>
                                LOADING…
                            </div>
                        ) : wishlist.length === 0 ? (
                            <div style={{ border: '1px solid var(--ts-line)', padding: '64px 32px', textAlign: 'center', background: 'var(--ts-bg-2)' }}>
                                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink-3)', marginBottom: 12 }}>
                                    Nothing on the list yet.
                                </div>
                                <p style={{ color: 'var(--ts-ink-3)', fontSize: 13, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                                    Browse the card catalogue and add cards you're hunting to your wishlist.
                                </p>
                                <Link href="/cards" className="ts-btn ts-btn-primary" style={{ textDecoration: 'none' }}>
                                    Browse Cards →
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                                {wishlist.map(item => (
                                    <WishlistCard key={item.card.id} item={item} onRemove={handleRemoveFromWishlist} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                </Tabs>
            </main>
        </div>
    );
};

export default UserProfilePage;
