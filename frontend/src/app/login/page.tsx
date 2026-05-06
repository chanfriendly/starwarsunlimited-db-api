// frontend/src/app/login/page.tsx
'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/profile';
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ts-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Twin Suns · Field Access</div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 36, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
            Welcome back,<br />Commander.
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', padding: '36px 32px' }}>

          {error && (
            <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.08)' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-red)', marginBottom: 4, textTransform: 'uppercase' }}>
                Access Denied
              </div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(255,100,90,0.9)', letterSpacing: '0.06em' }}>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="username" style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                Callsign
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="ts-input"
                style={{ width: '100%' }}
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
                required
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label htmlFor="password" style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                Security Code
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="ts-input"
                style={{ width: '100%' }}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="ts-btn ts-btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 11, letterSpacing: '0.22em', padding: '14px 24px', opacity: isLoading ? 0.6 : 1 }}
              disabled={isLoading}
            >
              {isLoading ? 'AUTHENTICATING...' : 'ENTER THE ATELIER →'}
            </button>
          </form>

          <div className="ts-rule" style={{ margin: '24px 0' }} />

          <div style={{ textAlign: 'center', fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.12em' }}>
            No account?{' '}
            <Link href="/signup" style={{ color: 'var(--ts-amber)', textDecoration: 'none' }}>
              Enlist now
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Twin Suns · Star Wars Unlimited · Twin Suns Format
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--ts-bg)' }} />}>
      <LoginPageContent />
    </Suspense>
  );
}
