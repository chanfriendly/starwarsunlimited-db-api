/**
 * Authenticated fetch helper. Reads the JWT token from localStorage and:
 * 1. Syncs it to a browser cookie so Next.js server-side route handlers can
 *    read it via cookies() — they can't access localStorage.
 * 2. Also sends it as an Authorization header as a fallback.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Sync token to cookie so server-side route handlers (cookies()) can read it
  if (token && typeof document !== 'undefined') {
    document.cookie = `auth_token=${token}; path=/; SameSite=Strict`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorDetail = `Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || JSON.stringify(errorData);
    } catch {
      try { errorDetail = await response.text() || errorDetail; } catch { /* ignore */ }
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
