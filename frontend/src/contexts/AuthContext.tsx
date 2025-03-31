// frontend/src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { registerUser, loginUser, logoutUser } from '@/lib/auth';
import { fetchUserProfile } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
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

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we have a token
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        // Verify token by fetching user profile
        const userData = await fetchUserProfile();
        setUser(userData);
      } catch (error) {
        console.error('Auth check error:', error);
        // Clear invalid token
        localStorage.removeItem('accessToken');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
    
    // Listen for storage events (e.g., user logs out in another tab)
    const handleStorageChange = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      const authData = await loginUser(username, password);
      
      if (!authData.access_token) {
        throw new Error('Login failed: No access token received');
      }
      
      // Fetch user profile
      const userData = await fetchUserProfile();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
      // Dispatch event to notify other tabs
      window.dispatchEvent(new Event("authChange"));
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    
    try {
      await registerUser(username, email, password);
      // Note: We don't automatically log in after registration
      // User will need to log in explicitly
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        register,
      }}
    >
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