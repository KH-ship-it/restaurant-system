# routes/employees.py - FIXED

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
    "Quản lý": "OWNER",
    "Đầu bếp": "KITCHEN",
    "Phó bếp": "KITCHEN",
    "Phục vụ": "EMPLOYEE",
    "Thu ngân": "CASHIER",
    "Bảo vệ": "EMPLOYEE",
}


def get_role_from_position(position: str) -> str:
    """Map position to role"""
    return POSITION_ROLE_MAP.get(position, "EMPLOYEE")


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ==================== GET ALL EMPLOYEES ====================

@router.get("")
async def get_all_employees(current_user: dict = Depends(get_current_user)):
    """
    Get all employees
    Permission: OWNER, admin
    """
    print(f"\n🔍 GET /api/employees - User: {current_user.get('username')}, Role: {current_user.get('role')}")
    
    if current_user["role"] not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền xem danh sách nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
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
                u.is_active,
                e.created_at
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
            if emp.get("created_at"):
                emp["created_at"] = emp["created_at"].isoformat()
            emp["role_name"] = emp.get("role")

        print(f"✅ Fetched {len(employees)} employees")
        
        return {
            "success": True,
            "data": employees,
            "count": len(employees)
        }

    except Exception as e:
        print(f"❌ Error fetching employees: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy danh sách nhân viên: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


# ==================== GET EMPLOYEE BY ID ====================

@router.get("/{employee_id}")
async def get_employee_by_id(
    employee_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get employee details by ID"""
    print(f"\n🔍 GET /api/employees/{employee_id}")
    
    if current_user["role"] not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không có quyền truy cập"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
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
            WHERE e.employee_id = %s
            """,
            (employee_id,)
        )

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy nhân viên ID {employee_id}"
            )

        if employee.get("hire_date"):
            employee["hire_date"] = employee["hire_date"].isoformat()

        return {"success": True, "data": employee}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching employee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
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
    Create new employee with user account
    Permission: OWNER, ADMIN
    """
    print(f"\n📥 POST /api/employees - Creating employee: {employee_data.full_name}")
    print(f"   Username: {employee_data.username}")
    print(f"   Position: {employee_data.position}")
    
    if current_user["role"] not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền tạo nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Check username uniqueness
        cursor.execute(
            "SELECT user_id FROM users WHERE username = %s",
            (employee_data.username,),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{employee_data.username}' đã tồn tại"
            )

        # Determine role
        if employee_data.role:
            role = employee_data.role
        elif employee_data.position:
            role = get_role_from_position(employee_data.position)
        else:
            role = "EMPLOYEE"

        print(f"   Role: {role}")

        # Hash password
        password_hash = hash_password(employee_data.password)

        # Start transaction
        cursor.execute("BEGIN")

        try:
            # 1. Create user account
            cursor.execute(
                """
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES (%s, %s, %s, TRUE)
                RETURNING user_id
                """,
                (employee_data.username, password_hash, role),
            )
            user_result = cursor.fetchone()
            
            if not user_result:
                raise Exception("Failed to create user account")
                
            user_id = user_result["user_id"]
            print(f"   ✅ Created user_id: {user_id}")

            # 2. Create employee record
            hire_date = employee_data.hire_date if employee_data.hire_date else datetime.now().date()
            
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
                    hire_date,
                ),
            )
            
            employee_result = cursor.fetchone()
            
            if not employee_result:
                raise Exception("Failed to create employee record")
                
            employee_id = employee_result["employee_id"]
            print(f"   ✅ Created employee_id: {employee_id}")

            # Commit transaction
            cursor.execute("COMMIT")
            print(f"✅ Transaction committed successfully")

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
                    "hire_date": hire_date.isoformat(),
                },
            }

        except Exception as e:
            cursor.execute("ROLLBACK")
            print(f"❌ Transaction error: {e}")
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating employee: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
    Update employee information
    Permission: OWNER, ADMIN
    """
    print(f"\n✏️ PUT /api/employees/{employee_id}")
    
    if current_user["role"] not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền cập nhật nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Check if employee exists
        cursor.execute(
            "SELECT user_id FROM employees WHERE employee_id = %s",
            (employee_id,)
        )
        emp = cursor.fetchone()
        
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy nhân viên"
            )

        # Build update query
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
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không có thông tin nào để cập nhật"
            )

        cursor.execute("BEGIN")

        try:
            # Update employee
            values.append(employee_id)
            cursor.execute(
                f"UPDATE employees SET {', '.join(fields)} WHERE employee_id = %s",
                values,
            )

            # Update role if position changed
            if employee_data.position:
                new_role = get_role_from_position(employee_data.position)
                cursor.execute(
                    "UPDATE users SET role = %s WHERE user_id = %s",
                    (new_role, emp["user_id"]),
                )
                print(f"   ✅ Updated role to {new_role}")

            cursor.execute("COMMIT")
            print(f"✅ Employee {employee_id} updated successfully")

            return {
                "success": True,
                "message": "Cập nhật thông tin nhân viên thành công"
            }

        except Exception as e:
            cursor.execute("ROLLBACK")
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating employee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
    Delete employee (hard delete)
    Permission: OWNER, ADMIN
    """
    print(f"\n🗑️ DELETE /api/employees/{employee_id}")
    
    if current_user["role"] not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ chủ nhà hàng và quản lý mới có quyền xóa nhân viên"
        )

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Get employee info
        cursor.execute(
            """
            SELECT e.employee_id, e.user_id, e.full_name, u.username
            FROM employees e
            JOIN users u ON e.user_id = u.user_id
            WHERE e.employee_id = %s
            """,
            (employee_id,)
        )
        emp = cursor.fetchone()

        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy nhân viên"
            )

        # Prevent self-deletion
        if emp["user_id"] == current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể xóa tài khoản của chính mình"
            )

        cursor.execute("BEGIN")

        try:
            # Delete employee (CASCADE will delete user)
            cursor.execute(
                "DELETE FROM employees WHERE employee_id = %s",
                (employee_id,)
            )

            cursor.execute(
                "DELETE FROM users WHERE user_id = %s",
                (emp["user_id"],)
            )

            cursor.execute("COMMIT")

            print(f"✅ Deleted employee: {emp['full_name']} ({emp['username']})")

            return {
                "success": True,
                "message": f"Đã xóa nhân viên {emp['full_name']} ({emp['username']}) thành công"
            }

        except Exception as e:
            cursor.execute("ROLLBACK")
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting employee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Xóa nhân viên thất bại: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()


print("✅ Employees router loaded with enhanced logging")