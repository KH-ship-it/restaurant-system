import axios from 'axios';

// Get API URL from environment
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
};

const API_URL = getApiUrl();

console.log('🔧 API URL:', API_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - Add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('📤 Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ Response error:', error);
    
    if (error.response) {
      // Server responded with error status
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      
      if (error.response.status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.location.href = '/vi/login';
        }
      }
    } else if (error.request) {
      // Request was made but no response
      console.error('❌ No response from server');
      console.error('Request:', error.request);
    } else {
      // Error in request setup
      console.error('❌ Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username: string, password: string) => {
    try {
      console.log('🔐 Attempting login...');
      console.log('URL:', `${API_URL}/api/auth/login`);
      
      const response = await api.post('/api/auth/login', {
        username,
        password,
      });
      
      console.log('✅ Login successful:', response.data);
      return response;
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      
      // Provide user-friendly error message
      if (error.response) {
        throw new Error(
          error.response.data?.detail || 
          'Đăng nhập thất bại. Vui lòng kiểm tra tên đăng nhập và mật khẩu.'
        );
      } else if (error.request) {
        throw new Error(
          'Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng.'
        );
      } else {
        throw new Error('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if API fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  getMe: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error) {
      console.error('Get me error:', error);
      throw error;
    }
  },
};

// Menu API
export const menuAPI = {
  getAll: async () => {
    const response = await api.get('/api/menu');
    return response.data;
  },

  getPublic: async () => {
    const response = await api.get('/api/menu/public');
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/api/menu', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/api/menu/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/menu/${id}`);
    return response.data;
  },
};

// Tables API
export const tablesAPI = {
  getAll: async () => {
    const response = await api.get('/api/tables');
    return response.data;
  },

  getOne: async (number: number) => {
    const response = await api.get(`/api/tables/${number}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/api/tables', data);
    return response.data;
  },

  update: async (number: number, data: any) => {
    const response = await api.put(`/api/tables/${number}`, data);
    return response.data;
  },

  delete: async (number: number) => {
    const response = await api.delete(`/api/tables/${number}`);
    return response.data;
  },

  verifyToken: async (number: number, token: string) => {
    const response = await api.get(`/api/tables/${number}/verify?token=${token}`);
    return response.data;
  },
};

export default api;