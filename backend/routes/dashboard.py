# backend/routes/dashboard.py
from fastapi import APIRouter, Depends, HTTPException
from config.database import get_db
from middleware.auth import verify_token
from typing import Optional

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get dashboard statistics"""
    cursor = conn.cursor()
    
    # Build date filter
    date_filter = ""
    params = []
    
    if date_from:
        date_filter += " AND DATE(o.created_at) >= %s"
        params.append(date_from)
    
    if date_to:
        date_filter += " AND DATE(o.created_at) <= %s"
        params.append(date_to)
    
    # Total revenue
    cursor.execute(f"""
        SELECT COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders o
        WHERE status = 'COMPLETED'
        {date_filter}
    """, params)
    revenue = cursor.fetchone()
    
    # Total orders
    cursor.execute(f"""
        SELECT COUNT(*) as total_orders
        FROM orders o
        WHERE status != 'CANCELLED'
        {date_filter}
    """, params)
    orders = cursor.fetchone()
    
    # Average order value
    cursor.execute(f"""
        SELECT COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders o
        WHERE status = 'COMPLETED'
        {date_filter}
    """, params)
    avg_value = cursor.fetchone()
    
    # Total customers (unique orders)
    cursor.execute(f"""
        SELECT COUNT(DISTINCT table_id) as total_customers
        FROM orders o
        WHERE status != 'CANCELLED'
        {date_filter}
    """, params)
    customers = cursor.fetchone()
    
    # Popular items
    cursor.execute(f"""
        SELECT m.item_name, m.image_url,
               COUNT(oi.order_item_id) as order_count,
               SUM(oi.quantity) as total_quantity,
               SUM(oi.quantity * oi.price) as revenue
        FROM order_items oi
        JOIN menu_items m ON oi.item_id = m.item_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status = 'COMPLETED'
        {date_filter}
        GROUP BY m.item_id, m.item_name, m.image_url
        ORDER BY order_count DESC
        LIMIT 5
    """, params)
    popular_items = cursor.fetchall()
    
    # Order status breakdown
    cursor.execute(f"""
        SELECT 
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'PREPARING' THEN 1 END) as preparing,
            COUNT(CASE WHEN status = 'READY' THEN 1 END) as ready,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled
        FROM orders o
        WHERE 1=1
        {date_filter}
    """, params)
    status_breakdown = cursor.fetchone()  
    cursor.close()
    return {
        "success": True,
        "data": {
            "totalRevenue": float(revenue['total_revenue']),
            "totalOrders": int(orders['total_orders']),
            "avgOrderValue": float(avg_value['avg_order_value']),
            "totalCustomers": int(customers['total_customers']),
            "popularItems": popular_items,
            "orderStatusBreakdown": status_breakdown
        }
    }

@router.get("/revenue")
def get_revenue_data(
    period: str = "daily",  # daily, weekly, monthly
    limit: int = 30,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get revenue data by period"""
    cursor = conn.cursor()
    
    if period == "daily":
        query = """
            SELECT DATE(created_at) as date, SUM(total_amount) as revenue
            FROM orders
            WHERE status = 'COMPLETED'
            AND created_at >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """
    elif period == "weekly":
        query = """
            SELECT 
                DATE_TRUNC('week', created_at) as date,
                SUM(total_amount) as revenue
            FROM orders
            WHERE status = 'COMPLETED'
            AND created_at >= CURRENT_DATE - INTERVAL '%s weeks'
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY date DESC
        """
    elif period == "monthly":
        query = """
            SELECT 
                DATE_TRUNC('month', created_at) as date,
                SUM(total_amount) as revenue
            FROM orders
            WHERE status = 'COMPLETED'
            AND created_at >= CURRENT_DATE - INTERVAL '%s months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY date DESC
        """
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Use: daily, weekly, or monthly")
    
    cursor.execute(query, (limit,))
    revenue_data = cursor.fetchall()
    cursor.close()
    return {
        "success": True,
        "data": revenue_data,
        "period": period
    }
@router.get("/orders/chart")
def get_orders_chart_data(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get order data for charts (last 7 days)"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
            SUM(total_amount) as revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    """)
    
    chart_data = cursor.fetchall()
    cursor.close()
    
    return {
        "success": True,
        "data": chart_data
    }

@router.get("/categories/stats")
def get_category_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get sales by category"""
    cursor = conn.cursor()
    
    date_filter = ""
    params = []
    
    if date_from:
        date_filter += " AND DATE(o.created_at) >= %s"
        params.append(date_from)
    
    if date_to:
        date_filter += " AND DATE(o.created_at) <= %s"
        params.append(date_to)
    
    cursor.execute(f"""
        SELECT 
            c.category_name,
            COUNT(DISTINCT oi.order_id) as order_count,
            SUM(oi.quantity) as items_sold,
            SUM(oi.quantity * oi.price) as revenue,
            ROUND(
                SUM(oi.quantity * oi.price) * 100.0 / 
                (SELECT SUM(total_amount) FROM orders WHERE status = 'COMPLETED' {date_filter}),
                2
            ) as revenue_percentage
        FROM order_items oi
        JOIN menu_items m ON oi.item_id = m.item_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status = 'COMPLETED'
        {date_filter}
        GROUP BY c.category_id, c.category_name
        ORDER BY revenue DESC
    """, params + params)  # params twice because of subquery
    
    category_stats = cursor.fetchall()
    cursor.close()
    
    return {
        "success": True,
        "data": category_stats
    }

@router.get("/today")
def get_today_summary(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get today's summary"""
    cursor = conn.cursor()
    
    # Today's revenue
    cursor.execute("""
        SELECT COALESCE(SUM(total_amount), 0) as today_revenue
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
        AND status = 'COMPLETED'
    """)
    revenue = cursor.fetchone()
    
    # Today's orders
    cursor.execute("""
        SELECT COUNT(*) as today_orders
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
        AND status != 'CANCELLED'
    """)
    orders = cursor.fetchone()
    
    # Active orders (pending + preparing + ready)
    cursor.execute("""
        SELECT COUNT(*) as active_orders
        FROM orders
        WHERE status IN ('PENDING', 'PREPARING', 'READY')
    """)
    active = cursor.fetchone()
    
    # Occupied tables
    cursor.execute("""
        SELECT COUNT(*) as occupied_tables
        FROM tables
        WHERE status = 'OCCUPIED'
    """)
    tables = cursor.fetchone()
    
    # New customers today
    cursor.execute("""
        SELECT COUNT(DISTINCT table_id) as new_customers
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
    """)
    customers = cursor.fetchone()
    
    # Average rating (if you have a ratings table)
    # For now, return a mock value
    avg_rating = 4.8
    
    cursor.close()
    
    return {
        "success": True,
        "data": {
            "todayRevenue": float(revenue['today_revenue']),
            "todayOrders": int(orders['today_orders']),
            "activeOrders": int(active['active_orders']),
            "occupiedTables": int(tables['occupied_tables']),
            "newCustomers": int(customers['new_customers']),
            "avgRating": avg_rating
        }
    }

@router.get("/performance/hourly")
def get_hourly_performance(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get hourly performance for today"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            EXTRACT(HOUR FROM created_at) as hour,
            COUNT(*) as order_count,
            SUM(total_amount) as revenue
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
        AND status = 'COMPLETED'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour ASC
    """)
    
    hourly_data = cursor.fetchall()
    cursor.close()
    
    return {
        "success": True,
        "data": hourly_data
    }