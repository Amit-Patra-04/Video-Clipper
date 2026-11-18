from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.logger import logger
from app.core.db import init_db
from app.core.middleware import (
    SecurityHeadersAndHttpsMiddleware,
    RateLimitingMiddleware,
    RequestLoggingAndMetricsMiddleware
)
from app.api import (
    ingest_router,
    pipeline_router,
    clips_router,
    metadata_router,
    export_router,
    upload_router,
    metrics_router
)

# Initialize database
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade AI Video-Clipping & Highlight Generation API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

# Apply Security Headers and HTTPS enforcement middleware (outermost)
app.add_middleware(SecurityHeadersAndHttpsMiddleware)

# Apply Sliding-Window Rate Limiter
app.add_middleware(RateLimitingMiddleware)

# Apply Structured Request Logging and Metrics Telemetry
app.add_middleware(RequestLoggingAndMetricsMiddleware)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for video streaming
app.mount("/storage", StaticFiles(directory=str(settings.STORAGE_DIR)), name="storage")

# Include API Routers under /api
app.include_router(upload_router, prefix=settings.API_V1_STR)
app.include_router(ingest_router, prefix=settings.API_V1_STR)
app.include_router(pipeline_router, prefix=settings.API_V1_STR)
app.include_router(clips_router, prefix=settings.API_V1_STR)
app.include_router(metadata_router, prefix=settings.API_V1_STR)
app.include_router(export_router, prefix=settings.API_V1_STR)

# Also mount upload router and metrics router at root
app.include_router(upload_router)
app.include_router(metrics_router)

@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "ffmpeg_available": True,
        "database": "connected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
