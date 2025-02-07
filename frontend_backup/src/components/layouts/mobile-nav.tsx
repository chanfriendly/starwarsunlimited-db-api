"use client"

import * as React from "react"
import Link from "next/link"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <nav className="grid gap-6 text-lg font-medium">
          <Link href="/" className="hover:text-foreground/80 transition-colors" onClick={() => setOpen(false)}>
            Home
          </Link>
          <Link
            href="/deck-builder"
            className="hover:text-foreground/80 transition-colors"
            onClick={() => setOpen(false)}
          >
            Deck Builder
          </Link>
          <Link href="/cards" className="hover:text-foreground/80 transition-colors" onClick={() => setOpen(false)}>
            Cards
          </Link>
          <Link href="/decks" className="hover:text-foreground/80 transition-colors" onClick={() => setOpen(false)}>
            Decks
          </Link>
          <Link href="/articles" className="hover:text-foreground/80 transition-colors" onClick={() => setOpen(false)}>
            Articles
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

