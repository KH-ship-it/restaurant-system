from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import MenuItemCreate, MenuItemUpdate
from typing import Optional
from psycopg2.extras import RealDictCursor

router = APIRouter(prefix="/api/menu", tags=["Menu Management"])


# ✅ GET ALL MENU (ADMIN)
@router.get("")
def get_menu_items(
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
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
            m.updated_at,
            c.category_name
        FROM menu_items m
        LEFT JOIN categories c ON m.category_id = c.category_id
        WHERE 1=1
    """
    params = []

    if category:
        query += " AND c.category_name = %s"
        params.append(category)

    if status_filter:
        query += " AND UPPER(m.status) = %s"
        params.append(status_filter.upper())

    if search:
        query += " AND (m.item_name ILIKE %s OR m.description ILIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY m.item_name"

    cursor.execute(query, params)
    items = cursor.fetchall()
    cursor.close()

    return {
        "success": True,
        "count": len(items),
        "data": items
    }


# ✅ GET PUBLIC MENU (CUSTOMER)
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
        "count": len(items),
        "data": items
    }


# ✅ CREATE MENU ITEM
@router.post("")
def create_menu_item(item: MenuItemCreate, conn=Depends(get_db)):
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        status_value = "AVAILABLE"
        if hasattr(item, 'status') and item.status:
            status_value = item.status.upper()

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
            item.image_url or 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            status_value
        ))

        new_item = cursor.fetchone()
        conn.commit()
        cursor.close()

        return {
            "success": True,
            "message": "Menu item created successfully",
            "data": new_item
        }

    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"🔥 CREATE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ✅ UPDATE MENU ITEM
@router.put("/{item_id}")
def update_menu_item(item_id: int, item: MenuItemUpdate, conn=Depends(get_db)):
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM menu_items WHERE item_id = %s", (item_id,))
        if not cursor.fetchone():
            cursor.close()
            raise HTTPException(status_code=404, detail="Menu item not found")

        update_fields = []
        params = []

        for field, value in item.dict(exclude_unset=True).items():
            update_fields.append(f"{field} = %s")
            params.append(value.upper() if field == "status" else value)

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
            "message": "Menu item updated",
            "data": updated_item
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"🔥 UPDATE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ✅ DELETE MENU ITEM
@router.delete("/{item_id}")
def delete_menu_item(item_id: int, conn=Depends(get_db)):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM menu_items WHERE item_id = %s", (item_id,))
        if not cursor.fetchone():
            cursor.close()
            raise HTTPException(status_code=404, detail="Menu item not found")

        cursor.execute("DELETE FROM menu_items WHERE item_id = %s", (item_id,))
        conn.commit()
        cursor.close()

        return {
            "success": True,
            "message": f"Menu item {item_id} deleted"
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"🔥 DELETE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))