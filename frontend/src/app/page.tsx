// src/app/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-32 px-4">
      <h1 className="text-6xl md:text-7xl font-bold mb-6">
        Welcome to{" "}
        <span className="twin-suns-gradient">Twin Suns</span>
      </h1>
        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-12">
          The ultimate resource for Star Wars Unlimited players. Build, share, and discover.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button asChild className="bg-gradient-to-r from-orange-600 to-orange-400 text-white hover:opacity-90 py-6 px-8 text-lg">
            <Link href="/deck-builder">
              <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Building
            </Link>
          </Button>
          <Button asChild className="bg-transparent border border-pink-500 text-pink-500 hover:bg-pink-500/10 py-6 px-8 text-lg">
          <Link href="/cards">
            <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            Browse Cards
          </Link>
        </Button>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="py-16 px-4 bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-white">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card Browser Feature */}
            <Card className="bg-gray-900 border-gray-800 hover:border-purple-500 transition-colors group">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-purple-900/30 flex items-center justify-center mb-4 group-hover:bg-purple-800/50 transition-colors">
                  <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">Card Browser</h3>
                <p className="text-gray-400 mb-4">
                  Explore every card in Star Wars Unlimited with powerful filtering and search capabilities.
                </p>
                <Link href="/cards" className="text-purple-400 inline-flex items-center hover:underline group-hover:text-purple-300">
                  Browse Cards
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </CardContent>
            </Card>

            {/* Deck Builder Feature */}
            <Card className="bg-gray-900 border-gray-800 hover:border-purple-500 transition-colors group">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-purple-900/30 flex items-center justify-center mb-4 group-hover:bg-purple-800/50 transition-colors">
                  <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">Twin Suns Deck Builder</h3>
                <p className="text-gray-400 mb-4">
                  Build your perfect deck for the Twin Suns format with our intuitive deck building tools.
                </p>
                <Link href="/deck-builder" className="text-purple-400 inline-flex items-center hover:underline group-hover:text-purple-300">
                  Build a Deck
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </CardContent>
            </Card>

            {/* AI Companion Feature */}
            <Card className="bg-gray-900 border-gray-800 hover:border-purple-500 transition-colors group">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-purple-900/30 flex items-center justify-center mb-4 group-hover:bg-purple-800/50 transition-colors">
                  <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">AI Companion <span className="text-xs text-gray-500">(Coming Soon)</span></h3>
                <p className="text-gray-400 mb-4">
                  Get deck suggestions and playtest your strategies against our AI opponent.
                </p>
                <span className="text-gray-500 inline-flex items-center">
                  In Development
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">Join the Community</h2>
          <p className="text-xl text-gray-300 mb-10">
            Connect with other Star Wars Unlimited players, share your decks, and discover new strategies.
          </p>
          <Button asChild className="bg-transparent border border-pink-500 text-pink-500 hover:bg-pink-500/10 py-6 px-8 text-lg">
          <Link href="/cards">
            <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            Browse Cards
          </Link>
        </Button>
        </div>
      </section>
    </div>
  );
}