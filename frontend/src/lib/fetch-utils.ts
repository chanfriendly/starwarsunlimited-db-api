// frontend/src/lib/fetch-utils.ts
// Utility functions for making authenticated API requests

interface FetchOptions extends RequestInit {
  body?: string;
}

/**
 * Makes an authenticated API request using the stored JWT token
 * @param url - The API endpoint URL (relative or absolute)
 * @param options - Standard fetch options (method, body, etc.)
 * @returns Promise that resolves to the parsed JSON response
 * @throws Error if the request fails or response is not ok
 */
export async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<any> {
  // Get the token from localStorage
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle authentication errors
  if (response.status === 401) {
    // Token is invalid or expired, clear it
    localStorage.removeItem('auth_token');
    throw new Error('Authentication expired. Please log in again.');
  }

  // Handle other errors
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      // If we can't parse the error response, use the generic message
    }
    throw new Error(errorMessage);
  }

  // Parse and return the response
  try {
    return await response.json();
  } catch (e) {
    // If the response isn't JSON, return null or handle as needed
    return null;
  }
}

/**
 * Checks if the user is currently authenticated
 * @returns boolean indicating if a valid token exists
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('auth_token');
  return !!token;
}

/**
 * Clears the authentication token
 */
export function clearAuth(): void {
  localStorage.removeItem('auth_token');
}

/**
 * Gets the current authentication token
 * @returns The token string or null if not authenticated
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}