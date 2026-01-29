# main.py - FIXED FOR NGROK

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Import routes
from routes import auth, employees, menu, orders, tables, kitchen

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("\n" + "="*60)
    print("🚀 Restaurant Management System API Starting...")
    print("="*60)
    print(f"📍 API Base: http://localhost:8000")
    print(f"📖 Docs: http://localhost:8000/docs")
    print("="*60 + "\n")
    
    yield
    
    print("\n" + "="*60)
    print("👋 Shutting Down...")
    print("="*60 + "\n")

# ==================== APP INITIALIZATION ====================

app = FastAPI(
    title="Restaurant Management API",
    description="API for Restaurant Management System",
    version="1.0.0",
    lifespan=lifespan
)

# ==================== CORS MIDDLEWARE - NGROK COMPATIBLE ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://*.ngrok-free.dev",
        "https://downier-winston-theological.ngrok-free.dev",
        "*"  # Allow all as fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ==================== NGROK MIDDLEWARE ====================

@app.middleware("http")
async def add_ngrok_headers(request: Request, call_next):
    """Add headers for ngrok compatibility"""
    response = await call_next(request)
    
    # Add CORS headers explicitly
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

# ==================== OPTIONS HANDLER ====================

@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    """Handle preflight requests"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

# ==================== ROOT ENDPOINT ====================

@app.get("/")
async def root():
    """API health check"""
    return {
        "status": "online",
        "message": "Restaurant Management API is running",
        "version": "1.0.0",
        "cors": "enabled",
        "ngrok": "compatible"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# ==================== INCLUDE ROUTERS ====================

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(tables.router)
app.include_router(kitchen.router)

# ==================== ERROR HANDLERS ====================

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Endpoint not found",
            "path": str(request.url)
        },
        headers={
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error"
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
    print("="*60 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )