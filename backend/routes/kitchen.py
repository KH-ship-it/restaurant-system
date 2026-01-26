# backend/routes/kitchen.py
from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import KitchenOrderStatusUpdate
from middleware.auth import verify_token
from typing import Optional

router = APIRouter(prefix="/api/kitchen", tags=["Kitchen Management"])

@router.get("")
def get_kitchen_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get all kitchen orders"""
    cursor = conn.cursor()
    
    query = """
        SELECT ko.*, o.order_id, o.total_amount, o.created_at as order_time,
               t.table_number
        FROM kitchen_orders ko
        JOIN orders o ON ko.order_id = o.order_id
        JOIN tables t ON o.table_id = t.table_id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND ko.status = %s"
        params.append(status.upper())
    else:
        # By default, don't show completed orders
        query += " AND ko.status != 'COMPLETED'"
    
    query += " ORDER BY ko.updated_at ASC, o.created_at ASC"
    
    cursor.execute(query, params)
    orders = cursor.fetchall()
    
    # Get items for each order
    for order in orders:
        cursor.execute("""
            SELECT oi.*, m.item_name, m.description
            FROM order_items oi
            JOIN menu_items m ON oi.item_id = m.item_id
            WHERE oi.order_id = %s
        """, (order['order_id'],))
        order['items'] = cursor.fetchall()
        # Calculate elapsed time in minutes
        cursor.execute("""
            SELECT EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 as elapsed_minutes
            FROM orders o
            WHERE o.order_id = %s
        """, (order['order_id'],))
        time_result = cursor.fetchone()
        order['elapsed_minutes'] = int(time_result['elapsed_minutes']) if time_result else 0
    
    cursor.close()
    return {
        "success": True,
        "data": orders,
        "count": len(orders)
    }
@router.get("/{kitchen_order_id}")
def get_kitchen_order(
    kitchen_order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get single kitchen order"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT ko.*, o.order_id, o.total_amount, o.created_at as order_time,
               t.table_number
        FROM kitchen_orders ko
        JOIN orders o ON ko.order_id = o.order_id
        JOIN tables t ON o.table_id = t.table_id
        WHERE ko.kitchen_order_id = %s
    """, (kitchen_order_id,))
    order = cursor.fetchone()
    
    if not order:
        raise HTTPException(status_code=404, detail="Kitchen order not found")
    
    # Get items
    cursor.execute("""
        SELECT oi.*, m.item_name, m.description
        FROM order_items oi
        JOIN menu_items m ON oi.item_id = m.item_id
        WHERE oi.order_id = %s
    """, (order['order_id'],))
    order['items'] = cursor.fetchall()
    
    cursor.close()
    
    return {"success": True, "data": order}

@router.put("/{kitchen_order_id}/status")
def update_kitchen_order_status(
    kitchen_order_id: int,
    status_data: KitchenOrderStatusUpdate,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Update kitchen order status"""
    cursor = conn.cursor()
    
    try:
        # Valid statuses: WAITING, PREPARING, READY, COMPLETED
        valid_statuses = ['WAITING', 'PREPARING', 'READY', 'COMPLETED']
        if status_data.status.upper() not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Check if kitchen order exists
        cursor.execute(
            "SELECT kitchen_order_id, order_id FROM kitchen_orders WHERE kitchen_order_id = %s",
            (kitchen_order_id,)
        )
        kitchen_order = cursor.fetchone()
        
        if not kitchen_order:
            raise HTTPException(status_code=404, detail="Kitchen order not found")
        
        # Update kitchen order status
        cursor.execute("""
            UPDATE kitchen_orders
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE kitchen_order_id = %s
            RETURNING *
        """, (status_data.status.upper(), kitchen_order_id))
        
        updated_order = cursor.fetchone()
        
        # Also update main order status if kitchen order is ready
        if status_data.status.upper() == 'READY':
            cursor.execute("""
                UPDATE orders
                SET status = 'READY'
                WHERE order_id = %s
            """, (kitchen_order['order_id'],))
        elif status_data.status.upper() == 'PREPARING':
            cursor.execute("""
                UPDATE orders
                SET status = 'PREPARING'
                WHERE order_id = %s AND status = 'PENDING'
            """, (kitchen_order['order_id'],))
        
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Kitchen order status updated successfully",
            "data": updated_order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{kitchen_order_id}/start")
def start_preparing(
    kitchen_order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Start preparing order (shortcut for status=PREPARING)"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT order_id FROM kitchen_orders WHERE kitchen_order_id = %s", (kitchen_order_id,))
        kitchen_order = cursor.fetchone()
        
        if not kitchen_order:
            raise HTTPException(status_code=404, detail="Kitchen order not found")
        
        cursor.execute("""
            UPDATE kitchen_orders
            SET status = 'PREPARING', updated_at = CURRENT_TIMESTAMP
            WHERE kitchen_order_id = %s
            RETURNING *
        """, (kitchen_order_id,))
        
        updated_order = cursor.fetchone()
        
        # Update main order
        cursor.execute("""
            UPDATE orders SET status = 'PREPARING'
            WHERE order_id = %s
        """, (kitchen_order['order_id'],))
        
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Started preparing order",
            "data": updated_order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{kitchen_order_id}/complete")
def complete_order(
    kitchen_order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Mark order as ready (shortcut for status=READY)"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT order_id FROM kitchen_orders WHERE kitchen_order_id = %s", (kitchen_order_id,))
        kitchen_order = cursor.fetchone()
        
        if not kitchen_order:
            raise HTTPException(status_code=404, detail="Kitchen order not found")
        
        cursor.execute("""
            UPDATE kitchen_orders
            SET status = 'READY', updated_at = CURRENT_TIMESTAMP
            WHERE kitchen_order_id = %s
            RETURNING *
        """, (kitchen_order_id,))
        
        updated_order = cursor.fetchone()
        
        # Update main order
        cursor.execute("""
            UPDATE orders SET status = 'READY'
            WHERE order_id = %s
        """, (kitchen_order['order_id'],))
        
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Order is ready for serving",
            "data": updated_order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/summary")
def get_kitchen_stats(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get kitchen statistics"""
    cursor = conn.cursor()
    
    # Count orders by status
    cursor.execute("""
        SELECT 
            COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting,
            COUNT(CASE WHEN status = 'PREPARING' THEN 1 END) as preparing,
            COUNT(CASE WHEN status = 'READY' THEN 1 END) as ready,
            COUNT(*) as total
        FROM kitchen_orders
        WHERE status != 'COMPLETED'
    """)
    
    stats = cursor.fetchone()
    
    # Get average preparation time today
    cursor.execute("""
        SELECT AVG(EXTRACT(EPOCH FROM (ko.updated_at - o.created_at))/60) as avg_prep_time
        FROM kitchen_orders ko
        JOIN orders o ON ko.order_id = o.order_id
        WHERE ko.status = 'READY'
        AND DATE(o.created_at) = CURRENT_DATE
    """)
    
    prep_time = cursor.fetchone()
    
    cursor.close()
    
    return {
        "success": True,
        "data": {
            "waiting": stats['waiting'] or 0,
            "preparing": stats['preparing'] or 0,
            "ready": stats['ready'] or 0,
            "total_active": stats['total'] or 0,
            "avg_prep_time_minutes": round(prep_time['avg_prep_time'] or 0, 1)
        }
    }