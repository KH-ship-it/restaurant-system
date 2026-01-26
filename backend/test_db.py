from config.database import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()

try:
    cursor.execute("SELECT user_id, username, role, is_active FROM users WHERE user_id = 1")
    user = cursor.fetchone()
    print("✅ Query success!")
    print("User data:", dict(user))
except Exception as e:
    print("❌ Query failed!")
    print("Error:", e)
    import traceback
    traceback.print_exc()
finally:
    cursor.close()
    conn.close()
