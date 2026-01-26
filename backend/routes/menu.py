from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import MenuItemCreate, MenuItemUpdate
from middleware.auth import require_role
from typing import Optional
from psycopg2.extras import RealDictCursor

router = APIRouter(prefix="/api/menu", tags=["Menu Management"])


@router.get("/")
def get_menu_items(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    conn=Depends(get_db)
):
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = """
        SELECT 
            m.item_id,
            m.category_id,
            m.item_name,
            m.description,
            m.price,
            m.image_url,
            m.status,
            m.created_at,
            c.category_name
        FROM menu_items m
        LEFT JOIN categories c ON m.category_id = c.category_id
        WHERE 1=1
    """
    params = []
    if category:
        query += " AND c.category_name = %s"
        params.append(category)

    if status:
        query += " AND m.status = %s"
        params.append(status.upper())
    
    if search:
        query += " AND (m.item_name ILIKE %s OR m.description ILIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY m.item_name"

    cursor.execute(query, params)
    items = cursor.fetchall()
    cursor.close()

    return {
        "success": True,
        "data": items,
        "count": len(items)
    }


@router.get("/public")
def get_public_menu_items(conn=Depends(get_db)):
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT 
            m.item_id,
            m.item_name,
            m.description,
            m.price,
            m.image_url,
            m.category_id,
            c.category_name
        FROM menu_items m
        LEFT JOIN categories c ON m.category_id = c.category_id
        WHERE UPPER(m.status) = 'AVAILABLE'
        ORDER BY m.item_name
    """

    cursor.execute(query)
    items = cursor.fetchall()
    cursor.close()

    return {
        "success": True,
        "data": items,
        "count": len(items)
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_menu_item(
    item: MenuItemCreate,
    conn=Depends(get_db)
):
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            INSERT INTO menu_items 
            (category_id, item_name, description, price, image_url, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            item.category_id,
            item.item_name,
            item.description,
            item.price,
            item.image_url,
            item.status.upper()
        ))
        new_item = cursor.fetchone()
        conn.commit()
        cursor.close()
        return {
            "success": True,
            "message": "Menu item created",
            "data": new_item
        }

    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{item_id}", status_code=status.HTTP_200_OK)
def update_menu_item(
    item_id: int,
    item: MenuItemUpdate,
    conn=Depends(get_db)
):
    """Cập nhật món ăn"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Kiểm tra món có tồn tại không
        cursor.execute("SELECT * FROM menu_items WHERE item_id = %s", (item_id,))
        existing_item = cursor.fetchone()
        
        if not existing_item:
            cursor.close()
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        # Build dynamic update query based on provided fields
        update_fields = []
        params = []
        
        if item.category_id is not None:
            update_fields.append("category_id = %s")
            params.append(item.category_id)
        if item.item_name is not None:
            update_fields.append("item_name = %s")
            params.append(item.item_name)
        if item.description is not None:
            update_fields.append("description = %s")
            params.append(item.description)
        if item.price is not None:
            update_fields.append("price = %s")
            params.append(item.price)
        if item.image_url is not None:
            update_fields.append("image_url = %s")
            params.append(item.image_url)
        if item.status is not None:
            update_fields.append("status = %s")
            params.append(item.status.upper())
        
        if not update_fields:
            cursor.close()
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_fields.append("updated_at = NOW()")
        params.append(item_id)
        
        query = f"""
            UPDATE menu_items 
            SET {', '.join(update_fields)}
            WHERE item_id = %s
            RETURNING *
        """
        
        cursor.execute(query, params)
        updated_item = cursor.fetchone()
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Menu item updated successfully",
            "data": updated_item
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
def delete_menu_item(
    item_id: int,
    conn=Depends(get_db)
):
    """Xóa món ăn"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Kiểm tra món có tồn tại không
        cursor.execute("SELECT * FROM menu_items WHERE item_id = %s", (item_id,))
        existing_item = cursor.fetchone()
        
        if not existing_item:
            cursor.close()
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        # Xóa món
        cursor.execute("DELETE FROM menu_items WHERE item_id = %s", (item_id,))
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": f"Menu item {item_id} deleted successfully",
            "deleted_id": item_id
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{item_id}/status", status_code=status.HTTP_200_OK)
def update_menu_status(
    item_id: int,
    status_value: str,
    conn=Depends(get_db)
):
    """Cập nhật trạng thái món (AVAILABLE/UNAVAILABLE)"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if status_value.upper() not in ['AVAILABLE', 'UNAVAILABLE']:
            raise HTTPException(status_code=400, detail="Invalid status. Use AVAILABLE or UNAVAILABLE")
        
        cursor.execute("SELECT * FROM menu_items WHERE item_id = %s", (item_id,))
        existing_item = cursor.fetchone()
        
        if not existing_item:
            cursor.close()
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        cursor.execute("""
            UPDATE menu_items 
            SET status = %s,
                updated_at = NOW()
            WHERE item_id = %s
            RETURNING *
        """, (status_value.upper(), item_id))
        
        updated_item = cursor.fetchone()
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Status updated successfully",
            "data": updated_item
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))