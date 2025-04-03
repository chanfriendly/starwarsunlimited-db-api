// frontend/src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          console.log('[Auth] No token found in localStorage');
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        console.log('[Auth] Token found in localStorage, verifying...');
        
        // Directly call backend API to get user data
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const authUrl = `${API_URL}/api/auth/me`;
        console.log('[Auth] Fetching user data from:', authUrl);
        
        const response = await fetch(authUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.log('[Auth] Token verification failed, status:', response.status);
          localStorage.removeItem('auth_token');
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        const userData = await response.json();
        console.log('[Auth] User authenticated successfully:', userData.username);
        setUser(userData);
      } catch (error) {
        console.error('[Auth] Auth check error:', error);
        localStorage.removeItem('auth_token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Important: Run this check immediately
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Use the Next.js API route to check auth status
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Important for cookies
      });
      
      if (!response.ok) {
        console.log('[Auth] Not authenticated, status:', response.status);
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      const userData = await response.json();
      console.log('[Auth] User authenticated as:', userData.username);
      setUser(userData);
    } catch (error) {
      console.error('[Auth] Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };


  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log('[Auth] Login attempt for:', username);
      
      // Use the Next.js API route instead of direct backend call
      const loginUrl = '/api/auth/login';
      console.log('[Auth] Sending login request to:', loginUrl);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Important for cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[Auth] Login failed:', errorData);
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const data = await response.json();
      console.log('[Auth] Login successful');
      
      // Get user data from the Next.js API route
      const userUrl = '/api/auth/me';
      console.log('[Auth] Fetching user data from:', userUrl);
      
      const userResponse = await fetch(userUrl, {
        credentials: 'include', // Important for cookies
      });
      
      if (!userResponse.ok) {
        console.log('[Auth] Failed to get user data, status:', userResponse.status);
        throw new Error('Failed to get user data');
      }
      
      const userData = await userResponse.json();
      console.log('[Auth] User data retrieved successfully');
      setUser(userData);
      
      // Allow the state update to complete before redirecting
      setTimeout(() => {
        router.push('/profile');
      }, 100);
      
    } catch (error) {
      console.error('[Auth] Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log('[Auth] Logging out user');
      localStorage.removeItem('auth_token');
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // The value we're providing to consumers
  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
  };

  console.log('[Auth] Current auth state:', { 
    isAuthenticated: !!user, 
    isLoading, 
    user: user ? user.username : 'none' 
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}