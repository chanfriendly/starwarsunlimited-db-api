"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import { Menu, X, Search } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

export function MainNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)

  // Navigation links definition for reusability
  const navLinks = [
    {
      href: "/deck-builder",
      label: "Deck Builder",
      active: pathname === "/deck-builder",
    },
    {
      href: "/cards",
      label: "Cards",
      active: pathname === "/cards",
    },
    {
      href: "/decks",
      label: "Decks",
      active: pathname === "/decks",
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/50 bg-black/80 backdrop-blur-sm">
      <div className="container flex h-14 items-center px-4 sm:px-6">
        {/* Logo and desktop navigation */}
        <div className="flex items-center mr-4">
          <Link href="/" className="mr-6 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-black font-bold text-xs">TS</span>
            </div>
            <span className="font-bold text-white hidden sm:inline-block text-shadow-sm">Twin Suns</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  link.active
                    ? "text-white after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-primary relative"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        
        {/* Mobile Navigation Trigger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="h-5 w-5 text-white" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-black/95 border-zinc-800">
            <Link href="/" className="flex items-center gap-2 mb-8" onClick={() => setIsOpen(false)}>
              <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center">
                <span className="text-black font-bold text-sm">TS</span>
              </div>
              <span className="font-bold text-xl text-white">Twin Suns</span>
            </Link>
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "text-base font-medium px-2 py-1.5 rounded-md transition-colors",
                    link.active
                      ? "bg-zinc-800/50 text-white"
                      : "text-muted-foreground hover:bg-zinc-800/30 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        
        {/* Search and User Components */}
        <div className="flex flex-1 items-center justify-end space-x-2">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Button variant="outline" className="w-full justify-start text-white bg-zinc-900/50 border-zinc-700/30 hover:bg-zinc-800/70">
              <Search className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline-flex">Search cards...</span>
              <span className="inline-flex sm:hidden">Search...</span>
              <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
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
