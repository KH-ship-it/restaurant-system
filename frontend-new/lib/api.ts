import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials:true,
  headers: {
    'Content-Type': 'application/json',
    
  },
  
});
  
      
// Add token to requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/vi/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== Auth API ====================
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  
  me: () => api.get('/api/auth/me'),
  
  logout: () => api.post('/api/auth/logout'),
};

// ==================== Menu API ====================
export const menuAPI = {
  getAll: (params?: { category?: string; status?: string; search?: string }) =>
    api.get('/api/menu', { params }),
  
  getById: (id: number) => api.get(`/api/menu/${id}`),
  
  create: (data: any) => api.post('/api/menu', data),
  
  update: (id: number, data: any) => api.put(`/api/menu/${id}`, data),
  
  delete: (id: number) => api.delete(`/api/menu/${id}`),
  
  getCategories: () => api.get('/api/menu/categories/list'),
};

// ==================== Order API ====================
export const orderAPI = {
  getAll: (params?: { status?: string; table_id?: number; date_from?: string; date_to?: string }) =>
    api.get('/api/orders', { params }),
  
  getById: (id: number) => api.get(`/api/orders/${id}`),
  
  create: (data: {
    table_id: number;
    items: Array<{ item_id: number; quantity: number; price: number }>;
    customer_id?: number;
  }) => api.post('/api/orders', data),
  
  updateStatus: (id: number, status: string) =>
    api.put(`/api/orders/${id}/status`, { status }),
  
  cancel: (id: number) => api.put(`/api/orders/${id}/cancel`),
};

// ==================== Table API ====================
export const tableAPI = {
  getAll: (params?: { status?: string }) => api.get('/api/tables', { params }),
  
  create: (data: { table_number: number; status?: string }) =>
    api.post('/api/tables', data),
  
  updateStatus: (id: number, status: string) =>
    api.put(`/api/tables/${id}/status`, { status }),
  
  delete: (id: number) => api.delete(`/api/tables/${id}`),
};

// ==================== Employee API ====================
export const employeeAPI = {
  getAll: () => api.get('/api/employees'),
  
  getById: (id: number) => api.get(`/api/employees/${id}`),
  
  create: (data: any) => api.post('/api/employees', data),
  
  update: (id: number, data: any) => api.put(`/api/employees/${id}`, data),
  
  delete: (id: number) => api.delete(`/api/employees/${id}`),
};

// ==================== Kitchen API ====================
export const kitchenAPI = {
  getOrders: (status?: string) => api.get('/api/kitchen', { params: { status } }),
  
  updateStatus: (id: number, status: string) =>
    api.put(`/api/kitchen/${id}/status`, { status }),
  
  startPreparing: (id: number) => api.post(`/api/kitchen/${id}/start`),
  
  complete: (id: number) => api.post(`/api/kitchen/${id}/complete`),
};

// ==================== Dashboard API ====================
export const dashboardAPI = {
  getStats: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/api/dashboard/stats', { params }),
  
  getRevenue: (params?: { period?: string; limit?: number }) =>
    api.get('/api/dashboard/revenue', { params }),
  
  getToday: () => api.get('/api/dashboard/today'),
};

// ==================== Cashier API ====================
export const cashierAPI = {
  getPending: () => api.get('/api/cashier/pending'),
  
  processPayment: (order_id: number) =>
    api.post('/api/cashier/payment', { order_id }),
  
  getTodayTransactions: () => api.get('/api/cashier/transactions/today'),
  
  getShiftReport: (params?: { shift_start?: string; shift_end?: string }) =>
    api.get('/api/cashier/shift/report', { params }),
};

// ==================== Helper Functions ====================

/**
 * Login helper function
 */
export async function login(username: string, password: string) {
  try {
    const response = await authAPI.login(username, password);
    const data = response.data;
    
    // Lưu token và user vào localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Đăng nhập thất bại');
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('token');
  return !!token;
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Get default route based on user role
 */
export function getDefaultRoute(role?: string): string {
  if (!role) {
    const user = getCurrentUser();
    role = user?.role;
  }

  const routes: Record<string, string> = {
    'OWNER': '/vi/thongke',
    'admin': '/vi/admin/dashboard',
    'KITCHEN': '/vi/kitchen',
    'staff': '/vi/staff',
    'EMPLOYEE': '/vi/order',
  };

  return routes[role || ''] || '/vi/dashboard';
}

/**
 * Logout user
 */
export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/vi/login';
  }
}
import publicApi from './publicApi';

// ==================== Public Menu API ====================
export const publicMenuAPI = {
  getAll: () => publicApi.get('/api/menu/public'),
};

// ==================== Public Order API ====================
export const publicOrderAPI = {
  create: (data: {
    table_id: number;
    items: Array<{ item_id: number; quantity: number }>;
  }) => publicApi.post('/api/orders/public', data),
};
