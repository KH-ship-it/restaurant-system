'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { navigate } from 'next/dist/client/components/segment-cache/navigation';

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
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
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
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
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
      const statsRes = await fetch(
        `${API_URL}/api/dashboard/stats?${dateParams}`, 
        { headers }
      );
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }

      // Load today's summary (always current day)
      const todayRes = await fetch(`${API_URL}/api/dashboard/today`, { headers });
      if (todayRes.ok) {
        const data = await todayRes.json();
        setTodayStats(data.data);
      }

      // Load category stats with date filter
      const categoryRes = await fetch(
        `${API_URL}/api/dashboard/categories/stats?${dateParams}`, 
        { headers }
      );
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
      'Coffee': '',
      'Main Course': '',
      'Beverage': '',
      'Smoothie': '',
      'Dessert': '',
      'Appetizer': '',
      'Uncategorized': '🍽️'
    };
    return icons[category] || '🍽️';
  };
  const navigateTo = (path: string) => {
    router.push(path);
  };

  if (isLoading || !stats || !todayStats) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📊</div>
          <div className="text-[#8b949e] text-lg">Đang tải dữ liệu...</div>
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
      bgColor: 'bg-blue-500/15 text-blue-400'
    },
    {
      icon: '📦',
      label: 'Tổng đơn hàng',
      value: stats.totalOrders.toString(),
      trendUp: true,
      bgColor: 'bg-green-500/15 text-green-400'
    },
    {
      icon: '🍽️',
      label: 'Bàn đang dùng',
      value: `${stats.occupiedTables}/${stats.totalTables}`,
      trend: `${Math.round((stats.occupiedTables / stats.totalTables) * 100)}%`,
      trendUp: true,
      bgColor: 'bg-yellow-500/15 text-yellow-400'
    },
    {
      icon: '📊',
      label: 'Giá trị TB/đơn',
      value: formatCurrency(stats.avgOrderValue),
      trendUp: true,
      bgColor: 'bg-purple-500/15 text-purple-400'
    }
  ];

  const categoryColors = ['#58a6ff', '#3fb950', '#f2c94c', '#f85149', '#a371f7'];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
        <div 
        onClick={()=>navigateTo('/vi/thongke')}
        className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all bg-[#238636] text-white"
         title="Dashboard">
          📊
        </div>
        <div 
          onClick={() => navigateTo('/vi/qldatban')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lý bàn"

        >
          🪑
        </div>
        <div 
          onClick={() => navigateTo('/vi/qlmenu')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Thực đơn"
        >
          🍽️
        </div>
        <div 
          onClick={() => navigateTo('/vi/qlnhanvien')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Nhân viên"
        >
          👥
        </div>
        <div 
          onClick={() => navigateTo('/vi/order')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Đơn hàng"
        >
          📋
        </div>
         <div 
          onClick={() => navigateTo('/vi/thungan')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Thu Ngân"
          
        >
          💰
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-[60px]">
        {/* Header */}
        <div className="bg-[#161b22] border-b border-[#30363d] px-4 md:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl text-white mb-1">📊 Dashboard</h1>
              <p className="text-xs md:text-sm text-[#8b949e]">Tổng quan hệ thống</p>
            </div>
            
            {/* Date Filter */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              {/* Quick Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => updateDateRange('today')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    selectedPeriod === 'today'
                      ? 'bg-[#238636] text-white'
                      : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => updateDateRange('week')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    selectedPeriod === 'week'
                      ? 'bg-[#238636] text-white'
                      : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                  }`}
                >
                  7 ngày
                </button>
                <button
                  onClick={() => updateDateRange('month')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    selectedPeriod === 'month'
                      ? 'bg-[#238636] text-white'
                      : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
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
                  className="bg-[#0d1117] border border-[#30363d] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:border-[#58a6ff]"
                />
                <span className="text-[#8b949e] text-xs">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setSelectedPeriod('custom');
                  }}
                  className="bg-[#0d1117] border border-[#30363d] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:border-[#58a6ff]"
                />
                {selectedPeriod === 'custom' && (
                  <button
                    onClick={handleCustomDateApply}
                    className="bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded text-xs font-medium transition"
                  >
                    Áp dụng
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Selected Period Display */}
          <div className="mt-3 text-xs text-[#8b949e]">
            📅 Đang xem: {new Date(dateFrom).toLocaleDateString('vi-VN')} - {new Date(dateTo).toLocaleDateString('vi-VN')}
          </div>
        </div>
        {/* Content */}
        <div className="p-4 md:p-8">
          {/* Today's Summary */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Hôm nay</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="text-xs text-[#8b949e] mb-1">Doanh thu</div>
                <div className="text-lg md:text-xl font-bold text-[#3fb950]">
                  {formatCurrency(todayStats.todayRevenue)}
                </div>

              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="text-xs text-[#8b949e] mb-1">Đơn hàng</div>
                <div className="text-lg md:text-xl font-bold text-[#58a6ff]">
                  {todayStats.todayOrders}
                </div>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="text-xs text-[#8b949e] mb-1">Đang xử lý</div>
                <div className="text-lg md:text-xl font-bold text-[#f2c94c]">
                  {todayStats.activeOrders}
                </div>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="text-xs text-[#8b949e] mb-1">Bàn có khách</div>
                <div className="text-lg md:text-xl font-bold text-[#a371f7]">
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
                className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 md:p-6 hover:border-[#58a6ff] hover:-translate-y-1 transition-all"
              >
                <div className="flex justify-between items-start mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center text-xl md:text-2xl ${stat.bgColor}`}>
                    {stat.icon}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${stat.trendUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {stat.trend}
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs md:text-sm text-[#8b949e]">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-5">
            {/* Category Distribution */}
            <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-white mb-4 md:mb-6">
                📊 Phân bố theo danh mục
              </h3>
              {categoryStats.length === 0 ? (
                <div className="text-center py-12 text-[#8b949e]">
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
                          <span className="text-[#c9d1d9] font-medium">{cat.category_name}</span>
                          <span className="text-[#8b949e]">({cat.items_sold} món)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[#58a6ff] font-bold">{cat.revenue_percentage}%</div>
                          <div className="text-xs text-[#8b949e]">{formatCurrency(cat.revenue)}</div>
                        </div>
                      </div>
                      <div className="w-full bg-[#0d1117] rounded-full h-2 md:h-2.5 overflow-hidden">
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
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-white mb-4 md:mb-6">
                📋 Trạng thái đơn hàng
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg">
                  <span className="text-sm text-[#8b949e]">Chờ xử lý</span>
                  <span className="text-base font-bold text-yellow-400">{stats.orderStatusBreakdown.pending}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg">
                  <span className="text-sm text-[#8b949e]">Đang nấu</span>
                  <span className="text-base font-bold text-blue-400">{stats.orderStatusBreakdown.preparing}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg">
                  <span className="text-sm text-[#8b949e]">Sẵn sàng</span>
                  <span className="text-base font-bold text-green-400">{stats.orderStatusBreakdown.ready}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg">
                  <span className="text-sm text-[#8b949e]"> Hoàn thành</span>
                  <span className="text-base font-bold text-[#3fb950]">{stats.orderStatusBreakdown.completed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg">
                  <span className="text-sm text-[#8b949e]">Đã hủy</span>
                  <span className="text-base font-bold text-red-400">{stats.orderStatusBreakdown.cancelled}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Popular Items */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 md:p-6">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h3 className="text-base md:text-lg font-semibold text-white">
                🔥 Top món bán chạy
              </h3>
              <button 
                onClick={() => navigateTo('/vi/qlmenu')}
                className="text-xs md:text-sm text-[#58a6ff] hover:text-[#79c0ff] transition"
              >
                Xem tất cả →
              </button>
            </div>
            {stats.popularItems.length === 0 ? (
              <div className="text-center py-12 text-[#8b949e]">
                <div className="text-4xl md:text-5xl mb-4 opacity-50">🍽️</div>
                <p className="text-sm md:text-base">Không có dữ liệu trong khoảng thời gian này</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {stats.popularItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-[#0d1117] rounded-lg hover:bg-[#21262d] transition"
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
                      <div className="font-medium text-white text-sm md:text-base truncate">
                        {item.item_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                        <span>{getCategoryIcon(item.category_name)} {item.category_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm md:text-base font-bold text-[#58a6ff]">
                        {item.order_count} đơn
                      </div>
                      <div className="text-xs text-[#3fb950]">
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