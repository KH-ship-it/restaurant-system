# ========================================
# FILE: backend/main.py - FIXED VERSION
# ========================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import traceback

# ✅ Import auth router
from routes import auth

# ✅ Import tables router with detailed error handling
TABLES_AVAILABLE = False
tables = None

try:
    from routes import tables
    print("✅ Tables module imported successfully")
    
    # Check if router exists
    if hasattr(tables, 'router'):
        TABLES_AVAILABLE = True
        print("✅ Tables router found")
    else:
        print("❌ Tables module has no 'router' attribute")
        
except ImportError as e:
    print(f"❌ ImportError loading tables: {e}")
    traceback.print_exc()
except Exception as e:
    print(f"❌ Unexpected error loading tables: {e}")
    traceback.print_exc()

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
        "version": "1.0.0",
        "tables_available": TABLES_AVAILABLE
    }

# ========================================
# INCLUDE ROUTERS
# ========================================

# Auth router (required)
app.include_router(auth.router)
print("✅ Auth router registered at /api/auth")

# Tables router (optional)
if TABLES_AVAILABLE and tables:
    try:
        app.include_router(tables.router)
        print("✅ Tables router registered at /api/tables")
    except Exception as e:
        print(f"❌ Error registering tables router: {e}")
        traceback.print_exc()
else:
    print("⚠️  Tables router NOT registered")

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
    
    if TABLES_AVAILABLE:
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
        "endpoints": endpoints,
        "tables_available": TABLES_AVAILABLE
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
    
    if TABLES_AVAILABLE:
        print("🪑 Tables: http://localhost:8000/api/tables")
    else:
        print("❌ Tables: NOT AVAILABLE")
    
    print("=" * 60 + "\n")

# ========================================
# Run with:
# python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ========================================