'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { useTranslations } from 'next-intl';
import ParticlesBackground from "@/app/[locale]/login/ParticlesBackground";

const REMEMBER_KEY = 'restaurant_remember_me';

interface SavedCredentials {
  username: string;
  password: string;
}

export default function LoginPage() {
  const t = useTranslations('Login');
  const router = useRouter();
  const pathname = usePathname();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  // Holds the saved credentials in memory — used to auto-fill password when username matches
  const [savedCreds, setSavedCreds] = useState<SavedCredentials | null>(null);
  // True only while the password was auto-filled and not yet manually changed
  const [passwordAutoFilled, setPasswordAutoFilled] = useState(false);

  const currentLocale = pathname.startsWith('/vi') ? 'vi' : 'en';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const ROLE_ROUTES: Record<string, string> = {
    'OWNER':   '/thongke',
    'ADMIN':   '/thongke',
    'KITCHEN': '/order',
    'CASHIER': '/thungan',
    'STAFF':   '/order',
  };

  // ── On mount: load saved username only, keep password hidden ──────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (raw) {
        const creds: SavedCredentials = JSON.parse(raw);
        if (creds.username && creds.password) {
          setSavedCreds(creds);
          // Pre-fill username only — password stays empty until username matches
          setFormData({ username: creds.username, password: '' });
          setRememberMe(true);
        }
      }
    } catch (_) {}

    checkAPIConnection();
  }, []);

  // ── Auto-fill password when typed username matches the saved one ───────────
  useEffect(() => {
    if (!savedCreds) return;

    if (formData.username === savedCreds.username && formData.password === '') {
      // Username matches and password box is empty → auto-fill silently
      setFormData(prev => ({ ...prev, password: savedCreds.password }));
      setPasswordAutoFilled(true);
    } else if (formData.username !== savedCreds.username && passwordAutoFilled) {
      // Username was changed away → clear the auto-filled password
      setFormData(prev => ({ ...prev, password: '' }));
      setPasswordAutoFilled(false);
    }
  }, [formData.username]);

  const checkAPIConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (response.ok) {
        setApiStatus('ok');
      } else {
        setApiStatus('error');
        setError('Server không phản hồi. Vui lòng thử lại sau.');
      }
    } catch {
      setApiStatus('error');
      setError('Không thể kết nối tới server. Vui lòng kiểm tra kết nối.');
    }
  };

  const handleLanguageChange = (locale: string) => {
    const newPathname = pathname.replace(/^\/(vi|en)/, `/${locale}`);
    router.push(newPathname);
  };

  // Handle username change — if user manually edits username, mark password as not auto-filled
  const handleUsernameChange = (value: string) => {
    setFormData(prev => ({ ...prev, username: value }));
    // If user clears/changes username away from saved one, clear auto-filled password
    if (savedCreds && value !== savedCreds.username && passwordAutoFilled) {
      setFormData({ username: value, password: '' });
      setPasswordAutoFilled(false);
    }
  };

  // Handle password change — once user manually types, it's no longer "auto-filled"
  const handlePasswordChange = (value: string) => {
    setFormData(prev => ({ ...prev, password: value }));
    if (passwordAutoFilled) setPasswordAutoFilled(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Capture before any state mutation
    const capturedUsername = formData.username;
    const capturedPassword = formData.password;
    const capturedRemember = rememberMe;

    try {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('access_token');

      const response = await authAPI.login(capturedUsername, capturedPassword);

      if (response.data.success) {
        const user  = response.data.user;
        const token = response.data.token;

        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('access_token', token);

        // Save or clear credentials
        if (capturedRemember) {
          const creds: SavedCredentials = { username: capturedUsername, password: capturedPassword };
          localStorage.setItem(REMEMBER_KEY, JSON.stringify(creds));
          setSavedCreds(creds);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
          setSavedCreds(null);
        }

        const redirectRoute = ROLE_ROUTES[user.role] || '/order';
        router.push(`/${currentLocale}${redirectRoute}`);
      } else {
        throw new Error('Login failed');
      }
    } catch (err: any) {
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setFormData(prev => ({ ...prev, password: '' }));
      setPasswordAutoFilled(false);
    } finally {
      setLoading(false);
    }
  };

  // Unchecking immediately removes saved credentials
  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      localStorage.removeItem(REMEMBER_KEY);
      setSavedCreds(null);
      setPasswordAutoFilled(false);
    }
  };

  // Whether the current username matches a saved account (for hint display)
  const usernameHasSavedPassword =
    savedCreds !== null && formData.username === savedCreds.username;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      <ParticlesBackground />
      <div
        className="fixed inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-indigo-50/40 pointer-events-none"
        style={{ zIndex: 2 }}
      />

      {/* Language switcher */}
      <div className="absolute top-6 right-6" style={{ zIndex: 50 }}>
        <div className="flex gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
          <button
            onClick={() => handleLanguageChange('vi')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              currentLocale === 'vi' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Tiếng Việt
          </button>
          <button
            onClick={() => handleLanguageChange('en')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              currentLocale === 'en' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="w-full max-w-md px-4" style={{ zIndex: 10 }}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 transform transition-all duration-500 hover:shadow-3xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-bounce">🍽️</div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600">{t('title2')}</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-shake">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="font-medium mb-1">Lỗi đăng nhập</div>
                  <div>{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* API unavailable banner */}
          {apiStatus === 'error' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="font-medium mb-1">Server không khả dụng</div>
                  <div className="text-xs mb-2">
                    API URL: <code className="bg-yellow-100 px-2 py-1 rounded">{API_URL}</code>
                  </div>
                  <button
                    onClick={checkAPIConnection}
                    className="text-xs underline hover:no-underline font-medium"
                  >
                    Thử kết nối lại
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="group">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                👤 {t('username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder={t('usernamePlaceholder')}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 group-hover:border-gray-300"
                required
                disabled={loading || apiStatus === 'error'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>

            {/* Password */}
            <div className="group">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  🔒 {t('password')}
                </label>
                {/* Subtle hint when password was auto-filled from saved credentials */}
                {passwordAutoFilled && usernameHasSavedPassword && (
                  <span className="text-xs text-blue-500 font-medium animate-fade-in">
                    🔑 Đã điền từ tài khoản lưu
                  </span>
                )}
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 group-hover:border-gray-300 ${
                  passwordAutoFilled
                    ? 'border-blue-300 bg-blue-50/40'
                    : 'border-gray-200'
                }`}
                required
                disabled={loading || apiStatus === 'error'}
                autoComplete="off"
              />
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  disabled={loading}
                />
                <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                  {t('rememberMe')}
                </span>
              </label>

              {rememberMe && savedCreds && (
                <span className="text-xs text-green-600 font-medium">
                  ✅ Đã lưu thông tin
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || apiStatus === 'error'}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : (
                '🔐 Đăng nhập'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500"></p>
            <p className="mt-2 text-xs text-gray-400"></p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-10px); }
          75%       { transform: translateX(10px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-shake    { animation: shake   0.5s ease-in-out; }
        .animate-fade-in  { animation: fadeIn  0.3s ease-out; }
      `}</style>
    </div>
  );
}