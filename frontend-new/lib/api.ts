
// FILE: lib/api.ts 

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
// API CONFIGURATION

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

console.log('API URL:', API_URL);

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

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    //  CRITICAL: Do NOT add token for login endpoint
    const isLoginRequest = config.url?.includes('/auth/login');
    if (isLoginRequest) {
      console.log(' Login request - NO TOKEN will be added');
      return config;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    
    if (token) {
      // Add Authorization header
      config.headers.Authorization = `Bearer ${token}`;
      console.log(' Added token to request:', config.url);
    } else {
      console.warn(' No token found for request:', config.url);
    }
    
    return config;
  },
  (error) => {
    console.error(' Request interceptor error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // Success response - just return it
    console.log(' Response received:', response.config.url, response.status);
    return response;
  },
  (error: AxiosError) => {
    // Error response handling
    const status = error.response?.status;
    const url = error.config?.url;
    
    console.error(' API Error:', {
      url,
      status,
      message: error.message,
      data: error.response?.data,
    });
    if (status === 401) {
      // Unauthorized - Token invalid or expired
      console.error(' 401 Unauthorized');
      
      // CRITICAL: Do NOT redirect if this is a login request
      const isLoginRequest = url?.includes('/auth/login');
      
      if (isLoginRequest) {
        console.log(' Login failed - wrong credentials');
        // Let the login page handle the error
        return Promise.reject(error);
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      const isLoginPage = window.location.pathname.includes('/login');
      
      if (!isLoginPage) {
        console.log('🔄 Redirecting to login page...');
        const locale = window.location.pathname.startsWith('/vi') ? 'vi' : 'en';
        window.location.href = `/${locale}/login`;
      }
    } else if (status === 403) {
      // Forbidden - No permission
      console.error(' 403 Forbidden - No permission');
    } else if (status === 404) {
      // Not Found
      console.error(' 404 Not Found:', url);
    } else if (status === 500) {
      // Server Error
      console.error(' 500 Internal Server Error');
    }
    
    return Promise.reject(error);
  }
);
export const authAPI = {
  
  login: (username: string, password: string) => {
    console.log('Attempting login for:', username);
    console.log(' API URL:', `${API_URL}/api/auth/login`);
    return apiClient.post('/api/auth/login', { username, password });
  },
  getMe: () => {
    console.log('👤 Fetching current user info');
    return apiClient.get('/api/auth/me');
  },
  /**
   * Logout user
   */
  logout: () => {
    console.log('Logging out');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    return Promise.resolve({ data: { success: true } });
  },
};

// ========================================
// EMPLOYEES API
// ========================================

export const employeesAPI = {
  getAll: () => apiClient.get('/api/employees'),
  getById: (id: number) => apiClient.get(`/api/employees/${id}`),
  create: (data: any) => apiClient.post('/api/employees', data),
  update: (id: number, data: any) => apiClient.put(`/api/employees/${id}`, data),
  delete: (id: number) => apiClient.delete(`/api/employees/${id}`),
};

// ========================================

export const tablesAPI = {
  getAll: () => apiClient.get('/api/tables'),
  getById: (id: number) => apiClient.get(`/api/tables/${id}`),
  create: (data: any) => apiClient.post('/api/tables', data),
  update: (id: number, data: any) => apiClient.put(`/api/tables/${id}`, data),
  delete: (id: number) => apiClient.delete(`/api/tables/${id}`),
};

// ========================================
// HEALTH CHECK
// ========================================

export const healthAPI = {
  check: () => apiClient.get('/health'),
};

// ========================================
// EXPORT DEFAULT CLIENT
// ========================================

export default apiClient;

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  return !!(token && user);
}

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
export function getToken(): string | null {
  return localStorage.getItem('access_token');
}