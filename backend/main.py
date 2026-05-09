# backend/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import bcrypt
from pydantic import BaseModel


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "="*60)
    print(" Restaurant API Starting...")
    print("="*60)
    print(f" Local:  http://localhost:8000")
    print(f" Docs:   http://localhost:8000/docs")
    print("="*60 + "\n")
    yield
    print("\n Shutting down...\n")


app = FastAPI(
    title="Restaurant Management API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.middleware("http")
async def cors_and_ngrok_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return JSONResponse(
            content={"ok": True},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning, X-Requested-With",
                "Access-Control-Max-Age": "86400",
            }
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, ngrok-skip-browser-warning"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        body_str = body.decode('utf-8')
    except:
        body_str = "Unable to read body"
    print(f"\n{'='*70}")
    print(f" VALIDATION ERROR: {request.url}")
    print(f" Body: {body_str}")
    for error in exc.errors():
        print(f"  - {'.'.join(str(x) for x in error['loc'])}: {error['msg']}")
    print(f"{'='*70}\n")
    error_messages = [
        f"{'.'.join(str(x) for x in e['loc'][1:])}: {e['msg']}"
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": "Dữ liệu không hợp lệ",
                 "errors": error_messages, "detail": exc.errors()},
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


@app.get("/")
def root():
    return {"status": "online", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

class PasswordHashRequest(BaseModel):
    password: str

@app.post("/api/utils/hash-password")
def create_hash(request: PasswordHashRequest):
    hashed = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    return {"success": True, "password": request.password, "hash": hashed}


# ============================================================
# LOAD ROUTERS
# ============================================================
print("\n Loading routers...")

try:
    from routes import auth
    app.include_router(auth.router)
    print(" ✅ Auth router loaded")
except Exception as e:
    print(f" ❌ Auth router failed: {e}")

try:
    from routes import employees
    app.include_router(employees.router)
    print(" ✅ Employees router loaded")
except Exception as e:
    print(f" ❌ Employees router failed: {e}")

try:
    from routes import tables
    app.include_router(tables.router)
    print(" ✅ Tables router loaded")
except Exception as e:
    print(f" ❌ Tables router failed: {e}")

try:
    from routes import dashboard
    app.include_router(dashboard.router)
    print(" ✅ Dashboard router loaded")
except Exception as e:
    print(f" ❌ Dashboard router failed: {e}")

try:
    from routes import payment
    app.include_router(payment.router)
    print(" ✅ Payment router loaded")
except Exception as e:
    print(f" ❌ Payment router failed: {e}")

try:
    from routes import cashier
    app.include_router(cashier.router)
    print(" ✅ Cashier router loaded")
except Exception as e:
    print(f" ❌ Cashier router failed: {e}")

try:
    from routes import menu, order, kitchen
    app.include_router(menu.router)
    print(" ✅ Menu router loaded")
    app.include_router(order.router)
    print(" ✅ Order router loaded")
    app.include_router(kitchen.router)
    print(" ✅ Kitchen router loaded")
except ImportError as e:
    print(f"  ℹ️  Some routers not found: {e}")

try:
    from routes import inventory
    app.include_router(inventory.router)
    print(" ✅ Inventory router loaded")
except Exception as e:
    print(f" ❌ Inventory router failed: {e}")
    import traceback; traceback.print_exc()

print("\n" + "="*60)
print(" ✅ All routers loaded!")
print("="*60 + "\n")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")