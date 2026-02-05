# backend/config/database.py
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "DB"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "123456"),
    "port": os.getenv("DB_PORT", "5432")
}

def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(**DATABASE_CONFIG, cursor_factory=RealDictCursor)

        #  DEBUG: kiểm tra backend đang kết nối DB nào
        cur = conn.cursor()
        cur.execute("SELECT current_database();")
        print(" Backend connected to DB:", cur.fetchone())
        cur.close()
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise
def get_db():
    """Generator function for database connection (FastAPI dependency)"""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
# Test connection on import
try:
    test_conn = get_db_connection()
    cursor = test_conn.cursor()
    cursor.execute("SELECT NOW()")
    result = cursor.fetchone()
    print(f"Database connected successfully at: {result['now']}")
    cursor.close()
    test_conn.close()
except Exception as e:
    print(f"Database connection failed: {e}")