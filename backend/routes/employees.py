# ========================================
# FILE: backend/routes/employees.py
# FIXED VERSION - Handles both with/without trailing slash
# ========================================

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from config.database import get_db_connection
from utils.auth import get_current_user

router = APIRouter(prefix="/api/employees", tags=["employees"])

# ========================================
# SCHEMAS
# ========================================

class EmployeeCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str = "staff"
    salary: Optional[float] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    salary: Optional[float] = None
    status: Optional[str] = None

# ========================================
# GET ALL EMPLOYEES - FIXED WITH BOTH DECORATORS
# ========================================

@router.get("")  # Handles /api/employees
@router.get("/")  # Handles /api/employees/
async def get_employees(current_user: dict = Depends(get_current_user)):
    """
    Get all employees
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                employee_id,
                name,
                phone,
                email,
                role,
                salary,
                status,
                hire_date,
                created_at,
                updated_at
            FROM employees
            ORDER BY created_at DESC
        """)
        
        employees = cursor.fetchall()
        
        print(f"✅ Loaded {len(employees)} employees")
        
        return {
            "success": True,
            "data": employees
        }
        
    except Exception as e:
        print(f"❌ Error getting employees: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting employees: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# CREATE EMPLOYEE - FIXED WITH BOTH DECORATORS
# ========================================

@router.post("")  # Handles /api/employees
@router.post("/")  # Handles /api/employees/
async def create_employee(
    employee: EmployeeCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create new employee
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if phone already exists
        cursor.execute(
            "SELECT employee_id FROM employees WHERE phone = %s",
            (employee.phone,)
        )
        
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số điện thoại {employee.phone} đã tồn tại"
            )
        
        # Check if email already exists (if provided)
        if employee.email:
            cursor.execute(
                "SELECT employee_id FROM employees WHERE email = %s",
                (employee.email,)
            )
            
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email {employee.email} đã tồn tại"
                )
        
        # Insert new employee
        cursor.execute("""
            INSERT INTO employees (name, phone, email, role, salary, status, hire_date)
            VALUES (%s, %s, %s, %s, %s, 'active', NOW())
            RETURNING employee_id, name, phone, email, role, salary, status, hire_date, created_at
        """, (
            employee.name,
            employee.phone,
            employee.email,
            employee.role,
            employee.salary
        ))
        
        new_employee = cursor.fetchone()
        conn.commit()
        
        print(f"✅ Created employee {employee.name}")
        
        return {
            "success": True,
            "message": "Thêm nhân viên thành công",
            "data": new_employee
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"❌ Error creating employee: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tạo nhân viên: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# GET EMPLOYEE BY ID
# ========================================

@router.get("/{employee_id}")
async def get_employee(
    employee_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get specific employee by ID
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                employee_id,
                name,
                phone,
                email,
                role,
                salary,
                status,
                hire_date,
                created_at,
                updated_at
            FROM employees
            WHERE employee_id = %s
        """, (employee_id,))
        
        employee = cursor.fetchone()
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy nhân viên ID {employee_id}"
            )
        
        return {
            "success": True,
            "data": employee
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting employee: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy thông tin nhân viên: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# UPDATE EMPLOYEE
# ========================================

@router.put("/{employee_id}")
async def update_employee(
    employee_id: int,
    employee: EmployeeUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update employee info
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if employee exists
        cursor.execute(
            "SELECT employee_id FROM employees WHERE employee_id = %s",
            (employee_id,)
        )
        
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy nhân viên ID {employee_id}"
            )
        
        # Build update query dynamically
        update_fields = []
        params = []
        
        if employee.name is not None:
            update_fields.append("name = %s")
            params.append(employee.name)
        
        if employee.phone is not None:
            # Check if phone already exists for another employee
            cursor.execute(
                "SELECT employee_id FROM employees WHERE phone = %s AND employee_id != %s",
                (employee.phone, employee_id)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Số điện thoại {employee.phone} đã được sử dụng"
                )
            update_fields.append("phone = %s")
            params.append(employee.phone)
        
        if employee.email is not None:
            # Check if email already exists for another employee
            cursor.execute(
                "SELECT employee_id FROM employees WHERE email = %s AND employee_id != %s",
                (employee.email, employee_id)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email {employee.email} đã được sử dụng"
                )
            update_fields.append("email = %s")
            params.append(employee.email)
        
        if employee.role is not None:
            update_fields.append("role = %s")
            params.append(employee.role)
        
        if employee.salary is not None:
            update_fields.append("salary = %s")
            params.append(employee.salary)
        
        if employee.status is not None:
            update_fields.append("status = %s")
            params.append(employee.status)
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không có thông tin để cập nhật"
            )
        
        # Add employee_id to params
        params.append(employee_id)
        
        # Execute update
        query = f"""
            UPDATE employees 
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE employee_id = %s
            RETURNING employee_id, name, phone, email, role, salary, status, hire_date, updated_at
        """
        
        cursor.execute(query, params)
        updated_employee = cursor.fetchone()
        conn.commit()
        
        print(f"✅ Updated employee {employee_id}")
        
        return {
            "success": True,
            "message": "Cập nhật nhân viên thành công",
            "data": updated_employee
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating employee: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật nhân viên: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# DELETE EMPLOYEE
# ========================================

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete employee (soft delete - set status to inactive)
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if employee exists
        cursor.execute(
            "SELECT employee_id, status FROM employees WHERE employee_id = %s",
            (employee_id,)
        )
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy nhân viên ID {employee_id}"
            )
        
        # Soft delete - set status to inactive instead of actual deletion
        cursor.execute("""
            UPDATE employees 
            SET status = 'inactive', updated_at = NOW()
            WHERE employee_id = %s
        """, (employee_id,))
        
        conn.commit()
        
        print(f"✅ Deleted (deactivated) employee {employee_id}")
        
        return {
            "success": True,
            "message": f"Đã xóa nhân viên ID {employee_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"❌ Error deleting employee: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xóa nhân viên: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()