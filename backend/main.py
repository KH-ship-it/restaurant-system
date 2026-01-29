# backend/main.py - FIXED FOR NGROK + LOCALHOST

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Import routes
from routes import auth, employees, menu, order, tables, kitchen

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("\n" + "="*60)
    print("🚀 Restaurant Management System API Starting...")
    print("="*60)
    print(f"📍 Local: http://localhost:8000")
    print(f"📍 Ngrok: Check your ngrok dashboard")
    print(f"📖 Docs: /docs")
    print("="*60 + "\n")
    
    yield
    
    print("\n" + "="*60)
    print("👋 Shutting Down...")
    print("="*60 + "\n")

# ==================== APP INITIALIZATION ====================

app = FastAPI(
    title="Restaurant Management API",
    description="API for Restaurant Management System",
    version="2.0.0",
    lifespan=lifespan
)

# ==================== CORS MIDDLEWARE - NGROK COMPATIBLE ====================

# ⭐ CRITICAL: Allow ALL origins for ngrok
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow ALL origins (ngrok requirement)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

print("✅ CORS configured: Allow ALL origins")

# ==================== MIDDLEWARE FOR NGROK ====================

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add custom headers for ngrok compatibility"""
    response = await call_next(request)
    
    # Add CORS headers explicitly
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# ==================== OPTIONS HANDLER ====================

@app.options("/{full_path:path}")
async def preflight_handler(full_path: str):
    """Handle all OPTIONS (preflight) requests"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        },
        status_code=200
    )

# ==================== ROOT ENDPOINTS ====================

@app.get("/")
async def root():
    """API health check"""
    return {
        "status": "online",
        "message": "Restaurant Management API",
        "version": "2.0.0",
        "cors": "enabled (all origins)",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "employees": "/api/employees",
            "menu": "/api/menu",
            "orders": "/api/orders"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "cors": "enabled"
    }

# ==================== INCLUDE ROUTERS ====================

try:
    app.include_router(auth.router)
    print("✅ Auth router loaded")
except Exception as e:
    print(f"⚠️ Auth router failed: {e}")

try:
    app.include_router(employees.router)
    print("✅ Employees router loaded")
except Exception as e:
    print(f"⚠️ Employees router failed: {e}")

try:
    app.include_router(menu.router)
    print("✅ Menu router loaded")
except Exception as e:
    print(f"⚠️ Menu router failed: {e}")

try:
    app.include_router(order.router)
    print("✅ Order router loaded")
except Exception as e:
    print(f"⚠️ Order router failed: {e}")

try:
    app.include_router(tables.router)
    print("✅ Tables router loaded")
except Exception as e:
    print(f"⚠️ Tables router failed: {e}")

try:
    app.include_router(kitchen.router)
    print("✅ Kitchen router loaded")
except Exception as e:
    print(f"⚠️ Kitchen router failed: {e}")

# ==================== ERROR HANDLERS ====================

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Not Found",
            "path": str(request.url.path),
            "message": f"Endpoint {request.url.path} không tồn tại"
        },
        headers={
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    print(f"❌ Internal error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": str(exc)
        },
        headers={
            "Access-Control-Allow-Origin": "*"
        }
    )

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*60)
    print("🔧 Starting Uvicorn Server...")
    print("="*60)
    print("💡 IMPORTANT: After starting, run ngrok:")
    print("   ngrok http 8000")
    print("="*60 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # Listen on all interfaces (required for ngrok)
        port=8000,
        reload=True,
        log_level="info"
    )