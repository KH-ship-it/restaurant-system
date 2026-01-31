# routes/employees.py - UPDATED WITH POSITION-ROLE MAPPING
from fastapi import APIRouter, Depends, HTTPException
from middleware.auth import verify_token
from utils.auth import get_password_hash
from config.database import get_db_connection
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/employees", tags=["employees"])

# ============================================================================
# POSITION TO ROLE MAPPING - CRITICAL CHANGE
# ============================================================================

POSITION_TO_ROLE = {
    "Quản lý": "OWNER",      # Quản lý → ADMIN → /thongke
    "Đầu bếp": "KITCHEN",    # Đầu bếp → KITCHEN → /order
    "Phục vụ": "STAFF",      # Phục vụ → STAFF → /order
    "Thu ngân": "CASHIER",   # Thu ngân → CASHIER → /thungan
}

def get_role_id_from_position(cursor, position: str) -> int:
    """Get role_id based on position"""
    
    # Map position to role_name
    role_name = POSITION_TO_ROLE.get(position, "STAFF")  # Default to STAFF
    
    print(f"   Position: '{position}' → Role: '{role_name}'")
    
    # Get role_id from database
    cursor.execute(
        "SELECT role_id FROM roles WHERE role_name = %s LIMIT 1",
        (role_name,)
    )
    role_result = cursor.fetchone()
    
    if not role_result:
        # Fallback to STAFF role
        cursor.execute(
            "SELECT role_id FROM roles WHERE role_name = 'STAFF' LIMIT 1"
        )
        role_result = cursor.fetchone()
        
        if not role_result:
            raise Exception(f"Cannot find role_id for position '{position}'")
    
    role_id = role_result['role_id']
    print(f"   → role_id: {role_id}")
    
    return role_id

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class EmployeeCreate(BaseModel):
    username: str
    password: str
    full_name: str
    phone: Optional[str] = None
    position: str = "Phục vụ"
    
    class Config:
        extra = "ignore"

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None  # Changing position will change role
    
    class Config:
        extra = "ignore"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def validate_employee_data(employee: EmployeeCreate) -> dict:
    """Validate and clean employee data"""
    errors = []
    
    # Validate username
    username = employee.username.strip() if employee.username else ""
    if len(username) < 3:
        errors.append("Tên đăng nhập phải có ít nhất 3 ký tự")
    
    # Validate password
    if len(employee.password) < 6:
        errors.append("Mật khẩu phải có ít nhất 6 ký tự")
    
    # Validate full_name
    full_name = employee.full_name.strip() if employee.full_name else ""
    if len(full_name) < 2:
        errors.append("Họ tên phải có ít nhất 2 ký tự")
    
    # Validate position
    if employee.position not in POSITION_TO_ROLE:
        errors.append(f"Vị trí không hợp lệ. Chọn: {', '.join(POSITION_TO_ROLE.keys())}")
    
    # Clean phone
    phone = employee.phone.strip() if employee.phone else None
    if phone and len(phone) == 0:
        phone = None
    
    if errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "Dữ liệu không hợp lệ", "errors": errors}
        )
    
    return {
        "username": username,
        "password": employee.password,
        "full_name": full_name,
        "phone": phone,
        "position": employee.position
    }

# ============================================================================
# ROUTES
# ============================================================================

@router.get("")
def get_employees(current_user: dict = Depends(verify_token)):
    """Get all employees - OWNER/ADMIN only"""
    
    conn = None
    cursor = None
    
    try:
        print(f"\n{'='*70}")
        print(f"📋 [GET EMPLOYEES]")
        print(f"{'='*70}")
        
        # Allow OWNER and ADMIN to view
        if current_user.get("role") not in ["OWNER", "ADMIN"]:
            raise HTTPException(
                status_code=403,
                detail="Chỉ OWNER/ADMIN mới có quyền xem danh sách nhân viên"
            )
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                e.employee_id,
                e.user_id,
                u.username,
                e.full_name,
                e.phone,
                e.position,
                e.hire_date,
                u.role_id,
                r.role_name,
                u.is_active
            FROM employees e
            JOIN users u ON e.user_id = u.user_id
            LEFT JOIN roles r ON u.role_id = r.role_id
            ORDER BY e.employee_id
        """)
        
        rows = cursor.fetchall()
        employees = []
        
        for row in rows:
            employees.append({
                'employee_id': row['employee_id'],
                'user_id': row['user_id'],
                'username': row['username'],
                'full_name': row['full_name'],
                'phone': row['phone'],
                'position': row['position'],
                'hire_date': row['hire_date'].isoformat() if row['hire_date'] else None,
                'role': row['role_name'] or 'STAFF',
                'is_active': row['is_active']
            })

        print(f"✅ Loaded {len(employees)} employees")
        print(f"{'='*70}\n")

        return {
            "success": True,
            "data": employees
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.post("")
def create_employee(
    employee: EmployeeCreate,
    current_user: dict = Depends(verify_token)
):
    """Create new employee - OWNER/ADMIN only, auto-assign role based on position"""
    
    print(f"\n{'='*70}")
    print(f" [CREATE EMPLOYEE] REQUEST RECEIVED")
    print(f"{'='*70}")
    print(f"Current user: {current_user.get('username')} (role: {current_user.get('role')})")
    print(f"\n RAW DATA:")
    print(f"  username: '{employee.username}'")
    print(f"  full_name: '{employee.full_name}'")
    print(f"  phone: '{employee.phone}'")
    print(f"  position: '{employee.position}'")
    print(f"{'='*70}\n")
    
    # Check permission
    if current_user.get("role") not in ["OWNER", "ADMIN"]:
        print(f" Permission denied")
        raise HTTPException(
            status_code=403, 
            detail="Chỉ OWNER/ADMIN mới có quyền tạo nhân viên"
        )
    
    conn = None
    cursor = None
    
    try:
        # Validate data
        print(f" Validating data...")
        validated_data = validate_employee_data(employee)
        print(f"Data validated")
        
        # Connect to database
        print(f"\n Connecting to database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        print(f" Database connected")
        
        # Check username exists
        print(f"\nChecking if username exists...")
        cursor.execute(
            "SELECT user_id, username FROM users WHERE username = %s", 
            (validated_data['username'],)
        )
        existing = cursor.fetchone()
        
        if existing:
            print(f" Username already exists: {existing['username']}")
            raise HTTPException(
                status_code=400, 
                detail=f"Tên đăng nhập '{validated_data['username']}' đã tồn tại"
            )
        
        print(f" Username available")
        
        # Hash password
        print(f"\n Hashing password...")
        hashed_password = get_password_hash(validated_data['password'])
        print(f" Password hashed")
        
        #  GET ROLE_ID FROM POSITION (KEY CHANGE)
        print(f"\n Mapping position to role...")
        role_id = get_role_id_from_position(cursor, validated_data['position'])
        print(f"Position '{validated_data['position']}' → role_id: {role_id}")
        
        # Create user account
        print(f"\n👤 Creating user account...")
        cursor.execute("""
            INSERT INTO users (username, password, role_id, is_active)
            VALUES (%s, %s, %s, true)
            RETURNING user_id
        """, (validated_data['username'], hashed_password, role_id))
        
        user_result = cursor.fetchone()
        
        if not user_result:
            raise Exception("Failed to create user - no user_id returned")
        
        user_id = user_result['user_id']
        print(f" User created - User ID: {user_id}")
        
        # Create employee record
        print(f"\n Creating employee record...")
        cursor.execute("""
            INSERT INTO employees (user_id, full_name, phone, position, hire_date)
            VALUES (%s, %s, %s, %s, CURRENT_DATE)
            RETURNING employee_id
        """, (
            user_id, 
            validated_data['full_name'], 
            validated_data['phone'], 
            validated_data['position']
        ))
        
        emp_result = cursor.fetchone()
        
        if not emp_result:
            raise Exception("Failed to create employee - no employee_id returned")
        
        employee_id = emp_result['employee_id']
        print(f"Employee created - Employee ID: {employee_id}")
        
        # Commit transaction
        print(f"\n Committing transaction...")
        conn.commit()
        print(f" Transaction committed")
        
        result = {
            "success": True,
            "message": f"Tạo nhân viên '{validated_data['full_name']}' thành công!",
            "data": {
                "employee_id": employee_id,
                "user_id": user_id,
                "username": validated_data['username'],
                "full_name": validated_data['full_name'],
                "phone": validated_data['phone'],
                "position": validated_data['position'],
                "role": POSITION_TO_ROLE[validated_data['position']]
            }
        }
        
        print(f"\n{'='*70}")
        print(f" CREATE EMPLOYEE SUCCESS")
        print(f"   Employee: {validated_data['full_name']}")
        print(f"   Position: {validated_data['position']}")
        print(f"   Role: {POSITION_TO_ROLE[validated_data['position']]}")
        print(f"{'='*70}\n")
        
        return result
        
    except HTTPException as he:
        if conn:
            conn.rollback()
            print(f" Transaction rolled back (HTTP error)")
        raise he
        
    except Exception as e:
        if conn:
            conn.rollback()
            print(f"Transaction rolled back")
        
        print(f"\n{'='*70}")
        print(f" CREATE EMPLOYEE ERROR")
        print(f"{'='*70}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*70}\n")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Lỗi tạo nhân viên: {str(e)}"
        )
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.put("/{employee_id}")
def update_employee(
    employee_id: int,
    employee: EmployeeUpdate,
    current_user: dict = Depends(verify_token)
):
    """Update employee - OWNER/ADMIN only, changing position changes role"""
    
    print(f"\n{'='*70}")
    print(f"✏️ [UPDATE EMPLOYEE] ID: {employee_id}")
    print(f"{'='*70}")
    
    if current_user.get("role") not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=403, 
            detail="Chỉ OWNER/ADMIN mới có quyền cập nhật nhân viên"
        )
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get employee and user info
        cursor.execute("""
            SELECT e.employee_id, e.user_id, e.full_name, e.position, u.role_id
            FROM employees e
            JOIN users u ON e.user_id = u.user_id
            WHERE e.employee_id = %s
        """, (employee_id,))
        
        existing = cursor.fetchone()
        
        if not existing:
            raise HTTPException(
                status_code=404, 
                detail=f"Không tìm thấy nhân viên ID {employee_id}"
            )
        
        user_id = existing['user_id']
        old_position = existing['position']
        
        # Build employee update
        emp_updates = []
        emp_params = []
        
        if employee.full_name:
            emp_updates.append("full_name = %s")
            emp_params.append(employee.full_name.strip())
        
        if employee.phone is not None:
            phone = employee.phone.strip() if employee.phone else None
            emp_updates.append("phone = %s")
            emp_params.append(phone)
        
        if employee.position:
            emp_updates.append("position = %s")
            emp_params.append(employee.position)
        
        if not emp_updates:
            raise HTTPException(
                status_code=400, 
                detail="Không có dữ liệu để cập nhật"
            )
        
        # Update employee table
        emp_params.append(employee_id)
        cursor.execute(f"""
            UPDATE employees 
            SET {', '.join(emp_updates)}
            WHERE employee_id = %s
        """, emp_params)
        
        #  IF POSITION CHANGED, UPDATE ROLE IN USERS TABLE
        if employee.position and employee.position != old_position:
            print(f"\nPosition changed: '{old_position}' → '{employee.position}'")
            
            new_role_id = get_role_id_from_position(cursor, employee.position)
            
            cursor.execute("""
                UPDATE users
                SET role_id = %s
                WHERE user_id = %s
            """, (new_role_id, user_id))
            
            print(f"Role updated to match new position")
        
        conn.commit()
        
        print(f" Updated employee ID: {employee_id}")
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "message": f"Cập nhật nhân viên thành công!"
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f" UPDATE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    current_user: dict = Depends(verify_token)
):
    """Delete employee - OWNER/ADMIN only"""
    
    print(f"\n{'='*70}")
    print(f"🗑️ [DELETE EMPLOYEE] ID: {employee_id}")
    print(f"{'='*70}")
    
    if current_user.get("role") not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=403, 
            detail="Chỉ OWNER/ADMIN mới có quyền xóa nhân viên"
        )
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get employee info
        cursor.execute("""
            SELECT e.user_id, e.full_name, u.username 
            FROM employees e
            JOIN users u ON e.user_id = u.user_id
            WHERE e.employee_id = %s
        """, (employee_id,))
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(
                status_code=404, 
                detail=f"Không tìm thấy nhân viên ID {employee_id}"
            )
        
        user_id = result['user_id']
        full_name = result['full_name']
        username = result['username']
        
        # Prevent self-deletion
        if user_id == current_user.get('user_id'):
            raise HTTPException(
                status_code=400,
                detail="Không thể xóa chính mình"
            )
        
        # Delete employee first (foreign key)
        cursor.execute("DELETE FROM employees WHERE employee_id = %s", (employee_id,))
        
        # Delete user
        cursor.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
        
        conn.commit()
        
        print(f"Deleted: {full_name} ({username})")
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "message": f"Đã xóa nhân viên '{full_name}' thành công!"
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f" DELETE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()