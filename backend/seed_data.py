# backend/seed_data.py
import psycopg2
import bcrypt
from dotenv import load_dotenv
import os

load_dotenv()

# Database connection
conn = psycopg2.connect(
    host=os.getenv("DB_HOST", "localhost"),
    database=os.getenv("DB_NAME", "qlnhahang"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD", "123456"),
    port=os.getenv("DB_PORT", "5432")
)

cursor = conn.cursor()

print("🌱 Starting database seeding...")

# 1. Insert roles
print(" Inserting roles...")
cursor.execute("""
    INSERT INTO roles (role_name) 
    VALUES ('OWNER'), ('EMPLOYEE') 
    ON CONFLICT (role_name) DO NOTHING
""")

# 2. Hash passwords
print(" Hashing passwords...")
admin_password = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
manager_password = bcrypt.hashpw('manager123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
staff_password = bcrypt.hashpw('staff123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# 3. Insert users
print(" Inserting users...")
try:
    cursor.execute("""
        INSERT INTO users (username, password, role_id) 
        VALUES 
            ('admin', %s, (SELECT role_id FROM roles WHERE role_name = 'OWNER')),
            ('manager', %s, (SELECT role_id FROM roles WHERE role_name = 'EMPLOYEE')),
            ('staff', %s, (SELECT role_id FROM roles WHERE role_name = 'EMPLOYEE'))
        ON CONFLICT (username) DO NOTHING
    """, (admin_password, manager_password, staff_password))
except Exception as e:
    print(f"Users might already exist: {e}")

# 4. Insert employees
print(" Inserting employees...")
cursor.execute("""
    INSERT INTO employees (user_id, full_name, phone, position, hire_date)
    SELECT user_id, 'Quản trị viên', '0901234567', 'Quản lý', CURRENT_DATE
    FROM users WHERE username = 'admin'
    ON CONFLICT (user_id) DO NOTHING
""")

cursor.execute("""
    INSERT INTO employees (user_id, full_name, phone, position, hire_date)
    SELECT user_id, 'Nguyễn Văn Manager', '0912345678', 'Quản lý ca', CURRENT_DATE
    FROM users WHERE username = 'manager'
    ON CONFLICT (user_id) DO NOTHING
""")

cursor.execute("""
    INSERT INTO employees (user_id, full_name, phone, position, hire_date)
    SELECT user_id, 'Trần Thị Staff', '0923456789', 'Phục vụ', CURRENT_DATE
    FROM users WHERE username = 'staff'
    ON CONFLICT (user_id) DO NOTHING
""")

# 5. Insert categories
print(" Inserting categories...")
categories = [
    ('Cà phê', 'Các loại cà phê'),
    ('Món chính', 'Món ăn chính'),
    ('Đồ uống', 'Nước giải khát'),
    ('Trái cây', 'Nước ép trái cây'),
    ('Tráng miệng', 'Các món tráng miệng')
]

for cat_name, cat_desc in categories:
    cursor.execute("""
        INSERT INTO categories (category_name, description) 
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING
    """, (cat_name, cat_desc))

# 6. Insert menu items
print("🍽️ Inserting menu items...")
menu_items = [
    (1, 'Espresso', 'Cà phê đậm đặc, đậm vị Ý', 45000, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', 'AVAILABLE'),
    (1, 'Cappuccino', 'Lớp bọt mịn màng trên nền cà phê đậm đà', 55000, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', 'AVAILABLE'),
    (1, 'Latte', 'Cà phê sữa Ý truyền thống', 50000, 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400', 'AVAILABLE'),
    (2, 'Beef Steak', 'Bò bít tết Mỹ cao cấp, kèm khoai tây và salad', 180000, 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=400', 'AVAILABLE'),
    (2, 'Spaghetti', 'Mì Ý truyền thống với sốt cà chua tươi và thịt bò xay', 50000, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400', 'AVAILABLE'),
    (2, 'Bánh mì Việt Nam', 'Bánh mì giòn tan với nhân thịt đặc biệt', 100000, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', 'AVAILABLE'),
    (3, 'Orange Fresh', 'Cam ép 100% nguyên chất, tươi mát', 45000, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400', 'AVAILABLE'),
    (3, 'Lemon Mint Cooler', 'Nước chanh tươi, lá bạc hà và nước mật ong', 45000, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', 'AVAILABLE'),
    (4, 'Watermelon Zest', 'Dưa hấu ép lạnh', 45000, 'https://images.unsplash.com/photo-1587049352846-4a222e784720?w=400', 'AVAILABLE'),
    (4, 'Avocado Cream', 'Bơ tươi xay cùng sữa đặc và đá mịn', 50000, 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=400', 'AVAILABLE'),
    (5, 'Chocolate Cake', 'Bánh socola béo ngậy', 60000, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400', 'AVAILABLE'),
    (5, 'Tiramisu', 'Bánh Tiramisu Ý truyền thống', 75000, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400', 'AVAILABLE')
]

for item in menu_items:
    try:
        cursor.execute("""
            INSERT INTO menu_items (category_id, item_name, description, price, image_url, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, item)
    except Exception as e:
        print(f"Item might already exist: {e}")

# 7. Insert tables
print("🪑 Inserting tables...")
for i in range(1, 21):
    cursor.execute("""
        INSERT INTO tables (table_number, status) 
        VALUES (%s, 'EMPTY') 
        ON CONFLICT DO NOTHING
    """, (i,))

# Commit all changes
conn.commit()
cursor.close()
conn.close()

print("✅ Database seeding completed successfully!")
print("\n Demo accounts:")
print("=" * 50)
print(" Admin/Owner:")
print("   Username: admin")
print("   Password: admin123")
print("\n Manager:")
print("   Username: manager")
print("   Password: manager123")
print("\n Staff:")
print("   Username: staff")
print("   Password: staff123")
print("=" * 50)