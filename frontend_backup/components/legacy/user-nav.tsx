"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"

export function UserNav() {
  const { user, logout } = useAuth()

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/auth/login">Sign In</Link>
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled>
          {user.username}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/my-decks" className="w-full">My Decks</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

