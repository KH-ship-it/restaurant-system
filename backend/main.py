from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load env
load_dotenv()

# Create app
app = FastAPI(title="Restaurant System API")

# ==================== CORS ====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "https://frontend-new-mu-one.vercel.app",
        "*"  # Tạm thời cho phép tất cả (production nên cụ thể hơn)
    ],
    allow_credentials=True,
    allow_methods=["*"],

    allow_headers=["*"],
)

# ==================== Import routers ====================
from routes.auth import router as auth_router
from routes.menu import router as menu_router
from routes.order import router as order_router
from routes.table import router as table_router
from routes.employee import router as employee_router
from routes.kitchen import router as kitchen_router
from routes.dashboard import router as dashboard_router
from routes.cashier import router as cashier_router

# ==================== Include routers ====================
app.include_router(auth_router)
app.include_router(menu_router)
app.include_router(order_router)
app.include_router(table_router)
app.include_router(employee_router)
app.include_router(kitchen_router)
app.include_router(dashboard_router)
app.include_router(cashier_router)

# ==================== Health check ====================
@app.get("/")
def root():
    return {"status": "ok"}
