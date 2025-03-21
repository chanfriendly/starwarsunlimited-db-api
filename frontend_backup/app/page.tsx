import React from 'react';
import { Button } from "@/components/ui/button"
import { motion } from 'framer-motion';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    LayoutDashboard,
    Swords,
    Database,
    Users,
    ChevronRight,
    Zap,
    Sparkles
} from 'lucide-react';
import { cn } from "@/lib/utils"

// Placeholder image since Next.js Image component isn't directly usable here
const backgroundImage = "https://placehold.co/1920x1080/000/FFF?text=Star+Wars+Unlimited+Background&font=Montserrat";

// Feature data for maintainability
const features = [
    {
        title: "Card Browser",
        description: "Explore every card in Star Wars Unlimited with powerful search and filtering.",
        icon: LayoutDashboard,
        href: "/cards",
    },
    {
        title: "Deck Builder",
        description: "Craft your winning strategies with our intuitive deck building tool.",
        icon: Swords,
        href: "/deck-builder",
    },
    {
        title: "Card Database",
        description: "Dive deep into card details, including aspects, keywords, and traits.",
        icon: Database,
        href: "/cards",
    },
    {
        title: "Community Hub",
        description: "Connect with other players, share decks, and discuss strategies.",
        icon: Users,
        href: "/community",
    },
];

// Animation variants
const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeInOut" } },
    hover: { scale: 1.03, boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)", transition: { duration: 0.2 } },
};

export const metadata = {
    title: "Twin Suns Deck Builder",
    description: "Deck builder for Star Wars Unlimited TCG",
};

const Home = () => {
    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <section className="relative flex flex-col items-center justify-center min-h-[600px] py-16">
                {/* Background Image (Placeholder) */}
                <div className="absolute inset-0">
                    <img
                        src={backgroundImage}
                        alt="Star Wars Unlimited landscape"
                        className="object-cover w-full h-full"
                        style={{
                            mixBlendMode: 'overlay',
                            opacity: 0.75,
                            filter: 'brightness(80%)', // Slightly darken the image
                        }}
                    />
                    {/* Darkening Overlay */}
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <div className="relative z-10 text-center space-y-6">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-white"
                    >
                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">Twin Suns</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeInOut", delay: 0.3 }}
                        className="max-w-3xl mx-auto text-lg sm:text-xl text-gray-200"
                    >
                        The ultimate resource for Star Wars Unlimited players.  Build, share, and discover.
                    </motion.p>
                    <div className="flex gap-4 justify-center">
                        <Button
                            asChild
                            size="lg"
                            className="bg-gradient-to-r from-orange-500 to-purple-500 text-white
                                      hover:from-orange-600 hover:to-purple-600 shadow-lg
                                      transition-all duration-300 transform hover:scale-105
                                      flex items-center gap-2"
                        >
                            <a href="/deck-builder">
                                <Zap className="w-5 h-5" /> Start Building
                            </a>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="text-white border-gray-300 hover:bg-white/10
                                      transition-colors duration-200 flex items-center gap-2"
                        >
                            <a href="/cards">
                                <Sparkles className="w-5 h-5" /> Browse Cards
                            </a>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Feature Section */}
            <section className="py-16 bg-muted/50 backdrop-blur-sm">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12 text-white">Key Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <motion.div
                                    key={feature.title}
                                    variants={cardVariants}
                                    initial="hidden"
                                    animate="visible"
                                    whileHover="hover"
                                >
                                    <Card
                                        className={cn(
                                            "group transition-all duration-300",
                                            "border-gray-700 bg-black/50 hover:bg-black/70",
                                            "hover:shadow-lg hover:shadow-purple-500/20"
                                        )}
                                    >
                                        <CardHeader>
                                            <div className="flex items-center gap-2">
                                                <Icon className="w-6 h-6 text-purple-400" />
                                                <CardTitle className="text-xl font-semibold text-white">
                                                    {feature.title}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="text-gray-300 mb-4">
                                                {feature.description}
                                            </CardDescription>
                                            <Button
                                                asChild
                                                variant="link"
                                                className="p-0 text-purple-300 hover:text-purple-200
                                                        transition-colors duration-200 font-medium
                                                        flex items-center gap-1"
                                            >
                                                <a href={feature.href}>
                                                    Learn More <ChevronRight className="w-4 h-4" />
                                                </a>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Statistics Section */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12 text-white">
                        Community Stats
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                        <Card className="bg-black/50 border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-4xl font-bold text-purple-400">891</CardTitle>
                                <CardDescription className="text-gray-300">Total Cards</CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-black/50 border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-4xl font-bold text-purple-400">6</CardTitle>
                                <CardDescription className="text-gray-300">Aspects</CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-black/50 border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-4xl font-bold text-purple-400">12</CardTitle>
                                <CardDescription className="text-gray-300">Card Types</CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-black/50 border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-4xl font-bold text-purple-400">3</CardTitle>
                                <CardDescription className="text-gray-300">Sets Released</CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
