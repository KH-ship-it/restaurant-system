// FILE: lib/api.ts

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

// ✅ Client-side → dùng proxy Next.js (tránh CORS + ngrok warning)
// ✅ Server-side → gọi thẳng backend
const API_URL = typeof window !== 'undefined'
  ? '/api/proxy'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

console.log('API URL:', API_URL);

// ========================================
// CREATE AXIOS INSTANCE
// ========================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // Không cần ngrok header ở đây vì proxy server-side tự thêm
  },
});

// ========================================
// REQUEST INTERCEPTOR
// ========================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const isLoginRequest = config.url?.includes('/auth/login');
    if (isLoginRequest) {
      return config;
    }

    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No token found for request:', config.url);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ========================================
// RESPONSE INTERCEPTOR
// ========================================

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;

    console.error('API Error:', { url, status, data: error.response?.data });

    if (status === 401) {
      const isLoginRequest = url?.includes('/auth/login');
      if (isLoginRequest) return Promise.reject(error);

      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');

      const isLoginPage = window.location.pathname.includes('/login');
      if (!isLoginPage) {
        const locale = window.location.pathname.startsWith('/vi') ? 'vi' : 'en';
        window.location.href = `/${locale}/login`;
      }
    }

    return Promise.reject(error);
  }
);

// ========================================
// AUTH API
// ✅ Bỏ prefix /api/ — baseURL đã là /api/proxy
//    /api/proxy + /auth/login → proxy forward → backend /api/auth/login ✅
// ========================================

export const authAPI = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),

  getMe: () => apiClient.get('/auth/me'),

  logout: () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('rememberMe');
    return Promise.resolve({ data: { success: true } });
  },
};

// ========================================
// EMPLOYEES API
// ========================================

export const employeesAPI = {
  getAll: ()                        => apiClient.get('/employees'),
  getById: (id: number)             => apiClient.get(`/employees/${id}`),
  create: (data: any)               => apiClient.post('/employees', data),
  update: (id: number, data: any)   => apiClient.put(`/employees/${id}`, data),
  delete: (id: number)              => apiClient.delete(`/employees/${id}`),
};

// ========================================
// TABLES API
// ========================================

export const tablesAPI = {
  getAll: ()                        => apiClient.get('/tables'),
  getById: (id: number)             => apiClient.get(`/tables/${id}`),
  create: (data: any)               => apiClient.post('/tables', data),
  update: (id: number, data: any)   => apiClient.put(`/tables/${id}`, data),
  delete: (id: number)              => apiClient.delete(`/tables/${id}`),
};

// ========================================
// INVENTORY API
// ========================================

export const inventoryAPI = {
  // Dashboard & alerts
  // Dashboard APIs (đúng theo Swagger)
getDashboardStats: () => apiClient.get('/dashboard/stats'),
getTodaySummary: () => apiClient.get('/dashboard/today'),
getRevenue: () => apiClient.get('/dashboard/revenue'),
getCategoryStats: () => apiClient.get('/dashboard/categories/stats'),
getHourlyPerformance: () => apiClient.get('/dashboard/performance/hourly'),
getOrdersChart: () => apiClient.get('/dashboard/orders/chart'),

  // Nguyên liệu
  getIngredients: (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  })                                => apiClient.get('/inventory/ingredients', { params }),
  getIngredientDetail: (id: number) => apiClient.get(`/inventory/ingredients/${id}`),
  createIngredient: (data: any)     => apiClient.post('/inventory/ingredients', data),
  updateIngredient: (id: number, data: any) => apiClient.put(`/inventory/ingredients/${id}`, data),
  deleteIngredient: (id: number)    => apiClient.delete(`/inventory/ingredients/${id}`),
  restock: (id: number, quantity: number, notes?: string) =>
    apiClient.patch(`/inventory/ingredients/${id}/restock`, { quantity, notes }),
  adjust: (id: number, actualStock: number, notes?: string) =>
    apiClient.patch(`/inventory/ingredients/${id}/adjust`, { actual_stock: actualStock, notes }),

  // Công thức
  getRecipe: (itemId: number)       => apiClient.get(`/inventory/recipes/${itemId}`),
  upsertRecipe: (itemId: number, ingredients: any[]) =>
    apiClient.post(`/inventory/recipes/${itemId}`, { ingredients }),
  deleteRecipeItem: (itemId: number, ingredientId: number) =>
    apiClient.delete(`/inventory/recipes/${itemId}/${ingredientId}`),

  // Trừ kho
  deductPreview: (data: any)        => apiClient.post('/inventory/deduct/preview', data),
  deductConfirm: (data: any)        => apiClient.post('/inventory/deduct/confirm', data),

  // Giao dịch
  getTransactions: (params?: {
    ingredient_id?: number;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  })                                => apiClient.get('/inventory/transactions', { params }),
  getTodayTransactions: ()          => apiClient.get('/inventory/transactions/today'),
  getTodayConsumption: ()           => apiClient.get('/inventory/consumption/today'),
  getDailyCost: (params?: { from?: string; to?: string }) =>
    apiClient.get('/inventory/cost/daily', { params }),

  // Phiếu nhập hàng
  getPurchaseRequests: (status?: string) =>
    apiClient.get('/inventory/purchase-requests', { params: status ? { status } : undefined }),
  createPurchaseRequest: (data: any) => apiClient.post('/inventory/purchase-requests', data),
  updatePurchaseRequest: (id: number, data: any) =>
    apiClient.patch(`/inventory/purchase-requests/${id}`, data),
};

// ========================================
// HEALTH CHECK
// ========================================

export const healthAPI = {
  // /health không đi qua /api/ trên backend nên cần gọi thẳng
  check: () => fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`,
    { headers: { 'ngrok-skip-browser-warning': 'true' } }
  ),
};

// ========================================
// EXPORT DEFAULT
// ========================================

export default apiClient;

// ========================================
// AUTH HELPERS
// ========================================

export function isAuthenticated(): boolean {
  const token = sessionStorage.getItem('access_token');
  const user = sessionStorage.getItem('user');
  return !!(token && user);
}

export function getCurrentUser(): any | null {
  try {
    const userStr = sessionStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
  } catch (e) {
    console.error('Error parsing user:', e);
  }
  return null;
}

export function getToken(): string | null {
  return sessionStorage.getItem('access_token');
}