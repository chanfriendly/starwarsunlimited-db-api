# backend/src/utils/rate_limiter.py
import time
from typing import Dict, Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self, 
        app,  # Keep this as the first parameter after self
        requests_per_minute: int = 60,
        window_size: int = 60
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_size = window_size
        self.request_history: Dict[str, list] = {}  # IP address -> list of timestamps
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Get client IP (accounting for possible proxies)
        client_ip = request.client.host
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        # Rate limit check
        current_time = time.time()
        
        # Initialize history for new clients
        if client_ip not in self.request_history:
            self.request_history[client_ip] = []
        
        # Clean up old timestamps outside the window
        self.request_history[client_ip] = [
            t for t in self.request_history[client_ip] 
            if current_time - t < self.window_size
        ]
        
        # Check if rate limit exceeded
        if len(self.request_history[client_ip]) >= self.requests_per_minute:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return Response(
                content="Rate limit exceeded. Please try again later.",
                status_code=429
            )
        
        # Add current request timestamp
        self.request_history[client_ip].append(current_time)
        
        # Call next middleware/endpoint
        return await call_next(request)

# Cleanup task to prevent memory growth
def cleanup_rate_limiter(rate_limiter: RateLimitMiddleware) -> None:
    """Remove old entries from the rate limiter history to prevent memory leaks"""
    current_time = time.time()
    for ip in list(rate_limiter.request_history.keys()):
        # Clean timestamps
        rate_limiter.request_history[ip] = [
            t for t in rate_limiter.request_history[ip] 
            if current_time - t < rate_limiter.window_size
        ]
        
        # Remove IP if no recent requests
        if not rate_limiter.request_history[ip]:
            del rate_limiter.request_history[ip]