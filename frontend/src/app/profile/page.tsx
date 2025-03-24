'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    BookOpen,
    Library, // Changed from Cards to Library
    LayoutDashboard,
    Users,
    UserCircle,
    PlusCircle,
    Edit,
    Trash2,
    Search,
    ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ApiCard as CardType } from '@/lib/api';

// Types for our user profile data
interface Deck {
    id: string;
    name: string;
    leaders: Leader[];
    base?: CardType;
    aspects: string[];
    cardCount: number;
    lastUpdated: string;
}

interface Leader {
    id: string;
    name: string;
    imageUrl: string;
}

interface CollectionCard {
    id: string;
    card: CardType;
    count: number;
}

interface UserProfile {
    id: string;
    username: string;
    avatarUrl: string;
    createdAt: string;
    decks: Deck[];
    collection: CollectionCard[];
}

// Mock data (replace with actual API call)
const mockUserProfile: UserProfile = {
    id: '1',
    username: 'GalacticGamer77',
    avatarUrl: 'https://placehold.co/100x100/EEE/31343C?text=GG&font=Montserrat',
    createdAt: '2023-01-15',
    decks: [
        {
            id: '1',
            name: 'Vader Command',
            leaders: [
                {
                    id: '1',
                    name: 'Darth Vader',
                    imageUrl: 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-001.webp'
                },
                {
                    id: '2', 
                    name: 'Grand Moff Tarkin',
                    imageUrl: 'https://placehold.co/200x300/EEE/31343C?text=Tarkin&font=Montserrat'
                }
            ],
            aspects: ['Command', 'Villainy'],
            cardCount: 40,
            lastUpdated: '2025-03-21',
        },
        {
            id: '2',
            name: 'Luke Force',
            leaders: [
                {
                    id: '3',
                    name: 'Luke Skywalker',
                    imageUrl: 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-012.webp'
                },
                {
                    id: '4', 
                    name: 'Obi-Wan Kenobi',
                    imageUrl: 'https://placehold.co/200x300/EEE/31343C?text=Obi-Wan&font=Montserrat'
                }
            ],
            aspects: ['Heroism', 'Force'],
            cardCount: 40,
            lastUpdated: '2025-03-20',
        },
        {
            id: '3',
            name: 'Leia Command',
            leaders: [
                {
                    id: '5',
                    name: 'Leia Organa',
                    imageUrl: 'https://placehold.co/200x300/EEE/31343C?text=Leia&font=Montserrat'
                },
                {
                    id: '6', 
                    name: 'Han Solo',
                    imageUrl: 'https://placehold.co/200x300/EEE/31343C?text=Han&font=Montserrat'
                }
            ],
            aspects: ['Command', 'Heroism'],
            cardCount: 40,
            lastUpdated: '2025-03-18',
        },
    ],
    collection: [
        {
            id: '1',
            card: {
                id: '1',
                name: 'Darth Vader',
                type: 'Leader',
                aspects: [{ aspect_name: 'Command', aspect_color: '#ff0000' }, { aspect_name: 'Villainy', aspect_color: '#000000' }],
                image_uri: 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-001.webp',
                image_url: 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-001.webp', // Support both property names
                text: 'Villainous. After you play a card, deal 1 damage to target undefeated unit.',
                energy_cost: 5,
                cost: 5, // Support both property names
                attack: 5,
                power: 5, // Support both property names
                health: 5,
                set_name: 'Core Set',
                set_code: 'SWU01',
                card_number: '001',
                // Removed rarity as it's not in our Card type
            },
            count: 1
        },
        {
            id: '2',
            card: {
                id: '2',
                name: 'Luke Skywalker',
                type: 'Leader',
                aspects: [{ aspect_name: 'Heroism', aspect_color: '#3366ff' }, { aspect_name: 'Force', aspect_color: '#9933ff' }],
                image_uri: 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-012.webp',
                image_url: 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-012.webp', // Support both property names
                text: 'Valiant. After an opponent plays a card, heal 1 damage from target undefeated unit.',
                energy_cost: 5,
                cost: 5, // Support both property names
                attack: 3,
                power: 3, // Support both property names
                health: 5,
                set_name: 'Core Set',
                set_code: 'SWU01',
                card_number: '012',
                // Removed rarity as it's not in our Card type
            },
            count: 1
        },
        {
            id: '3',
            card: {
                id: '3',
                name: 'Rebel Trooper',
                type: 'Unit',
                aspects: [{ aspect_name: 'Command', aspect_color: '#ff0000' }],
                image_uri: 'https://placehold.co/200x300/EEE/31343C?text=Trooper&font=Montserrat',
                text: 'Deploy: Draw a card if you control a Leader.',
                energy_cost: 2,
                attack: 1,
                health: 3,
                set_name: 'Core Set',
                card_number: '048',
                // Removed rarity as it's not in our Card type
            },
            count: 3
        },
        {
            id: '4',
            card: {
                id: '4',
                name: 'Stormtrooper',
                type: 'Unit',
                aspects: [{ aspect_name: 'Command', aspect_color: '#ff0000' }],
                image_uri: 'https://placehold.co/200x300/EEE/31343C?text=Storm&font=Montserrat',
                text: 'Deploy: Deal 1 damage to target unit.',
                energy_cost: 3,
                attack: 2,
                health: 2,
                set_name: 'Core Set',
                card_number: '050',
                // Removed rarity as it's not in our Card type
            },
            count: 4
        },
        {
            id: '5',
            card: {
                id: '5',
                name: 'Force Lightning',
                type: 'Event',
                aspects: [{ aspect_name: 'Villainy', aspect_color: '#000000' }, { aspect_name: 'Force', aspect_color: '#9933ff' }],
                image_uri: 'https://placehold.co/200x300/EEE/31343C?text=Lightning&font=Montserrat',
                text: 'Deal 3 damage to target character.',
                energy_cost: 2,
                set_name: 'Core Set',
                card_number: '075',
                // Removed rarity as it's not in our Card type
            },
            count: 2
        },
        {
            id: '6',
            card: {
                id: '6',
                name: 'Lightsaber',
                type: 'Upgrade',
                aspects: [{ aspect_name: 'Force', aspect_color: '#9933ff' }],
                image_uri: 'https://placehold.co/200x300/EEE/31343C?text=Saber&font=Montserrat',
                text: 'Equipped unit gets +2/+0.',
                energy_cost: 2,
                set_name: 'Core Set',
                card_number: '082',
                // Removed rarity as it's not in our Card type
            },
            count: 2
        },
    ]
};

// Component to display a single deck
const DeckCard = ({ deck }: { deck: Deck }) => {
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
                        {deck.cardCount} Cards
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-2">
                        {deck.leaders.map((leader) => (
                            <div key={leader.id} className="w-12 h-12 relative rounded-full overflow-hidden border border-gray-700">
                                <img 
                                    src={leader.imageUrl} 
                                    alt={leader.name}
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {deck.aspects.map((aspect) => {
                            // Define a color map for aspects
                            const aspectColorMap: Record<string, string> = {
                                'Command': 'border-red-600 bg-red-900/20 text-red-400',
                                'Heroism': 'border-blue-600 bg-blue-900/20 text-blue-400',
                                'Villainy': 'border-gray-600 bg-gray-900/40 text-gray-300',
                                'Force': 'border-purple-600 bg-purple-900/20 text-purple-400',
                                'Cunning': 'border-amber-600 bg-amber-900/20 text-amber-400',
                                'Aggression': 'border-orange-600 bg-orange-900/20 text-orange-400',
                            };
                            
                            return (
                                <Badge
                                    key={aspect}
                                    variant="outline"
                                    className={cn("text-xs border", aspectColorMap[aspect] || "border-gray-600 bg-gray-900/50 text-gray-300")}
                                >
                                    {aspect}
                                </Badge>
                            );
                        })}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                        Last Updated: {deck.lastUpdated}
                    </div>
                    <Button
                        variant="outline"
                        className="mt-4 w-full bg-gray-900/50 text-gray-300 border-gray-700 hover:bg-purple-500 hover:text-white
                                hover:border-purple-500 transition-colors duration-200"
                        asChild
                    >
                        <Link href={`/deck-builder/${deck.id}`}>
                            View Deck <ChevronRight className="ml-2 w-4 h-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    );
};

// Component to display a single card in a collection
const CollectionCard = ({ collectionCard }: { collectionCard: CollectionCard }) => {
    const { card, count } = collectionCard;
    
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="group"
        >
            <Card className="bg-gray-800 border-gray-700 hover:border-purple-500 transition-colors duration-200
                       hover:shadow-lg hover:shadow-purple-500/20 flex flex-col h-full">
                <CardHeader className="p-2">
                    <div className="aspect-[2/3] relative rounded-lg overflow-hidden border border-gray-700">
                        <img
                            src={card.image_uri}
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
                    <Badge
                        variant="secondary"
                        className="mt-2 self-start bg-gray-700 text-gray-300 border-gray-600 group-hover:bg-purple-500 group-hover:text-white
                               group-hover:border-purple-500 transition-colors duration-200"
                    >
                        x{count}
                    </Badge>
                </CardContent>
            </Card>
        </motion.div>
    );
};

const UserProfilePage = () => {
    const [userProfile, setUserProfile] = useState<UserProfile>(mockUserProfile);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('decks'); // 'decks', 'collection', etc.
    const [formData, setFormData] = useState({
        username: userProfile.username,
    });

    // Simulate fetching user data
    useEffect(() => {
        // In a real implementation, fetch from the API
        // Example: getUserProfile(userId).then(data => setUserProfile(data));
        setUserProfile(mockUserProfile);
        setFormData({ username: mockUserProfile.username });
    }, []);

    // Handlers for editing profile
    const handleEditProfile = () => {
        setIsEditing(true);
    };
    
    const handleSaveProfile = () => {
        // In a real implementation, send update to the API
        // Example: updateUserProfile(userId, formData).then(() => {
        setUserProfile({
            ...userProfile,
            username: formData.username,
        });
        setIsEditing(false);
        // });
    };
    
    const handleCancelEdit = () => {
        setFormData({ username: userProfile.username });
        setIsEditing(false);
    };
    
    const handleDeleteDeck = (deckId: string) => {
        // In a real implementation, send delete request to the API
        // Example: deleteDeck(deckId).then(() => {
        setUserProfile({
            ...userProfile,
            decks: userProfile.decks.filter((deck) => deck.id !== deckId),
        });
        // });
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
    const filteredCollection = userProfile.collection.filter((item) =>
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
                                <span>Member Since: {new Date(userProfile.createdAt).toLocaleDateString()}</span>
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
                        {userProfile.decks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {userProfile.decks.map((deck) => (
                                    <div key={deck.id} className="relative">
                                        <DeckCard deck={deck} />
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
                            <div className="text-gray-400 text-center py-8">
                                You haven't created any decks yet. Click "Create Deck" to get started!
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="collection">
                        <div className="mb-8 flex justify-between items-start">
                            <h2 className="text-2xl font-semibold">My Collection</h2>
                            <div className="flex gap-2 items-center">
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
                        {filteredCollection.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filteredCollection.map((collectionCard) => (
                                    <CollectionCard key={collectionCard.id} collectionCard={collectionCard} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-center py-8">
                                {searchTerm
                                    ? `No cards found matching "${searchTerm}".`
                                    : "Your collection is empty. Add cards to your collection!"}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default UserProfilePage;