'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Users, ShoppingCart, FileText, Package, CreditCard, Calendar, User } from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalTables: number;
  occupiedTables: number;
  popularItems: PopularItem[];
  orderStatusBreakdown: OrderStatus;
}

interface PopularItem {
  item_name: string;
  image_url: string;
  category_name: string;
  order_count: number;
  total_quantity: number;
  revenue: number;
}

interface OrderStatus {
  pending: number;
  preparing: number;
  ready: number;
  completed: number;
  cancelled: number;
}

interface TodaySummary {
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  occupiedTables: number;
}

interface CategoryStat {
  category_name: string;
  order_count: number;
  items_sold: number;
  revenue: number;
  revenue_percentage: number;
}

// Menu Items Configuration
const menuItems = [
  { 
    label: 'Thống kê', 
    path: '/vi/thongke', 
    icon: BarChart3,
    active: true 
  },
  { 
    label: 'Quản lý bàn', 
    path: '/vi/qldatban', 
    icon: Calendar,
    active: false 
  },
  { 
    label: 'Thực đơn', 
    path: '/vi/qlmenu', 
    icon: FileText,
    active: false 
  },
  { 
    label: 'Nhân viên', 
    path: '/vi/qlnhanvien', 
    icon: Users,
    active: false 
  },
  { 
    label: 'Đơn hàng', 
    path: '/vi/order', 
    icon: ShoppingCart,
    active: false 
  },
  { 
    label: 'Tài khoản', 
    path: '/vi/qltk', 
    icon: User,
    active: false 
  },
  { 
    label: 'Kho vận', 
    path: '/vi/qlkho', 
    icon: Package,
    active: false 
  },
  { 
    label: 'Thu ngân', 
    path: '/vi/thungan', 
    icon: CreditCard,
    active: false 
  }
];

// Sidebar Component
const Sidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateTo = (path: string) => {
    window.location.href = path;
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1a1d29] text-white rounded-lg shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          w-64 bg-[#1a1d29] min-h-screen fixed left-0 top-0 text-gray-300 z-40
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Restaurant</h2>
              <p className="text-xs text-gray-400">Management</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="py-4">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => navigateTo(item.path)}
                className={`
                  w-full px-6 py-3 flex items-center gap-3 transition-all duration-200
                  ${item.active 
                    ? 'bg-green-500/10 text-green-400 border-r-4 border-green-500' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }
                `}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayStats, setTodayStats] = useState<TodaySummary | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
   const token = sessionStorage.getItem('access_token') 
    || localStorage.getItem('access_token') 
    || localStorage.getItem('token');
    if (!token) {
      router.push('/vi/login');
      return;
    }

    // Set default dates based on selected period
    updateDateRange('today');
  }, []);

  const updateDateRange = (period: 'today' | 'week' | 'month' | 'custom') => {
    const today = new Date();
    let from = new Date(today);
    
    setSelectedPeriod(period);

    switch (period) {
      case 'today':
        from = new Date(today);
        break;
      case 'week':
        from.setDate(today.getDate() - 7);
        break;
      case 'month':
        from.setDate(today.getDate() - 30);
        break;
      case 'custom':
        // Keep current dates
        return;
    }

    const fromStr = from.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];
    
    setDateFrom(fromStr);
    setDateTo(toStr);
    
    // Load data with new dates
    loadDashboardData(fromStr, toStr);
  };

  const loadDashboardData = async (from?: string, to?: string) => {
    const token = sessionStorage.getItem('access_token') 
  || localStorage.getItem('access_token') 
  || localStorage.getItem('token');
    if (!token) return;

    try {
      setIsLoading(true);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      };
      const dateParams = new URLSearchParams();
      if (from) dateParams.append('date_from', from);
      if (to) dateParams.append('date_to', to);

      // Load main stats with date filter
      const statsRes = await fetch(`/api/proxy/dashboard/stats?${dateParams}`, { headers });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }

      // Load today's summary (always current day)
    const todayRes = await fetch(`/api/proxy/dashboard/today`, { headers });
      if (todayRes.ok) {
        const data = await todayRes.json();
        setTodayStats(data.data);
      }

      // Load category stats with date filter
      const categoryRes = await fetch(`/api/proxy/dashboard/categories/stats?${dateParams}`, { headers });
      if (categoryRes.ok) {
        const data = await categoryRes.json();
        setCategoryStats(data.data);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomDateApply = () => {
    if (dateFrom && dateTo) {
      loadDashboardData(dateFrom, dateTo);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Coffee': '☕',
      'Main Course': '🍛',
      'Beverage': '🥤',
      'Smoothie': '🥤',
      'Dessert': '🍰',
      'Appetizer': '🥗',
      'Uncategorized': '🍽️'
    };
    return icons[category] || '🍽️';
  };
  
  const navigateTo = (path: string) => {
    router.push(path);
  };

  if (isLoading || !stats || !todayStats) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce"></div>
          <div className="text-gray-600 text-lg">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: '💰',
      label: 'Tổng doanh thu',
      value: formatCurrency(stats.totalRevenue),
      trendUp: true,
      bgColor: 'bg-blue-100 text-blue-600'
    },
    {
      icon: '📦',
      label: 'Tổng đơn hàng',
      value: stats.totalOrders.toString(),
      trendUp: true,
      bgColor: 'bg-green-100 text-green-600'
    },
    {
      icon: '🍽️',
      label: 'Bàn đang dùng',
      value: `${stats.occupiedTables}/${stats.totalTables}`,
      trend: `${Math.round((stats.occupiedTables / stats.totalTables) * 100)}%`,
      trendUp: true,
      bgColor: 'bg-yellow-100 text-yellow-600'
    },
    {
      icon: '📊',
      label: 'Giá trị TB/đơn',
      value: formatCurrency(stats.avgOrderValue),
      trendUp: true,
      bgColor: 'bg-purple-100 text-purple-600'
    }
  ];

  const categoryColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="w-full lg:ml-64">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 mt-12 lg:mt-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl text-gray-800 mb-1">📊 Dashboard</h1>
              <p className="text-xs md:text-sm text-gray-600">Tổng quan hệ thống</p>
            </div>
            
            {/* Date Filter */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              {/* Quick Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => updateDateRange('today')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    selectedPeriod === 'today'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => updateDateRange('week')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    selectedPeriod === 'week'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  7 ngày
                </button>
                <button
                  onClick={() => updateDateRange('month')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    selectedPeriod === 'month'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  30 ngày
                </button>
              </div>

              {/* Custom Date Range */}
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setSelectedPeriod('custom');
                  }}
                  className="bg-white border border-gray-300 text-gray-800 px-2 py-1.5 rounded text-xs focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-500 text-xs">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setSelectedPeriod('custom');
                  }}
                  className="bg-white border border-gray-300 text-gray-800 px-2 py-1.5 rounded text-xs focus:outline-none focus:border-blue-500"
                />
                {selectedPeriod === 'custom' && (
                  <button
                    onClick={handleCustomDateApply}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                  >
                    Áp dụng
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Selected Period Display */}
          <div className="mt-3 text-xs text-gray-500">
            📅 Đang xem: {new Date(dateFrom).toLocaleDateString('vi-VN')} - {new Date(dateTo).toLocaleDateString('vi-VN')}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-8">
          {/* Today's Summary */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Hôm nay</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">Doanh thu</div>
                <div className="text-lg md:text-xl font-bold text-green-600">
                  {formatCurrency(todayStats.todayRevenue)}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">Đơn hàng</div>
                <div className="text-lg md:text-xl font-bold text-blue-600">
                  {todayStats.todayOrders}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">Đang xử lý</div>
                <div className="text-lg md:text-xl font-bold text-yellow-600">
                  {todayStats.activeOrders}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">Bàn có khách</div>
                <div className="text-lg md:text-xl font-bold text-purple-600">
                  {todayStats.occupiedTables}
                </div>
              </div>
            </div>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
            {statCards.map((stat, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 hover:border-blue-400 hover:-translate-y-1 transition-all shadow-sm"
              >
                <div className="flex justify-between items-start mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center text-xl md:text-2xl ${stat.bgColor}`}>
                    {stat.icon}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${stat.trendUp ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {stat.trend}
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">{stat.value}</div>
                <div className="text-xs md:text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-5">
            {/* Category Distribution */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 md:mb-6">
                📊 Phân bố theo danh mục
              </h3>
              {categoryStats.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-sm">Không có dữ liệu trong khoảng thời gian này</div>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {categoryStats.map((cat, index) => (
                    <div key={cat.category_name} className="space-y-2">
                      <div className="flex justify-between items-center text-xs md:text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-base md:text-xl">{getCategoryIcon(cat.category_name)}</span>
                          <span className="text-gray-800 font-medium">{cat.category_name}</span>
                          <span className="text-gray-500">({cat.items_sold} món)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-blue-600 font-bold">{cat.revenue_percentage}%</div>
                          <div className="text-xs text-gray-500">{formatCurrency(cat.revenue)}</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 md:h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${cat.revenue_percentage}%`,
                            backgroundColor: categoryColors[index % categoryColors.length]
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Status */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 md:mb-6">
                📋 Trạng thái đơn hàng
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Chờ xử lý</span>
                  <span className="text-base font-bold text-yellow-600">{stats.orderStatusBreakdown.pending}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Đang nấu</span>
                  <span className="text-base font-bold text-blue-600">{stats.orderStatusBreakdown.preparing}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Sẵn sàng</span>
                  <span className="text-base font-bold text-green-600">{stats.orderStatusBreakdown.ready}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Hoàn thành</span>
                  <span className="text-base font-bold text-green-700">{stats.orderStatusBreakdown.completed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Đã hủy</span>
                  <span className="text-base font-bold text-red-600">{stats.orderStatusBreakdown.cancelled}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Popular Items */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-800">
                🔥 Top món bán chạy
              </h3>
              <button 
                onClick={() => navigateTo('/vi/qlmenu')}
                className="text-xs md:text-sm text-blue-600 hover:text-blue-700 transition"
              >
                Xem tất cả →
              </button>
            </div>
            {stats.popularItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl md:text-5xl mb-4 opacity-50">🍽️</div>
                <p className="text-sm md:text-base">Không có dữ liệu trong khoảng thời gian này</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {stats.popularItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                      index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-800' :
                      'bg-green-600'
                    }`}>
                      {index + 1}
                    </div>
                    <img 
                      src={item.image_url || '/placeholder.jpg'} 
                      alt={item.item_name} 
                      className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm md:text-base truncate">
                        {item.item_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getCategoryIcon(item.category_name)} {item.category_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm md:text-base font-bold text-blue-600">
                        {item.order_count} đơn
                      </div>
                      <div className="text-xs text-green-600">
                        {formatCurrency(item.revenue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}