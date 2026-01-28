# ========================================
# FILE: backend/main.py
# Complete version with ALL routes
# ========================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import traceback

# ========================================
# CREATE APP
# ========================================

app = FastAPI(
    title="Restaurant Management API",
    description="Complete Restaurant System",
    version="2.0.0"
)

# ========================================
# CORS CONFIGURATION
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
    expose_headers=["*"],
)

print("✅ CORS configured")

# ========================================
# IMPORT AND REGISTER ROUTERS
# ========================================

# Track which routers are available
AVAILABLE_ROUTERS = {
    "auth": False,
    "tables": False,
    "menu": False,
    "order": False,
    "cashier": False,
    "dashboard": False,
    "employees": False,
    "kitchen": False,
}

# ========================================
# AUTH ROUTER (Required)
# ========================================
try:
    from routes.auth import router as auth_router
    app.include_router(auth_router)
    AVAILABLE_ROUTERS["auth"] = True
    print("✅ Auth router included: /api/auth")
except Exception as e:
    print(f"❌ Auth router failed: {e}")
    traceback.print_exc()

# ========================================
# TABLES ROUTER
# ========================================
try:
    from routes.tables import router as tables_router
    app.include_router(tables_router)
    AVAILABLE_ROUTERS["tables"] = True
    print("✅ Tables router included: /api/tables")
except Exception as e:
    print(f"⚠️  Tables router not available: {e}")

# ========================================
# MENU ROUTER
# ========================================
try:
    from routes.menu import router as menu_router
    app.include_router(menu_router)
    AVAILABLE_ROUTERS["menu"] = True
    print("✅ Menu router included: /api/menu")
except Exception as e:
    print(f"⚠️  Menu router not available: {e}")

# ========================================
# ORDER ROUTER
# ========================================
try:
    from routes.order import router as order_router
    app.include_router(order_router)
    AVAILABLE_ROUTERS["order"] = True
    print("✅ Order router included: /api/orders")
except Exception as e:
    print(f"⚠️  Order router not available: {e}")

# ========================================
# CASHIER ROUTER
# ========================================
try:
    from routes.cashier import router as cashier_router
    app.include_router(cashier_router)
    AVAILABLE_ROUTERS["cashier"] = True
    print("✅ Cashier router included: /api/cashier")
except Exception as e:
    print(f"⚠️  Cashier router not available: {e}")

# ========================================
# DASHBOARD ROUTER
# ========================================
try:
    from routes.dashboard import router as dashboard_router
    app.include_router(dashboard_router)
    AVAILABLE_ROUTERS["dashboard"] = True
    print("✅ Dashboard router included: /api/dashboard")
except Exception as e:
    print(f"⚠️  Dashboard router not available: {e}")

# ========================================
# EMPLOYEES ROUTER
# ========================================
try:
    from routes.employees import router as employees_router
    app.include_router(employees_router)
    AVAILABLE_ROUTERS["employees"] = True
    print("✅ Employees router included: /api/employees")
except Exception as e:
    print(f"⚠️  Employees router not available: {e}")

# ========================================
# KITCHEN ROUTER
# ========================================
try:
    from routes.kitchen import router as kitchen_router
    app.include_router(kitchen_router)
    AVAILABLE_ROUTERS["kitchen"] = True
    print("✅ Kitchen router included: /api/kitchen")
except Exception as e:
    print(f"⚠️  Kitchen router not available: {e}")

# ========================================
# HEALTH CHECK
# ========================================

@app.get("/health")
async def health_check():
    """Health check with router status"""
    return {
        "status": "ok",
        "message": "Restaurant Management API is running",
        "version": "2.0.0",
        "routers": AVAILABLE_ROUTERS
    }

# ========================================
# ROOT ENDPOINT
# ========================================

@app.get("/")
async def root():
    """API information and available endpoints"""
    endpoints = {
        "health": "/health",
        "docs": "/docs",
        "redoc": "/redoc",
    }
    
    if AVAILABLE_ROUTERS["auth"]:
        endpoints["auth"] = {
            "login": "POST /api/auth/login",
            "me": "GET /api/auth/me"
        }
    
    if AVAILABLE_ROUTERS["tables"]:
        endpoints["tables"] = {
            "list": "GET /api/tables",
            "create": "POST /api/tables",
            "update": "PUT /api/tables/{id}",
            "delete": "DELETE /api/tables/{id}"
        }
    
    if AVAILABLE_ROUTERS["menu"]:
        endpoints["menu"] = {
            "public": "GET /api/menu/public (no auth required)",
            "list": "GET /api/menu",
            "create": "POST /api/menu",
            "update": "PUT /api/menu/{id}",
            "delete": "DELETE /api/menu/{id}"
        }
    
    if AVAILABLE_ROUTERS["order"]:
        endpoints["orders"] = {
            "create": "POST /api/orders (no auth required)",
            "list": "GET /api/orders",
            "get": "GET /api/orders/{id}",
            "update": "PUT /api/orders/{id}",
            "delete": "DELETE /api/orders/{id}"
        }
    
    return {
        "message": "Restaurant Management API",
        "version": "2.0.0",
        "available_routers": AVAILABLE_ROUTERS,
        "endpoints": endpoints
    }

# ========================================
# STARTUP EVENT
# ========================================

@app.on_event("startup")
async def startup():
    print("\n" + "=" * 70)
    print("🚀 RESTAURANT MANAGEMENT API")
    print("=" * 70)
    print(f"Version: 2.0.0")
    print(f"Docs: http://localhost:8000/docs")
    print()
    print("Available Routers:")
    
    if AVAILABLE_ROUTERS["auth"]:
        print("  ✅ /api/auth - Authentication")
    if AVAILABLE_ROUTERS["tables"]:
        print("  ✅ /api/tables - Table Management")
    if AVAILABLE_ROUTERS["menu"]:
        print("  ✅ /api/menu - Menu Management")
        print("     → /api/menu/public (no auth)")
    if AVAILABLE_ROUTERS["order"]:
        print("  ✅ /api/orders - Order Management")
        print("     → POST /api/orders (no auth)")
    if AVAILABLE_ROUTERS["cashier"]:
        print("  ✅ /api/cashier - Cashier")
    if AVAILABLE_ROUTERS["dashboard"]:
        print("  ✅ /api/dashboard - Dashboard")
    if AVAILABLE_ROUTERS["employees"]:
        print("  ✅ /api/employees - Employees")
    if AVAILABLE_ROUTERS["kitchen"]:
        print("  ✅ /api/kitchen - Kitchen")
    
    print("=" * 70 + "\n")

# ========================================
# ERROR HANDLERS
# ========================================

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Not Found",
            "path": request.url.path,
            "message": f"The endpoint {request.url.path} does not exist",
            "hint": "Check /docs for available endpoints"
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    print(f"❌ Internal error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": "An unexpected error occurred"
        }
    )

# ========================================
# Run with:
# python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ========================================