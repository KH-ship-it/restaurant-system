# backend/models/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ==================== Auth Schemas ====================

class UserLogin(BaseModel):
    username: str
    password: str
    
    class Config:
        schema_extra = {
            "example": {
                "username": "admin",
                "password": "admin123"
            }
        }

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    fullName: str
    email: str

class LoginResponse(BaseModel):
    success: bool
    token: str
    user: UserResponse
    allowed_routes: Optional[List[str]] = []  # ✅ THÊM FIELD NÀY

class UserRegister(BaseModel):
    username: str
    password: str
    role: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None

# ==================== Menu Schemas ====================

class MenuItemCreate(BaseModel):
    category_id: int
    item_name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None

class MenuItemUpdate(BaseModel):
    category_id: Optional[int] = None
    item_name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    
class MenuItemResponse(BaseModel):
    item_id: int
    category_id: int
    item_name: str
    description: Optional[str]
    price: float
    image_url: Optional[str]
    status: str
    created_at: datetime


# ==================== Order Schemas ====================

class OrderItem(BaseModel):
    item_id: int
    quantity: int
    price: float

class OrderCreate(BaseModel):
    table_id: int
    items: List[OrderItem]
    customer_id: Optional[int] = None

class OrderStatusUpdate(BaseModel):
    status: str

# ==================== Table Schemas ====================

class TableCreate(BaseModel):
    table_number: int
    status: str = "EMPTY"

class TableUpdate(BaseModel):
    status: str

# ==================== Employee Schemas ====================

class EmployeeCreate(BaseModel):
    user_id: int
    full_name: str
    phone: Optional[str] = None
    position: Optional[str] = None
    hire_date: Optional[str] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None

# ==================== Kitchen Schemas ====================

class KitchenOrderStatusUpdate(BaseModel):
    status: str

# ==================== Cashier Schemas ====================

class PaymentProcess(BaseModel):
    order_id: int

# ==================== Generic Response ====================

class SuccessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# ==================== Employee + User Create ======

class EmployeeCreateWithUser(BaseModel):
    username: str
    password: str
    role: Optional [str]=None 
    full_name: str
    phone: Optional[str] = None
    position: Optional[str] = None
    hire_date: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "username": "nhanvien01",
                "password": "123456",
                "role": "KITCHEN",
                "full_name": "Nguyễn Văn A",
                "phone": "0901234567",
                "position": "Đầu bếp",
                "hire_date": "2026-01-19"
            }
        }