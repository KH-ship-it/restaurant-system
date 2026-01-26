-- ==================== Database Schema ====================
-- Database: qlnhahang

-- Drop tables if exist (for fresh setup)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==================== Users Table ====================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster username lookup
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ==================== Employees Table ====================
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    position VARCHAR(100),
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for employee lookups
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_position ON employees(position);

-- ==================== Tables (Restaurant Tables) ====================
CREATE TABLE tables (
    table_id SERIAL PRIMARY KEY,
    table_number INTEGER UNIQUE NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for table status
CREATE INDEX idx_tables_status ON tables(status);

-- ==================== Categories Table ====================
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== Menu Items Table ====================
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

-- Create indexes for menu items
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_status ON menu_items(status);

-- ==================== Orders Table ====================
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

-- Create indexes for orders
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ==================== Order Items Table ====================
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES menu_items(item_id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for order items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ==================== Payments Table ====================
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    processed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create index for payments
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- ==================== Insert Sample Data ====================

-- Insert default admin user (password: admin123)
-- Hash generated using bcrypt for "admin123"
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyKmUhh.rQfK', 'OWNER', TRUE);

-- Get the admin user_id (will be 1 if it's the first user)
INSERT INTO employees (user_id, full_name, phone, position, hire_date)
VALUES (1, 'Administrator', '0900000000', 'Quản lý', CURRENT_DATE);

-- Insert sample categories
INSERT INTO categories (category_name, description) VALUES
('Món chính', 'Các món ăn chính như cơm, phở, bún'),
('Món phụ', 'Các món ăn kèm, món phụ'),
('Đồ uống', 'Nước uống, sinh tố, trà'),
('Tráng miệng', 'Món tráng miệng, món ngọt');

-- Insert sample tables
INSERT INTO tables (table_number, capacity, status) VALUES
(1, 4, 'AVAILABLE'),
(2, 4, 'AVAILABLE'),
(3, 6, 'AVAILABLE'),
(4, 2, 'AVAILABLE'),
(5, 8, 'AVAILABLE');

-- Insert sample menu items
INSERT INTO menu_items (category_id, item_name, description, price, status) VALUES
(1, 'Cơm sườn', 'Cơm sườn nướng với rau xào', 45000, 'AVAILABLE'),
(1, 'Phở bò', 'Phở bò Hà Nội truyền thống', 50000, 'AVAILABLE'),
(1, 'Bún chả', 'Bún chả Hà Nội đặc sản', 55000, 'AVAILABLE'),
(2, 'Gỏi cuốn', 'Gỏi cuốn tôm thịt (2 cuốn)', 30000, 'AVAILABLE'),
(2, 'Nem rán', 'Nem rán Hà Nội (5 chiếc)', 35000, 'AVAILABLE'),
(3, 'Trà đá', 'Trà đá miễn phí', 0, 'AVAILABLE'),
(3, 'Nước ngọt', 'Coca, Pepsi, Sprite', 15000, 'AVAILABLE'),
(3, 'Sinh tố bơ', 'Sinh tố bơ sữa', 25000, 'AVAILABLE'),
(4, 'Chè khúc bạch', 'Chè khúc bạch truyền thống', 20000, 'AVAILABLE');

-- ==================== Useful Queries ====================

-- Check all users and their roles
-- SELECT u.user_id, u.username, u.role, e.full_name, e.position 
-- FROM users u 
-- LEFT JOIN employees e ON u.user_id = e.user_id;

-- Check employee with position and role mapping
-- SELECT e.employee_id, e.full_name, e.position, u.role 
-- FROM employees e 
-- JOIN users u ON e.user_id = u.user_id;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== Grant Permissions (if needed) ====================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;