# ========================================
# FILE: backend/main.py - WITH TABLES ROUTER
# ========================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ✅ Import routers
from routes import auth

# ✅ Import tables router
try:
    from routes import tables
    print("✅ Tables router imported")
except ImportError as e:
    print(f"⚠️  Tables router not available: {e}")
    tables = None

# ========================================
# CREATE APP
# ========================================

app = FastAPI(
    title="Restaurant Management API",
    version="1.0.0"
)

# ========================================
# CORS
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
        "message": "Server is running",
        "version": "1.0.0"
    }

# ========================================
# INCLUDE ROUTERS
# ========================================

# Auth router (required)
app.include_router(auth.router)
print("✅ Auth router included at /api/auth")

# Tables router (optional)
if tables:
    app.include_router(tables.router)
    print("✅ Tables router included at /api/tables")
else:
    print("⚠️  Tables router not included")

# ========================================
# ROOT ENDPOINT
# ========================================

@app.get("/")
async def root():
    endpoints = {
        "health": "/health",
        "docs": "/docs",
        "auth": {
            "login": "POST /api/auth/login",
            "me": "GET /api/auth/me",
        },
    }
    
    if tables:
        endpoints["tables"] = {
            "list": "GET /api/tables",
            "create": "POST /api/tables",
            "get": "GET /api/tables/{number}",
            "update": "PUT /api/tables/{number}",
            "delete": "DELETE /api/tables/{number}",
        }
    
    return {
        "message": "Restaurant Management API",
        "version": "1.0.0",
        "endpoints": endpoints
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
    print("🔐 Auth: http://localhost:8000/api/auth")
    
    if tables:
        print("🪑 Tables: http://localhost:8000/api/tables")
    
    print("=" * 60 + "\n")

# ========================================
# Run with:
# python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ========================================