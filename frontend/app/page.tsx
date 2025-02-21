import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[600px] px-4">
        {/* Hero Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/placeholder.jpg"
            alt="Star Wars Unlimited Hero"
            className="object-cover w-full h-full brightness-[0.3]"
            width={1920}
            height={1080}
            priority
          />
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
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card hover:bg-card/80 transition-colors">
              <h3 className="text-2xl font-bold mb-4">Card Browser</h3>
              <p className="text-muted-foreground">
                Browse and search through all Star Wars Unlimited cards with advanced filtering options.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card hover:bg-card/80 transition-colors">
              <h3 className="text-2xl font-bold mb-4">Deck Builder</h3>
              <p className="text-muted-foreground">
                Create and save your decks with our intuitive deck building interface.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card hover:bg-card/80 transition-colors">
              <h3 className="text-2xl font-bold mb-4">Card Database</h3>
              <p className="text-muted-foreground">
                Access detailed card information, including aspects, keywords, and traits.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card hover:bg-card/80 transition-colors">
              <h3 className="text-2xl font-bold mb-4">Community</h3>
              <p className="text-muted-foreground">
                Share your decks and strategies with the Star Wars Unlimited community.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

