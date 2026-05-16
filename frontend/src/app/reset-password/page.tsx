'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch('/api/auth/password-reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Invalid or expired reset token.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
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
            New Security<br />Code.
          </div>
        </div>

        <div style={{ background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', padding: '36px 32px' }}>

          {success ? (
            <div style={{ padding: '16px', border: '1px solid var(--ts-green)', background: 'rgba(0,200,100,0.06)' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-green)', marginBottom: 6, textTransform: 'uppercase' }}>
                Code Updated
              </div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-2)', letterSpacing: '0.06em', lineHeight: 1.6 }}>
                Password updated. Redirecting to login...
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.08)' }}>
                  <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-red)', marginBottom: 4, textTransform: 'uppercase' }}>
                    Error
                  </div>
                  <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(255,100,90,0.9)', letterSpacing: '0.06em' }}>
                    {error}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {!tokenFromUrl && (
                  <div style={{ marginBottom: 20 }}>
                    <label htmlFor="token" style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Reset Token
                    </label>
                    <input
                      id="token"
                      type="text"
                      className="ts-input"
                      style={{ width: '100%' }}
                      placeholder="Paste token from email"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="newPassword" style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                    New Security Code
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    className="ts-input"
                    style={{ width: '100%' }}
                    placeholder="At least 8 characters, include a number"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label htmlFor="confirm" style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Confirm Code
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    className="ts-input"
                    style={{ width: '100%' }}
                    placeholder="Repeat new password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="ts-btn ts-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11, letterSpacing: '0.22em', padding: '14px 24px', opacity: isLoading ? 0.6 : 1 }}
                  disabled={isLoading}
                >
                  {isLoading ? 'UPDATING...' : 'SET NEW CODE →'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--ts-bg)' }} />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
