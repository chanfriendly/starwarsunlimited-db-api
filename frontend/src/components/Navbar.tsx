// src/components/Navbar.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function TwinSunsMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="14" cy="22" r="9" fill="var(--ts-amber)" opacity="0.9" />
      <circle cx="27" cy="14" r="6" fill="var(--ts-red)" opacity="0.85" />
      <circle cx="14" cy="22" r="9" fill="none" stroke="var(--ts-bg)" strokeWidth="0.5" />
    </svg>
  );
}

const STATUS_ITEMS = [
  { tag: 'SET',   text: 'Set 04 · Jump to Lightspeed — cards available in the archive' },
  { tag: 'INFO',  text: 'Twin Suns format — build a 50-card deck around two leaders and one base' },
  { tag: 'HINT',  text: 'Use the Deck Atelier to build, simulate mulligans, and save your lists' },
];

function StatusStrip() {
  const loop = [...STATUS_ITEMS, ...STATUS_ITEMS];
  return (
    <div
      style={{
        borderBottom: '1px solid var(--ts-line)',
        background: 'var(--ts-panel)',
        overflow: 'hidden',
        height: 30,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          fontFamily: 'var(--ts-font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--ts-ink-3)',
        }}
      >
        {/* Left badge */}
        <span
          style={{
            flexShrink: 0,
            padding: '0 20px',
            color: 'var(--ts-amber)',
            fontWeight: 700,
            letterSpacing: '0.18em',
            borderRight: '1px solid var(--ts-line)',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--ts-panel)',
            zIndex: 2,
            fontSize: 10,
          }}
        >
          ◉ LIVE
        </span>

        {/* Marquee track */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div
            className="ts-marquee-track"
            style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', paddingLeft: 24 }}
          >
            {loop.map((item, i) => (
              <span
                key={i}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
              >
                <span
                  style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    border: '1px solid var(--ts-line-2)',
                    color: 'var(--ts-ink-2)',
                    letterSpacing: '0.2em',
                  }}
                >
                  {item.tag}
                </span>
                <span>{item.text}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right ABY date */}
        <span
          style={{
            flexShrink: 0,
            padding: '0 20px',
            fontSize: 10,
            color: 'var(--ts-ink-4)',
            whiteSpace: 'nowrap',
            borderLeft: '1px solid var(--ts-line)',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--ts-panel)',
            zIndex: 2,
            letterSpacing: '0.1em',
          }}
        >
          34 ABY
        </span>
      </div>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      localStorage.removeItem('auth_token');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navLinks = [
    { href: '/cards', label: 'Cards' },
    { href: '/deck-builder', label: 'Deck Builder' },
    ...(isAuthenticated ? [{ href: '/decks', label: 'My Decks' }] : []),
    ...(isAuthenticated ? [{ href: '/game', label: 'Play' }] : []),
    ...(isAuthenticated ? [{ href: '/profile', label: 'Profile' }] : []),
  ];

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100 }} ref={menuRef}>
      {/* Main nav bar */}
      <div
        style={{
          borderBottom: '1px solid var(--ts-line)',
          background: 'var(--ts-bg)',
          backdropFilter: 'blur(6px)',
          position: 'relative',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 60,
            gap: 28,
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textDecoration: 'none',
            }}
          >
            <TwinSunsMark size={26} />
            <div style={{ lineHeight: 1.1 }}>
              <div
                style={{
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.26em',
                  color: 'var(--ts-ink-3)',
                  textTransform: 'uppercase',
                }}
              >
                Star Wars Unlimited
              </div>
              <div
                style={{
                  fontFamily: 'var(--ts-font-display)',
                  fontSize: 18,
                  color: 'var(--ts-ink)',
                  letterSpacing: '0.04em',
                }}
              >
                Twin&nbsp;Suns
              </div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <nav className="ts-nav-desktop" style={{ gap: 2, alignItems: 'center' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '8px 14px',
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: isActive(link.href) ? 'var(--ts-amber)' : 'var(--ts-ink-2)',
                  textDecoration: 'none',
                  borderBottom: isActive(link.href)
                    ? '2px solid var(--ts-amber)'
                    : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Hamburger — mobile only */}
          <button
            className="ts-nav-hamburger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
            style={{
              background: 'transparent',
              border: '1px solid var(--ts-line-2)',
              color: 'var(--ts-ink-2)',
              cursor: 'pointer',
              padding: '6px 10px',
              fontFamily: 'var(--ts-font-mono)',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>

          {/* Right: user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      background: 'var(--ts-panel-2)',
                      border: '1px solid var(--ts-line-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      color: 'var(--ts-amber)',
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ lineHeight: 1.1 }}>
                    <div style={{ fontSize: 12, color: 'var(--ts-ink)', fontFamily: 'var(--ts-font-mono)' }}>
                      {user?.username ?? 'Commander'}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--ts-font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.14em',
                        color: 'var(--ts-ink-3)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Twin Suns
                    </div>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '6px 12px',
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    border: '1px solid var(--ts-line-2)',
                    background: 'transparent',
                    color: 'var(--ts-ink-3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ts-red)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--ts-red)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ts-line-2)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--ts-ink-3)';
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                style={{
                  padding: '7px 16px',
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--ts-amber)',
                  background: 'transparent',
                  color: 'var(--ts-amber)',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <div className={`ts-nav-mobile-menu${mobileOpen ? ' open' : ''}`}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '12px 24px',
                fontFamily: 'var(--ts-font-mono)',
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: isActive(link.href) ? 'var(--ts-amber)' : 'var(--ts-ink-2)',
                textDecoration: 'none',
                borderLeft: isActive(link.href) ? '2px solid var(--ts-amber)' : '2px solid transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <button
              onClick={() => { handleLogout(); setMobileOpen(false); }}
              style={{
                padding: '12px 24px',
                fontFamily: 'var(--ts-font-mono)',
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--ts-red)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                borderLeft: '2px solid transparent',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </div>
      <StatusStrip />
    </header>
  );
}
