import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { MainNav } from "@/components/main-nav";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { DeckProvider } from "@/lib/deck-context";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={cn(inter.className, "antialiased bg-background text-foreground")}>
        <AuthProvider>
          <DeckProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              {/* Single main layout container */}
              <div className="relative flex min-h-screen flex-col">
                <MainNav />
                <main className="flex-1 w-full overflow-x-hidden">
                  {children}
                </main>
              </div>
              <Toaster />
            </ThemeProvider>
          </DeckProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
