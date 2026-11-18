import time
import uuid
import re
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.core.logger import logger
from app.core.security import get_rate_limit_status, HEAVY_ENDPOINT_THRESHOLDS
from app.services.metrics_service import metrics_service

def mask_ip_address(ip: str) -> str:
    """Mask the last segment of IPv4 / IPv6 addresses for PII privacy protection."""
    if not ip:
        return "unknown"
    if ":" in ip:
        # IPv6
        parts = ip.split(":")
        return ":".join(parts[:3] + ["xxxx"])
    # IPv4
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.{parts[2]}.xxx"
    return "xxx.xxx.xxx.xxx"

class SecurityHeadersAndHttpsMiddleware(BaseHTTPMiddleware):
    """
    Enforces security headers across all responses and redirects HTTP to HTTPS in production:
    - HSTS (Strict-Transport-Security)
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Content-Security-Policy (CSP)
    - Referrer-Policy
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Enforce HTTPS redirect when in production or when reverse proxy indicates HTTP
        is_production = settings.ENVIRONMENT.lower() in ("production", "prod")
        forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
        
        if is_production and (request.url.scheme == "http" or forwarded_proto == "http"):
            https_url = request.url.replace(scheme="https")
            logger.info(f"Redirecting non-HTTPS traffic to {https_url}")
            return RedirectResponse(url=str(https_url), status_code=308)

        response = await call_next(request)

        # Apply industry-standard security headers
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "media-src 'self' blob: data: storage:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )

        return response

class RateLimitingMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window rate limiter per client IP.
    Applies strict burst limits on heavy endpoints (/upload, /export/render, /metadata/generate)
    while providing high capacity for standard status checks and health routes.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        
        # Determine client IP (support X-Forwarded-For if behind reverse proxy)
        client_ip = request.client.host if request.client else "127.0.0.1"
        if "x-forwarded-for" in request.headers:
            client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()

        # Check rate limit
        allowed, remaining, retry_after = get_rate_limit_status(client_ip, path)

        if not allowed:
            metrics_service.record_rate_limit_block()
            masked_ip = mask_ip_address(client_ip)
            logger.warning(
                f"Rate limit exceeded: IP {masked_ip} throttled on {request.method} {path} "
                f"(Retry-After: {retry_after}s)"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Too many requests.",
                    "retry_after": retry_after,
                    "endpoint": path
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(HEAVY_ENDPOINT_THRESHOLDS.get(path, 60)),
                    "X-RateLimit-Remaining": "0"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

class RequestLoggingAndMetricsMiddleware(BaseHTTPMiddleware):
    """
    Logs API requests & errors without sensitive PII or credentials,
    measures request latency, and increments telemetry metrics.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Assign or propagate X-Request-ID
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        client_ip = request.client.host if request.client else "127.0.0.1"
        if "x-forwarded-for" in request.headers:
            client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
        masked_ip = mask_ip_address(client_ip)

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000
            status_code = response.status_code

            # Record in metrics
            metrics_service.record_http_request(request.method, request.url.path, status_code, duration_ms)

            # Structured logging
            log_msg = (
                f"HTTP {request.method} {request.url.path} -> {status_code} "
                f"in {duration_ms:.1f}ms [client={masked_ip}, req_id={request_id[:8]}]"
            )
            if status_code >= 500:
                logger.error(log_msg)
            elif status_code >= 400:
                logger.warning(log_msg)
            else:
                logger.info(log_msg)

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
            return response

        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000
            metrics_service.record_http_request(request.method, request.url.path, 500, duration_ms)
            logger.error(
                f"Unhandled exception processing {request.method} {request.url.path} "
                f"after {duration_ms:.1f}ms: {exc} [client={masked_ip}, req_id={request_id[:8]}]"
            )
            raise exc
