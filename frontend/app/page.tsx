import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Layout, Swords, Database, Users } from "lucide-react"

// Feature data for maintainability
const features = [
  {
    title: "Card Browser",
    description: "Browse and search through all Star Wars Unlimited cards with advanced filtering options.",
    icon: Layout,
    href: "/cards"
  },
  {
    title: "Deck Builder",
    description: "Create and save your decks with our intuitive deck building interface.",
    icon: Swords,
    href: "/deck-builder"
  },
  {
    title: "Card Database",
    description: "Access detailed card information, including aspects, keywords, and traits.",
    icon: Database,
    href: "/cards"
  },
  {
    title: "Community",
    description: "Share your decks and strategies with the Star Wars Unlimited community.",
    icon: Users,
    href: "/community"
  }
]

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[600px] px-4">
        {/* Base gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-900 to-purple-900">
          <Image
            src="/hero-background.jpg"
            alt="Star Wars landscape with futuristic buildings"
            className="object-cover w-full h-full mix-blend-overlay opacity-75"
            width={1920}
            height={1080}
            priority
          />
          {/* Darkening overlay for better text contrast */}
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-white mb-6">
            Welcome to Twin Suns
          </h1>
          <p className="max-w-[600px] text-lg text-gray-200 md:text-xl mb-8">
            Build and share your Star Wars Unlimited decks with the community
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" className="text-lg">
              <Link href="/deck-builder">Start Building</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="text-lg">
              <Link href="/cards">Browse Cards</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="w-full py-16 bg-muted/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Link 
                  key={feature.title} 
                  href={feature.href}
                  className="group block p-6 rounded-lg bg-card hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                    <h3 className="text-2xl font-bold">{feature.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="w-full py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="p-6 rounded-lg bg-card">
              <h3 className="text-4xl font-bold text-primary mb-2">891</h3>
              <p className="text-muted-foreground">Total Cards</p>
            </div>
            <div className="p-6 rounded-lg bg-card">
              <h3 className="text-4xl font-bold text-primary mb-2">6</h3>
              <p className="text-muted-foreground">Aspects</p>
            </div>
            <div className="p-6 rounded-lg bg-card">
              <h3 className="text-4xl font-bold text-primary mb-2">12</h3>
              <p className="text-muted-foreground">Card Types</p>
            </div>
            <div className="p-6 rounded-lg bg-card">
              <h3 className="text-4xl font-bold text-primary mb-2">3</h3>
              <p className="text-muted-foreground">Sets Released</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
