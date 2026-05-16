// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Spectral, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spectral = Spectral({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Twin Suns · Star Wars Unlimited",
  description: "Field manual and deck atelier for Star Wars: Unlimited Twin Suns format.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${cormorant.variable} ${spectral.variable} ${jetbrainsMono.variable} antialiased`}
        style={{
          fontFamily: "var(--font-body, 'Spectral', Georgia, serif)",
          background: "var(--ts-bg)",
          color: "var(--ts-ink)",
        }}
      >
        <AuthProvider>
          <Navbar />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
