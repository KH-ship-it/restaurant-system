# backend/routes/cashier.py - WITH BANK ACCOUNTS SUPPORT
from fastapi import APIRouter, Depends, HTTPException, status, Header
from config.database import get_db
from models.schemas import PaymentProcess
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date
from enum import Enum
import jwt
import os

router = APIRouter(prefix="/api/cashier", tags=["Cashier"])

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"

# ==================== AUTH DEPENDENCY ====================

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

# ==================== ENUMS ====================

class PaymentMethod(str, Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    QR_CODE = "qr_code"
    CARD = "card"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    PARTIAL = "partial"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"

# ==================== MODELS ====================

class PaymentProcessRequest(BaseModel):
    order_id: int
    payment_method: PaymentMethod
    amount_paid: float
    bank_transaction_id: Optional[str] = None
    card_last4: Optional[str] = None
    notes: Optional[str] = None

class SplitPaymentRequest(BaseModel):
    order_id: int
    split_count: int = Field(ge=2, le=10)
    amounts: Optional[List[float]] = None

class RefundRequest(BaseModel):
    order_id: int
    amount: Optional[float] = None
    reason: str

class BankTransaction(BaseModel):
    transaction_id: str
    amount: float
    description: str
    timestamp: datetime

# ==================== HELPER FUNCTIONS ====================

def calculate_order_breakdown(subtotal) -> dict:
    """Calculate tax and service charge"""
    # Convert to float if Decimal (from PostgreSQL)
    subtotal = float(subtotal)
    
    tax = round(subtotal * 0.1, 2)  # 10% VAT
    service_charge = round(subtotal * 0.05, 2)  # 5% service
    total = round(subtotal + tax + service_charge, 2)
    
    return {
        'subtotal': float(subtotal),
        'tax': float(tax),
        'service_charge': float(service_charge),
        'discount': 0.0,
        'total': float(total)
    }

def validate_payment_amount(total, paid, method: PaymentMethod) -> tuple[bool, str]:
    """Validate payment amount"""
    # Convert to float if Decimal
    total = float(total)
    paid = float(paid)
    
    if method == PaymentMethod.CASH:
        if paid < total:
            return False, f"Insufficient payment. Need {total:.2f}, got {paid:.2f}"
        return True, "OK"
    
    tolerance = 5000  # 5,000 VND tolerance
    if abs(paid - total) > tolerance:
        return False, f"Payment amount mismatch. Expected {total:.2f}, got {paid:.2f}"
    
    return True, "OK"

def verify_bank_transaction(transaction_id: str, expected_amount, conn) -> tuple[bool, Optional[str]]:
    """Verify bank transaction in database"""
    cursor = conn.cursor()
    
    # Convert expected_amount to float if Decimal
    expected_amount = float(expected_amount)
    
    cursor.execute("""
        SELECT transaction_id, amount, used_for_order_id, status
        FROM bank_transactions
        WHERE transaction_id = %s
    """, (transaction_id,))
    
    transaction = cursor.fetchone()
    cursor.close()
    
    if not transaction:
        return False, "Transaction not found in bank feed"
    
    if transaction['used_for_order_id']:
        return False, f"Transaction already used for order #{transaction['used_for_order_id']}"
    
    if transaction['status'] != 'PENDING':
        return False, f"Transaction status is {transaction['status']}, cannot use"
    
    # Convert transaction amount to float for comparison
    transaction_amount = float(transaction['amount'])
    
    if abs(transaction_amount - expected_amount) > 5000:
        return False, f"Amount mismatch: Expected {expected_amount:.2f}, got {transaction_amount:.2f}"
    
    return True, None

# ==================== BANK ACCOUNTS ENDPOINTS ====================

@router.get("/bank-accounts/active")
def get_active_bank_accounts(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get active bank accounts for cashier payment"""
    cursor = conn.cursor()
    
    try:
        print(f"\n{'='*70}")
        print(f" FETCHING ACTIVE BANK ACCOUNTS")
        print(f"{'='*70}")
        
        cursor.execute("""
            SELECT id, bank_name, bank_logo, account_number, 
                   account_holder, branch_name, is_active, 
                   created_at, updated_at
            FROM bank_accounts
            WHERE is_active = TRUE AND status = 'active'
            ORDER BY created_at ASC
        """)
        
        accounts = cursor.fetchall()
        
        print(f" Found {len(accounts)} active bank accounts")
        for account in accounts:
            print(f"  - {account['bank_name']}: {account['account_number']}")
        
        cursor.close()
        
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "data": accounts,
            "count": len(accounts)
        }
        
    except Exception as e:
        cursor.close()
        print(f" ERROR fetching bank accounts: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching bank accounts: {str(e)}"
        )

# ==================== PAYMENT ENDPOINTS ====================

@router.get("/pending")
def get_pending_orders(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get orders pending payment - FIXED to include PENDING status"""
    cursor = conn.cursor()
    
    print(f"\n{'='*70}")
    print(f" FETCHING PENDING ORDERS")
    print(f"{'='*70}")
    
    # FIXED: Include 'PENDING' status so newly created orders appear
    cursor.execute("""
        SELECT o.*, t.table_number, e.full_name as employee_name
        FROM orders o
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        WHERE o.status IN ('PENDING', 'CONFIRMED', 'READY', 'DELIVERED')
        AND o.order_id NOT IN (
            SELECT order_id FROM payments WHERE status = 'PAID'
        )
        ORDER BY o.created_at ASC
    """)
    
    orders = cursor.fetchall()
    print(f" Found {len(orders)} pending orders")
    
    # Get items for each order
    for order in orders:
        cursor.execute("""
            SELECT oi.*, m.item_name, m.image_url
            FROM order_items oi
            JOIN menu_items m ON oi.item_id = m.item_id
            WHERE oi.order_id = %s
        """, (order['order_id'],))
        order['items'] = cursor.fetchall()
        
        # Add payment breakdown
        order['payment_breakdown'] = calculate_order_breakdown(order['total_amount'])
        
        print(f"  - Order #{order['order_id']}: Table {order['table_number']}, Status: {order['status']}, Total: {order['total_amount']}")
    
    cursor.close()
    
    print(f"{'='*70}\n")
    
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
    
    # Check if already paid
    cursor.execute("""
        SELECT payment_id, payment_method, amount_paid, created_at
        FROM payments
        WHERE order_id = %s AND status = 'PAID'
    """, (order_id,))
    
    existing_payment = cursor.fetchone()
    
    # Get order items
    cursor.execute("""
        SELECT oi.*, m.item_name, m.image_url, m.description
        FROM order_items oi
        JOIN menu_items m ON oi.item_id = m.item_id
        WHERE oi.order_id = %s
    """, (order_id,))
    
    order['items'] = cursor.fetchall()
    
    # Calculate payment breakdown
    order['payment_breakdown'] = calculate_order_breakdown(order['total_amount'])
    
    # Add payment status
    order['can_payment'] = existing_payment is None
    order['payment_message'] = "Already paid" if existing_payment else "Ready for payment"
    order['existing_payment'] = existing_payment
    
    cursor.close()
    
    return {
        "success": True,
        "data": order
    }

@router.post("/payment")
def process_payment(
    payment: PaymentProcessRequest,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Process payment for an order"""
    cursor = conn.cursor()
    
    try:
        print(f"\n{'='*70}")
        print(f" PROCESSING PAYMENT")
        print(f"{'='*70}")
        print(f"Order ID: {payment.order_id}")
        print(f"Method: {payment.payment_method}")
        print(f"Amount: {payment.amount_paid:,.2f}")      
        # Get order details
        cursor.execute("""
            SELECT o.order_id, o.table_id, o.status, o.total_amount,
                   t.table_number
            FROM orders o
            JOIN tables t ON o.table_id = t.table_id
            WHERE o.order_id = %s
        """, (payment.order_id,))
        
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order['status'] == 'CANCELLED':
            raise HTTPException(status_code=400, detail="Cannot pay for cancelled order")
        
        # Calculate breakdown
        breakdown = calculate_order_breakdown(order['total_amount'])
        total = breakdown['total']
        
        print(f"Order Total: {total:,.2f}")
        
        # Validate payment amount
        valid, message = validate_payment_amount(total, payment.amount_paid, payment.payment_method)
        if not valid:
            raise HTTPException(status_code=400, detail=message)
        
        print(" Amount validated")
        
        # Verify bank transaction if applicable
        if payment.payment_method in [PaymentMethod.BANK_TRANSFER, PaymentMethod.QR_CODE]:
            if not payment.bank_transaction_id:
                raise HTTPException(status_code=400, detail="Bank transaction ID required")
            
            valid, error = verify_bank_transaction(payment.bank_transaction_id, total, conn)
            if not valid:
                raise HTTPException(status_code=400, detail=f"Bank verification failed: {error}")
            
            print("Bank transaction verified")
        
        # Calculate change (for cash)
        change = max(0, payment.amount_paid - total) if payment.payment_method == PaymentMethod.CASH else 0
        # Create payment record
        cursor.execute("""
            INSERT INTO payments (
                order_id, payment_method, amount_paid, change_given,
                bank_transaction_id, card_last4, notes,
                cashier_id, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'PAID', CURRENT_TIMESTAMP)
            RETURNING payment_id, created_at
        """, (
            payment.order_id,
            payment.payment_method.value,
            total,
            change,
            payment.bank_transaction_id,
            payment.card_last4,
            payment.notes,
            current_user.get('employeeId')
        ))
        
        payment_record = cursor.fetchone()
        print(f"✓ Payment record created: #{payment_record['payment_id']}")
        
        # Mark bank transaction as used (if applicable)
        if payment.bank_transaction_id:
            cursor.execute("""
                UPDATE bank_transactions
                SET used_for_order_id = %s,
                    status = 'VERIFIED',
                    verified_at = CURRENT_TIMESTAMP
                WHERE transaction_id = %s
            """, (payment.order_id, payment.bank_transaction_id))
            print(f"✓ Bank transaction marked as used")
        
        # Update order status
        cursor.execute("""
            UPDATE orders
            SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
            WHERE order_id = %s
            RETURNING *
        """, (payment.order_id,))
        
        updated_order = cursor.fetchone()
        print(f"✓ Order status updated to PAID")
        
        # Update table status to empty
        cursor.execute("""
            UPDATE tables
            SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
            WHERE table_id = %s
        """, (order['table_id'],))
        print(f"✓ Table {order['table_number']} released")
        
        # Update kitchen order if exists
        cursor.execute("""
            UPDATE kitchen_orders
            SET status = 'SERVED', updated_at = CURRENT_TIMESTAMP
            WHERE order_id = %s
        """, (payment.order_id,))
        
        conn.commit()
        
        print(f" PAYMENT SUCCESSFUL")
        print(f"{'='*70}\n")
        
        cursor.close()
        
        return {
            "success": True,
            "message": "Payment processed successfully",
            "data": {
                "payment_id": payment_record['payment_id'],
                "order_id": payment.order_id,
                "amount": total,
                "amount_paid": payment.amount_paid,
                "change": change,
                "payment_method": payment.payment_method.value,
                "paid_at": payment_record['created_at'].isoformat(),
                "order": updated_order,
                "breakdown": breakdown
            }
        }
        
    except HTTPException:
        conn.rollback()
        cursor.close()
        raise
    except Exception as e:
        conn.rollback()
        cursor.close()
        print(f" ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/bank-feed")
def get_bank_feed(
    status: Optional[str] = "PENDING",
    limit: int = 50,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get bank transactions for verification"""
    cursor = conn.cursor()   
    print(f"\n{'='*50}")
    print(f" FETCHING BANK FEED")
    print(f"Status filter: {status}")
    print(f"{'='*50}")
    
    query = """
        SELECT transaction_id, amount, description, 
               transaction_date, status, used_for_order_id,
               created_at
        FROM bank_transactions
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND status = %s"
        params.append(status)
    
    query += " ORDER BY transaction_date DESC, created_at DESC LIMIT %s"
    params.append(limit)
    
    cursor.execute(query, params)
    transactions = cursor.fetchall()
    
    print(f" Found {len(transactions)} transactions")
    
    # Summary
    cursor.execute("""
        SELECT 
            COUNT(*) as total_count,
            SUM(amount) as total_amount,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'VERIFIED' THEN 1 END) as verified_count
        FROM bank_transactions
        WHERE DATE(transaction_date) = CURRENT_DATE
    """)
    
    summary = cursor.fetchone()
    
    cursor.close()
    
    print(f"{'='*50}\n")
    
    return {
        "success": True,
        "data": {
            "transactions": transactions,
            "summary": summary,
            "last_updated": datetime.now().isoformat()
        }
    }

@router.post("/bank-feed/verify")
def verify_bank_transaction_endpoint(
    transaction_id: str,
    order_id: int,
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Verify a bank transaction matches an order"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT order_id, total_amount, status
        FROM orders
        WHERE order_id = %s
    """, (order_id,))
    
    order = cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    breakdown = calculate_order_breakdown(order['total_amount'])
    total = breakdown['total']
    
    valid, error = verify_bank_transaction(transaction_id, total, conn)
    
    cursor.close()
    
    if not valid:
        return {
            "success": False,
            "message": error,
            "amount_match": False
        }
    
    return {
        "success": True,
        "message": "Transaction verified successfully",
        "amount_match": True
    }

@router.get("/transactions/today")
def get_today_transactions(
    current_user: dict = Depends(verify_token),
    conn=Depends(get_db)
):
    """Get today's completed transactions"""
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT p.payment_id, p.order_id, p.amount_paid as total_amount,
               p.payment_method, p.change_given, p.created_at,
               t.table_number, e.full_name as employee_name,
               ce.full_name as cashier_name
        FROM payments p
        JOIN orders o ON p.order_id = o.order_id
        JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        LEFT JOIN employees ce ON p.cashier_id = ce.employee_id
        WHERE p.status = 'PAID'
        AND DATE(p.created_at) = CURRENT_DATE
        ORDER BY p.created_at DESC
    """)
    
    transactions = cursor.fetchall()
    
    # Calculate summary
    cursor.execute("""
        SELECT 
            COUNT(*) as transaction_count,
            SUM(amount_paid) as total_revenue,
            AVG(amount_paid) as avg_transaction,
            SUM(CASE WHEN payment_method = 'cash' THEN amount_paid ELSE 0 END) as cash_total,
            SUM(CASE WHEN payment_method IN ('bank_transfer', 'qr_code') THEN amount_paid ELSE 0 END) as transfer_total,
            SUM(CASE WHEN payment_method = 'card' THEN amount_paid ELSE 0 END) as card_total
        FROM payments
        WHERE status = 'PAID'
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
                "avg_transaction": float(summary['avg_transaction'] or 0),
                "cash_total": float(summary['cash_total'] or 0),
                "transfer_total": float(summary['transfer_total'] or 0),
                "card_total": float(summary['card_total'] or 0)
            }
        }
    }