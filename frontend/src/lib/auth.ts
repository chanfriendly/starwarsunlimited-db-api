// frontend/src/lib/auth.ts
// Remove fetchPublic import since it doesn't exist
import { fetchWithAuth } from '@/lib/fetch-utils';

// Auth-related utility functions and types
export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

// Authentication utility functions
export async function getCurrentUser(): Promise<User> {
  return fetchWithAuth('/api/auth/me');
}

export async function refreshToken(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch (error) {
    return false;
  }
}

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    // Basic JWT token expiration check
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    // If we can't parse the token, consider it expired
    return true;
  }
}