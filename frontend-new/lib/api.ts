import axios from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      const locale =
        window.location.pathname.startsWith('/en') ? 'en' : 'vi';
      window.location.href = `/${locale}/login`;
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  getMe: () => api.get('/api/auth/me'),
};

export default api;
