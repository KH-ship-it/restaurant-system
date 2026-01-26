from fastapi import APIRouter, HTTPException, status, Depends
from models.schemas import UserLogin, LoginResponse, UserResponse
from config.database import get_db_connection
from utils.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# ✅ CẬP NHẬT: Thêm CASHIER role và route
ROLE_ROUTES = {
    "OWNER": ["/admin", "/manager", "/kitchen", "/cashier", "/staff"],  # Owner: tất cả
    "admin": ["/admin"],  # Quản lý (badge tím "Quản lý")
    "KITCHEN": ["/kitchen"],  # Đầu bếp/Phó bếp (badge nâu "Đầu bếp" / "Phó bếp")
    "CASHIER": ["/cashier"],  # ✅ Thu ngân - THÊM DÒNG NÀY
    "staff": ["/staff"],  # Nhân viên
    "EMPLOYEE": ["/staff"],  # Nhân viên
}

# ✅ CẬP NHẬT: Thêm display name cho cashier
ROLE_DISPLAY = {
    "OWNER": "Chủ nhà hàng",
    "admin": "Quản lý",
    "KITCHEN": "Bếp",
    "CASHIER": "Thu ngân",  # ✅ THÊM DÒNG NÀY
    "staff": "Nhân viên",
    "EMPLOYEE": "Nhân viên"
}

# ✅ THÊM: Default route cho mỗi role khi login
DEFAULT_ROUTES = {
    "OWNER": "/admin",
    "admin": "/admin",
    "KITCHEN": "/kitchen",
    "CASHIER": "/cashier",  # ✅ Cashier redirect đến /cashier
    "staff": "/staff",
    "EMPLOYEE": "/staff"
}

@router.post("/login", response_model=LoginResponse)
async def login(credentials: UserLogin):
    """
    Login endpoint with role-based access control
    - Kiểm tra username/password
    - Kiểm tra tài khoản có active không
    - Trả về JWT token + allowed_routes + default_route theo role
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Lấy thông tin user từ database
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
        
        # Kiểm tra tài khoản có bị khóa không
        if not user['is_active']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
            )
        
        # Xác thực mật khẩu
        if not verify_password(credentials.password, user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tên đăng nhập hoặc mật khẩu không đúng"
            )
        
        # Lấy role của user
        user_role = user['role']
        
        # Validate role có tồn tại trong hệ thống không
        if user_role not in ROLE_ROUTES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Vai trò '{user_role}' không hợp lệ trong hệ thống"
            )
        
        # Tạo JWT token
        token = create_access_token(
            user_id=user['user_id'],
            username=user['username'],
            role=user_role
        )
        
        # Lấy danh sách routes được phép truy cập
        allowed_routes = ROLE_ROUTES.get(user_role, [])
        
        # ✅ Lấy default route để redirect sau khi login
        default_route = DEFAULT_ROUTES.get(user_role, "/")
        
        # Chuẩn bị response
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
            allowed_routes=allowed_routes,
            default_route=default_route  # ✅ Thêm default_route vào response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Đăng nhập thất bại: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Lấy thông tin user hiện tại
    Yêu cầu JWT token hợp lệ
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.role, u.is_active,
                   e.full_name, e.phone, e.position
            FROM users u
            LEFT JOIN employees e ON u.user_id = e.user_id
            WHERE u.user_id = %s
            """,
            (current_user['user_id'],)
        )
        
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng"
            )
        
        # Lấy allowed routes
        allowed_routes = ROLE_ROUTES.get(user['role'], [])
        
        return {
            "success": True,
            "data": {
                "user_id": user['user_id'],
                "username": user['username'],
                "role": user['role'],
                "role_display": ROLE_DISPLAY.get(user['role'], user['role']),
                "full_name": user.get('full_name'),
                "phone": user.get('phone'),
                "position": user.get('position'),
                "is_active": user['is_active'],
                "allowed_routes": allowed_routes,
                "default_route": DEFAULT_ROUTES.get(user['role'], "/")  # ✅ Thêm default_route
            }
        }
    
    finally:
        cursor.close()
        conn.close()


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Đăng xuất
    JWT không cần xử lý server-side, client tự xóa token
    """
    return {
        "success": True,
        "message": "Đăng xuất thành công"
    }


# ==================== Helper Functions ====================

def check_route_permission(user_role: str, requested_route: str) -> bool:
    """
    Kiểm tra user có quyền truy cập route không
    
    Args:
        user_role: Role của user (OWNER, admin, KITCHEN, CASHIER, staff)
        requested_route: Route muốn truy cập (vd: /admin/dashboard)
    
    Returns:
        bool: True nếu có quyền, False nếu không
    """
    allowed_routes = ROLE_ROUTES.get(user_role, [])
    
    for allowed_route in allowed_routes:
        if requested_route.startswith(allowed_route):
            return True
    
    return False


def require_role_permission(requested_route: str):
    """
    Dependency để kiểm tra quyền truy cập route
    
    Cách dùng:
    @router.get("/admin/dashboard", dependencies=[Depends(require_role_permission("/admin"))])
    """
    async def check_permission(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get('role')
        
        if not check_route_permission(user_role, requested_route):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bạn không có quyền truy cập vào {requested_route}. Vai trò của bạn là '{ROLE_DISPLAY.get(user_role, user_role)}'"
            )
        
        return current_user
    
    return check_permission