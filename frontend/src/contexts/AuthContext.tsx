// frontend/src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Define User interface
interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
}

// Define Auth Context interface
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  refreshAuthState: () => Promise<boolean>;
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Define refreshAuthState function
  const refreshAuthState = useCallback(async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        return false;
      }
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.warn('[Auth] Token invalid or expired');
        localStorage.removeItem('auth_token');
        setUser(null);
        return false;
      }
      
      const userData = await response.json();
      setUser(userData);
      return true;
    } catch (error) {
      console.error('[Auth] Error refreshing auth state:', error);
      return false;
    }
  }, []);

  // Define login function
  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log('[Auth] Login attempt for:', username);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const data = await response.json();
      console.log('[Auth] Login successful, data:', data);
      
      // Save token in localStorage for persistence
      if (data.access_token) {
        localStorage.setItem('auth_token', data.access_token);
      }
      
      // Get user data
      const userResponse = await fetch('/api/auth/me', {
        headers: data.access_token ? {
          'Authorization': `Bearer ${data.access_token}`
        } : undefined,
        credentials: 'include',
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to get user data');
      }
      
      const userData = await userResponse.json();
      setUser(userData);
      
      router.push('/profile');
    } catch (error) {
      console.error('[Auth] Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Define logout function
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_collection'); // Also clear collection data
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, [router]);

  // Define register function
  const register = useCallback(async (username: string, email: string, password: string) => {
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
  }, []);

  // Effect for checking auth on mount
  useEffect(() => {
    const checkAuth = async () => {
        try {
            console.log('[Auth] Checking authentication');
            
            // Use the Next.js API route to check auth status
            const response = await fetch('/api/auth/me', {
                credentials: 'include', // Important for cookies
            });
            
            console.log('[Auth] Me API response status:', response.status);
            
            if (!response.ok) {
                console.log('[Auth] Not authenticated');
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

    checkAuth();
}, []);


  // Effect for periodic token refresh
  useEffect(() => {
    // Set up interval to refresh auth state (every 10 minutes)
    const intervalId = setInterval(() => {
      refreshAuthState();
    }, 10 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [refreshAuthState]);

  // Create context value
  const contextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
    refreshAuthState
  };

  console.log('[Auth] Current auth state:', { 
    isAuthenticated: !!user, 
    isLoading, 
    user: user ? user.username : 'none' 
  });

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}