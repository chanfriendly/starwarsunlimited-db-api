"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MainNavItems } from "@/components/main-nav-items"
import { UserNav } from "@/components/user-nav"
import { MobileNav } from "@/components/mobile-nav"

export function MainNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Twin Suns</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/deck-builder"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/deck-builder" ? "text-foreground" : "text-foreground/60"
              )}
            >
              Deck Builder
            </Link>
            <Link
              href="/cards"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/cards" ? "text-foreground" : "text-foreground/60"
              )}
            >
              Cards
            </Link>
            <Link
              href="/decks"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/decks" ? "text-foreground" : "text-foreground/60"
              )}
            >
              Decks
            </Link>
          </nav>
        </div>
        <MobileNav />
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">
              <span className="hidden lg:inline-flex">Search cards...</span>
              <span className="inline-flex lg:hidden">Search...</span>
              <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
          <UserNav />
        </div>
      </div>
    </header>
  )
}

