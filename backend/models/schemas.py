# backend/models/schemas.py
from pydantic import BaseModel, Field, validator
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
    allowed_routes: Optional[List[str]] = []

class UserRegister(BaseModel):
    username: str
    password: str
    role: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None

# ==================== Menu Schemas (UPDATED WITH BILINGUAL) ====================

class MenuItemCreate(BaseModel):
    """Schema for creating a new menu item with bilingual support"""
    category_id: int = Field(..., description="Category ID (1=Coffee, 2=Main, 3=Drinks, 4=Smoothie)")
    
    # Vietnamese fields (required)
    item_name: str = Field(..., min_length=1, max_length=255, description="Item name in Vietnamese")
    description: str = Field(..., min_length=1, description="Description in Vietnamese")
    
    # English fields (optional, will default to Vietnamese if not provided)
    item_name_en: Optional[str] = Field(None, max_length=255, description="Item name in English")
    description_en: Optional[str] = Field(None, description="Description in English")
    
    # Common fields
    price: float = Field(..., gt=0, description="Price in VND")
    image_url: Optional[str] = Field(None, description="Image URL")
    status: Optional[str] = Field("AVAILABLE", description="Status: AVAILABLE or UNAVAILABLE")

    @validator('status')
    def validate_status(cls, v):
        """Ensure status is uppercase and valid"""
        if v:
            v = v.upper()
            if v not in ['AVAILABLE', 'UNAVAILABLE']:
                raise ValueError('Status must be AVAILABLE or UNAVAILABLE')
        return v or 'AVAILABLE'

    @validator('item_name_en', always=True)
    def set_item_name_en(cls, v, values):
        """If English name not provided, use Vietnamese name as fallback"""
        return v or values.get('item_name', '')

    @validator('description_en', always=True)
    def set_description_en(cls, v, values):
        """If English description not provided, use Vietnamese description as fallback"""
        return v or values.get('description', '')

    class Config:
        schema_extra = {
            "example": {
                "category_id": 1,
                "item_name": "Cà phê đen",
                "item_name_en": "Black Coffee",
                "description": "Cà phê đen truyền thống Việt Nam",
                "description_en": "Traditional Vietnamese black coffee",
                "price": 25000,
                "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400",
                "status": "AVAILABLE"
            }
        }


class MenuItemUpdate(BaseModel):
    """Schema for updating an existing menu item"""
    category_id: Optional[int] = Field(None, description="Category ID")
    
    # Vietnamese fields
    item_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Item name in Vietnamese")
    description: Optional[str] = Field(None, min_length=1, description="Description in Vietnamese")
    
    # English fields
    item_name_en: Optional[str] = Field(None, max_length=255, description="Item name in English")
    description_en: Optional[str] = Field(None, description="Description in English")
    
    # Common fields
    price: Optional[float] = Field(None, gt=0, description="Price in VND")
    image_url: Optional[str] = Field(None, description="Image URL")
    status: Optional[str] = Field(None, description="Status: AVAILABLE or UNAVAILABLE")

    @validator('status')
    def validate_status(cls, v):
        """Ensure status is uppercase and valid"""
        if v:
            v = v.upper()
            if v not in ['AVAILABLE', 'UNAVAILABLE']:
                raise ValueError('Status must be AVAILABLE or UNAVAILABLE')
        return v

    class Config:
        schema_extra = {
            "example": {
                "item_name": "Cà phê sữa đá",
                "item_name_en": "Iced Milk Coffee",
                "description": "Cà phê sữa đá truyền thống",
                "description_en": "Traditional iced milk coffee",
                "price": 28000,
                "status": "AVAILABLE"
            }
        }

    
class MenuItemResponse(BaseModel):
    """Schema for menu item response with bilingual support"""
    item_id: int
    category_id: int
    item_name: str
    item_name_en: Optional[str]
    description: str
    description_en: Optional[str]
    price: float
    image_url: Optional[str]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


# ==================== Order Schemas ====================

class OrderItem(BaseModel):
    """Schema for a single item in an order"""
    item_id: int = Field(..., description="Menu item ID")
    quantity: int = Field(..., gt=0, description="Quantity ordered")
    price: float = Field(..., gt=0, description="Price per item")

    class Config:
        schema_extra = {
            "example": {
                "item_id": 1,
                "quantity": 2,
                "price": 25000
            }
        }


class OrderCreate(BaseModel):
    """Schema for creating a new order"""
    table_number: int = Field(..., ge=1, description="Table number (for backward compatibility)")
    table_id: Optional[int] = Field(None, ge=1, description="Table ID (new field)")
    items: List[OrderItem] = Field(..., min_items=1, description="List of items in the order")
    customer_id: Optional[int] = Field(None, description="Customer ID if logged in")
    customer_name: Optional[str] = Field("Khách", max_length=100, description="Customer name")
    total_amount: float = Field(..., gt=0, description="Total order amount")

    @validator('table_id', always=True)
    def set_table_id(cls, v, values):
        """If table_id not provided, use table_number"""
        return v or values.get('table_number')

    class Config:
        schema_extra = {
            "example": {
                "table_number": 5,
                "customer_name": "Nguyễn Văn A",
                "items": [
                    {"item_id": 1, "quantity": 2, "price": 25000},
                    {"item_id": 3, "quantity": 1, "price": 35000}
                ],
                "total_amount": 85000
            }
        }


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status"""
    status: str = Field(..., description="New status")

    @validator('status')
    def validate_status(cls, v):
        """Validate order status"""
        valid_statuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']
        v = v.upper()
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

    class Config:
        schema_extra = {
            "example": {
                "status": "PREPARING"
            }
        }


# ==================== Table Schemas ====================

class TableCreate(BaseModel):
    """Schema for creating a new table"""
    table_number: int = Field(..., ge=1, description="Table number")
    capacity: Optional[int] = Field(4, ge=1, description="Seating capacity")
    status: str = Field("EMPTY", description="Table status")

    @validator('status')
    def validate_status(cls, v):
        """Validate table status"""
        valid_statuses = ['EMPTY', 'OCCUPIED', 'RESERVED']
        v = v.upper()
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

    class Config:
        schema_extra = {
            "example": {
                "table_number": 5,
                "capacity": 4,
                "status": "EMPTY"
            }
        }


class TableUpdate(BaseModel):
    """Schema for updating table status"""
    status: str = Field(..., description="New table status")

    @validator('status')
    def validate_status(cls, v):
        """Validate table status"""
        valid_statuses = ['EMPTY', 'OCCUPIED', 'RESERVED']
        v = v.upper()
        if v not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v

    class Config:
        schema_extra = {
            "example": {
                "status": "OCCUPIED"
            }
        }


# ==================== Employee Schemas ====================

class EmployeeCreate(BaseModel):
    """Schema for creating employee record (user must already exist)"""
    user_id: int = Field(..., description="User ID from users table")
    full_name: str = Field(..., min_length=1, max_length=100, description="Employee full name")
    phone: Optional[str] = Field(None, max_length=15, description="Phone number")
    position: Optional[str] = Field("Phục vụ", max_length=50, description="Job position")
    hire_date: Optional[str] = Field(None, description="Hire date (YYYY-MM-DD)")

    class Config:
        schema_extra = {
            "example": {
                "user_id": 5,
                "full_name": "Nguyễn Văn A",
                "phone": "0901234567",
                "position": "Phục vụ",
                "hire_date": "2024-01-15"
            }
        }


class EmployeeUpdate(BaseModel):
    """Schema for updating employee information"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Employee full name")
    phone: Optional[str] = Field(None, max_length=15, description="Phone number")
    position: Optional[str] = Field(None, max_length=50, description="Job position")

    class Config:
        schema_extra = {
            "example": {
                "full_name": "Nguyễn Văn B",
                "phone": "0907654321",
                "position": "Thu ngân"
            }
        }


class EmployeeCreateWithUser(BaseModel):
    """Schema for creating employee with user account (all-in-one)"""
    # User account fields
    username: str = Field(..., min_length=3, max_length=50, description="Username for login")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    role: Optional[str] = Field("STAFF", description="User role")
    
    # Employee profile fields
    full_name: str = Field(..., min_length=1, max_length=100, description="Full name")
    phone: Optional[str] = Field(None, max_length=15, description="Phone number")
    position: Optional[str] = Field("Phục vụ", max_length=50, description="Job position")
    hire_date: Optional[str] = Field(None, description="Hire date (YYYY-MM-DD)")

    @validator('role')
    def validate_role(cls, v):
        """Validate and uppercase role"""
        if v:
            v = v.upper()
            valid_roles = ['OWNER', 'ADMIN', 'KITCHEN', 'CASHIER', 'STAFF']
            if v not in valid_roles:
                raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v or 'STAFF'
    
    class Config:
        schema_extra = {
            "example": {
                "username": "nhanvien01",
                "password": "password123",
                "role": "STAFF",
                "full_name": "Nguyễn Văn A",
                "phone": "0901234567",
                "position": "Phục vụ",
                "hire_date": "2024-01-19"
            }
        }


# ==================== Kitchen Schemas ====================

class KitchenOrderStatusUpdate(BaseModel):
    """Schema for updating order status from kitchen"""
    status: str = Field(..., description="New order status")

    @validator('status')
    def validate_status(cls, v):
        """Validate kitchen order status"""
        valid_statuses = ['PREPARING', 'READY']
        v = v.upper()
        if v not in valid_statuses:
            raise ValueError(f'Kitchen can only set status to: {", ".join(valid_statuses)}')
        return v

    class Config:
        schema_extra = {
            "example": {
                "status": "READY"
            }
        }


# ==================== Cashier Schemas ====================

class PaymentProcess(BaseModel):
    """Schema for processing payment"""
    order_id: int = Field(..., description="Order ID to process payment for")
    payment_method: Optional[str] = Field("CASH", description="Payment method")
    amount_paid: Optional[float] = Field(None, description="Amount paid by customer")

    @validator('payment_method')
    def validate_payment_method(cls, v):
        """Validate payment method"""
        if v:
            v = v.upper()
            valid_methods = ['CASH', 'CARD', 'MOMO', 'BANKING']
            if v not in valid_methods:
                raise ValueError(f'Payment method must be one of: {", ".join(valid_methods)}')
        return v or 'CASH'

    class Config:
        schema_extra = {
            "example": {
                "order_id": 123,
                "payment_method": "CASH",
                "amount_paid": 100000
            }
        }


# ==================== Generic Response ====================

class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Human-readable message")
    data: Optional[dict] = Field(None, description="Additional data")

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Operation completed successfully",
                "data": {"id": 123}
            }
        }


class ErrorResponse(BaseModel):
    """Generic error response"""
    success: bool = Field(False, description="Always False for errors")
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")

    class Config:
        schema_extra = {
            "example": {
                "success": False,
                "message": "Operation failed",
                "detail": "Validation error: field 'name' is required"
            }
        }