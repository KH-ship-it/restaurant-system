from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

app = FastAPI(title="Restaurant API", version="1.0.0")

# ✅ CRITICAL: CORS Configuration - PHẢI ĐẶT TRƯỚC KHI IMPORT ROUTES
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://restaurant-system-ivory.vercel.app",
        "https://downier-winston-theological.ngrok-free.dev",
        "http://localhost:3000",
        "http://localhost:3001",
        "*"  # Allow all (chỉ dùng cho development)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# ✅ CRITICAL: Add exception handler to return JSON instead of HTML
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure all errors return JSON, not HTML"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": str(exc),
            "detail": traceback.format_exc()
        }
    )

# Health check endpoint
@app.get("/")
async def root():
    return {
        "success": True,
        "message": "Restaurant API is running",
        "version": "1.0.0",
        "endpoints": [
            "/health",
            "/api/menu",
            "/api/tables",
            "/api/orders"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "success": True,
        "status": "healthy",
        "service": "restaurant-api"
    }

# Import and register routes
try:
    from routes import menu, table
    app.include_router(menu.router)
    app.include_router(table.router)
    print("✅ Routes loaded successfully")
except Exception as e:
    print(f"❌ Error loading routes: {e}")

# Middleware to log all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"📝 {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        print(f"✅ Response: {response.status_code}")
        return response
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)