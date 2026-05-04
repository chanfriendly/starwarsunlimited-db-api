// API Configuration
export const API_CONFIG = {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    endpoints: {
      cards: '/api/cards',
      decks: '/api/decks',
      collection: '/api/collection',
      stats: '/api/stats'
    },
    // Default request timeout in milliseconds
    timeout: 10000,
    // Number of retries for failed requests
    retries: 2
  };