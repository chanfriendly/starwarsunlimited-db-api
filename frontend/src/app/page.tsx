// frontend/app/page.tsx

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-24 px-4 md:py-32">
        <h1 className="text-5xl md:text-7xl font-bold mb-4">
          Welcome to <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">Twin Suns</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-10">
          The ultimate resource for Star Wars Unlimited players. Build, share, and discover.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button asChild className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90">
            <Link href="/deck-builder">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Building
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 hover:bg-white/10">
            <Link href="/cards">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              Browse Cards
            </Link>
          </Button>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 px-4 bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card Browser */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-2">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Card Browser</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Explore every card in Star Wars Unlimited with powerful search and filtering.
              </p>
              <Link href="/cards" className="text-purple-400 inline-flex items-center hover:underline">
                Learn More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Deck Builder */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-2">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Deck Builder</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Craft your winning strategies with our intuitive deck building tool.
              </p>
              <Link href="/deck-builder" className="text-purple-400 inline-flex items-center hover:underline">
                Learn More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Card Database */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-2">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Card Database</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Dive deep into card details, including aspects, keywords, and traits.
              </p>
              <Link href="/database" className="text-purple-400 inline-flex items-center hover:underline">
                Learn More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Community Hub */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-2">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Community Hub</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Connect with other players, share decks, and discuss strategies.
              </p>
              <Link href="/community" className="text-purple-400 inline-flex items-center hover:underline">
                Learn More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Community Stats Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Community Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Cards */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
              <h3 className="text-5xl font-bold text-purple-400 mb-2">891</h3>
              <p className="text-gray-400">Total Cards</p>
            </div>
            
            {/* Aspects */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
              <h3 className="text-5xl font-bold text-purple-400 mb-2">6</h3>
              <p className="text-gray-400">Aspects</p>
            </div>
            
            {/* Card Types */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
              <h3 className="text-5xl font-bold text-purple-400 mb-2">12</h3>
              <p className="text-gray-400">Card Types</p>
            </div>
            
            {/* Sets Released */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
              <h3 className="text-5xl font-bold text-purple-400 mb-2">3</h3>
              <p className="text-gray-400">Sets Released</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}