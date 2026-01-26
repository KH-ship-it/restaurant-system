# backend/routes/table.py
from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import TableCreate, TableUpdate
from middleware.auth import verify_token, require_role
from typing import Optional
router = APIRouter(prefix="/api/tables", tags=["Table Management"])

@router.get("")
def get_tables(
    status: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get all tables"""
    cursor = conn.cursor()
    
    query = "SELECT * FROM dining_tables WHERE 1=1"  # ✅ THAY ĐỔI: tables → dining_tables
    params = []
    
    if status:
        query += " AND status = %s"
        params.append(status.upper())
    
    query += " ORDER BY table_number"
    
    cursor.execute(query, params)
    tables = cursor.fetchall()
    cursor.close()
    
    return {"success": True, "data": tables}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_table(
    table: TableCreate,
    current_user: dict = Depends(require_role(["OWNER"])),
    conn=Depends(get_db)
):
    """Create new table (Owner only)"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO dining_tables (table_number, status)
            VALUES (%s, %s)
            RETURNING *
        """, (table.table_number, table.status))
        
        new_table = cursor.fetchone()
        conn.commit()
        cursor.close()
        
        return {"success": True, "message": "Table created successfully", "data": new_table}
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{table_id}/status")
def update_table_status(
    table_id: int,
    status_data: TableUpdate,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Update table status"""
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "UPDATE dining_tables SET status = %s WHERE table_id = %s RETURNING *",
            (status_data.status.upper(), table_id)
        )
        
        updated_table = cursor.fetchone()
        
        if not updated_table:
            raise HTTPException(status_code=404, detail="Table not found")
        
        conn.commit()
        cursor.close()
        
        return {"success": True, "data": updated_table}
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{table_id}")
def delete_table(
    table_id: int,
    current_user: dict = Depends(require_role(["OWNER"])),
    conn=Depends(get_db)
):
    """Delete table (Owner only)"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM dining_tables WHERE table_id = %s RETURNING *", (table_id,))
        deleted_table = cursor.fetchone()
        
        if not deleted_table:
            raise HTTPException(status_code=404, detail="Table not found")
        
        conn.commit()
        cursor.close()
        
        return {"success": True, "message": "Table deleted successfully"}
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))
        