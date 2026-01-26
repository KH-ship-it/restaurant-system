from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2.extras import RealDictCursor
import bcrypt
from datetime import datetime

from config.database import get_db_connection
from models.schemas import EmployeeCreateWithUser, EmployeeUpdate
from utils.auth import get_current_user

router = APIRouter(prefix="/api/employees", tags=["employees"])

# ==================== Position → Role Mapping ====================
POSITION_ROLE_MAP = {
    "Quản lý": "OWNER",    # ✅ Khớp với frontend
    "Đầu bếp": "KITCHEN",
    "Phó bếp": "KITCHEN",
    "Phục vụ": "EMPLOYEE", # ✅ Frontend gửi "EMPLOYEE"
    "Thu ngân": "CASHIER", # ✅ Frontend gửi "CASHIER"
    "Bảo vệ": "EMPLOYEE",
}


def get_role_from_position(position: str) -> str:
    return POSITION_ROLE_MAP.get(position, "EMPLOYEE")


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ==================== Routes ====================

@router.get("")
async def get_all_employees(current_user: dict = Depends(get_current_user)):
    """
    ✅ Lấy danh sách nhân viên
    Quyền: OWNER, admin
    """
    # ✅ Cho phép cả OWNER và admin
    if current_user["role"] not in ["OWNER", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền xem danh sách nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # ✅ Query lấy role từ bảng users
        cursor.execute(
            """
            SELECT 
                e.employee_id,
                e.user_id,
                u.username,
                e.full_name,
                e.phone,
                e.position,
                e.hire_date,
                u.role,
                u.is_active
            FROM employees e
            JOIN users u ON e.user_id = u.user_id
            ORDER BY e.employee_id DESC
            """
        )

        employees = cursor.fetchall()

        # Convert dates to ISO format
        for emp in employees:
            if emp.get("hire_date"):
                emp["hire_date"] = emp["hire_date"].isoformat()
            # ✅ Thêm role_name để frontend hiển thị
            emp["role_name"] = emp.get("role")

        print(f"✅ Fetched {len(employees)} employees for user: {current_user['username']}")
        
        return {"success": True, "data": employees}

    except Exception as e:
        print(f"❌ Error fetching employees: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# ==================== CREATE EMPLOYEE ====================

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreateWithUser,
    current_user: dict = Depends(get_current_user),
):
    """
    ✅ Tạo nhân viên mới
    Quyền: OWNER, admin
    """
    # ✅ Cho phép cả OWNER và admin
    if current_user["role"] not in ["OWNER", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền tạo nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Check username exists
        cursor.execute(
            "SELECT user_id FROM users WHERE username = %s",
            (employee_data.username,),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=400, 
                detail=f"Username '{employee_data.username}' đã tồn tại"
            )

        # ✅ Ưu tiên role từ employee_data (frontend gửi)
        # Nếu không có, fallback sang position mapping
        if hasattr(employee_data, 'role') and employee_data.role:
            role = employee_data.role
            print(f"✅ Using role from request: {role}")
        else:
            role = get_role_from_position(employee_data.position) if employee_data.position else "EMPLOYEE"
            print(f"✅ Mapped role from position '{employee_data.position}': {role}")

        password_hash = hash_password(employee_data.password)

        # ===== TRANSACTION =====
        cursor.execute("BEGIN")

        # 1. Create user
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (%s, %s, %s, TRUE)
            RETURNING user_id
            """,
            (employee_data.username, password_hash, role),
        )
        user_id = cursor.fetchone()["user_id"]
        print(f"✅ Created user_id: {user_id} with role: {role}")

        # 2. Create employee
        cursor.execute(
            """
            INSERT INTO employees (user_id, full_name, phone, position, hire_date)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING employee_id
            """,
            (
                user_id,
                employee_data.full_name,
                employee_data.phone,
                employee_data.position,
                employee_data.hire_date or datetime.now().date(),
            ),
        )

        employee_id = cursor.fetchone()["employee_id"]
        print(f"✅ Created employee_id: {employee_id}")

        cursor.execute("COMMIT")

        return {
            "success": True,
            "message": f"Tạo nhân viên '{employee_data.full_name}' thành công",
            "data": {
                "employee_id": employee_id,
                "user_id": user_id,
                "username": employee_data.username,
                "full_name": employee_data.full_name,
                "position": employee_data.position,
                "role": role,
            },
        }

    except HTTPException:
        cursor.execute("ROLLBACK")
        raise
    except Exception as e:
        cursor.execute("ROLLBACK")
        print(f"❌ Error creating employee: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Tạo nhân viên thất bại: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


# ==================== UPDATE EMPLOYEE ====================
@router.put("/{employee_id}")
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    ✅ Cập nhật thông tin nhân viên
    Quyền: OWNER, admin
    """
    if current_user["role"] not in ["OWNER", "admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền cập nhật nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cursor.execute(
            "SELECT user_id FROM employees WHERE employee_id = %s", 
            (employee_id,)
        )
        emp = cursor.fetchone()
        if not emp:
            raise HTTPException(
                status_code=404, 
                detail="Không tìm thấy nhân viên"
            )

        fields = []
        values = []
        
        if employee_data.full_name:
            fields.append("full_name = %s")
            values.append(employee_data.full_name)
            
        if employee_data.phone:
            fields.append("phone = %s")
            values.append(employee_data.phone)

        if employee_data.position:
            fields.append("position = %s")
            values.append(employee_data.position)

        if not fields:
            raise HTTPException(
                status_code=400, 
                detail="Không có thông tin nào để cập nhật"
            )

        cursor.execute("BEGIN")

        values.append(employee_id)
        cursor.execute(
            f"UPDATE employees SET {', '.join(fields)} WHERE employee_id = %s",
            values,
        )

        # ✅ Nếu đổi position, tự động update role
        if employee_data.position:
            new_role = get_role_from_position(employee_data.position)
            cursor.execute(
                "UPDATE users SET role = %s WHERE user_id = %s",
                (new_role, emp["user_id"]),
            )
            print(f"✅ Updated role to {new_role} for employee_id: {employee_id}")

        cursor.execute("COMMIT")

        return {
            "success": True, 
            "message": "Cập nhật thông tin nhân viên thành công"
        }

    except HTTPException:
        cursor.execute("ROLLBACK")
        raise
    except Exception as e:
        cursor.execute("ROLLBACK")
        print(f"❌ Error updating employee: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Cập nhật thất bại: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


# ==================== DELETE EMPLOYEE ====================

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    ❌ HARD DELETE nhân viên (xóa vĩnh viễn)
    Quyền: OWNER, admin
    """

    if current_user["role"] not in ["OWNER", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền xóa nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 🔍 Lấy thông tin employee
        cursor.execute(
            """
            SELECT employee_id, user_id
            FROM employees
            WHERE employee_id = %s
            """,
            (employee_id,)
        )
        emp = cursor.fetchone()

        if not emp:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy nhân viên"
            )

        # 🚫 Không cho xóa chính mình
        if emp["user_id"] == current_user["user_id"]:
            raise HTTPException(
                status_code=400,
                detail="Không thể xóa tài khoản của chính mình"
            )

        cursor.execute("BEGIN")

        # ❗ 1. XÓA NHÂN VIÊN (HARD DELETE)
        cursor.execute(
            "DELETE FROM employees WHERE employee_id = %s",
            (employee_id,)
        )

        # ❗ 2. XÓA USER LIÊN KẾT
        cursor.execute(
            "DELETE FROM users WHERE user_id = %s",
            (emp["user_id"],)
        )

        cursor.execute("COMMIT")

        print(f"🗑️ HARD deleted employee_id: {employee_id}")

        return {
            "success": True,
            "message": "Đã xóa vĩnh viễn nhân viên"
        }

    except HTTPException:
        cursor.execute("ROLLBACK")
        raise

    except Exception as e:
        cursor.execute("ROLLBACK")
        print(f"❌ Error hard deleting employee: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Xóa nhân viên thất bại: {str(e)}"
        )

    finally:
        cursor.close()
        conn.close()
