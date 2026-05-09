from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import MenuItemCreate, MenuItemUpdate
from typing import Optional
from psycopg2.extras import RealDictCursor

router = APIRouter(prefix="/api/menu", tags=["Menu Management"])


# GET ALL MENU (ADMIN) - WITH ENGLISH SUPPORT
@router.get("")
def get_menu_items(
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    conn=Depends(get_db)
):
    """Get all menu items with bilingual support (Admin only)"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = """
        SELECT 
            m.item_id,
            m.category_id,
            m.item_name,
            m.item_name_en,
            m.description,
            m.description_en,
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
        query += " AND (m.item_name ILIKE %s OR m.description ILIKE %s OR m.item_name_en ILIKE %s OR m.description_en ILIKE %s)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

    query += " ORDER BY m.item_name"

    cursor.execute(query, params)
    items = cursor.fetchall()
    cursor.close()

    return {
        "success": True,
        "count": len(items),
        "data": items
    }


#  GET PUBLIC MENU (CUSTOMER) - WITH ENGLISH SUPPORT
@router.get("/public")
def get_public_menu_items(conn=Depends(get_db)):
    """Get available menu items with bilingual support (Public access)"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = """
        SELECT 
            m.item_id,
            m.item_name,
            m.item_name_en,
            m.description,
            m.description_en,
            m.price,
            m.image_url,
            m.category_id,
            m.status,
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


# CREATE MENU ITEM - WITH ENGLISH SUPPORT
@router.post("")
def create_menu_item(item: MenuItemCreate, conn=Depends(get_db)):
    """Create new menu item with bilingual support"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Validate required fields
        if not item.item_name:
            raise HTTPException(status_code=400, detail="Item name (Vietnamese) is required")
        
        # Set default status
        status_value = "AVAILABLE"
        if hasattr(item, 'status') and item.status:
            status_value = item.status.upper()

        # Get English values or use Vietnamese as fallback
        item_name_en = getattr(item, 'item_name_en', None) or item.item_name
        description_en = getattr(item, 'description_en', None) or item.description

        print(f"📝 Creating menu item:")
        print(f"   VI: {item.item_name}")
        print(f"   EN: {item_name_en}")
        print(f"   Price: {item.price}")
        print(f"   Status: {status_value}")

        cursor.execute("""
            INSERT INTO menu_items
            (category_id, item_name, item_name_en, description, description_en, price, image_url, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            item.category_id,
            item.item_name,
            item_name_en,
            item.description,
            description_en,
            item.price,
            item.image_url or 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            status_value
        ))
        
        new_item = cursor.fetchone()
        conn.commit()
        cursor.close()
        
        print(f"Menu item created successfully: ID {new_item['item_id']}")
        
        return {
            "success": True,
            "message": "Menu item created successfully",
            "data": new_item
        }

    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"CREATE ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create menu item: {str(e)}")


# ✅ UPDATE MENU ITEM - WITH ENGLISH SUPPORT
@router.put("/{item_id}")
def update_menu_item(item_id: int, item: MenuItemUpdate, conn=Depends(get_db)):
    """Update menu item with bilingual support"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if item exists
        cursor.execute("SELECT * FROM menu_items WHERE item_id = %s", (item_id,))
        existing_item = cursor.fetchone()
        
        if not existing_item:
            cursor.close()
            raise HTTPException(status_code=404, detail=f"Menu item {item_id} not found")

        # Build update query
        update_fields = []
        params = []
        
        # Get all fields that were actually provided (exclude unset)
        update_data = item.dict(exclude_unset=True)
        
        print(f" Updating menu item {item_id}:")
        print(f"   Fields to update: {list(update_data.keys())}")
        
        for field, value in update_data.items():
            if value is not None:  # Only update non-null values
                update_fields.append(f"{field} = %s")
                # Uppercase status field
                if field == "status":
                    params.append(value.upper())
                else:
                    params.append(value)
                print(f"   {field}: {value}")

        if not update_fields:
            cursor.close()
            raise HTTPException(status_code=400, detail="No fields to update")

        # Add updated timestamp
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

        print(f" Menu item {item_id} updated successfully")

        return {
            "success": True,
            "message": "Menu item updated successfully",
            "data": updated_item
        }

    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"UPDATE ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update menu item: {str(e)}")


#  DELETE MENU ITEM
@router.delete("/{item_id}")
def delete_menu_item(item_id: int, conn=Depends(get_db)):
    """Delete menu item permanently"""
    cursor = conn.cursor()
    try:
        # Check if item exists
        cursor.execute("SELECT item_name FROM menu_items WHERE item_id = %s", (item_id,))
        existing = cursor.fetchone()
        
        if not existing:
            cursor.close()
            raise HTTPException(status_code=404, detail=f"Menu item {item_id} not found")

        item_name = existing[0] if existing else f"ID {item_id}"

        # Delete the item
        cursor.execute("DELETE FROM menu_items WHERE item_id = %s", (item_id,))
        conn.commit()
        cursor.close()

        print(f"🗑️ Deleted menu item: {item_name} (ID: {item_id})")

        return {
            "success": True,
            "message": f"Menu item '{item_name}' deleted successfully"
        }

    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f" DELETE ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete menu item: {str(e)}")


#  GET SINGLE MENU ITEM
@router.get("/{item_id}")
def get_menu_item(item_id: int, conn=Depends(get_db)):
    """Get single menu item with bilingual support"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT 
                m.item_id,
                m.category_id,
                m.item_name,
                m.item_name_en,
                m.description,
                m.description_en,
                m.price,
                m.image_url,
                m.status,
                m.created_at,
                m.updated_at,
                c.category_name
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.category_id
            WHERE m.item_id = %s
        """, (item_id,))
        
        item = cursor.fetchone()
        cursor.close()
        
        if not item:
            raise HTTPException(status_code=404, detail=f"Menu item {item_id} not found")
        
        return {
            "success": True,
            "data": item
        }
    
    except HTTPException:
        raise
    except Exception as e:
        cursor.close()
        print(f"GET ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))