"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import { 
  Menu, X, Search, 
  Swords, Book, Bookmark, 
  Users, PanelRight
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"

export function MainNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)

  // Navigation links definition for reusability
  const navLinks = [
    {
      href: "/deck-builder",
      label: "Deck Builder",
      active: pathname === "/deck-builder",
      icon: <Swords className="h-4 w-4 mr-2" />
    },
    {
      href: "/cards",
      label: "Card Browser",
      active: pathname === "/cards",
      icon: <Book className="h-4 w-4 mr-2" />
    },
    {
      href: "/my-decks",
      label: "My Decks",
      active: pathname === "/my-decks",
      icon: <Bookmark className="h-4 w-4 mr-2" />
    },
    {
      href: "/community",
      label: "Community",
      active: pathname === "/community",
      icon: <Users className="h-4 w-4 mr-2" />
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/50 bg-black/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center px-4 sm:px-6">
        {/* Logo and desktop navigation */}
        <div className="flex items-center mr-4">
          <Link href="/" className="mr-6 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
              <span className="text-black font-bold text-sm">TS</span>
            </div>
            <span className="font-bold text-white hidden sm:inline-block text-shadow-sm text-lg">Twin Suns</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center text-sm font-medium transition-colors hover:text-primary",
                  link.active
                    ? "text-white after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-primary relative"
                    : "text-muted-foreground"
                )}
              >
                {link.icon}
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
            <div className="flex flex-col h-full">
              <Link href="/" className="flex items-center gap-2 mb-8" onClick={() => setIsOpen(false)}>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <span className="text-black font-bold text-sm">TS</span>
                </div>
                <span className="font-bold text-xl text-white">Twin Suns</span>
              </Link>
              
              {/* Mobile Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search cards..." 
                  className="pl-9 bg-zinc-900/70 border-zinc-700/50"
                />
              </div>
              
              <nav className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "flex items-center text-base font-medium px-3 py-2 rounded-md transition-colors",
                        link.active
                          ? "bg-zinc-800/70 text-white"
                          : "text-muted-foreground hover:bg-zinc-800/40 hover:text-white"
                      )}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              
              <div className="mt-auto pt-4 border-t border-zinc-800/50">
                <UserNav />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Search and User Components */}
        <div className="flex flex-1 items-center justify-end space-x-4">
          <div className="relative hidden md:flex w-full max-w-sm items-center">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search cards..." 
              className="pl-9 bg-zinc-900/70 border-zinc-700/50 w-full"
            />
          </div>
          <UserNav />
        </div>
      </div>
    </header>
  )
}
