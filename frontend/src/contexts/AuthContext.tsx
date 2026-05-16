// frontend/src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetch-utils'; // Correct import path

// Define User interface
interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  email_verified?: boolean;
  created_at?: string;
}

// Define Auth Context interface
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean; // <<< Keep this
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  refreshAuthState: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // <<< ADD state variable back
  const router = useRouter();

  // --- Define login function (Corrected) ---
  const login = useCallback(async (username: string, password: string) => {

    setIsLoading(true);
    // Reset auth state immediately on login attempt
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token'); // Clear old token just in case

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('/api/auth/token', { // Correct endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', },
        body: formData.toString(),
      });

      if (!response.ok) {
         let errorDetail = 'Login failed';
         try { const errorData = await response.json(); errorDetail = errorData.detail || JSON.stringify(errorData); }
         catch(_) { try { errorDetail = await response.text() || errorDetail; } catch {} }
         console.error(`[Auth Context] Login API error (${response.status}): ${errorDetail}`);
         throw new Error(errorDetail);
      }

      const data = await response.json();

      if (data && data.access_token && typeof data.access_token === 'string') {
          localStorage.setItem('auth_token', data.access_token); // Use correct key

          const storedToken = localStorage.getItem('auth_token');

          try {

            const userData: User = await fetchWithAuth('/api/auth/me'); // Use fetchWithAuth
            if (userData && userData.username) {

                setUser(userData);
                setIsAuthenticated(true); // <<< SET authenticated state
                router.push('/profile');
            } else {
                console.error("[Auth Context] Fetched /api/auth/me but received invalid user data after login.");
                await logout(); // Call logout if /me fails
                throw new Error("Authentication succeeded but failed to retrieve user data.");
            }
          } catch (fetchUserError) {
             console.error("[Auth Context] Error fetching user data after login:", fetchUserError);
             await logout(); // Call logout if /me fails
             throw new Error("Authentication succeeded but failed to retrieve user data.");
          }
      } else {
          // ... (log specific token error) ...
          if (!data) { console.error("[Auth Context] Login failed: No data received from /api/auth/token."); }
          else if (!data.access_token) { console.error("[Auth Context] Login successful but 'access_token' key MISSING in response data:", data); }
          else { console.error("[Auth Context] Login successful but 'access_token' in response data is NOT A STRING:", data); }
          throw new Error("Login failed: Could not retrieve authentication token.");
       }
    } catch (error) {
        console.error("[Auth Context] Error during login process:", error);
        // Ensure state is cleared on error
        localStorage.removeItem('auth_token');
        setUser(null);
        setIsAuthenticated(false); // <<< SET authenticated state
        throw error; // Re-throw
    } finally {
       setIsLoading(false);
    }
  // Added logout to dependency array as it's called inside catch blocks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, /* logout - causes potential infinite loop if added, handle carefully */ ]);

  // --- Define logout function (Corrected) ---
  const logout = useCallback(async () => {

    try {
      // Optional backend call
    } catch (error) { /* ... */ }
    finally {
       localStorage.removeItem('auth_token');
       setUser(null);
       setIsAuthenticated(false); // <<< SET authenticated state

       router.push('/login');
    }
  }, [router]);

  // --- Define register function (Keep as is) ---
  const register = useCallback(async (username: string, email: string, password: string) => {
    // ... (register logic) ...

    setIsLoading(true);
    try {
      const response = await fetch(`/api/auth/register`, { // Use relative path
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) { /* ... (error handling) ... */
         let errorDetail = 'Registration failed';
         try { const errorData = await response.json(); errorDetail = errorData.detail || JSON.stringify(errorData); }
         catch(_) { try { errorDetail = await response.text() || errorDetail; } catch {} }
         console.error(`[Auth Context] Registration API error (${response.status}): ${errorDetail}`);
         throw new Error(errorDetail);
      }

      // Maybe redirect to login page after successful registration
      // router.push('/login');
    } catch (error) {
      console.error('[Auth Context] Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [/* router - add if redirecting */]);

  // --- Define refreshAuthState function (Corrected) ---
   const refreshAuthState = useCallback(async (): Promise<boolean> => {

      const token = localStorage.getItem('auth_token');
      if (!token) {

        if (isAuthenticated) { // Check the state variable
            setUser(null);
            setIsAuthenticated(false); // <<< SET authenticated state
        }
        return false;
      }

      try {
        const userData: User = await fetchWithAuth('/api/auth/me');
        if (userData && userData.username) {

             setUser(userData);
             setIsAuthenticated(true); // <<< SET authenticated state
             return true;
        } else {

             await logout();
             return false;
        }
      } catch (error: any) {

        await logout();
        return false;
      }
    // Depends on logout now
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logout, isAuthenticated]); // Depend on isAuthenticated state

  // --- Effect for checking auth on initial mount (Corrected) ---
  useEffect(() => {

    // No need to check 'user' state here, refreshAuthState handles token check
    refreshAuthState().finally(() => {

        setIsLoading(false);
    });
  // Only run on mount, refreshAuthState has its own dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Effect for periodic token refresh (Corrected) ---
  useEffect(() => {
    const refreshIntervalMinutes = 15;

    const intervalId = setInterval(() => {
      // Check isAuthenticated state variable
      if (isAuthenticated) {

           refreshAuthState();
      } else {

      }
    }, refreshIntervalMinutes * 60 * 1000);

    return () => clearInterval(intervalId); // Clear interval on unmount
  }, [refreshAuthState, isAuthenticated]); // Depend on isAuthenticated state

  // --- Create context value (Corrected) ---
  const contextValue = {
    user,
    isAuthenticated, // <<< Use the state variable
    isLoading,
    login,
    logout,
    register,
    refreshAuthState
  };

  useEffect(() => {
    // intentionally empty — was debug logging
  }, [isAuthenticated, isLoading, user]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// --- Custom Hook to use AuthContext (Keep as is) ---
export function useAuth() {
  // ... (hook implementation) ...
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}