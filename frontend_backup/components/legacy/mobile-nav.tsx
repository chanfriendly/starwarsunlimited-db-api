"use client"

import * as React from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

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
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <div className="px-7">
          <Link
            href="/"
            className="flex items-center"
            onClick={() => setOpen(false)}
          >
            <span className="font-bold">Twin Suns</span>
          </Link>
        </div>
        <div className="flex flex-col space-y-3 px-7 pb-7 pt-4">
          <Link
            href="/deck-builder"
            className="text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Deck Builder
          </Link>
          <Link
            href="/cards"
            className="text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Cards
          </Link>
          <Link
            href="/decks"
            className="text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Decks
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}

