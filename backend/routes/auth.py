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
    🔥 FIX: Chuẩn hóa role_name từ tiếng Việt sang tiếng Anh
    
    Ví dụ: "Quản lý" -> "ADMIN"
    
    Args:
        role_name: Tên role từ database (có thể là tiếng Việt)
        role_id: ID của role (dùng làm fallback)
    
    Returns:
        Tên role chuẩn hóa bằng tiếng Anh (ADMIN, KITCHEN, STAFF, CASHIER, OWNER)
    """
    
    # Mapping từ tiếng Việt sang tiếng Anh
    ROLE_MAPPING = {
        "Quản lý": "ADMIN",
        "Đầu bếp": "KITCHEN", 
        "Phục vụ": "STAFF",
        "Thu ngân": "CASHIER",
        "Chủ cửa hàng": "OWNER",
        # Thêm các biến thể có thể có
        "quan ly": "ADMIN",
        "dau bep": "KITCHEN",
        "phuc vu": "STAFF",
        "thu ngan": "CASHIER"
    }
    
    # Nếu role_name đã là tiếng Anh, giữ nguyên
    english_roles = ["ADMIN", "KITCHEN", "STAFF", "CASHIER", "OWNER"]
    if role_name and role_name.upper() in english_roles:
        return role_name.upper()
    
    # Nếu có mapping, dùng mapping
    if role_name and role_name in ROLE_MAPPING:
        return ROLE_MAPPING[role_name]
    
    # Fallback theo role_id
    ROLE_ID_MAPPING = {
        1: "ADMIN",      # Quản lý / Owner
        2: "ADMIN",      # Admin
        3: "KITCHEN",    # Đầu bếp
        4: "CASHIER",    # Thu ngân
        5: "STAFF"       # Phục vụ
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
    🔥 FIXED: Login endpoint with role normalization
    
    Trả về role_name đã được chuẩn hóa (ADMIN, KITCHEN, STAFF, CASHIER, OWNER)
    thay vì tên tiếng Việt từ database
    """
    
    conn = None
    cursor = None
    
    try:
        print("\n" + "="*70)
        print(f"🔐 LOGIN ATTEMPT")
        print("="*70)
        print(f"📧 Username: {credentials.username}")
        print(f"🔑 Password: {'*' * len(credentials.password)} (length: {len(credentials.password)})")
        
        # Connect to database
        conn = get_db_connection()
        cursor = conn.cursor()
        print(f"✅ Database connected")
        
        # 🔥 CRITICAL: JOIN with roles table to get role_name
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
        
        print(f"\n🔍 Executing query for username: {credentials.username}")
        cursor.execute(query, (credentials.username,))
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ User '{credentials.username}' NOT FOUND in database")
            print("="*70 + "\n")
            raise HTTPException(
                status_code=401,
                detail="Tên đăng nhập hoặc mật khẩu không đúng"
            )
        
        print(f"\n✅ User found in database:")
        print(f"   User ID: {user['user_id']}")
        print(f"   Username: {user['username']}")
        print(f"   Full Name: {user.get('full_name', 'N/A')}")
        print(f"   Position: {user.get('position', 'N/A')}")
        print(f"   Role ID: {user['role_id']}")
        print(f"   Role Name (from DB): {user.get('role_name', 'N/A')}")
        
        # Check if user is active
        if not user.get('is_active', True):
            print(f"❌ User is inactive")
            raise HTTPException(
                status_code=403,
                detail="Tài khoản đã bị vô hiệu hóa"
            )
        
        # Get password hash
        password_hash = user['password']
        
        print(f"\n🔐 Password Hash Info:")
        print(f"   Hash type: {'BCRYPT' if password_hash.startswith('$2') else 'UNKNOWN'}")
        print(f"   Hash length: {len(password_hash)}")
        print(f"   Hash preview: {password_hash[:30]}...")
        
        # Verify password
        print(f"\n🔓 Verifying password...")
        
        is_valid = False
        
        if password_hash.startswith('$2b$') or password_hash.startswith('$2a$'):
            # BCrypt hash
            is_valid = verify_password(credentials.password, password_hash)
            
            if not is_valid:
                print(f"❌ Password verification FAILED")
                print("="*70 + "\n")
                raise HTTPException(
                    status_code=401,
                    detail="Tên đăng nhập hoặc mật khẩu không đúng"
                )
            
            print(f"✅ Password verification SUCCESS")
            
        else:
            # Plain text (for debugging only - NOT RECOMMENDED)
            print(f"⚠️ WARNING: Plain text password detected")
            is_valid = (credentials.password == password_hash)
            
            if not is_valid:
                print(f"❌ Plain text password mismatch")
                print("="*70 + "\n")
                raise HTTPException(
                    status_code=401,
                    detail="Tên đăng nhập hoặc mật khẩu không đúng"
                )
            
            print(f"✅ Plain text password matched")
        
        # 🔥 FIX: Normalize role_name (Quản lý -> ADMIN)
        raw_role_name = user.get('role_name')
        user_role = normalize_role_name(raw_role_name, user['role_id'])
        
        print(f"\n👤 User Role Information:")
        print(f"   Role ID: {user['role_id']}")
        print(f"   Raw Role Name from DB: {raw_role_name}")
        print(f"   🔥 Normalized Role: {user_role}")  # 👈 THIS IS WHAT WE RETURN
        
        # Create JWT token with normalized role
        token = create_access_token(
            user_id=user['user_id'],
            username=user['username'],
            role=user_role  # 👈 Now "ADMIN" not "Quản lý"
        )
        
        print(f"\n🎫 Token Info:")
        print(f"   Algorithm: {ALGORITHM}")
        print(f"   Expires in: {ACCESS_TOKEN_EXPIRE_MINUTES} minutes")
        print(f"   Token preview: {token[:40]}...")
        
        # Prepare response
        response = {
            "success": True,
            "message": "Đăng nhập thành công",
            "token": token,
            "access_token": token,  # Alias for compatibility
            "token_type": "bearer",
            "user": {
                "userId": user['user_id'],
                "username": user['username'],
                "fullName": user.get('full_name', user['username']),
                "role": user_role,  # 🔥 FIX: Now returns "ADMIN" not "Quản lý"
                "roleId": user['role_id'],
                "employeeId": user.get('employee_id'),
                "position": user.get('position'),
                "email": f"{user['username']}@restaurant.com"
            },
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds
        }
        
        print(f"\n✅ LOGIN SUCCESSFUL")
        print(f"📤 Returning user.role: '{user_role}' (normalized)")
        print(f"   Response keys: {list(response.keys())}")
        print("="*70 + "\n")
        
        return response
        
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
        
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR:")
        print(f"   Type: {type(e).__name__}")
        print(f"   Message: {str(e)}")
        print("="*70 + "\n")
        
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi server: {str(e)}"
        )
        
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
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        
        if scheme.lower() != 'bearer':
            raise HTTPException(
                status_code=401,
                detail="Sai định dạng token"
            )
        
        # Verify token
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
        
        # 🔥 FIX: Normalize role
        raw_role_name = user.get('role_name')
        normalized_role = normalize_role_name(raw_role_name, user['role_id'])
        
        return {
            "success": True,
            "user": {
                "userId": user['user_id'],
                "username": user['username'],
                "fullName": user.get('full_name', user['username']),
                "role": normalized_role,  # 🔥 Normalized
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
    """Logout - Client deletes token"""
    return {
        "success": True,
        "message": "Đăng xuất thành công"
    }

# ==================== DEBUG ENDPOINTS ====================

@router.get("/check-user/{username}")
def check_user(username: str):
    """Debug endpoint to check user in database"""
    
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
        
        # Normalize role for debug output
        raw_role_name = user.get('role_name')
        normalized_role = normalize_role_name(raw_role_name, user['role_id'])
        
        return {
            "found": True,
            "user_id": user['user_id'],
            "username": user['username'],
            "role_id": user['role_id'],
            "role_name_raw": raw_role_name,
            "role_name_normalized": normalized_role,  # 🔥 Show both versions
            "full_name": user.get('full_name'),
            "position": user.get('position'),
            "is_active": user.get('is_active'),
            "password_type": "bcrypt" if user['password'].startswith('$2') else "plain",
            "password_preview": user['password'][:30] + "..."
        }
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/check-roles")
def check_roles():
    """Debug endpoint to check roles table"""
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM roles ORDER BY role_id")
        roles = cursor.fetchall()
        
        # Add normalized version
        roles_with_normalized = []
        for role in roles:
            role_dict = dict(role)
            role_dict['normalized_name'] = normalize_role_name(
                role_dict.get('role_name'), 
                role_dict['role_id']
            )
            roles_with_normalized.append(role_dict)
        
        return {
            "success": True,
            "roles": roles_with_normalized
        }
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()