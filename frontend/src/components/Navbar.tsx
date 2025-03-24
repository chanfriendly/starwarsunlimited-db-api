// src/components/Navbar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => pathname === path;
  
  return (
    <nav className="bg-gray-900 border-b border-gray-800 py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo/Home link with gradient */}
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold">
            <span className="twin-suns-gradient">Twin Suns</span>
          </span>
        </Link>
        
        {/* Navigation Links */}
        <div className="flex items-center space-x-6">
          <Link
            href="/cards"
            className={`text-lg transition-colors ${
              isActive('/cards')
                ? 'text-purple-400 font-medium'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Cards
          </Link>
          
          <Link
            href="/deck-builder"
            className={`text-lg transition-colors ${
              isActive('/deck-builder')
                ? 'text-purple-400 font-medium'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Deck Builder
          </Link>
          
          <Link
            href="/profile"
            className={`text-lg transition-colors ${
              isActive('/profile')
                ? 'text-purple-400 font-medium'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Profile
          </Link>
        </div>
      </div>
    </nav>
  );
}