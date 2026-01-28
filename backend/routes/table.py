# ========================================
# FILE: backend/routes/tables.py
# ========================================

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from config.database import get_db_connection
from utils.auth import get_current_user

router = APIRouter(prefix="/api/tables", tags=["tables"])

# ========================================
# SCHEMAS
# ========================================

class TableCreate(BaseModel):
    table_number: int
    capacity: int = 4
    status: str = "AVAILABLE"

class TableUpdate(BaseModel):
    capacity: Optional[int] = None
    status: Optional[str] = None
    changeToken: Optional[bool] = False

# ========================================
# GET ALL TABLES
# ========================================

@router.get("/")
async def get_tables(current_user: dict = Depends(get_current_user)):
    """
    Get all tables
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # ✅ Try different possible table names
        table_names = ['tables', 'dining_tables', 'restaurant_tables']
        
        tables_data = None
        used_table_name = None
        
        for table_name in table_names:
            try:
                cursor.execute(f"""
                    SELECT 
                        table_id,
                        table_number as number,
                        capacity,
                        status,
                        qr_code,
                        created_at,
                        updated_at
                    FROM {table_name}
                    ORDER BY table_number
                """)
                
                tables_data = cursor.fetchall()
                used_table_name = table_name
                print(f"✅ Found tables in '{table_name}'")
                break
                
            except Exception as e:
                print(f"⚠️  Table '{table_name}' not found: {e}")
                continue
        
        if tables_data is None:
            # If no table found, return empty array
            print("⚠️  No tables table found in database")
            return {
                "success": True,
                "data": [],
                "message": "No tables table found in database. Please run database migration."
            }
        
        print(f"✅ Loaded {len(tables_data)} tables from '{used_table_name}'")
        
        return {
            "success": True,
            "data": tables_data
        }
        
    except Exception as e:
        print(f"❌ Error getting tables: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting tables: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# CREATE TABLE
# ========================================

@router.post("/")
async def create_table(
    table: TableCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create new table
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if table number already exists
        cursor.execute(
            "SELECT table_id FROM tables WHERE table_number = %s",
            (table.table_number,)
        )
        
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bàn số {table.table_number} đã tồn tại"
            )
        
        # Insert new table
        cursor.execute("""
            INSERT INTO tables (table_number, capacity, status, qr_code)
            VALUES (%s, %s, %s, %s)
            RETURNING table_id, table_number as number, capacity, status, qr_code, created_at
        """, (
            table.table_number,
            table.capacity,
            table.status.upper(),
            f"QR-{table.table_number}"  # Simple QR code placeholder
        ))
        
        new_table = cursor.fetchone()
        conn.commit()
        
        print(f"✅ Created table {table.table_number}")
        
        return {
            "success": True,
            "message": "Thêm bàn thành công",
            "data": new_table
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"❌ Error creating table: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tạo bàn: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# UPDATE TABLE
# ========================================

@router.put("/{table_number}")
async def update_table(
    table_number: int,
    table: TableUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update table info
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute(
            "SELECT table_id FROM tables WHERE table_number = %s",
            (table_number,)
        )
        
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy bàn số {table_number}"
            )
        
        # Build update query dynamically
        update_fields = []
        params = []
        
        if table.capacity is not None:
            update_fields.append("capacity = %s")
            params.append(table.capacity)
        
        if table.status is not None:
            update_fields.append("status = %s")
            params.append(table.status.upper())
        
        if table.changeToken:
            update_fields.append("qr_code = %s")
            params.append(f"QR-{table_number}-{int(datetime.now().timestamp())}")
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không có thông tin để cập nhật"
            )
        
        # Add table_number to params
        params.append(table_number)
        
        # Execute update
        query = f"""
            UPDATE tables 
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE table_number = %s
            RETURNING table_id, table_number as number, capacity, status, qr_code, updated_at
        """
        
        cursor.execute(query, params)
        updated_table = cursor.fetchone()
        conn.commit()
        
        print(f"✅ Updated table {table_number}")
        
        return {
            "success": True,
            "message": "Cập nhật bàn thành công",
            "data": updated_table
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating table: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật bàn: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# DELETE TABLE
# ========================================

@router.delete("/{table_number}")
async def delete_table(
    table_number: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete table
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if table is occupied
        cursor.execute(
            "SELECT status FROM tables WHERE table_number = %s",
            (table_number,)
        )
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy bàn số {table_number}"
            )
        
        if result['status'] == 'OCCUPIED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể xóa bàn đang có khách"
            )
        
        # Delete table
        cursor.execute(
            "DELETE FROM tables WHERE table_number = %s",
            (table_number,)
        )
        
        conn.commit()
        
        print(f"✅ Deleted table {table_number}")
        
        return {
            "success": True,
            "message": f"Đã xóa bàn số {table_number}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"❌ Error deleting table: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xóa bàn: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()

# ========================================
# GET TABLE BY NUMBER
# ========================================

@router.get("/{table_number}")
async def get_table(
    table_number: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Get specific table by number
    Requires authentication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                table_id,
                table_number as number,
                capacity,
                status,
                qr_code,
                created_at,
                updated_at
            FROM tables
            WHERE table_number = %s
        """, (table_number,))
        
        table = cursor.fetchone()
        
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy bàn số {table_number}"
            )
        
        return {
            "success": True,
            "data": table
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting table: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy thông tin bàn: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()