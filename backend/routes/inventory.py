from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel
import psycopg2
import psycopg2.extras

# ✅ Đúng với project này
from config.database import get_db_connection

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

# =============================================================================
# HELPERS
# =============================================================================

def serialize_row(row) -> dict:
    result = {}
    items = row.items() if hasattr(row, "items") else row._asdict().items()
    for key, value in items:
        if isinstance(value, (datetime, date)):
            result[key] = value.isoformat()
        elif hasattr(value, "__float__"):
            result[key] = float(value)
        else:
            result[key] = value
    return result


def ok_response(data=None, message="OK", status_code=200):
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return JSONResponse(content=payload, status_code=status_code)


def err_response(message: str, status_code=400):
    return JSONResponse(
        content={"success": False, "message": message},
        status_code=status_code
    )


def resolve_status(stock, min_t, max_t) -> str:
    stock = float(stock or 0)
    min_t = float(min_t or 0)
    max_t = float(max_t or 0)
    if stock <= 0:
        return "OUT_OF_STOCK"
    if stock <= min_t:
        return "LOW_STOCK"
    if max_t > 0 and stock >= max_t:
        return "OVERSTOCKED"
    return "NORMAL"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class IngredientCreate(BaseModel):
    ingredient_name: str
    unit: str
    unit_cost: float = 0
    current_stock: float = 0
    min_threshold: float = 0
    max_threshold: float = 0
    supplier: str = ""

class IngredientUpdate(BaseModel):
    ingredient_name: Optional[str] = None
    unit: Optional[str] = None
    unit_cost: Optional[float] = None
    min_threshold: Optional[float] = None
    max_threshold: Optional[float] = None
    supplier: Optional[str] = None
    is_active: Optional[bool] = None

class RestockBody(BaseModel):
    quantity: float
    notes: str = "Nhập kho thủ công"

class AdjustBody(BaseModel):
    actual_stock: float
    notes: str = "Điều chỉnh sau kiểm kê"

class RecipeIngredientItem(BaseModel):
    ingredient_id: int
    quantity_required: float
    waste_factor: float = 1.0
    notes: Optional[str] = None

class RecipeBody(BaseModel):
    ingredients: list[RecipeIngredientItem]

class OrderLine(BaseModel):
    item_id: int
    order_item_id: Optional[int] = None
    dish_name: Optional[str] = None
    quantity: int

class DeductBody(BaseModel):
    table_id: Optional[str] = None
    order_id: Optional[int] = None
    order_lines: list[OrderLine]

class PurchaseCreateBody(BaseModel):
    ingredient_id: int
    requested_quantity: float
    notes: str = "Tạo thủ công"

class PurchaseUpdateBody(BaseModel):
    status: str
    notes: Optional[str] = None
    actual_received_quantity: Optional[float] = None


# =============================================================================
# AUTH DEPENDENCY — tự động thích nghi với utils/auth.py hiện có
# =============================================================================

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = auth_header[7:]

    try:
        from middleware.auth import verify_token
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
        return payload
    except ImportError:
        pass

    try:
        from utils.auth import verify_token
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
        return payload
    except ImportError:
        pass

    try:
        import jwt, os
        secret = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET", "secret")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Xác thực thất bại: {str(e)}")


# =============================================================================
# NGUYÊN LIỆU
# =============================================================================

@router.get("/ingredients")
async def get_ingredients(
    search: str = Query(""),
    status: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user),
):
    offset = (page - 1) * limit
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    i.ingredient_id, i.ingredient_name, i.unit, i.unit_cost,
                    i.current_stock, i.min_threshold, i.max_threshold,
                    i.supplier, i.is_active,
                    ROUND((i.current_stock * i.unit_cost)::numeric, 0) AS stock_value,
                    CASE WHEN i.max_threshold > 0
                         THEN ROUND((i.current_stock / i.max_threshold * 100)::numeric, 1)
                         ELSE NULL END AS stock_percent,
                    CASE
                        WHEN i.current_stock <= 0               THEN 'OUT_OF_STOCK'
                        WHEN i.current_stock <= i.min_threshold THEN 'LOW_STOCK'
                        WHEN i.max_threshold > 0
                         AND i.current_stock >= i.max_threshold THEN 'OVERSTOCKED'
                        ELSE 'NORMAL'
                    END AS stock_status,
                    i.updated_at
                FROM ingredients i
                WHERE i.is_active = TRUE AND i.ingredient_name ILIKE %s
                ORDER BY
                    CASE WHEN i.current_stock <= 0 THEN 1
                         WHEN i.current_stock <= i.min_threshold THEN 2
                         ELSE 3 END,
                    i.ingredient_name
                LIMIT %s OFFSET %s
            """, (f"%{search}%", limit, offset))
            rows = [serialize_row(r) for r in cur.fetchall()]

            cur.execute("SELECT COUNT(*) AS total FROM ingredients WHERE is_active = TRUE AND ingredient_name ILIKE %s", (f"%{search}%",))
            total = cur.fetchone()["total"]

        if status:
            rows = [r for r in rows if r["stock_status"] == status]

        return ok_response({"ingredients": rows, "pagination": {"page": page, "limit": limit, "total": total}})
    finally:
        conn.close()


@router.get("/ingredients/{ingredient_id}")
async def get_ingredient_detail(
    ingredient_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM ingredients WHERE ingredient_id = %s", (ingredient_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu")
            item = serialize_row(row)
            item["stock_status"] = resolve_status(item["current_stock"], item["min_threshold"], item.get("max_threshold", 0))

            cur.execute("""
                SELECT it.transaction_id, it.transaction_type, it.quantity_change,
                       it.stock_before, it.stock_after, it.order_id, it.notes,
                       e.full_name AS employee_name, it.created_at
                FROM inventory_transactions it
                LEFT JOIN employees e ON it.employee_id = e.employee_id
                WHERE it.ingredient_id = %s AND it.created_at >= NOW() - INTERVAL '7 days'
                ORDER BY it.created_at DESC LIMIT 50
            """, (ingredient_id,))
            item["history"] = [serialize_row(r) for r in cur.fetchall()]

        return ok_response(item)
    finally:
        conn.close()


@router.post("/ingredients", status_code=201)
async def create_ingredient(
    body: IngredientCreate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO ingredients
                    (ingredient_name, unit, unit_cost, current_stock, min_threshold, max_threshold, supplier)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *
            """, (body.ingredient_name, body.unit, body.unit_cost, body.current_stock,
                  body.min_threshold, body.max_threshold, body.supplier))
            new_row = serialize_row(cur.fetchone())

            if body.current_stock > 0:
                cur.execute("""
                    INSERT INTO inventory_transactions
                        (ingredient_id, transaction_type, quantity_change, stock_before, stock_after, employee_id, notes)
                    VALUES (%s, 'RESTOCK', %s, 0, %s, %s, 'Nhập kho ban đầu')
                """, (new_row["ingredient_id"], body.current_stock, body.current_stock,
                      current_user.get("employee_id")))
        conn.commit()
        return ok_response(new_row, "Đã thêm nguyên liệu", 201)
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="Nguyên liệu đã tồn tại")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.put("/ingredients/{ingredient_id}")
async def update_ingredient(
    ingredient_id: int,
    body: IngredientUpdate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE ingredients SET
                    ingredient_name = COALESCE(%s, ingredient_name),
                    unit            = COALESCE(%s, unit),
                    unit_cost       = COALESCE(%s, unit_cost),
                    min_threshold   = COALESCE(%s, min_threshold),
                    max_threshold   = COALESCE(%s, max_threshold),
                    supplier        = COALESCE(%s, supplier),
                    is_active       = COALESCE(%s, is_active),
                    updated_at      = CURRENT_TIMESTAMP
                WHERE ingredient_id = %s RETURNING *
            """, (body.ingredient_name, body.unit, body.unit_cost, body.min_threshold,
                  body.max_threshold, body.supplier, body.is_active, ingredient_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu")
        conn.commit()
        return ok_response(serialize_row(row), "Đã cập nhật nguyên liệu")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/ingredients/{ingredient_id}")
async def delete_ingredient(
    ingredient_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE ingredients SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = %s", (ingredient_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu")
        conn.commit()
        return ok_response(message="Đã xóa nguyên liệu")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.patch("/ingredients/{ingredient_id}/restock")
async def restock_ingredient(
    ingredient_id: int,
    body: RestockBody,
    current_user: dict = Depends(get_current_user),
):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Số lượng nhập phải lớn hơn 0")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM ingredients WHERE ingredient_id = %s FOR UPDATE", (ingredient_id,))
            ing = cur.fetchone()
            if not ing:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu")

            stock_before = float(ing["current_stock"])
            stock_after = stock_before + body.quantity

            cur.execute("UPDATE ingredients SET current_stock = %s, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = %s",
                        (stock_after, ingredient_id))
            cur.execute("""
                INSERT INTO inventory_transactions
                    (ingredient_id, transaction_type, quantity_change, stock_before, stock_after, employee_id, notes)
                VALUES (%s, 'RESTOCK', %s, %s, %s, %s, %s)
            """, (ingredient_id, body.quantity, stock_before, stock_after,
                  current_user.get("employee_id"), body.notes))

            if stock_before <= 0 < stock_after:
                cur.execute("""
                    UPDATE menu_items SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
                    WHERE item_id IN (SELECT item_id FROM recipe_items WHERE ingredient_id = %s)
                    AND status = 'OUT_OF_STOCK'
                """, (ingredient_id,))
        conn.commit()
        return ok_response(
            {"ingredient_id": ingredient_id, "stock_before": stock_before,
             "stock_after": stock_after, "quantity_added": body.quantity},
            f"Đã nhập {body.quantity} {ing['unit']}")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.patch("/ingredients/{ingredient_id}/adjust")
async def adjust_inventory(
    ingredient_id: int,
    body: AdjustBody,
    current_user: dict = Depends(get_current_user),
):
    if body.actual_stock < 0:
        raise HTTPException(status_code=400, detail="Tồn kho thực tế không hợp lệ")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM ingredients WHERE ingredient_id = %s FOR UPDATE", (ingredient_id,))
            ing = cur.fetchone()
            if not ing:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu")

            stock_before = float(ing["current_stock"])
            diff = body.actual_stock - stock_before

            cur.execute("UPDATE ingredients SET current_stock = %s, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = %s",
                        (body.actual_stock, ingredient_id))
            cur.execute("""
                INSERT INTO inventory_transactions
                    (ingredient_id, transaction_type, quantity_change, stock_before, stock_after, employee_id, notes)
                VALUES (%s, 'MANUAL_ADJUST', %s, %s, %s, %s, %s)
            """, (ingredient_id, diff, stock_before, body.actual_stock,
                  current_user.get("employee_id"),
                  f"{body.notes} | chênh lệch: {diff:+.3f} {ing['unit']}"))
        conn.commit()
        return ok_response(
            {"ingredient_id": ingredient_id, "stock_before": stock_before,
             "stock_after": body.actual_stock, "difference": diff},
            "Đã cập nhật tồn kho sau kiểm kê")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# =============================================================================
# CÔNG THỨC
# =============================================================================

@router.get("/recipes/{item_id}")
async def get_recipe(item_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT ri.recipe_item_id, ri.ingredient_id, i.ingredient_name, i.unit,
                       i.current_stock, i.unit_cost, ri.quantity_required, ri.waste_factor,
                       ROUND((ri.quantity_required * ri.waste_factor)::numeric, 3) AS actual_usage,
                       ri.notes,
                       CASE WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
                            WHEN i.current_stock <= (ri.quantity_required * ri.waste_factor * 5) THEN 'LOW'
                            ELSE 'AVAILABLE' END AS ingredient_availability
                FROM recipe_items ri JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
                WHERE ri.item_id = %s ORDER BY i.ingredient_name
            """, (item_id,))
            rows = [serialize_row(r) for r in cur.fetchall()]

        max_servings = 0
        if rows:
            candidates = [float(r["current_stock"]) / float(r["actual_usage"])
                          for r in rows if float(r["actual_usage"]) > 0]
            max_servings = int(min(candidates)) if candidates else 0

        return ok_response({"recipe": rows, "max_servings_possible": max_servings})
    finally:
        conn.close()


@router.post("/recipes/{item_id}")
async def upsert_recipe(item_id: int, body: RecipeBody, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM recipe_items WHERE item_id = %s", (item_id,))
            for ing in body.ingredients:
                cur.execute("""
                    INSERT INTO recipe_items (item_id, ingredient_id, quantity_required, waste_factor, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (item_id, ing.ingredient_id, ing.quantity_required, ing.waste_factor, ing.notes))
        conn.commit()
        return ok_response(message=f"Đã lưu công thức với {len(body.ingredients)} nguyên liệu")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/recipes/{item_id}/{ingredient_id}")
async def delete_recipe_item(item_id: int, ingredient_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM recipe_items WHERE item_id = %s AND ingredient_id = %s", (item_id, ingredient_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu trong công thức")
        conn.commit()
        return ok_response(message="Đã xóa nguyên liệu khỏi công thức")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# =============================================================================
# TỰ ĐỘNG TRỪ KHO
# =============================================================================

@router.post("/deduct/preview")
async def deduct_preview(body: DeductBody, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            needed: dict = {}
            for line in body.order_lines:
                cur.execute("""
                    SELECT ri.ingredient_id, i.ingredient_name, i.unit,
                           i.current_stock, i.min_threshold,
                           ROUND((ri.quantity_required * ri.waste_factor * %s)::numeric, 3) AS qty_needed
                    FROM recipe_items ri JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
                    WHERE ri.item_id = %s AND i.is_active = TRUE
                """, (line.quantity, line.item_id))
                for row in cur.fetchall():
                    ing_id = row["ingredient_id"]
                    if ing_id in needed:
                        needed[ing_id]["qty_needed"] += float(row["qty_needed"])
                    else:
                        needed[ing_id] = {
                            "ingredient_id": ing_id,
                            "ingredient_name": row["ingredient_name"],
                            "unit": row["unit"],
                            "current_stock": float(row["current_stock"]),
                            "min_threshold": float(row["min_threshold"]),
                            "qty_needed": float(row["qty_needed"]),
                        }

        preview, can_all, missing = [], True, []
        for item in needed.values():
            after = round(item["current_stock"] - item["qty_needed"], 3)
            can_fulfill = item["current_stock"] >= item["qty_needed"]
            warning = None
            if after <= 0: warning = "OUT_OF_STOCK"
            elif after <= item["min_threshold"]: warning = "LOW_STOCK"
            if not can_fulfill:
                can_all = False
                missing.append(item["ingredient_name"])
            preview.append({**item, "qty_needed": round(item["qty_needed"], 3),
                             "stock_after": after, "can_fulfill": can_fulfill, "warning": warning})

        return ok_response({"preview": preview, "can_proceed": can_all, "missing": missing})
    finally:
        conn.close()


@router.post("/deduct/confirm")
async def deduct_confirm(body: DeductBody, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            needed: dict = {}
            for line in body.order_lines:
                cur.execute("""
                    SELECT ri.ingredient_id, i.ingredient_name, i.unit, i.min_threshold,
                           ROUND((ri.quantity_required * ri.waste_factor * %s)::numeric, 3) AS qty_needed
                    FROM recipe_items ri JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
                    WHERE ri.item_id = %s AND i.is_active = TRUE
                """, (line.quantity, line.item_id))
                for row in cur.fetchall():
                    ing_id = row["ingredient_id"]
                    if ing_id in needed:
                        needed[ing_id]["qty_needed"] += float(row["qty_needed"])
                    else:
                        needed[ing_id] = {
                            "ingredient_id": ing_id,
                            "ingredient_name": row["ingredient_name"],
                            "unit": row["unit"],
                            "min_threshold": float(row["min_threshold"]),
                            "qty_needed": float(row["qty_needed"]),
                        }

            if not needed:
                return ok_response({
                    "table_id": body.table_id, "order_id": body.order_id,
                    "deductions": [], "warnings": [],
                    "note": "Không có nguyên liệu cần trừ (chưa cấu hình công thức)",
                })

            # Lock và kiểm tra tồn kho
            insufficient = []
            for ing_id, info in needed.items():
                cur.execute("SELECT current_stock FROM ingredients WHERE ingredient_id = %s FOR UPDATE", (ing_id,))
                row = cur.fetchone()
                info["stock_before"] = float(row["current_stock"]) if row else 0.0
                if info["stock_before"] < info["qty_needed"]:
                    insufficient.append(
                        f"{info['ingredient_name']}: cần {info['qty_needed']:.3f}, "
                        f"còn {info['stock_before']:.3f} {info['unit']}")

            if insufficient:
                conn.rollback()
                return JSONResponse(content={
                    "success": False,
                    "message": "Không đủ nguyên liệu",
                    "errors": insufficient
                }, status_code=409)

            deductions, warnings = [], []
            for ing_id, info in needed.items():
                stock_after = round(info["stock_before"] - info["qty_needed"], 3)

                cur.execute("UPDATE ingredients SET current_stock = %s, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = %s",
                            (stock_after, ing_id))
                cur.execute("""
                    INSERT INTO inventory_transactions
                        (ingredient_id, transaction_type, quantity_change, stock_before, stock_after, order_id, employee_id, notes)
                    VALUES (%s, 'ORDER_DEDUCT', %s, %s, %s, %s, %s, %s)
                """, (ing_id, -info["qty_needed"], info["stock_before"], stock_after,
                      body.order_id, current_user.get("employee_id"), f"Bàn {body.table_id}"))

                warning = None
                if stock_after <= 0:
                    warning = "OUT_OF_STOCK"
                    cur.execute("""
                        UPDATE menu_items SET status = 'OUT_OF_STOCK', updated_at = CURRENT_TIMESTAMP
                        WHERE item_id IN (SELECT item_id FROM recipe_items WHERE ingredient_id = %s)
                        AND status = 'AVAILABLE'
                    """, (ing_id,))
                elif stock_after <= info["min_threshold"]:
                    warning = "LOW_STOCK"

                if warning:
                    cur.execute("""
                        INSERT INTO purchase_requests
                            (ingredient_id, requested_quantity, trigger_stock, status, notes)
                        VALUES (%s, %s, %s, 'PENDING', %s)
                        ON CONFLICT DO NOTHING
                    """, (ing_id, float(info["min_threshold"]) * 3, stock_after,
                          f"[AUTO] Bàn {body.table_id} – {info['ingredient_name']} {warning}"))

                d = {"ingredient_id": ing_id, "ingredient_name": info["ingredient_name"],
                     "unit": info["unit"], "deducted": round(info["qty_needed"], 3),
                     "stock_before": info["stock_before"], "stock_after": stock_after, "warning": warning}
                deductions.append(d)
                if warning:
                    warnings.append(d)

        conn.commit()
        return ok_response({
            "table_id": body.table_id, "order_id": body.order_id,
            "deductions": deductions, "warnings": warnings,
        }, "Đã trừ kho thành công")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi trừ kho: {str(e)}")
    finally:
        conn.close()


# =============================================================================
# BIẾN ĐỘNG KHO
# =============================================================================

@router.get("/transactions")
async def get_transactions(
    ingredient_id: Optional[int] = None,
    type: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=200),
    current_user: dict = Depends(get_current_user),
):
    offset = (page - 1) * limit
    conditions, params = [], []
    if ingredient_id: conditions.append("it.ingredient_id = %s"); params.append(ingredient_id)
    if type: conditions.append("it.transaction_type = %s"); params.append(type)
    if from_date: conditions.append("it.created_at >= %s"); params.append(from_date)
    if to_date: conditions.append("it.created_at < %s::date + INTERVAL '1 day'"); params.append(to_date)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f"""
                SELECT it.transaction_id, i.ingredient_name, i.unit, it.transaction_type,
                       it.quantity_change, it.stock_before, it.stock_after, it.order_id,
                       it.notes, e.full_name AS employee_name, it.created_at
                FROM inventory_transactions it
                JOIN ingredients i ON it.ingredient_id = i.ingredient_id
                LEFT JOIN employees e ON it.employee_id = e.employee_id
                {where}
                ORDER BY it.created_at DESC LIMIT %s OFFSET %s
            """, params + [limit, offset])
            rows = [serialize_row(r) for r in cur.fetchall()]
        return ok_response({"transactions": rows, "pagination": {"page": page, "limit": limit}})
    finally:
        conn.close()


@router.get("/transactions/today")
async def get_today_transactions(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT it.transaction_type, COUNT(*) AS count,
                       SUM(ABS(it.quantity_change)) AS total_quantity,
                       i.ingredient_name, i.unit
                FROM inventory_transactions it
                JOIN ingredients i ON it.ingredient_id = i.ingredient_id
                WHERE DATE(it.created_at) = CURRENT_DATE
                GROUP BY it.transaction_type, i.ingredient_id, i.ingredient_name, i.unit
                ORDER BY it.transaction_type, total_quantity DESC
            """)
            rows = [serialize_row(r) for r in cur.fetchall()]
        return ok_response(rows)
    finally:
        conn.close()


# =============================================================================
# DASHBOARD
# =============================================================================

@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT COUNT(*) AS total_ingredients,
                       COUNT(*) FILTER (WHERE current_stock <= 0) AS out_of_stock,
                       COUNT(*) FILTER (WHERE current_stock > 0 AND current_stock <= min_threshold) AS low_stock,
                       COUNT(*) FILTER (WHERE max_threshold > 0 AND current_stock >= max_threshold) AS overstocked,
                       ROUND(SUM(current_stock * unit_cost)::numeric, 0) AS total_inventory_value
                FROM ingredients WHERE is_active = TRUE
            """)
            summary = serialize_row(cur.fetchone())

            cur.execute("""
                SELECT ingredient_id, ingredient_name, unit, current_stock, min_threshold,
                       CASE WHEN current_stock <= 0 THEN 'OUT_OF_STOCK' ELSE 'LOW_STOCK' END AS alert_type
                FROM ingredients WHERE is_active = TRUE
                  AND (current_stock <= 0 OR current_stock <= min_threshold)
                ORDER BY current_stock ASC LIMIT 10
            """)
            alerts = [serialize_row(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT i.ingredient_name, i.unit, ABS(SUM(it.quantity_change)) AS consumed
                FROM inventory_transactions it
                JOIN ingredients i ON it.ingredient_id = i.ingredient_id
                WHERE it.transaction_type = 'ORDER_DEDUCT' AND DATE(it.created_at) = CURRENT_DATE
                GROUP BY i.ingredient_id, i.ingredient_name, i.unit
                ORDER BY consumed DESC LIMIT 5
            """)
            top_consumed = [serialize_row(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT COUNT(*) AS pending_count,
                       COALESCE(ROUND(SUM(pr.requested_quantity * i.unit_cost)::numeric, 0), 0) AS total_estimated_cost
                FROM purchase_requests pr
                JOIN ingredients i ON pr.ingredient_id = i.ingredient_id
                WHERE pr.status = 'PENDING'
            """)
            purchase_summary = serialize_row(cur.fetchone())

        return ok_response({
            "summary": summary, "alerts": alerts,
            "top_consumed_today": top_consumed, "purchase_requests": purchase_summary,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải dashboard: {str(e)}")
    finally:
        conn.close()


@router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT ingredient_id, ingredient_name, unit, current_stock,
                       min_threshold, max_threshold, supplier,
                       CASE WHEN current_stock <= 0 THEN 'OUT_OF_STOCK'
                            WHEN current_stock <= min_threshold THEN 'LOW_STOCK'
                            WHEN max_threshold > 0 AND current_stock >= max_threshold THEN 'OVERSTOCKED'
                       END AS alert_type,
                       GREATEST(0, min_threshold * 3 - current_stock) AS suggested_restock_qty
                FROM ingredients WHERE is_active = TRUE
                  AND (current_stock <= min_threshold
                    OR (max_threshold > 0 AND current_stock >= max_threshold))
                ORDER BY CASE WHEN current_stock <= 0 THEN 1 ELSE 2 END, current_stock ASC
            """)
            rows = [serialize_row(r) for r in cur.fetchall()]
        return ok_response(rows)
    finally:
        conn.close()


@router.get("/consumption/today")
async def get_today_consumption(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT i.ingredient_name, i.unit,
                       ABS(SUM(it.quantity_change)) AS total_consumed,
                       COUNT(DISTINCT it.order_id) AS order_count,
                       i.current_stock AS remaining_stock
                FROM inventory_transactions it
                JOIN ingredients i ON it.ingredient_id = i.ingredient_id
                WHERE it.transaction_type = 'ORDER_DEDUCT' AND DATE(it.created_at) = CURRENT_DATE
                GROUP BY i.ingredient_id, i.ingredient_name, i.unit, i.current_stock
                ORDER BY total_consumed DESC
            """)
            rows = [serialize_row(r) for r in cur.fetchall()]
        return ok_response(rows)
    finally:
        conn.close()


@router.get("/cost/daily")
async def get_daily_cost(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: dict = Depends(get_current_user),
):
    conditions = ["it.transaction_type = 'ORDER_DEDUCT'"]
    params = []
    if from_date: conditions.append("DATE(it.created_at) >= %s"); params.append(from_date)
    if to_date: conditions.append("DATE(it.created_at) <= %s"); params.append(to_date)
    where = "WHERE " + " AND ".join(conditions)

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f"""
                SELECT DATE(it.created_at) AS report_date, i.ingredient_name, i.unit,
                       ABS(SUM(it.quantity_change)) AS total_used, i.unit_cost,
                       ROUND(ABS(SUM(it.quantity_change)) * i.unit_cost, 0) AS total_cost
                FROM inventory_transactions it
                JOIN ingredients i ON it.ingredient_id = i.ingredient_id
                {where}
                GROUP BY DATE(it.created_at), i.ingredient_id, i.ingredient_name, i.unit, i.unit_cost
                ORDER BY report_date DESC, total_cost DESC
            """, params)
            rows = [serialize_row(r) for r in cur.fetchall()]
        return ok_response(rows)
    finally:
        conn.close()


# =============================================================================
# PHIẾU NHẬP HÀNG
# =============================================================================

@router.get("/purchase-requests")
async def get_purchase_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sql = """
                SELECT pr.request_id, i.ingredient_name, i.unit, i.supplier,
                       pr.requested_quantity,
                       ROUND((pr.requested_quantity * i.unit_cost)::numeric, 0) AS estimated_cost,
                       pr.trigger_stock, i.current_stock, pr.status, pr.notes,
                       req.full_name AS requested_by_name,
                       apr.full_name AS approved_by_name,
                       pr.created_at, pr.updated_at
                FROM purchase_requests pr
                JOIN ingredients i      ON pr.ingredient_id = i.ingredient_id
                LEFT JOIN employees req ON pr.requested_by  = req.employee_id
                LEFT JOIN employees apr ON pr.approved_by   = apr.employee_id
            """
            if status:
                cur.execute(sql + " WHERE pr.status = %s ORDER BY pr.created_at DESC", (status,))
            else:
                cur.execute(sql + " ORDER BY pr.created_at DESC")
            rows = [serialize_row(r) for r in cur.fetchall()]
        return ok_response(rows)
    finally:
        conn.close()


@router.post("/purchase-requests", status_code=201)
async def create_purchase_request(
    body: PurchaseCreateBody,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM ingredients WHERE ingredient_id = %s", (body.ingredient_id,))
            ing = cur.fetchone()
            if not ing:
                raise HTTPException(status_code=404, detail="Không tìm thấy nguyên liệu")
            cur.execute("""
                INSERT INTO purchase_requests
                    (ingredient_id, requested_quantity, trigger_stock, status, requested_by, notes)
                VALUES (%s, %s, %s, 'PENDING', %s, %s) RETURNING *
            """, (body.ingredient_id, body.requested_quantity, float(ing["current_stock"]),
                  current_user.get("employee_id"), body.notes))
            row = serialize_row(cur.fetchone())
        conn.commit()
        return ok_response(row, "Đã tạo phiếu nhập hàng", 201)
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.patch("/purchase-requests/{request_id}")
async def update_purchase_request(
    request_id: int,
    body: PurchaseUpdateBody,
    current_user: dict = Depends(get_current_user),
):
    valid_transitions = {
        "PENDING":  ["APPROVED", "CANCELLED"],
        "APPROVED": ["ORDERED",  "CANCELLED"],
        "ORDERED":  ["RECEIVED", "CANCELLED"],
    }
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT pr.*, i.ingredient_name, i.unit, i.current_stock
                FROM purchase_requests pr
                JOIN ingredients i ON pr.ingredient_id = i.ingredient_id
                WHERE pr.request_id = %s FOR UPDATE
            """, (request_id,))
            pr = cur.fetchone()
            if not pr:
                raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập hàng")

            allowed = valid_transitions.get(pr["status"], [])
            if body.status not in allowed:
                raise HTTPException(status_code=400,
                    detail=f"Không thể chuyển từ '{pr['status']}' sang '{body.status}'. Hợp lệ: {allowed}")

            approved_by = current_user.get("employee_id") if body.status == "APPROVED" else None
            cur.execute("""
                UPDATE purchase_requests
                SET status = %s, notes = COALESCE(%s, notes),
                    approved_by = COALESCE(%s, approved_by),
                    updated_at = CURRENT_TIMESTAMP
                WHERE request_id = %s
            """, (body.status, body.notes, approved_by, request_id))

            if body.status == "RECEIVED":
                qty_received = float(body.actual_received_quantity or pr["requested_quantity"])
                stock_before = float(pr["current_stock"])
                stock_after  = stock_before + qty_received

                cur.execute("UPDATE ingredients SET current_stock = %s, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = %s",
                            (stock_after, pr["ingredient_id"]))
                cur.execute("""
                    INSERT INTO inventory_transactions
                        (ingredient_id, transaction_type, quantity_change,
                         stock_before, stock_after, employee_id, notes)
                    VALUES (%s, 'RESTOCK', %s, %s, %s, %s, %s)
                """, (pr["ingredient_id"], qty_received, stock_before, stock_after,
                      current_user.get("employee_id"),
                      f"Nhập kho từ phiếu #{request_id}: {pr['ingredient_name']}"))

                if stock_before <= 0 < stock_after:
                    cur.execute("""
                        UPDATE menu_items SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
                        WHERE item_id IN (SELECT item_id FROM recipe_items WHERE ingredient_id = %s)
                        AND status = 'OUT_OF_STOCK'
                    """, (pr["ingredient_id"],))

        conn.commit()
        return ok_response(
            {"request_id": request_id, "new_status": body.status},
            f"Phiếu #{request_id} → '{body.status}'")
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật phiếu: {str(e)}")
    finally:
        conn.close()