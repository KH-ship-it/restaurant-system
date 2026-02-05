-- ==========================================
-- COMPLETE DATABASE SCHEMA - FRESH INSTALL
-- ==========================================
-- Database: qlnhahang
-- This script creates all tables from scratch with all required columns

-- Drop tables if exist (for fresh setup)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==========================================
-- 1. USERS TABLE
-- ==========================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ==========================================
-- 2. EMPLOYEES TABLE (✅ WITH updated_at)
-- ==========================================
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    position VARCHAR(100),
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- ✅ ADDED
);

CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_position ON employees(position);

-- ==========================================
-- 3. TABLES (Restaurant Tables)
-- ==========================================
CREATE TABLE tables (
    table_id SERIAL PRIMARY KEY,
    table_number INTEGER UNIQUE NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tables_status ON tables(status);
CREATE INDEX idx_tables_number ON tables(table_number);

-- ==========================================
-- 4. CATEGORIES TABLE
-- ==========================================
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. MENU ITEMS TABLE
-- ==========================================
CREATE TABLE menu_items (
    item_id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_status ON menu_items(status);

-- ==========================================
-- 6. ORDERS TABLE
-- ==========================================
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    table_id INTEGER REFERENCES tables(table_id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDING',
    total_amount NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ==========================================
-- 7. ORDER ITEMS TABLE
-- ==========================================
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES menu_items(item_id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ==========================================
-- 8. PAYMENTS TABLE
-- ==========================================
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    processed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- ==========================================
-- 9. TRIGGERS FOR updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at 
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at 
BEFORE UPDATE ON tables
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at 
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 10. INSERT SAMPLE DATA
-- ==========================================

-- Default admin user (password: admin123)
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyKmUhh.rQfK', 'OWNER', TRUE);

INSERT INTO employees (user_id, full_name, phone, position, hire_date)
VALUES (1, 'Administrator', '0900000000', 'Quản lý', CURRENT_DATE);

-- Sample employees (all use password: admin123)
INSERT INTO users (username, password_hash, role, is_active) VALUES
('nhanvien01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyKmUhh.rQfK', 'EMPLOYEE', TRUE),
('nhanvien02', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyKmUhh.rQfK', 'EMPLOYEE', TRUE),
('beptruong', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyKmUhh.rQfK', 'KITCHEN', TRUE),
('thungan01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyKmUhh.rQfK', 'CASHIER', TRUE);

INSERT INTO employees (user_id, full_name, phone, position, hire_date) VALUES
(2, 'Nguyễn Văn A', '0901234567', 'Phục vụ', '2024-01-15'),
(3, 'Trần Thị B', '0902345678', 'Phục vụ', '2024-01-20'),
(4, 'Lê Văn C', '0903456789', 'Đầu bếp', '2024-01-10'),
(5, 'Phạm Thị D', '0904567890', 'Thu ngân', '2024-02-01');

-- Categories
INSERT INTO categories (category_name, description) VALUES
('Cà phê', 'Các loại cà phê và café'),
('Món chính', 'Các món ăn chính như cơm, phở, bún'),
('Món phụ', 'Các món ăn kèm, món phụ'),
('Đồ uống', 'Nước uống, sinh tố, trà'),
('Tráng miệng', 'Món tráng miệng, món ngọt'),
('Món Âu', 'Món ăn phương Tây'),
('Salad', 'Salad rau củ tươi');

-- Menu Items
INSERT INTO menu_items (category_id, item_name, description, price, image_url, status) VALUES
-- Cà phê
(1, 'Cà phê đen', 'Cà phê phin truyền thống', 25000, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300', 'AVAILABLE'),
(1, 'Cà phê sữa', 'Cà phê sữa đá ngọt ngào', 30000, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300', 'AVAILABLE'),
(1, 'Bạc xỉu', 'Cà phê sữa nhẹ', 30000, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300', 'AVAILABLE'),
(1, 'Cappuccino', 'Cà phê Ý với bọt sữa', 45000, 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=300', 'AVAILABLE'),

-- Món chính
(2, 'Cơm sườn', 'Cơm sườn nướng với rau xào', 45000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300', 'AVAILABLE'),
(2, 'Phở bò', 'Phở bò Hà Nội truyền thống', 50000, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300', 'AVAILABLE'),
(2, 'Bún chả', 'Bún chả Hà Nội đặc sản', 55000, 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=300', 'AVAILABLE'),
(2, 'Cơm gà', 'Cơm gà xối mỡ', 45000, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300', 'AVAILABLE'),

-- Món phụ
(3, 'Gỏi cuốn', 'Gỏi cuốn tôm thịt (2 cuốn)', 30000, 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=300', 'AVAILABLE'),
(3, 'Nem rán', 'Nem rán Hà Nội (5 chiếc)', 35000, 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=300', 'AVAILABLE'),

-- Đồ uống
(4, 'Trà đá', 'Trà đá miễn phí', 0, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300', 'AVAILABLE'),
(4, 'Nước ngọt', 'Coca, Pepsi, Sprite', 15000, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300', 'AVAILABLE'),
(4, 'Sinh tố bơ', 'Sinh tố bơ sữa', 25000, 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=300', 'AVAILABLE'),
(4, 'Nước chanh', 'Nước chanh tươi', 20000, 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f02?w=300', 'AVAILABLE'),

-- Tráng miệng
(5, 'Chè khúc bạch', 'Chè khúc bạch truyền thống', 20000, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300', 'AVAILABLE'),
(5, 'Bánh flan', 'Bánh flan caramel', 20000, 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=300', 'AVAILABLE'),

-- Món Âu
(6, 'Beefsteak', 'Bít tết bò Úc 200g', 150000, 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=300', 'AVAILABLE'),
(6, 'Spaghetti Carbonara', 'Mì Ý sốt kem', 95000, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300', 'AVAILABLE'),

-- Salad
(7, 'Caesar Salad', 'Salad Caesar với gà', 75000, 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300', 'AVAILABLE');

-- Tables
INSERT INTO tables (table_number, capacity, status) VALUES
(1, 4, 'AVAILABLE'),
(2, 4, 'AVAILABLE'),
(3, 6, 'AVAILABLE'),
(4, 2, 'AVAILABLE'),
(5, 8, 'AVAILABLE'),
(6, 4, 'AVAILABLE'),
(7, 6, 'AVAILABLE'),
(8, 2, 'AVAILABLE'),
(9, 8, 'AVAILABLE'),
(10, 4, 'AVAILABLE');

-- ==========================================
-- 11. VERIFICATION
-- ==========================================

SELECT 
    '✅ Database setup complete!' AS status,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM employees) AS employees,
    (SELECT COUNT(*) FROM menu_items) AS menu_items,
    (SELECT COUNT(*) FROM tables) AS tables;

-- ==========================================
-- LOGIN CREDENTIALS
-- ==========================================
--  Admin: admin / admin123
--  Employee: nhanvien01 / admin123
--  Employee: nhanvien02 / admin123
--  Kitchen: beptruong / admin123
--  Cashier: thungan01 / admin123
-- ==========================================