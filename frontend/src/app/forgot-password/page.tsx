'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await fetch('/api/auth/password-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      // Always show success to avoid username enumeration
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ts-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Twin Suns · Field Access</div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 36, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
            Reset your<br />Security Code.
          </div>
        </div>

        <div style={{ background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', padding: '36px 32px' }}>

          {submitted ? (
            <div>
              <div style={{ padding: '16px', border: '1px solid var(--ts-amber)', background: 'rgba(255,176,0,0.06)', marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-amber)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Transmission Sent
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-2)', letterSpacing: '0.06em', lineHeight: 1.6 }}>
                  If that callsign has a comm channel on file, a reset link has been dispatched. Check your inbox.
                </div>
              </div>
              <Link href="/login" className="ts-btn ts-btn-primary" style={{ display: 'block', textAlign: 'center', fontSize: 11, letterSpacing: '0.22em', padding: '14px 24px', textDecoration: 'none' }}>
                RETURN TO LOGIN →
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.08)' }}>
                  <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(255,100,90,0.9)', letterSpacing: '0.06em' }}>
                    {error}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 28 }}>
                  <label htmlFor="username" style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Callsign
                  </label>
                  <input
                    id="username"
                    type="text"
                    className="ts-input"
                    style={{ width: '100%' }}
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="ts-btn ts-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11, letterSpacing: '0.22em', padding: '14px 24px', opacity: isLoading ? 0.6 : 1 }}
                  disabled={isLoading}
                >
                  {isLoading ? 'SENDING...' : 'SEND RESET LINK →'}
                </button>
              </form>
            </>
          )}

          <div className="ts-rule" style={{ margin: '24px 0' }} />

          <div style={{ textAlign: 'center', fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.12em' }}>
            <Link href="/login" style={{ color: 'var(--ts-ink-3)', textDecoration: 'none' }}>
              Back to login
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
