import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full h-[600px] overflow-hidden rounded-b-lg">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Image-qT2dIrqjKza5sIOBhG3Q2Dn7NcDtGa.png"
          alt="Twin suns landscape with purple spires"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-white mb-6">
            Welcome to Twin Suns Deck Builder
          </h1>
          <p className="max-w-[600px] text-lg text-gray-200 md:text-xl dark:text-gray-400 mb-8">
            Build and share your Star Wars Unlimited decks with the community
          </p>
          <div className="flex gap-4">
            <Button asChild size="lg" className="text-lg">
              <Link href="/deck-builder">Deck Builder</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg">
              <Link href="/cards">Browse Cards</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

