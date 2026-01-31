# backend/main.py - WITH VALIDATION ERROR HANDLER

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import bcrypt
from pydantic import BaseModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("\n" + "="*60)
    print(" Restaurant API Starting...")
    print("="*60)
    print(f" Local: http://localhost:8000")
    print(f" Docs: http://localhost:8000/docs")
    print("="*60 + "\n")
    yield
    print("\nShutting down...\n")

app = FastAPI(
    title="Restaurant Management API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS - Allow everything
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("CORS: Allow all origins")

# ==================== EXCEPTION HANDLERS ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors"""
    
    # Get request body
    try:
        body = await request.body()
        body_str = body.decode('utf-8')
    except:
        body_str = "Unable to read body"
    
    print(f"\n{'='*70}")
    print(f" VALIDATION ERROR")
    print(f"{'='*70}")
    print(f"URL: {request.url}")
    print(f"Method: {request.method}")
    print(f"Body: {body_str}")
    print(f"\nErrors:")
    for error in exc.errors():
        print(f"  - Field: {'.'.join(str(x) for x in error['loc'])}")
        print(f"    Error: {error['msg']}")
        print(f"    Type: {error['type']}")
    print(f"{'='*70}\n")
    
    # Format error messages for user
    error_messages = []
    for error in exc.errors():
        field = '.'.join(str(x) for x in error['loc'][1:])  # Skip 'body'
        msg = error['msg']
        error_messages.append(f"{field}: {msg}")
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Dữ liệu không hợp lệ",
            "errors": error_messages,
            "detail": exc.errors()
        },
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "path": str(request.url.path)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.exception_handler(500)
async def server_error(request: Request, exc):
    print(f" 500 error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.middleware("http")
async def add_cors(request: Request, call_next):
    """Add CORS headers"""
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# OPTIONS handler
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    return JSONResponse(
        content={"ok": True},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/")
def root():
    return {"status": "online", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

# ==================== UTILITY ENDPOINTS ====================

class PasswordHashRequest(BaseModel):
    password: str

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

@app.post("/api/utils/hash-password")
def create_hash(request: PasswordHashRequest):
    """Generate password hash"""
    hashed = hash_password(request.password)
    return {
        "success": True,
        "password": request.password,
        "hash": hashed
    }

# ==================== INCLUDE ROUTERS ====================

# Import and include auth router
try:
    from routes import auth
    app.include_router(auth.router)
    print(" Auth router loaded")
except Exception as e:
    print(f" Auth router failed: {e}")
    import traceback
    traceback.print_exc()

# Import and include employees router
try:
    from routes import employees
    app.include_router(employees.router)
    print(" Employees router loaded")
except Exception as e:
    print(f" Employees router failed: {e}")
    import traceback
    traceback.print_exc()

# Import other routers if they exist
try:
    from routes import menu, order, tables, kitchen
    
    app.include_router(menu.router)
    print(" Menu router loaded")
    
    app.include_router(order.router)
    print(" Order router loaded")
    
    app.include_router(tables.router)
    print(" Tables router loaded")
    
    app.include_router(kitchen.router)
    print(" Kitchen router loaded")
except ImportError as e:
    print(f"ℹ  Some routers not found: {e}")

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    
    print("\n🚀 Starting server...\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )