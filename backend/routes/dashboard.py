# backend/routes/dashboard.py - FIXED: LẤY DOANH THU TỪ BẢNG PAYMENTS
from fastapi import APIRouter, Depends, HTTPException, Header
from config.database import get_db_connection
from datetime import datetime, timedelta
from typing import Optional
import jwt
import os

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"

def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail="Invalid authorization scheme")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/stats")
def get_dashboard_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Dashboard stats - LẤY TỪ BẢNG PAYMENTS"""
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print(f"\n{'='*70}")
        print(f"📊 LOADING DASHBOARD STATS")
        print(f"{'='*70}")
        
        date_filter = ""
        params = []
        
        if date_from:
            date_filter += " AND DATE(p.created_at) >= %s"
            params.append(date_from)
        
        if date_to:
            date_filter += " AND DATE(p.created_at) <= %s"
            params.append(date_to)
        
        # 1. DOANH THU TỪ BẢNG PAYMENTS
        query = f"""
            SELECT COALESCE(SUM(amount_paid), 0) as total_revenue
            FROM payments p
            WHERE status = 'PAID'
            {date_filter}
        """
        cursor.execute(query, params) if params else cursor.execute(query)
        revenue_result = cursor.fetchone()
        total_revenue = float(revenue_result['total_revenue']) if revenue_result else 0
        
        print(f"💰 Total Revenue: {total_revenue:,.0f}đ")
        
        # 2. TỔNG ĐƠN HÀNG
        query = f"""
            SELECT COUNT(*) as total_orders
            FROM payments p
            WHERE status = 'PAID'
            {date_filter}
        """
        cursor.execute(query, params) if params else cursor.execute(query)
        orders_result = cursor.fetchone()
        total_orders = int(orders_result['total_orders']) if orders_result else 0
        
        print(f"📦 Total Orders: {total_orders}")
        
        # 3. GIÁ TRỊ TRUNG BÌNH
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        print(f"📊 Avg Value: {avg_order_value:,.0f}đ")
        
        # 4-5. BÀN
        cursor.execute("SELECT COUNT(*) as total_tables FROM tables")
        total_tables = int(cursor.fetchone()['total_tables'])
        
        cursor.execute("SELECT COUNT(*) as occupied FROM tables WHERE status = 'OCCUPIED'")
        occupied_tables = int(cursor.fetchone()['occupied'])
        
        # 6. TOP MÓN BÁN CHẠY
        query = f"""
            SELECT 
                m.item_name,
                m.image_url,
                c.category_name,
                COUNT(DISTINCT p.payment_id) as order_count,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * m.price) as revenue
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN menu_items m ON oi.item_id = m.item_id
            LEFT JOIN categories c ON m.category_id = c.category_id
            WHERE p.status = 'PAID'
            {date_filter}
            GROUP BY m.item_id, m.item_name, m.image_url, c.category_name
            ORDER BY order_count DESC
            LIMIT 5
        """
        cursor.execute(query, params) if params else cursor.execute(query)
        popular_items = cursor.fetchall()
        
        # 7. TRẠNG THÁI ĐƠN HÀNG
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'PREPARING' THEN 1 END) as preparing,
                COUNT(CASE WHEN status = 'READY' THEN 1 END) as ready,
                COUNT(CASE WHEN status IN ('COMPLETED', 'PAID') THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled
            FROM orders
        """)
        status_breakdown = cursor.fetchone()
        
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "data": {
                "totalRevenue": total_revenue,
                "totalOrders": total_orders,
                "avgOrderValue": avg_order_value,
                "totalTables": total_tables,
                "occupiedTables": occupied_tables,
                "popularItems": [dict(item) for item in popular_items] if popular_items else [],
                "orderStatusBreakdown": dict(status_breakdown) if status_breakdown else {}
            }
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/today")
def get_today_summary(current_user: dict = Depends(verify_token)):
    """Thống kê hôm nay - LẤY TỪ PAYMENTS"""
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # DOANH THU HÔM NAY
        cursor.execute("""
            SELECT COALESCE(SUM(amount_paid), 0) as today_revenue
            FROM payments
            WHERE DATE(created_at) = CURRENT_DATE
            AND status = 'PAID'
        """)
        today_revenue = float(cursor.fetchone()['today_revenue'])
        
        # ĐƠN HÀNG HÔM NAY
        cursor.execute("""
            SELECT COUNT(*) as today_orders
            FROM payments
            WHERE DATE(created_at) = CURRENT_DATE
            AND status = 'PAID'
        """)
        today_orders = int(cursor.fetchone()['today_orders'])
        
        # ĐƠN ĐANG XỬ LÝ
        cursor.execute("""
            SELECT COUNT(*) as active_orders
            FROM orders
            WHERE status IN ('PENDING', 'PREPARING', 'READY')
        """)
        active_orders = int(cursor.fetchone()['active_orders'])
        
        # BÀN CÓ KHÁCH
        cursor.execute("""
            SELECT COUNT(*) as occupied_tables
            FROM tables
            WHERE status = 'OCCUPIED'
        """)
        occupied_tables = int(cursor.fetchone()['occupied_tables'])
        
        print(f"📅 HÔM NAY: {today_revenue:,.0f}đ | {today_orders} đơn")
        
        return {
            "success": True,
            "data": {
                "todayRevenue": today_revenue,
                "todayOrders": today_orders,
                "activeOrders": active_orders,
                "occupiedTables": occupied_tables
            }
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/revenue")
def get_revenue_data(
    period: str = "daily",
    limit: int = 30,
    current_user: dict = Depends(verify_token)
):
    """Biểu đồ doanh thu - LẤY TỪ PAYMENTS"""
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if period == "daily":
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date, 
                    COALESCE(SUM(amount_paid), 0) as revenue,
                    COUNT(*) as orders
                FROM payments
                WHERE status = 'PAID'
                AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT %s
            """, (limit,))
            
        elif period == "weekly":
            cursor.execute("""
                SELECT 
                    DATE_TRUNC('week', created_at) as date,
                    COALESCE(SUM(amount_paid), 0) as revenue,
                    COUNT(*) as orders
                FROM payments
                WHERE status = 'PAID'
                AND created_at >= CURRENT_DATE - INTERVAL '12 weeks'
                GROUP BY DATE_TRUNC('week', created_at)
                ORDER BY date DESC
                LIMIT %s
            """, (limit,))
            
        elif period == "monthly":
            cursor.execute("""
                SELECT 
                    DATE_TRUNC('month', created_at) as date,
                    COALESCE(SUM(amount_paid), 0) as revenue,
                    COUNT(*) as orders
                FROM payments
                WHERE status = 'PAID'
                AND created_at >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY date DESC
                LIMIT %s
            """, (limit,))
        else:
            raise HTTPException(status_code=400, detail="Invalid period")
        
        revenue_data = cursor.fetchall()
        
        return {
            "success": True,
            "data": [dict(row) for row in revenue_data] if revenue_data else [],
            "period": period
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/categories/stats")
def get_category_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Thống kê theo danh mục - LẤY TỪ PAYMENTS"""
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        date_filter = ""
        params = []
        
        if date_from:
            date_filter += " AND DATE(p.created_at) >= %s"
            params.append(date_from)
        
        if date_to:
            date_filter += " AND DATE(p.created_at) <= %s"
            params.append(date_to)
        
        # TỔNG DOANH THU
        query = f"""
            SELECT COALESCE(SUM(amount_paid), 1) as total
            FROM payments p
            WHERE status = 'PAID' 
            {date_filter}
        """
        cursor.execute(query, params) if params else cursor.execute(query)
        total_revenue = float(cursor.fetchone()['total'])
        
        # THỐNG KÊ THEO DANH MỤC
        query = f"""
            SELECT 
                COALESCE(c.category_name, 'Uncategorized') as category_name,
                COUNT(DISTINCT p.payment_id) as order_count,
                SUM(oi.quantity) as items_sold,
                COALESCE(SUM(oi.quantity * m.price), 0) as revenue
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN menu_items m ON oi.item_id = m.item_id
            LEFT JOIN categories c ON m.category_id = c.category_id
            WHERE p.status = 'PAID'
            {date_filter}
            GROUP BY c.category_id, c.category_name
            ORDER BY revenue DESC
        """
        cursor.execute(query, params) if params else cursor.execute(query)
        category_stats = cursor.fetchall()
        
        # TÍNH %
        result = []
        for stat in category_stats:
            stat_dict = dict(stat)
            stat_dict['revenue_percentage'] = round(
                (float(stat_dict['revenue']) / total_revenue) * 100, 2
            ) if total_revenue > 0 else 0
            result.append(stat_dict)
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/performance/hourly")
def get_hourly_performance(current_user: dict = Depends(verify_token)):
    """Thống kê theo giờ"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                EXTRACT(HOUR FROM created_at)::INTEGER as hour,
                COUNT(*) as order_count,
                COALESCE(SUM(amount_paid), 0) as revenue
            FROM payments
            WHERE DATE(created_at) = CURRENT_DATE
            AND status = 'PAID'
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour ASC
        """)
        
        return {
            "success": True,
            "data": [dict(row) for row in cursor.fetchall()]
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/orders/chart")
def get_orders_chart_data(
    days: int = 7,
    current_user: dict = Depends(verify_token)
):
    """Biểu đồ đơn hàng"""
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                DATE(o.created_at) as date,
                COUNT(*) as total_orders,
                COUNT(CASE WHEN o.status IN ('COMPLETED', 'PAID') THEN 1 END) as completed,
                COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) as cancelled,
                COALESCE(
                    (SELECT SUM(p.amount_paid) 
                     FROM payments p 
                     WHERE DATE(p.created_at) = DATE(o.created_at) 
                     AND p.status = 'PAID'), 
                    0
                ) as revenue
            FROM orders o
            WHERE o.created_at >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY DATE(o.created_at)
            ORDER BY date ASC
        """, (days,))
        
        return {
            "success": True,
            "data": [dict(row) for row in cursor.fetchall()]
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()