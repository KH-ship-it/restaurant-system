# ==================== utils/auth.py ====================
import jwt
import bcrypt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from dotenv import load_dotenv
from config.database import get_db_connection

load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_IN = int(os.getenv("JWT_EXPIRES_IN", "24"))  # hours

security = HTTPBearer()

# ==================== Password Functions ====================

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

# ==================== JWT Functions ====================

def create_access_token(user_id: int, username: str, role: str) -> str:
    """Create JWT access token"""
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRES_IN),
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token

def decode_access_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã hết hạn. Vui lòng đăng nhập lại."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ"
        )

# ==================== Authentication Dependencies ====================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    
    # Decode token
    payload = decode_access_token(token)
    user_id = payload.get('user_id')
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu thông tin user_id"
        )
    
    # Verify user exists and is active
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # ✅ Query đúng: lấy role trực tiếp từ bảng users
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.role, u.is_active,
                   e.full_name, e.phone, e.position
            FROM users u
            LEFT JOIN employees e ON u.user_id = e.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Không tìm thấy người dùng"
            )
        
        if not user['is_active']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị vô hiệu hóa"
            )
        
        return dict(user)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xác thực: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ==================== Role-based Access Control ====================

def require_roles(allowed_roles: list):
    """
    Dependency to verify user has one of the required roles
    
    Usage:
        @router.get("/admin/dashboard")
        async def admin_dashboard(
            current_user: dict = Depends(require_roles(["OWNER", "admin"]))
        ):
            return {"message": "Welcome admin"}
    """
    async def role_verifier(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get('role')
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bạn không có quyền truy cập. Yêu cầu vai trò: {', '.join(allowed_roles)}"
            )
        
        return current_user
    
    return role_verifier


# ==================== Convenience Role Checkers ====================

def require_owner():
    """Require OWNER role"""
    return require_roles(["OWNER"])

def require_admin():
    """Require OWNER or admin role"""
    return require_roles(["OWNER", "admin"])

def require_kitchen():
    """Require OWNER or KITCHEN role"""
    return require_roles(["OWNER", "KITCHEN"])

def require_staff():
    """Require any staff role"""
    return require_roles(["OWNER", "admin", "KITCHEN", "staff"])


# ==================== routes/auth.py ====================
from fastapi import APIRouter, HTTPException, status, Depends
from models.schemas import UserLogin, LoginResponse, UserResponse
from config.database import get_db_connection
from utils.auth import (
    verify_password, 
    create_access_token, 
    get_current_user,
    hash_password
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Role to Routes Mapping
ROLE_ROUTES = {
    "OWNER": ["/admin", "/manager", "/kitchen", "/cashier", "/staff"],
    "admin": ["/admin"],
    "KITCHEN": ["/kitchen"],
    "staff": ["/staff"],
}

# Role Display Names
ROLE_DISPLAY = {
    "OWNER": "Chủ nhà hàng",
    "admin": "Quản lý",
    "KITCHEN": "Bếp",
    "staff": "Nhân viên"
}

@router.post("/login", response_model=LoginResponse)
async def login(credentials: UserLogin):
    """
    Login endpoint with role-based access control
    - Validates username/password
    - Checks if account is active
    - Returns JWT token + allowed_routes based on role
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # ✅ Query đúng: lấy role trực tiếp từ bảng users
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.password_hash, u.role, u.is_active,
                   e.full_name, e.phone, e.position
            FROM users u
            LEFT JOIN employees e ON u.user_id = e.user_id
            WHERE u.username = %s
            """,
            (credentials.username,)
        )
        
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tên đăng nhập hoặc mật khẩu không đúng"
            )
        
        # Check if account is active
        if not user['is_active']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
            )
        
        # Verify password
        if not verify_password(credentials.password, user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tên đăng nhập hoặc mật khẩu không đúng"
            )
        
        # Get user role
        user_role = user['role']
        
        # Validate role exists in system
        if user_role not in ROLE_ROUTES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Vai trò '{user_role}' không hợp lệ trong hệ thống"
            )
        
        # Create JWT token
        token = create_access_token(
            user_id=user['user_id'],
            username=user['username'],
            role=user_role
        )
        
        # Get allowed routes
        allowed_routes = ROLE_ROUTES.get(user_role, [])
        
        # Prepare response
        user_response = UserResponse(
            id=user['user_id'],
            username=user['username'],
            role=user_role,
            fullName=user.get('full_name', user['username']),
            email=f"{user['username']}@restaurant.com"
        )
        
        return LoginResponse(
            success=True,
            token=token,
            user=user_response,
            allowed_routes=allowed_routes
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Đăng nhập thất bại: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    allowed_routes = ROLE_ROUTES.get(current_user['role'], [])
    
    return {
        "success": True,
        "data": {
            "user_id": current_user['user_id'],
            "username": current_user['username'],
            "role": current_user['role'],
            "role_display": ROLE_DISPLAY.get(current_user['role'], current_user['role']),
            "full_name": current_user.get('full_name'),
            "phone": current_user.get('phone'),
            "position": current_user.get('position'),
            "is_active": current_user['is_active'],
            "allowed_routes": allowed_routes
        }
    }


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout - client removes token"""
    return {
        "success": True,
        "message": "Đăng xuất thành công"
    }


@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: dict = Depends(get_current_user)
):
    """Change password for current user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get current password hash
        cursor.execute(
            "SELECT password_hash FROM users WHERE user_id = %s",
            (current_user['user_id'],)
        )
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng"
            )
        
        # Verify old password
        if not verify_password(old_password, result['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu cũ không đúng"
            )
        
        # Hash new password
        new_hash = hash_password(new_password)
        
        # Update password
        cursor.execute(
            "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE user_id = %s",
            (new_hash, current_user['user_id'])
        )
        conn.commit()
        
        return {
            "success": True,
            "message": "Đổi mật khẩu thành công"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Đổi mật khẩu thất bại: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()