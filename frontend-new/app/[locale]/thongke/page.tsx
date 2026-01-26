'use client';

import { useState, useEffect } from 'react';

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  status: 'available' | 'unavailable';
  description: string;
  image: string;
  addedDate: string;
  views: number;
}

interface StatCard {
  icon: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  bgColor: string;
}

export default function DashboardPage() {
  const [dateFrom, setDateFrom] = useState('2025-01-01');
  const [dateTo, setDateTo] = useState('2025-01-17');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  // Load dữ liệu từ localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('menu-items');
      if (stored) {
        setMenuItems(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Lỗi tải dữ liệu:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tính toán thống kê thực từ dữ liệu
  const calculateStats = () => {
    const totalItems = menuItems.length;
    const availableItems = menuItems.filter(item => item.status === 'available').length;
    const totalRevenue = menuItems.reduce((sum, item) => sum + (item.price * item.views), 0);
    const totalOrders = menuItems.reduce((sum, item) => sum + item.views, 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalItems,
      availableItems,
      totalRevenue,
      totalOrders,
      avgOrderValue
    };
  };

  const stats = calculateStats();

  const statCards: StatCard[] = [
    {
      icon: '💰',
      label: 'Tổng doanh thu',
      value: `${(stats.totalRevenue / 1000000).toFixed(1)}M ₫`,
      trend: '↑ 12.5%',
      trendUp: true,
      bgColor: 'bg-blue-500/15 text-blue-400'
    },

    {
      icon: '📦',
      label: 'Tổng lượt xem',
      value: stats.totalOrders.toLocaleString('vi-VN'),
      trend: '↑ 8.3%',
      trendUp: true,
      bgColor: 'bg-green-500/15 text-green-400'
    },
    {
      icon: '🍽️',
      label: 'Món có sẵn',
      value: `${stats.availableItems}/${stats.totalItems}`,
      trend: `${Math.round((stats.availableItems / stats.totalItems) * 100)}%`,
      trendUp: true,
      bgColor: 'bg-yellow-500/15 text-yellow-400'
    },
    {
      icon: '📊',
      label: 'Giá trị TB/lượt',
      value: `${(stats.avgOrderValue / 1000).toFixed(1)}K ₫`,
      trend: '↑ 5.2%',
      trendUp: true,
      bgColor: 'bg-purple-500/15 text-purple-400'
    }
  ];

  // Top 5 món phổ biến nhất
  const popularItems = [...menuItems]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      category: item.category,
      views: item.views,
      revenue: (item.price * item.views).toLocaleString('vi-VN'),
      image: item.image,
      price: item.price
    }));

  // Thống kê theo danh mục
  const categoryStats = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = { count: 0, revenue: 0, views: 0 };
    }
    acc[item.category].count++;
    acc[item.category].revenue += item.price * item.views;
    acc[item.category].views += item.views;
    return acc;
  }, {} as Record<string, { count: number; revenue: number; views: number }>);

  const totalCategoryRevenue = Object.values(categoryStats).reduce((sum, cat) => sum + cat.revenue, 0);

  const categoryData = Object.entries(categoryStats).map(([category, data]) => ({
    category,
    percentage: totalCategoryRevenue > 0 ? Math.round((data.revenue / totalCategoryRevenue) * 100) : 0,
    count: data.count,
    revenue: data.revenue,
    views: data.views
  })).sort((a, b) => b.percentage - a.percentage);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      coffee: '☕',
      main: '🍖',
      drink: '🥤',
      smoothie: '🍹',
      dessert: '🍰'
    };
    return icons[category] || '🍽️';
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      coffee: 'Cà phê',
      main: 'Món chính',
      drink: 'Đồ uống',
      smoothie: 'Sinh tố',
      dessert: 'Tráng miệng'
    };
    return names[category] || category;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-orange-500';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500';
    if (rank === 3) return 'bg-gradient-to-br from-orange-600 to-orange-800';
    return 'bg-green-600';
  };

  const categoryColors = ['#58a6ff', '#3fb950', '#f2c94c', '#f85149', '#a371f7'];

  const quickStats = [
    { label: 'Tổng món ăn', value: stats.totalItems.toString(), icon: '🍽️' },
    { label: 'Món còn hàng', value: stats.availableItems.toString(), icon: '✅' },
    { label: 'Món hết hàng', value: (stats.totalItems - stats.availableItems).toString(), icon: '❌' },
    { label: 'Tổng lượt xem', value: stats.totalOrders.toLocaleString('vi-VN'), icon: '👁️' },
    { label: 'Doanh thu dự kiến', value: `${(stats.totalRevenue / 1000000).toFixed(1)}M ₫`, icon: '💵' },
    { label: 'Giá TB/món', value: `${Math.round(menuItems.reduce((sum, item) => sum + item.price, 0) / menuItems.length / 1000)}K ₫`, icon: '💰' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📊</div>
          <div className="text-[#8b949e] text-lg">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white font-bold text-lg mb-5">
          H
        </div>
        <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all bg-[#238636] text-white" title="Dashboard">
          📊
        </div>
        <div 
          onClick={() => navigateTo('/vi/qldatban')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí bàn ăn"
        >
          📋
        </div>
        <div 
          onClick={() => navigateTo('/vi/qlmenu')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí thực đơn"
        >
          🍽️
        </div>
        <div 
          onClick={() => navigateTo('/vi/qlnhanvien')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí nhân viên"
        >
          👥
        </div>
        <div 
          onClick={() => navigateTo('/vi/qlkho')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí kho"
        >
          📦
        </div>
        <div 
          onClick={() => navigateTo('/vi/thungan')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Thu ngân"
        >
          💰
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-[60px]">
        {/* Top Header */}
        <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl text-white mb-1">Dashboard - Tổng quan</h1>
              <p className="text-sm text-[#8b949e]">Thống kê và phân tích dữ liệu thực đơn</p>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-sm text-[#8b949e]">
                📅 Cập nhật: {new Date().toLocaleDateString('vi-VN')}
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {statCards.map((stat, index) => (
              <div
                key={index}
                className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 hover:border-[#58a6ff] hover:-translate-y-1 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-2xl ${stat.bgColor}`}>
                    {stat.icon}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${stat.trendUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {stat.trend}
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-[#8b949e]">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Category Distribution */}
            <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Phân bố theo danh mục</h3>
              <div className="space-y-4">
                {categoryData.map((cat, index) => (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getCategoryIcon(cat.category)}</span>
                        <span className="text-[#c9d1d9] font-medium">{getCategoryName(cat.category)}</span>
                        <span className="text-[#8b949e]">({cat.count} món)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[#58a6ff] font-bold">{cat.percentage}%</div>
                        <div className="text-xs text-[#8b949e]">{(cat.revenue / 1000000).toFixed(1)}M ₫</div>
                      </div>
                    </div>
                    <div className="w-full bg-[#0d1117] rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: categoryColors[index % categoryColors.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Thống kê nhanh</h3>
              <div className="space-y-3">
                {quickStats.map((stat, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-[#0d1117] rounded-lg hover:bg-[#21262d] transition">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{stat.icon}</span>
                      <span className="text-sm text-[#8b949e]">{stat.label}</span>
                    </div>
                    <div className="text-base font-bold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Popular Items */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Top 5 món được xem nhiều nhất</h3>
              <button 
                onClick={() => navigateTo('/vi/qlmenu')}
                className="text-sm text-[#58a6ff] hover:text-[#79c0ff] transition"
              >
                Xem tất cả →
              </button>
            </div>
            {popularItems.length === 0 ? (
              <div className="text-center py-12 text-[#8b949e]">
                <div className="text-5xl mb-4 opacity-50">🍽️</div>
                <p className="text-base">Chưa có dữ liệu món ăn</p>
                <button
                  onClick={() => navigateTo('/vi/qlmenu')}
                  className="mt-4 px-4 py-2 bg-[#238636] text-white rounded-lg hover:bg-[#2ea043] transition"
                >
                  Thêm món ngay
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {popularItems.map((item) => (
                  <div
                    key={item.rank}
                    className="flex items-center gap-4 p-4 bg-[#0d1117] rounded-lg hover:bg-[#21262d] transition cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${getRankColor(item.rank)}`}>
                      {item.rank}
                    </div>
                    <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1">
                      <div className="font-medium text-white mb-1">{item.name}</div>
                      <div className="flex items-center gap-3 text-xs text-[#8b949e]">
                        <span>{getCategoryIcon(item.category)} {getCategoryName(item.category)}</span>
                        <span>•</span>
                        <span>{item.price.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[#58a6ff] mb-1">👁️ {item.views}</div>
                      <div className="text-xs text-[#3fb950]">≈ {item.revenue} ₫</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center text-xl">
                  ✅
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.availableItems}</div>
                  <div className="text-sm text-[#8b949e]">Món còn hàng</div>
                </div>
              </div>
              <div className="text-xs text-[#8b949e]">
                {Math.round((stats.availableItems / stats.totalItems) * 100)}% tổng số món
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xl">
                  ❌
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalItems - stats.availableItems}</div>
                  <div className="text-sm text-[#8b949e]">Món hết hàng</div>
                </div>
              </div>
              <div className="text-xs text-[#8b949e]">
                Cần cập nhật trạng thái
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{categoryData.length}</div>
                  <div className="text-sm text-[#8b949e]">Danh mục</div>
                </div>
              </div>
              <div className="text-xs text-[#8b949e]">
                Đa dạng thực đơn
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}