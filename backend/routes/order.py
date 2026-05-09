# routes/order.py
from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import OrderCreate, OrderStatusUpdate
from middleware.auth import verify_token
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/api/orders", tags=["Order Management"])

# ========================================
# MODELS CHO PUBLIC ORDER (khách hàng đặt món)
# ========================================

class PublicOrderItem(BaseModel):
    item_id: int
    quantity: int
    price: float

class PublicOrderCreate(BaseModel):
    table_number: int  # Số bàn (VD: 5)
    customer_name: str  # Tên khách hàng
    items: List[PublicOrderItem]
    total_amount: float
    notes: Optional[str] = None

# ========================================
# PUBLIC ENDPOINT - KHÁCH HÀNG ĐẶT MÓN QUA QR CODE
# KHÔNG CẦN AUTHENTICATION 
# ========================================

@router.post("/public", status_code=status.HTTP_201_CREATED)
def create_public_order(
    order_data: PublicOrderCreate,
    conn=Depends(get_db)
):
    """
     PUBLIC ENDPOINT - Khách hàng đặt món qua QR code
    KHÔNG CẦN TOKEN
    
    Request body:
    {
        "table_number": 5,
        "customer_name": "Nguyễn Văn A",
        "items": [
            {"item_id": 1, "quantity": 2, "price": 25000},
            {"item_id": 3, "quantity": 1, "price": 35000}
        ],
        "total_amount": 85000,
        "notes": "Không đá"
    }
    """
    cursor = conn.cursor()
    
    try:
        print(f"\n📱 [PUBLIC ORDER] Table {order_data.table_number} - {order_data.customer_name}")
        print(f"   Items: {len(order_data.items)} | Total: {order_data.total_amount:,}đ")
        
        # 1. Tìm table_id từ table_number
        cursor.execute("""
            SELECT table_id, status FROM dining_tables 
            WHERE table_number = %s
        """, (order_data.table_number,))
        
        table = cursor.fetchone()
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy bàn số {order_data.table_number}"
            )
        
        table_id = table['table_id']
        print(f"   ✓ Found table_id: {table_id} (status: {table['status']})")
        
        # 2. Tạo order với RETURNING (PostgreSQL)
        cursor.execute("""
            INSERT INTO orders (
                table_id,
                customer_name,
                total_amount,
                status,
                notes
            )
            VALUES (%s, %s, %s, 'PENDING', %s)
            RETURNING order_id
        """, (
            table_id,
            order_data.customer_name,
            order_data.total_amount,
            order_data.notes
        ))        
        # Lấy order_id từ RETURNING
        result = cursor.fetchone()
        order_id = result['order_id']
        print(f"   ✓ Order created: #{order_id}")        
        # FIX: Thêm order items với ĐÚNG tên cột và subtotal
        for item in order_data.items:
            subtotal = item.price * item.quantity  # Tính subtotal
            
            cursor.execute("""
                INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                order_id, 
                item.item_id, 
                item.quantity, 
                item.price,      # unit_price
                subtotal         # subtotal
            ))
            
            print(f"      • Item {item.item_id}: {item.quantity} × {item.price:,.0f}đ = {subtotal:,.0f}đ")
        
        print(f"   ✓ {len(order_data.items)} items added")
        
        # 4. Cập nhật trạng thái bàn thành OCCUPIED
        cursor.execute("""
            UPDATE dining_tables 
            SET status = 'OCCUPIED'
            WHERE table_id = %s
        """, (table_id,))
        print(f"   ✓ Table {order_data.table_number} → OCCUPIED")
        
        # 5. Thêm vào kitchen orders để bếp thấy
        cursor.execute("""
            INSERT INTO kitchen_orders (order_id, status)
            VALUES (%s, 'WAITING')
        """, (order_id,))
        print(f"   ✓ Kitchen order created")
        
        conn.commit()
        cursor.close()
        
        print(f" [PUBLIC ORDER] Bàn {order_data.table_number} đặt món thành công!")
        
        return {
            "success": True,
            "message": "Đặt món thành công! Nhân viên sẽ phục vụ trong giây lát.",
            "data": {
                "order_id": order_id,
                "table_number": order_data.table_number,
                "customer_name": order_data.customer_name,
                "total_amount": order_data.total_amount,
                "status": "PENDING",
                "created_at": datetime.now().isoformat()
            }
        }
        
    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f" [PUBLIC ORDER ERROR]: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể tạo đơn hàng: {str(e)}"
        )

# ========================================
# STAFF ENDPOINTS - CẦN AUTHENTICATION 
# ========================================

@router.get("")
def get_orders(
    status: Optional[str] = None,
    table_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """✅ Lấy danh sách đơn hàng - Nhân viên"""
    cursor = conn.cursor()
    
    query = """
        SELECT o.*, t.table_number, e.full_name as employee_name
        FROM orders o
        LEFT JOIN dining_tables t ON o.table_id = t.table_id
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
    """Tạo đơn hàng - Nhân viên"""
    cursor = conn.cursor()
    
    try:
        total_amount = sum(item.price * item.quantity for item in order_data.items)       
        cursor.execute("""
            INSERT INTO orders (table_id, employee_id, customer_id, total_amount, status)
            VALUES (%s, %s, %s, %s, 'PENDING')
            RETURNING order_id
        """, (
            order_data.table_id,
            current_user.get('employeeId'),
            order_data.customer_id,
            total_amount
        ))      
        result = cursor.fetchone()
        order_id = result['order_id']      
        # 🔥 FIX: Dùng unit_price và subtotal
        for item in order_data.items:
            subtotal = item.price * item.quantity
            
            cursor.execute("""
                INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                order_id, 
                item.item_id, 
                item.quantity, 
                item.price,
                subtotal
            ))
        
        cursor.execute("UPDATE dining_tables SET status = 'OCCUPIED' WHERE table_id = %s", (order_data.table_id,))
        cursor.execute("INSERT INTO kitchen_orders (order_id, status) VALUES (%s, 'WAITING')", (order_id,))
        
        conn.commit()       
        # Fetch created order
        cursor.execute("""
            SELECT o.*, t.table_number
            FROM orders o
            LEFT JOIN dining_tables t ON o.table_id = t.table_id
            WHERE o.order_id = %s
        """, (order_id,))
        order = cursor.fetchone()
        cursor.close()      
        return {"success": True, "message": "Order created successfully", "data": order}      
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{order_id}")
def get_order_detail(
    order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Lấy chi tiết đơn hàng - Nhân viên"""
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT o.*, t.table_number, e.full_name as employee_name
            FROM orders o
            LEFT JOIN dining_tables t ON o.table_id = t.table_id
            LEFT JOIN employees e ON o.employee_id = e.employee_id
            WHERE o.order_id = %s
        """, (order_id,))
        order = cursor.fetchone()      
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy đơn hàng #{order_id}"
            )
        
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
@router.put("/{order_id}/status")
def update_order_status(
    order_id: int,
    status_data: OrderStatusUpdate,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """ Cập nhật trạng thái đơn hàng - Nhân viên"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT order_id, table_id FROM orders WHERE order_id = %s", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        cursor.execute("""
            UPDATE orders 
            SET status = %s
            WHERE order_id = %s
        """, (status_data.status.upper(), order_id))
        
        cursor.execute("""
            SELECT o.*, t.table_number
            FROM orders o
            LEFT JOIN dining_tables t ON o.table_id = t.table_id
            WHERE o.order_id = %s
        """, (order_id,))
        updated_order = cursor.fetchone()
        
        # Nếu hoàn thành hoặc hủy → Giải phóng bàn
        if status_data.status.upper() in ['COMPLETED', 'CANCELLED']:
            cursor.execute("""
                UPDATE dining_tables 
                SET status = 'AVAILABLE'
                WHERE table_id = %s
            """, (order['table_id'],))
        
        conn.commit()
        cursor.close()
        
        return {"success": True, "message": "Order status updated", "data": updated_order}
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/public/{order_id}")
def delete_public_order(
    order_id: str,  # ✅ Chú ý: order_id có thể là string từ localStorage
    conn=Depends(get_db)
):
    """
    🗑️ DELETE PUBLIC ORDER - Khách hàng/Nhân viên hủy đơn
    KHÔNG CẦN AUTHENTICATION
    
    API: DELETE /api/orders/public/{order_id}
    """
    cursor = conn.cursor()
    
    try:
        print(f"\n{'='*70}")
        print(f"🗑️ [DELETE PUBLIC ORDER] Order ID: {order_id}")
        print(f"{'='*70}")
        
        # 1️⃣ Kiểm tra đơn hàng có tồn tại không
        cursor.execute("""
            SELECT o.order_id, o.table_id, o.status, o.total_amount, t.table_number
            FROM orders o
            LEFT JOIN tables t ON o.table_id = t.table_id
            WHERE o.order_id = %s
        """, (order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            print(f"❌ Order #{order_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy đơn hàng #{order_id}"
            )
        
        print(f"✅ Found order: Table {order['table_number']}, Status: {order['status']}")
        
        # 2️⃣ Kiểm tra trạng thái - chỉ cho phép hủy nếu chưa thanh toán
        allowed_statuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED']
        
        if order['status'] not in allowed_statuses:
            print(f"❌ Cannot cancel - status is {order['status']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể hủy đơn hàng ở trạng thái '{order['status']}'"
            )
        
        # 3️⃣ XÓA HOÀN TOÀN đơn hàng (hoặc đánh dấu CANCELLED tùy logic)
        # OPTION A: Xóa hẳn (khuyến nghị cho testing)
        cursor.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
        print(f"✅ Deleted order items")
        
        cursor.execute("DELETE FROM kitchen_orders WHERE order_id = %s", (order_id,))
        print(f"✅ Deleted kitchen order")
        
        cursor.execute("DELETE FROM orders WHERE order_id = %s", (order_id,))
        print(f"✅ Deleted order record")
        
        # OPTION B: Đánh dấu CANCELLED (khuyến nghị cho production)
        # cursor.execute("""
        #     UPDATE orders 
        #     SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
        #     WHERE order_id = %s
        # """, (order_id,))
        
        # 4️⃣ Giải phóng bàn
        if order['table_id']:
            cursor.execute("""
                UPDATE tables 
                SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
                WHERE table_id = %s
            """, (order['table_id'],))
            print(f"✅ Table {order['table_number']} → AVAILABLE")
        
        conn.commit()
        cursor.close()
        
        print(f"✅ [DELETE SUCCESS] Order #{order_id} deleted")
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "message": f"Đã xóa đơn hàng #{order_id}",
            "data": {
                "order_id": order_id,
                "table_number": order.get('table_number'),
                "status": "DELETED"
            }
        }
    
    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa đơn hàng: {str(e)}"
        )


print("✅ Order DELETE endpoint added:")
print("    DELETE /api/orders/public/{order_id} - Xóa đơn hàng (no auth)")

@router.put("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """ Hủy đơn hàng - Nhân viên"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT o.order_id, o.table_id, o.status, o.total_amount, t.table_number
            FROM orders o
            LEFT JOIN dining_tables t ON o.table_id = t.table_id
            WHERE o.order_id = %s
        """, (order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy đơn hàng #{order_id}"
            )
        
        current_status = order['status']
        allowed_cancel_statuses = ['PENDING', 'PREPARING', 'WAITING']
        
        if current_status not in allowed_cancel_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể hủy đơn hàng ở trạng thái '{current_status}'."
            )
        
        cursor.execute("""
            UPDATE orders
            SET status = 'CANCELLED'
            WHERE order_id = %s
        """, (order_id,))
        
        if order['table_id']:
            cursor.execute("""
                UPDATE dining_tables
                SET status = 'AVAILABLE'
                WHERE table_id = %s
            """, (order['table_id'],))
        
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
                "new_status": "CANCELLED"
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

print("Order router loaded (PostgreSQL):")
print("    POST /api/orders/public - Khách hàng đặt món (no auth)")
print("    GET  /api/orders - Nhân viên xem danh sách (auth required)")
print("    POST /api/orders - Nhân viên tạo order (auth required)")
print("    GET  /api/orders/{id} - Chi tiết order (auth required)")
print("    PUT  /api/orders/{id}/status - Cập nhật trạng thái (auth required)")
print("    PUT  /api/orders/{id}/cancel - Hủy order (auth required)")