// ========================================
// FILE: lib/api.ts - PHIÊN BẢN HOÀN CHỈNH
// ========================================

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

// ========================================
// API CONFIGURATION
// ========================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

console.log('🌐 API URL:', API_URL);

// ========================================
// CREATE AXIOS INSTANCE
// ========================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // For ngrok tunnels
  },
});

// ========================================
// REQUEST INTERCEPTOR - Add token to all requests
// ========================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    if (token) {
      // Add Authorization header
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🎟️ Added token to request:', config.url);
    } else {
      console.warn('⚠️ No token found for request:', config.url);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ========================================
// RESPONSE INTERCEPTOR - Handle errors globally
// ========================================

apiClient.interceptors.response.use(
  (response) => {
    // Success response - just return it
    console.log('✅ Response received:', response.config.url, response.status);
    return response;
  },
  (error: AxiosError) => {
    // Error response handling
    const status = error.response?.status;
    const url = error.config?.url;
    
    console.error('❌ API Error:', {
      url,
      status,
      message: error.message,
      data: error.response?.data,
    });
    
    // Handle specific error codes
    if (status === 401) {
      // Unauthorized - Token invalid or expired
      console.error('🔒 401 Unauthorized - Token invalid or expired');
      
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Don't redirect if we're already on login page or this is a login request
      const isLoginPage = window.location.pathname.includes('/login');
      const isLoginRequest = url?.includes('/auth/login');
      
      if (!isLoginPage && !isLoginRequest) {
        console.log('🔄 Redirecting to login page...');
        
        // Get current locale
        const locale = window.location.pathname.startsWith('/vi') ? 'vi' : 'en';
        
        // Redirect to login
        window.location.href = `/${locale}/login`;
      }
    } else if (status === 403) {
      // Forbidden - No permission
      console.error('🚫 403 Forbidden - No permission');
    } else if (status === 404) {
      // Not Found
      console.error('🔍 404 Not Found:', url);
    } else if (status === 500) {
      // Server Error
      console.error('💥 500 Internal Server Error');
    }
    
    return Promise.reject(error);
  }
);

// ========================================
// AUTH API
// ========================================

export const authAPI = {
  /**
   * Login user
   */
  login: (username: string, password: string) => {
    console.log('🔐 Attempting login for:', username);
    return apiClient.post('/api/auth/login', { username, password });
  },
  
  /**
   * Get current user info
   */
  getMe: () => {
    console.log('👤 Fetching current user info');
    return apiClient.get('/api/auth/me');
  },
  
  /**
   * Logout user (client-side only, just clears localStorage)
   */
  logout: () => {
    console.log('👋 Logging out');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    return Promise.resolve({ data: { success: true } });
  },
};

// ========================================
// EMPLOYEES API
// ========================================

export const employeesAPI = {
  /**
   * Get all employees
   */
  getAll: () => {
    console.log('👥 Fetching employees');
    return apiClient.get('/api/employees');
  },
  
  /**
   * Get employee by ID
   */
  getById: (id: number) => {
    console.log('👤 Fetching employee:', id);
    return apiClient.get(`/api/employees/${id}`);
  },
  
  /**
   * Create new employee
   */
  create: (data: any) => {
    console.log('➕ Creating employee');
    return apiClient.post('/api/employees', data);
  },
  
  /**
   * Update employee
   */
  update: (id: number, data: any) => {
    console.log('✏️ Updating employee:', id);
    return apiClient.put(`/api/employees/${id}`, data);
  },
  
  /**
   * Delete employee
   */
  delete: (id: number) => {
    console.log('🗑️ Deleting employee:', id);
    return apiClient.delete(`/api/employees/${id}`);
  },
};

// ========================================
// TABLES API
// ========================================

export const tablesAPI = {
  /**
   * Get all tables
   */
  getAll: () => {
    console.log('🪑 Fetching tables');
    return apiClient.get('/api/tables');
  },
  
  /**
   * Get table by ID
   */
  getById: (id: number) => {
    console.log('🪑 Fetching table:', id);
    return apiClient.get(`/api/tables/${id}`);
  },
  
  /**
   * Create new table
   */
  create: (data: any) => {
    console.log('➕ Creating table');
    return apiClient.post('/api/tables', data);
  },
  
  /**
   * Update table
   */
  update: (id: number, data: any) => {
    console.log('✏️ Updating table:', id);
    return apiClient.put(`/api/tables/${id}`, data);
  },
  
  /**
   * Delete table
   */
  delete: (id: number) => {
    console.log('🗑️ Deleting table:', id);
    return apiClient.delete(`/api/tables/${id}`);
  },
};

// ========================================
// HEALTH CHECK
// ========================================

export const healthAPI = {
  /**
   * Check if API is online
   */
  check: () => {
    console.log('🏥 Checking API health');
    return apiClient.get('/health');
  },
};

// ========================================
// EXPORT DEFAULT CLIENT
// ========================================

export default apiClient;

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  return !!(token && user);
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): any | null {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (error) {
    console.error('Error parsing user data:', error);
  }
  return null;
}

/**
 * Get current token from localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem('token');
}