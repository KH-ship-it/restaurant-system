# ========================================
# FILE: backend/main.py - FIX 404 ERROR
# ========================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ✅ CRITICAL: Import auth router
from routes import auth

# ========================================
# CREATE APP
# ========================================

app = FastAPI(
    title="Restaurant Management API",
    version="1.0.0"
)

# ========================================
# CORS - Allow frontend to connect
# ========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://frontend-new-mu-one.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# HEALTH CHECK
# ========================================

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "message": "Server is running"
    }

# ========================================
# ✅ CRITICAL: Include auth router
# ========================================

app.include_router(auth.router)

print("✅ Auth router included at /api/auth")

# ========================================
# ROOT ENDPOINT
# ========================================

@app.get("/")
async def root():
    return {
        "message": "Restaurant Management API",
        "endpoints": {
            "health": "/health",
            "login": "POST /api/auth/login",
            "me": "GET /api/auth/me",
            "docs": "/docs"
        }
    }

# ========================================
# STARTUP
# ========================================

@app.on_event("startup")
async def startup():
    print("\n" + "=" * 60)
    print("🚀 Restaurant Management API")
    print("=" * 60)
    print("📝 Docs: http://localhost:8000/docs")
    print("🔐 Login: POST http://localhost:8000/api/auth/login")
    print("=" * 60 + "\n")

# ========================================
# To run:
# python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ========================================