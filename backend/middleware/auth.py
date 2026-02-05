from fastapi import APIRouter, HTTPException, status, Depends, Header
from pydantic import BaseModel
from config.database import get_db_connection
import bcrypt
from datetime import datetime, timedelta
import jwt
import os
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# JWT Config
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# ==================== SCHEMAS ====================

class UserLogin(BaseModel):
    username: str
    password: str

# ==================== ROLE NORMALIZATION ====================

def normalize_role_name(role_name: str, role_id: int) -> str:
    """
    🔥 FIXED: Normalize role_name - Database có OWNER, không có ADMIN
    
    Position mapping:
    - "Quản lý" → OWNER (role_id = 1)
    - "Đầu bếp" → KITCHEN (role_id = 3)
    - "Phục vụ" → STAFF (role_id = 4)
    - "Thu ngân" → CASHIER (role_id = 2)
    """
    
    # If already English, keep it
    english_roles = ["OWNER", "KITCHEN", "STAFF", "CASHIER"]
    if role_name and role_name.upper() in english_roles:
        return role_name.upper()
    
    # Vietnamese to English mapping
    ROLE_MAPPING = {
        "Quản lý": "OWNER",      # ← KEY CHANGE: OWNER not ADMIN
        "Đầu bếp": "KITCHEN", 
        "Phục vụ": "STAFF",
        "Thu ngân": "CASHIER",
    }
    
    if role_name and role_name in ROLE_MAPPING:
        return ROLE_MAPPING[role_name]
    
    # Fallback by role_id
    ROLE_ID_MAPPING = {
        1: "OWNER",      # ← KEY CHANGE: OWNER not ADMIN
        2: "CASHIER",    
        3: "KITCHEN",    
        4: "STAFF"       
    }
    
    return ROLE_ID_MAPPING.get(role_id, "STAFF")

# ==================== PASSWORD FUNCTIONS ====================

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password using bcrypt"""
    try:
        plain_password = plain_password.strip()
        hashed_password = hashed_password.strip()
        
        print(f"🔐 Verifying password:")
        print(f"   Plain password length: {len(plain_password)}")
        print(f"   Hash starts with: {hashed_password[:10]}")
        
        result = bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
        
        print(f"   Verification result: {result}")
        return result
        
    except Exception as e:
        print(f"❌ Verification error: {type(e).__name__}: {e}")
        return False

# ==================== JWT FUNCTIONS ====================

def create_access_token(user_id: int, username: str, role: str):
    """Create JWT token"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    print(f"🎫 Token created: {token[:30]}...")
    
    return token

def verify_token(token: str):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token đã hết hạn")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

# ==================== UTILITY ENDPOINTS ====================

@router.post("/hash-password")
def create_password_hash(password: str):
    """Utility endpoint to create password hash"""
    hashed = hash_password(password)
    return {
        "password": password,
        "hash": hashed,
        "verify": verify_password(password, hashed)
    }

# ==================== LOGIN ENDPOINT ====================

@router.post("/login")
async def login(credentials: UserLogin):
    """
    🔥 FIXED: Login with correct role mapping (OWNER, not ADMIN)
    """
    
    conn = None
    cursor = None
    
    try:
        print("\n" + "="*70)
        print(f"🔐 LOGIN ATTEMPT")
        print("="*70)
        print(f"📧 Username: {credentials.username}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                u.user_id, 
                u.username, 
                u.password, 
                u.role_id,
                u.is_active,
                r.role_name,
                e.full_name,
                e.employee_id,
                e.position
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN employees e ON u.user_id = e.user_id
            WHERE u.username = %s
        """
        
        cursor.execute(query, (credentials.username,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Tên đăng nhập hoặc mật khẩu không đúng"
            )
        
        print(f"\n✅ User found:")
        print(f"   Username: {user['username']}")
        print(f"   Role ID: {user['role_id']}")
        print(f"   Role Name: {user.get('role_name')}")
        
        # Check active
        if not user.get('is_active', True):
            raise HTTPException(
                status_code=403,
                detail="Tài khoản đã bị vô hiệu hóa"
            )
        
        # Verify password
        password_hash = user['password']
        
        if password_hash.startswith('$2b$') or password_hash.startswith('$2a$'):
            is_valid = verify_password(credentials.password, password_hash)
            if not is_valid:
                raise HTTPException(
                    status_code=401,
                    detail="Tên đăng nhập hoặc mật khẩu không đúng"
                )
        else:
            # Plain text fallback
            if credentials.password != password_hash:
                raise HTTPException(
                    status_code=401,
                    detail="Tên đăng nhập hoặc mật khẩu không đúng"
                )
        
        # 🔥 Normalize role (OWNER not ADMIN)
        raw_role_name = user.get('role_name')
        user_role = normalize_role_name(raw_role_name, user['role_id'])
        
        print(f"\n👤 Role Information:")
        print(f"   Raw: {raw_role_name}")
        print(f"   Normalized: {user_role}")  # Should be "OWNER" for Quản lý
        
        # Create token
        token = create_access_token(
            user_id=user['user_id'],
            username=user['username'],
            role=user_role
        )
        
        response = {
            "success": True,
            "message": "Đăng nhập thành công",
            "token": token,
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "userId": user['user_id'],
                "username": user['username'],
                "fullName": user.get('full_name', user['username']),
                "role": user_role,  # 🔥 Now "OWNER" for Quản lý
                "roleId": user['role_id'],
                "employeeId": user.get('employee_id'),
                "position": user.get('position'),
                "email": f"{user['username']}@restaurant.com"
            },
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
        
        print(f"\n✅ LOGIN SUCCESS - Role: {user_role}")
        print("="*70 + "\n")
        
        return response
        
    except HTTPException:
        raise
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi server: {str(e)}")
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# ==================== GET CURRENT USER ====================

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user from token"""
    
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Không tìm thấy token xác thực"
        )
    
    try:
        scheme, token = authorization.split()
        
        if scheme.lower() != 'bearer':
            raise HTTPException(
                status_code=401,
                detail="Sai định dạng token"
            )
        
        payload = verify_token(token)
        return payload
        
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Sai định dạng token"
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Token không hợp lệ: {str(e)}"
        )

# ==================== OTHER ENDPOINTS ====================

@router.get("/me")
async def get_me(current_user = Depends(get_current_user)):
    """Get current user info"""
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT 
                u.user_id, 
                u.username, 
                u.role_id, 
                r.role_name,
                e.full_name,
                e.position
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN employees e ON u.user_id = e.user_id
            WHERE u.user_id = %s
            """,
            (current_user['user_id'],)
        )
        
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy user")
        
        # Normalize role
        raw_role_name = user.get('role_name')
        normalized_role = normalize_role_name(raw_role_name, user['role_id'])
        
        return {
            "success": True,
            "user": {
                "userId": user['user_id'],
                "username": user['username'],
                "fullName": user.get('full_name', user['username']),
                "role": normalized_role,
                "roleId": user['role_id'],
                "position": user.get('position')
            }
        }
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.post("/logout")
def logout():
    """Logout"""
    return {
        "success": True,
        "message": "Đăng xuất thành công"
    }

# ==================== DEBUG ENDPOINTS ====================

@router.get("/check-user/{username}")
def check_user(username: str):
    """Debug endpoint"""
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT 
                u.user_id, 
                u.username, 
                u.password, 
                u.role_id,
                u.is_active,
                r.role_name,
                e.full_name,
                e.position
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN employees e ON u.user_id = e.user_id
            WHERE u.username = %s
            """,
            (username,)
        )
        
        user = cursor.fetchone()
        
        if not user:
            return {"found": False, "username": username}
        
        raw_role_name = user.get('role_name')
        normalized_role = normalize_role_name(raw_role_name, user['role_id'])
        
        return {
            "found": True,
            "user_id": user['user_id'],
            "username": user['username'],
            "role_id": user['role_id'],
            "role_name_raw": raw_role_name,
            "role_name_normalized": normalized_role,
            "full_name": user.get('full_name'),
            "position": user.get('position'),
            "is_active": user.get('is_active'),
            "password_type": "bcrypt" if user['password'].startswith('$2') else "plain"
        }
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/check-roles")
def check_roles():
    """Debug endpoint"""
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM roles ORDER BY role_id")
        roles = cursor.fetchall()
        
        return {
            "success": True,
            "roles": [dict(role) for role in roles]
        }
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()