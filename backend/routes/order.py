# routes/order.py
from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import OrderCreate, OrderStatusUpdate
from middleware.auth import verify_token
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/orders", tags=["Order Management"])

@router.get("")
def get_orders(
    status: Optional[str] = None,
    table_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get all orders with filters"""
    cursor = conn.cursor()
    
    query = """
        SELECT o.*, t.table_number, e.full_name as employee_name
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND o.status = %s"
        params.append(status.upper())
    
    if table_id:
        query += " AND o.table_id = %s"
        params.append(table_id)
    
    if date_from:
        query += " AND DATE(o.created_at) >= %s"
        params.append(date_from)
    
    if date_to:
        query += " AND DATE(o.created_at) <= %s"
        params.append(date_to)
    
    query += " ORDER BY o.created_at DESC"
    
    cursor.execute(query, params)
    orders = cursor.fetchall()
    
    for order in orders:
        cursor.execute("""
            SELECT oi.*, m.item_name, m.image_url
            FROM order_items oi
            JOIN menu_items m ON oi.item_id = m.item_id
            WHERE oi.order_id = %s
        """, (order['order_id'],))
        order['items'] = cursor.fetchall()
    
    cursor.close()
    
    return {"success": True, "data": orders, "count": len(orders)}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(
    order_data: OrderCreate,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Create new order"""
    cursor = conn.cursor()
    
    try:
        total_amount = sum(item.price * item.quantity for item in order_data.items)
        
        cursor.execute("""
            INSERT INTO orders (table_id, employee_id, customer_id, total_amount, status)
            VALUES (%s, %s, %s, %s, 'PENDING')
            RETURNING *
        """, (
            order_data.table_id,
            current_user.get('employeeId'),
            order_data.customer_id,
            total_amount
        ))
        
        order = cursor.fetchone()
        order_id = order['order_id']
        
        for item in order_data.items:
            cursor.execute("""
                INSERT INTO order_items (order_id, item_id, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (order_id, item.item_id, item.quantity, item.price))
        
        cursor.execute("UPDATE tables SET status = 'OCCUPIED' WHERE table_id = %s", (order_data.table_id,))
        cursor.execute("INSERT INTO kitchen_orders (order_id, status) VALUES (%s, 'WAITING')", (order_id,))
        
        conn.commit()
        cursor.close()
        
        return {"success": True, "message": "Order created successfully", "data": order}
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{order_id}/status")
def update_order_status(
    order_id: int,
    status_data: OrderStatusUpdate,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Update order status"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT order_id, table_id FROM orders WHERE order_id = %s", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        cursor.execute(
            "UPDATE orders SET status = %s WHERE order_id = %s RETURNING *",
            (status_data.status.upper(), order_id)
        )
        
        updated_order = cursor.fetchone()
        
        if status_data.status.upper() in ['COMPLETED', 'CANCELLED']:
            cursor.execute("UPDATE tables SET status = 'EMPTY' WHERE table_id = %s", (order['table_id'],))
        
        conn.commit()
        cursor.close()
        
        return {"success": True, "message": "Order status updated", "data": updated_order}
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))


# ✅ THÊM MỚI: Endpoint hủy đơn hàng
@router.put("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """
    Hủy đơn hàng
    - Chỉ hủy được đơn ở trạng thái PENDING hoặc PREPARING
    - Giải phóng bàn về AVAILABLE/EMPTY
    - Update trạng thái order thành CANCELLED
    """
    cursor = conn.cursor()
    
    try:
        # 1. Kiểm tra order có tồn tại không
        cursor.execute("""
            SELECT o.order_id, o.table_id, o.status, o.total_amount, t.table_number
            FROM orders o
            LEFT JOIN tables t ON o.table_id = t.table_id
            WHERE o.order_id = %s
        """, (order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy đơn hàng #{order_id}"
            )
        
        # 2. Kiểm tra trạng thái có được phép hủy không
        current_status = order['status']
        allowed_cancel_statuses = ['PENDING', 'PREPARING', 'WAITING']
        
        if current_status not in allowed_cancel_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể hủy đơn hàng ở trạng thái '{current_status}'. Chỉ hủy được đơn 'Chờ xử lý' hoặc 'Đang chuẩn bị'."
            )
        
        # 3. Update trạng thái order thành CANCELLED
        cursor.execute("""
            UPDATE orders
            SET status = 'CANCELLED',
                updated_at = NOW()
            WHERE order_id = %s
            RETURNING *
        """, (order_id,))
        
        cancelled_order = cursor.fetchone()
        
        # 4. Giải phóng bàn về AVAILABLE/EMPTY
        if order['table_id']:
            cursor.execute("""
                UPDATE tables
                SET status = 'AVAILABLE',
                    updated_at = NOW()
                WHERE table_id = %s
            """, (order['table_id'],))
        
        # 5. Update kitchen_orders nếu có
        cursor.execute("""
            UPDATE kitchen_orders
            SET status = 'CANCELLED'
            WHERE order_id = %s
        """, (order_id,))
        
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": f"Đã hủy đơn hàng Bàn {order.get('table_number', order_id)}",
            "data": {
                "order_id": order_id,
                "table_number": order.get('table_number'),
                "previous_status": current_status,
                "new_status": "CANCELLED",
                "table_id": order['table_id'],
                "total_amount": order['total_amount'],
                "cancelled_by": current_user.get('username'),
                "cancelled_at": datetime.now().isoformat()
            }
        }
    
    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hủy đơn hàng thất bại: {str(e)}"
        )


# ✅ THÊM MỚI: Lấy chi tiết một đơn hàng
@router.get("/{order_id}")
def get_order_detail(
    order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get order detail by ID"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT o.*, t.table_number, e.full_name as employee_name
            FROM orders o
            LEFT JOIN tables t ON o.table_id = t.table_id
            LEFT JOIN employees e ON o.employee_id = e.employee_id
            WHERE o.order_id = %s
        """, (order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy đơn hàng #{order_id}"
            )
        
        # Lấy danh sách items
        cursor.execute("""
            SELECT oi.*, m.item_name, m.image_url
            FROM order_items oi
            JOIN menu_items m ON oi.item_id = m.item_id
            WHERE oi.order_id = %s
        """, (order_id,))
        
        order['items'] = cursor.fetchall()
        
        cursor.close()
        
        return {"success": True, "data": order}
        
    except HTTPException:
        cursor.close()
        raise
    except Exception as e:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi lấy chi tiết đơn hàng: {str(e)}"
        )