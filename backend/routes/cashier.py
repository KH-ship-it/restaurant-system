# backend/routes/cashier.py
from fastapi import APIRouter, Depends, HTTPException, status
from config.database import get_db
from models.schemas import PaymentProcess
from middleware.auth import verify_token
from typing import Optional

router = APIRouter(prefix="/api/cashier", tags=["Cashier"])

@router.get("/pending")
def get_pending_orders(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get orders pending payment"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT o.*, t.table_number, e.full_name as employee_name
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        WHERE o.status IN ('READY', 'CONFIRMED')
        ORDER BY o.created_at ASC
    """)
    
    orders = cursor.fetchall()
    
    # Get items for each order
    for order in orders:
        cursor.execute("""
            SELECT oi.*, m.item_name, m.image_url
            FROM order_items oi
            JOIN menu_items m ON oi.item_id = m.item_id
            WHERE oi.order_id = %s
        """, (order['order_id'],))
        order['items'] = cursor.fetchall()
    
    cursor.close()
    
    return {
        "success": True,
        "data": orders,
        "count": len(orders)
    }

@router.get("/orders/{order_id}/details")
def get_order_payment_details(
    order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get detailed order information for payment"""
    cursor = conn.cursor()
    
    # Get order details
    cursor.execute("""
        SELECT o.*, t.table_number, e.full_name as employee_name
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        WHERE o.order_id = %s
    """, (order_id,))
    
    order = cursor.fetchone()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get order items
    cursor.execute("""
        SELECT oi.*, m.item_name, m.image_url, m.description
        FROM order_items oi
        JOIN menu_items m ON oi.item_id = m.item_id
        WHERE oi.order_id = %s
    """, (order_id,))
    
    order['items'] = cursor.fetchall()
    
    # Calculate subtotal, tax, service charge
    subtotal = order['total_amount']
    tax = round(subtotal * 0.1, 2)  # 10% tax
    service_charge = round(subtotal * 0.05, 2)  # 5% service charge
    total = round(subtotal + tax + service_charge, 2)
    
    order['payment_breakdown'] = {
        'subtotal': subtotal,
        'tax': tax,
        'service_charge': service_charge,
        'total': total
    }
    
    cursor.close()
    
    return {
        "success": True,
        "data": order
    }

@router.post("/payment")
def process_payment(
    payment: PaymentProcess,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Process payment for an order"""
    cursor = conn.cursor()
    
    try:
        # Get order details
        cursor.execute("""
            SELECT order_id, table_id, status, total_amount
            FROM orders
            WHERE order_id = %s
        """, (payment.order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order['status'] == 'COMPLETED':
            raise HTTPException(status_code=400, detail="Order already paid")
        
        if order['status'] == 'CANCELLED':
            raise HTTPException(status_code=400, detail="Cannot pay for cancelled order")
        
        # Update order status to completed
        cursor.execute("""
            UPDATE orders
            SET status = 'COMPLETED'
            WHERE order_id = %s
            RETURNING *
        """, (payment.order_id,))
        
        updated_order = cursor.fetchone()
        
        # Update table status to empty
        cursor.execute("""
            UPDATE tables
            SET status = 'EMPTY'
            WHERE table_id = %s
        """, (order['table_id'],))
        
        # Update kitchen order if exists
        cursor.execute("""
            UPDATE kitchen_orders
            SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
            WHERE order_id = %s
        """, (payment.order_id,))
        
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Payment processed successfully",
            "data": {
                "order_id": payment.order_id,
                "amount_paid": order['total_amount'],
                "order": updated_order
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/payment/split")
def split_payment(
    order_id: int,
    split_count: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Calculate split payment"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT order_id, total_amount, status
        FROM orders
        WHERE order_id = %s
    """, (order_id,))
    order = cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order['status'] == 'COMPLETED':
        raise HTTPException(status_code=400, detail="Order already paid")
    
    if split_count < 2:
        raise HTTPException(status_code=400, detail="Split count must be at least 2")
    
    cursor.close()
    
    total = order['total_amount']
    per_person = round(total / split_count, 2)
    
    return {
        "success": True,
        "data": {
            "order_id": order_id,
            "total_amount": total,
            "split_count": split_count,
            "amount_per_person": per_person,
            "splits": [per_person] * split_count
        }
    }

@router.get("/transactions/today")
def get_today_transactions(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get today's completed transactions"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT o.order_id, o.total_amount, o.created_at,
               t.table_number, e.full_name as employee_name
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        WHERE o.status = 'COMPLETED'
        AND DATE(o.created_at) = CURRENT_DATE
        ORDER BY o.created_at DESC
    """)
    
    transactions = cursor.fetchall()
    
    # Calculate summary
    cursor.execute("""
        SELECT 
            COUNT(*) as transaction_count,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_transaction
        FROM orders
        WHERE status = 'COMPLETED'
        AND DATE(created_at) = CURRENT_DATE
    """)
    
    summary = cursor.fetchone()
    
    cursor.close()
    
    return {
        "success": True,
        "data": {
            "transactions": transactions,
            "summary": {
                "count": summary['transaction_count'] or 0,
                "total_revenue": float(summary['total_revenue'] or 0),
                "avg_transaction": float(summary['avg_transaction'] or 0)
            }
        }
    }

@router.get("/shift/report")
def get_shift_report(
    shift_start: Optional[str] = None,
    shift_end: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get shift report"""
    cursor = conn.cursor()
    
    # Default to today if no times provided
    date_filter = ""
    params = []
    
    if shift_start and shift_end:
        date_filter = "AND o.created_at BETWEEN %s AND %s"
        params = [shift_start, shift_end]
    else:
        date_filter = "AND DATE(o.created_at) = CURRENT_DATE"
    
    # Total transactions
    cursor.execute(f"""
        SELECT 
            COUNT(*) as total_transactions,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_transaction
        FROM orders o
        WHERE status = 'COMPLETED'
        {date_filter}
    """, params)
    
    totals = cursor.fetchone()
    
    # Payment method breakdown (if you have this data)
    # For now, assume all cash
    payment_breakdown = {
        'cash': float(totals['total_revenue'] or 0),
        'card': 0,
        'online': 0
    }
    
    # Top items sold
    cursor.execute(f"""
        SELECT m.item_name, SUM(oi.quantity) as quantity_sold,
               SUM(oi.quantity * oi.price) as revenue
        FROM order_items oi
        JOIN menu_items m ON oi.item_id = m.item_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status = 'COMPLETED'
        {date_filter}
        GROUP BY m.item_id, m.item_name
        ORDER BY quantity_sold DESC
        LIMIT 10
    """, params)
    
    top_items = cursor.fetchall()
    
    # Hourly breakdown
    cursor.execute(f"""
        SELECT 
            EXTRACT(HOUR FROM o.created_at) as hour,
            COUNT(*) as transaction_count,
            SUM(total_amount) as revenue
        FROM orders o
        WHERE status = 'COMPLETED'
        {date_filter}
        GROUP BY EXTRACT(HOUR FROM o.created_at)
        ORDER BY hour ASC
    """, params)
    
    hourly_breakdown = cursor.fetchall()
    
    cursor.close()
    
    return {
        "success": True,
        "data": {
            "shift_period": {
                "start": shift_start or "Start of day",
                "end": shift_end or "Current time"
            },
            "totals": {
                "transactions": totals['total_transactions'] or 0,
                "revenue": float(totals['total_revenue'] or 0),
                "avg_transaction": float(totals['avg_transaction'] or 0)
            },
            "payment_breakdown": payment_breakdown,
            "top_items": top_items,
            "hourly_breakdown": hourly_breakdown,
            "cashier": {
                "name": current_user.get('username'),
                "employee_id": current_user.get('employeeId')
            }
        }
    }

@router.post("/refund/{order_id}")
def process_refund(
    order_id: int,
    reason: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Process refund for an order"""
    cursor = conn.cursor()
    
    try:
        # Get order
        cursor.execute("""
            SELECT order_id, total_amount, status
            FROM orders
            WHERE order_id = %s
        """, (order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order['status'] != 'COMPLETED':
            raise HTTPException(status_code=400, detail="Can only refund completed orders")
        
        # Update order status to cancelled
        cursor.execute("""
            UPDATE orders
            SET status = 'CANCELLED'
            WHERE order_id = %s
            RETURNING *
        """, (order_id,))
        
        updated_order = cursor.fetchone()
        
        # TODO: Add refund record to a refunds table if you have one
        
        conn.commit()
        cursor.close()
        
        return {
            "success": True,
            "message": "Refund processed successfully",
            "data": {
                "order_id": order_id,
                "refund_amount": order['total_amount'],
                "reason": reason,
                "order": updated_order
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        raise HTTPException(status_code=500, detail=str(e))