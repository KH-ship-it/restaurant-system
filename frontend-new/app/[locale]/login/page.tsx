'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('Login');
  const router = useRouter();
  const pathname = usePathname();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  const currentLocale = pathname.startsWith('/vi') ? 'vi' : 'en';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  //  ROLE TO ROUTE MAPPING - FIXED
  const ROLE_ROUTES: Record<string, string> = {
    'OWNER': '/thongke',      // Chủ nhà hàng → Thống kê
    'ADMIN': '/thongke',      // Admin → Thống kê
    'KITCHEN': '/order',      // Đầu bếp → Order
    'CASHIER': '/thungan',    // Thu ngân → Thu ngân
    'STAFF': '/order',        // Nhân viên phục vụ → Order
  };

  // Check API connection on mount
  useEffect(() => {
    checkAPIConnection();
  }, []);

  const checkAPIConnection = async () => {
    try {
      console.log('🔍 Checking API connection:', API_URL);
      
      const response = await fetch(`${API_URL}/health`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
      
      if (response.ok) {
        console.log('✅ API is online');
        setApiStatus('ok');
      } else {
        console.error('❌ API returned error:', response.status);
        setApiStatus('error');
        setError('Server không phản hồi. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('❌ Cannot connect to API:', error);
      setApiStatus('error');
      setError('Không thể kết nối tới server. Vui lòng kiểm tra kết nối.');
    }
  };

  const handleLanguageChange = (locale: string) => {
    const newPathname = pathname.replace(/^\/(vi|en)/, `/${locale}`);
    router.push(newPathname);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('\n' + '='.repeat(60));
    console.log('🔐 LOGIN ATTEMPT');
    console.log('='.repeat(60));
    console.log('Username:', formData.username);
    console.log('API URL:', API_URL);

    try {
      const response = await authAPI.login(formData.username, formData.password);
      
      console.log('📦 Login response:', response.data);

      if (response.data.success) {
        // Save to localStorage
        const user = response.data.user;
        const token = response.data.token;
        
        // 🔥 FIX: Save token with BOTH keys for compatibility
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', token);           // ← NEW: For table management page
        localStorage.setItem('access_token', token);    // ← OLD: For API client
        
        console.log('💾 Saved to localStorage:');
        console.log('  - user:', JSON.stringify(user));
        console.log('  - token:', token.substring(0, 20) + '...');
        console.log('  - access_token:', token.substring(0, 20) + '...');
        
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        
        const userRole = user.role;
        
        console.log('\n✅ LOGIN SUCCESSFUL');
        console.log('👤 User:', user.username);
        console.log('🎭 Role:', userRole);
        console.log('📛 Full Name:', user.fullName);
        
        //  Get redirect route based on role
        const redirectRoute = ROLE_ROUTES[userRole];
        
        if (redirectRoute) {
          console.log('🔀 Redirecting to:', `/${currentLocale}${redirectRoute}`);
          console.log('='.repeat(60) + '\n');
          router.push(`/${currentLocale}${redirectRoute}`);
        } else {
          // Fallback if role not found
          console.warn('⚠️  Role not found in mapping, using /order as fallback');
          console.log('='.repeat(60) + '\n');
          router.push(`/${currentLocale}/order`);
        }
        
      } else {
        throw new Error('Login failed: ' + (response.data.message || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('\n❌ LOGIN ERROR');
      console.error(err);
      console.log('='.repeat(60) + '\n');
      
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }     
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading state while checking API
  if (apiStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔍</div>
          <div className="text-gray-600 text-lg">Đang kiểm tra kết nối...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Language Selector */}
      <div className="absolute top-6 right-6">
        <div className="flex gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => handleLanguageChange('vi')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              currentLocale === 'vi'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            🇻🇳 Tiếng Việt
          </button>
          <button
            onClick={() => handleLanguageChange('en')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              currentLocale === 'en'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* API Status Indicator */}
      <div className="absolute top-6 left-6">
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
          apiStatus === 'ok' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            apiStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'
          }`}></span>
          {apiStatus === 'ok' ? 'Server Online' : 'Server Offline'}
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🍽️</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-500">
              {t('title2')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg">❌</span>
                <div className="flex-1">
                  <div className="font-medium mb-1">Lỗi đăng nhập</div>
                  <div>{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* API Error Warning */}
          {apiStatus === 'error' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="font-medium mb-1">Server không khả dụng</div>
                  <div className="text-xs mb-2">
                    API URL: <code className="bg-yellow-100 px-1 rounded">{API_URL}</code>
                  </div>
                  <button
                    onClick={checkAPIConnection}
                    className="text-xs underline hover:no-underline"
                  >
                    🔄 Thử kết nối lại
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                {t('username')}
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={t('usernamePlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                disabled={loading || apiStatus === 'error'}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={t('passwordPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                disabled={loading || apiStatus === 'error'}
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={loading}
                />
                <span className="ml-2 text-sm text-gray-600">
                  {t('rememberMe')}
                </span>
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || apiStatus === 'error'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {loading ? '⏳ Đang đăng nhập...' : '🔐 Đăng nhập'}
            </button>
          </form>

          {/* Debug Info */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                const token = localStorage.getItem('token');
                const accessToken = localStorage.getItem('access_token');
                const user = localStorage.getItem('user');
                console.log('📊 Debug Info:');
                console.log('  API URL:', API_URL);
                console.log('  Status:', apiStatus);
                console.log('  token:', token ? token.substring(0, 20) + '...' : 'null');
                console.log('  access_token:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');
                console.log('  user:', user);
                alert(`API URL: ${API_URL}\nStatus: ${apiStatus}\ntoken: ${token ? 'Có ✅' : 'Không ❌'}\naccess_token: ${accessToken ? 'Có ✅' : 'Không ❌'}\nUser: ${user ? 'Có ✅' : 'Không ❌'}`);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              🐛 Debug Info
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}