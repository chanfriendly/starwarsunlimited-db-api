import Link from "next/link"
import { cn } from "@/lib/utils"

export function MainNavItems() {
  return (
    <div className="mr-4 hidden md:flex">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <span className="hidden font-bold sm:inline-block">Twin Suns Deck Builder</span>
      </Link>
      <nav className="flex items-center space-x-6 text-sm font-medium">
        <Link href="/deck-builder" className={cn("transition-colors hover:text-foreground/80", "text-foreground")}>
          Deck Builder
        </Link>
        <Link href="/cards" className={cn("transition-colors hover:text-foreground/80", "text-foreground/60")}>
          Cards
        </Link>
        <Link href="/decks" className={cn("transition-colors hover:text-foreground/80", "text-foreground/60")}>
          Decks
        </Link>
        <Link href="/articles" className={cn("transition-colors hover:text-foreground/80", "text-foreground/60")}>
          Articles
        </Link>
      </nav>
    </div>
  )
}

