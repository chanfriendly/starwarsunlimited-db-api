'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type State = 'loading' | 'success' | 'error' | 'no-token';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>(token ? 'loading' : 'no-token');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setState('success');
        } else {
          setState('error');
          setMessage(data.detail || 'Verification failed.');
        }
      })
      .catch(() => {
        setState('error');
        setMessage('Network error. Please try again.');
      });
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ts-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Twin Suns · Verification</div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 36, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
            Email Verification
          </div>
        </div>

        <div style={{ background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', padding: '36px 32px', textAlign: 'center' }}>

          {state === 'loading' && (
            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-3)', letterSpacing: '0.12em' }}>
              Verifying...
            </div>
          )}

          {state === 'success' && (
            <>
              <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid var(--ts-green)', background: 'rgba(110,227,107,0.08)' }}>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-green)', marginBottom: 4, textTransform: 'uppercase' }}>
                  Verified
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(110,227,107,0.9)', letterSpacing: '0.06em' }}>
                  Your email address has been confirmed.
                </div>
              </div>
              <Link href="/login" className="ts-btn ts-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', fontSize: 10, letterSpacing: '0.2em', padding: '12px 24px' }}>
                SIGN IN →
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.08)' }}>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-red)', marginBottom: 4, textTransform: 'uppercase' }}>
                  Link Invalid
                </div>
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(255,100,90,0.9)', letterSpacing: '0.06em' }}>
                  {message || 'This verification link is invalid or has expired.'}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.1em' }}>
                Log in and request a new link from your profile page.
              </div>
            </>
          )}

          {state === 'no-token' && (
            <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-ink-3)', letterSpacing: '0.1em' }}>
              No verification token found. Check the link in your email.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
