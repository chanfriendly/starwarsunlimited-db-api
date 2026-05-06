// frontend/src/app/signup/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.username) newErrors.username = 'Callsign is required';
    else if (formData.username.length < 3) newErrors.username = 'Callsign must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) newErrors.username = 'Letters, numbers, and underscores only';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Enter a valid email address';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Minimum 8 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await register(formData.username, formData.email, formData.password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const field = (
    id: string, label: string, type: string, placeholder: string,
    value: string, autoComplete?: string
  ) => (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ display: 'block', fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </label>
      <input
        id={id} name={id} type={type} placeholder={placeholder} value={value}
        onChange={handleChange} disabled={isLoading || success}
        autoComplete={autoComplete}
        className="ts-input"
        style={{ width: '100%', borderColor: errors[id] ? 'var(--ts-red)' : undefined }}
        required
      />
      {errors[id] && (
        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, color: 'var(--ts-red)', letterSpacing: '0.1em', marginTop: 6 }}>
          ⚠ {errors[id]}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ts-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Twin Suns · Enlistment</div>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 36, color: 'var(--ts-ink)', lineHeight: 1.1 }}>
            Join the squadron.
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)', padding: '36px 32px' }}>

          {success && (
            <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--ts-green)', background: 'rgba(110,227,107,0.08)' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-green)', marginBottom: 4, textTransform: 'uppercase' }}>
                Enlisted
              </div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(110,227,107,0.9)', letterSpacing: '0.06em' }}>
                Account created. Redirecting to login...
              </div>
            </div>
          )}

          {serverError && (
            <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--ts-red)', background: 'rgba(255,61,46,0.08)' }}>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ts-red)', marginBottom: 4, textTransform: 'uppercase' }}>
                Enlistment Failed
              </div>
              <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'rgba(255,100,90,0.9)', letterSpacing: '0.06em' }}>
                {serverError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {field('username', 'Callsign', 'text', 'Choose a username', formData.username, 'username')}
            {field('email', 'Comm Channel', 'email', 'Enter your email', formData.email, 'email')}
            {field('password', 'Security Code', 'password', 'Minimum 8 characters', formData.password, 'new-password')}
            {field('confirmPassword', 'Confirm Code', 'password', 'Repeat your password', formData.confirmPassword, 'new-password')}

            <div style={{ marginTop: 8 }}>
              <button
                type="submit"
                className="ts-btn ts-btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 11, letterSpacing: '0.22em', padding: '14px 24px', opacity: isLoading || success ? 0.6 : 1 }}
                disabled={isLoading || success}
              >
                {isLoading ? 'PROCESSING...' : 'ENLIST NOW →'}
              </button>
            </div>
          </form>

          <div className="ts-rule" style={{ margin: '24px 0' }} />

          <div style={{ textAlign: 'center', fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.12em' }}>
            Already enlisted?{' '}
            <Link href="/login" style={{ color: 'var(--ts-amber)', textDecoration: 'none' }}>
              Sign in
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
