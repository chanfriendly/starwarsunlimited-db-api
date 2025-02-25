import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNav } from "@/components/main-nav"
import type React from "react"
import { Toaster } from "sonner"
import { AuthProvider } from "@/lib/auth-context"
import { DeckProvider } from "@/lib/deck-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Twin Suns Deck Builder",
  description: "Deck builder for Star Wars Unlimited TCG",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen antialiased bg-background")}>
        <AuthProvider>
          <DeckProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <div className="relative flex min-h-screen flex-col">
                <MainNav />
                <main className="flex-1">{children}</main>
              </div>
              <Toaster />
            </ThemeProvider>
          </DeckProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

