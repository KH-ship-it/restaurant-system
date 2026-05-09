'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Users, ShoppingCart, FileText, Package, CreditCard, Calendar, User, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

interface Table {
  table_id?: number;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  qr_code?: string;
  created_at?: string;
  updated_at?: string;
}

// Menu Items Configuration
const menuItems = [
  { label: 'Thống kê', path: '/vi/thongke', icon: BarChart3, active: false },
  { label: 'Quản lý bàn', path: '/vi/qldatban', icon: Calendar, active: true },
  { label: 'Thực đơn', path: '/vi/qlmenu', icon: FileText, active: false },
  { label: 'Nhân viên', path: '/vi/qlnhanvien', icon: Users, active: false },
  { label: 'Đơn hàng', path: '/vi/order', icon: ShoppingCart, active: false },
  { label: 'Tài khoản', path: '/vi/qltk', icon: User, active: false },
  { label: 'Kho vận', path: '/vi/qlkho', icon: Package, active: false },
  { label: 'Thu ngân', path: '/vi/thungan', icon: CreditCard, active: false }
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

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`
          w-64 bg-[#1a1d29] min-h-screen fixed left-0 top-0 text-gray-300 z-40
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
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

export default function TableManagementPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentQRTable, setCurrentQRTable] = useState<Table | null>(null);
  const [currentEditTable, setCurrentEditTable] = useState<Table | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const CUSTOMER_APP_URL = 'localhost:3000';

  const getOrderUrl = (table: Table) => {
    return `${CUSTOMER_APP_URL}/vi/goimon?table=${table.number}`;
  };

  
// ================================
// REAL-TIME SYNC VIA BROADCASTCHANNEL + LOCALSTORAGE
// ================================
useEffect(() => {
  if (!token) return;

  console.log('🎧 [SYNC] Setting up listeners...');

  // 1 BroadcastChannel (cross-tab, same-origin)
  const channel = new BroadcastChannel('table-updates');
  
  channel.onmessage = (event) => {
    const { type, tableNumber, status, orderId, timestamp } = event.data;
    
    console.log(` [BROADCAST] Received:`, event.data);
    
    if (type === 'TABLE_STATUS_CHANGE') {
      console.log(`Table ${tableNumber} → ${status}`);
      loadTablesFromAPI(token);
      showNotification(`Bàn ${tableNumber} đã chuyển sang ${getStatusText(status)}`);
      setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
    }
    
    if (type === 'NEW_ORDER') {
      console.log(` New order from table ${tableNumber}`);
      loadTablesFromAPI(token);
      showNotification(` Đơn hàng mới từ bàn ${tableNumber}!`);
      setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
    }
  };

  //  LocalStorage (fallback for older browsers)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key && e.key.startsWith('table_') && e.key.endsWith('_status')) {
      const tableNumber = e.key.replace('table_', '').replace('_status', '');
      console.log(` [STORAGE] Table ${tableNumber} changed`);
      loadTablesFromAPI(token);
      setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
    }
    
    if (e.key === 'new_order_trigger' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        console.log(` [STORAGE] New order table ${data.tableNumber}`);
        loadTablesFromAPI(token);
        showNotification(` Đơn hàng mới từ bàn ${data.tableNumber}!`);
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
      } catch (err) {
        console.error('Parse error:', err);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  console.log(' [SYNC] Listeners active');

  // Cleanup
  return () => {
    channel.close();
    window.removeEventListener('storage', handleStorageChange);
    console.log(' [SYNC] Listeners removed');
  };
}, [token]);

  // Show notification helper
  const showNotification = (message: string) => {
    // Create a simple toast notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100] animate-slide-in';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('animate-slide-out');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  // ================================
  //  CHECK AUTH AND ROLE PERMISSION
  // ================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkAuthAndPermission();
    
    const handleFocus = () => {
      console.log(' Window focused, checking auth...');
      checkAuthAndPermission();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const checkAuthAndPermission = () => {
    console.log('Checking authentication and permissions...');
    
    const storedToken = sessionStorage.getItem('access_token') 
    || localStorage.getItem('access_token');
  const storedUser = sessionStorage.getItem('user') 
    || localStorage.getItem('user');


    console.log('Token exists:', !!storedToken);
    console.log('User exists:', !!storedUser);

    if (!storedToken || !storedUser) {
      console.log('No auth found');
      setAuthError('Vui lòng đăng nhập để tiếp tục');
      setIsAuthChecking(false);
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const role = user.role || '';
      
      console.log('👤 User role:', role);
      setUserRole(role);

      if (role !== 'OWNER' && role !== 'ADMIN') {
        console.log(' Access denied - insufficient permissions');
        setAuthError(`Bạn không có quyền truy cập trang này. Chỉ Quản lý hoặc Chủ sở hữu mới được phép.`);
        setIsAuthChecking(false);
        return;
      }

      console.log(' Auth and permission check passed');
      setToken(storedToken);
      setAuthError('');
      setIsAuthChecking(false);
      loadTablesFromAPI(storedToken);
    } catch (error) {
      console.error(' Error parsing user data:', error);
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      setAuthError('Dữ liệu đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      setIsAuthChecking(false);
    }
  };

  // ========================================
  // LOAD TABLES
  // ========================================
  const loadTablesFromAPI = async (authToken: string) => {
    try {
      setIsLoading(true);
      console.log('Loading tables...');

      const res = await fetch(`${API_URL}/api/tables`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('Response status:', res.status);

      if (res.status === 401) {
        console.log('401 Unauthorized - clearing auth and redirecting...');
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('user');
        setAuthError('Phiên đăng nhập hết hạn!');
        setToken(null);
        return;
      }

      if (res.status === 403) {
        setAuthError('Bạn không có quyền truy cập. Chỉ OWNER/ADMIN mới có thể quản lý bàn.');
        setTables([]);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log(' Tables loaded:', result);

      if (result.success && Array.isArray(result.data)) {
        setTables(result.data);
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
      } else {
        console.warn(' Unexpected response format:', result);
      }
    } catch (err) {
      console.error(' Error loading tables:', err);
      alert('Lỗi tải danh sách bàn!');
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // CREATE TABLE
  // ========================================
  const handleAddTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      alert('Vui lòng đăng nhập lại!');
      return;
    }

    const form = e.currentTarget;
    const number = Number((form.elements.namedItem('tableNumber') as HTMLInputElement).value);
    const capacity = Number((form.elements.namedItem('tableCapacity') as HTMLInputElement).value);
    const status = (form.elements.namedItem('tableStatus') as HTMLSelectElement).value as Table['status'];

    try {
      const res = await fetch(`${API_URL}/api/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          table_number: number,
          capacity: capacity,
          status: status,
        }),
      });

      const result = await res.json();

      if (result.success) {
        alert('Thêm bàn thành công!');
        setShowAddModal(false);
        form.reset();
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || result.message || 'Lỗi thêm bàn!');
      }
    } catch (error) {
      console.error('Error adding table:', error);
      alert('Lỗi thêm bàn!');
    }
  };

  // ========================================
  // UPDATE TABLE
  // ========================================
  const handleUpdateTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !currentEditTable) return;

    const form = e.currentTarget;
    const capacity = Number((form.elements.namedItem('capacity') as HTMLInputElement).value);
    const status = (form.elements.namedItem('status') as HTMLSelectElement).value as Table['status'];

    try {
      const res = await fetch(`${API_URL}/api/tables/${currentEditTable.number}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          capacity: capacity,
          status: status,
        }),
      });
      const result = await res.json();

      if (result.success) {
        alert(' Cập nhật thành công!');
        setShowEditModal(false);
        setCurrentEditTable(null);
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || 'Lỗi cập nhật!');
      }
    } catch (error) {
      console.error('Error updating table:', error);
      alert('Lỗi cập nhật!');
    }
  };

  // ========================================
  // DELETE TABLE
  // ========================================
  const handleDelete = async (number: number) => {
    if (!token) return;

    const table = tables.find(t => t.number === number);
    if (table?.status === 'OCCUPIED') {
      alert(' Không thể xóa bàn đang có khách!');
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa bàn số ${number}?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/tables/${number}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const result = await res.json();
      if (result.success) {
        alert('Xóa bàn thành công!');
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || 'Lỗi xóa bàn!');
      }
    } catch (error) {
      console.error('Error deleting table:', error);
      alert('Lỗi xóa bàn!');
    }
  };
  // ========================================
  // QUICK STATUS UPDATE
  // ========================================
  const updateTableStatus = async (number: number, newStatus: Table['status']) => {
    if (!token) return;

    const table = tables.find(t => t.number === number);
    if (!table) return;

    try {
      const res = await fetch(`${API_URL}/api/tables/${number}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          status: newStatus,
          capacity: table.capacity,
        }),
      });

      const result = await res.json();

      if (result.success) {
        showNotification(`Bàn ${number} đã chuyển sang ${getStatusText(newStatus)}`);
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || 'Lỗi cập nhật!');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Lỗi cập nhật trạng thái!');
    }
  };
  const openQR = (table: Table) => {
    setCurrentQRTable(table);
    setShowQRModal(true);
  };
  const openEdit = (table: Table) => {
    setCurrentEditTable(table);
    setShowEditModal(true);
  };
  const downloadQR = () => {
    if (!currentQRTable) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getOrderUrl(currentQRTable))}`;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `QR-Ban-${currentQRTable.number}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-gray-700 text-gray-300 border-gray-600';
      case 'OCCUPIED':
        return 'bg-blue-600 text-blue-100 border-blue-500';
      case 'RESERVED':
        return 'bg-yellow-600 text-yellow-100 border-yellow-500';
    }
  };
  const getStatusText = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Trống';
      case 'OCCUPIED':
        return 'Có khách';
      case 'RESERVED':
        return 'Đã đặt';
    }
  };
  const filteredTables = tables.filter(t => {
    const matchSearch = t.number.toString().includes(search);
    const matchFilter = filter === 'all' ? true : t.status === filter;
    return matchSearch && matchFilter;
  });
  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'AVAILABLE').length,
    occupied: tables.filter(t => t.status === 'OCCUPIED').length,
    reserved: tables.filter(t => t.status === 'RESERVED').length,
  };
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce"></div>
          <div className="text-gray-600 text-lg">Đang kiểm tra quyền truy cập...</div>
        </div>
      </div>
    );
  }
  if (!token || authError) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        
        <div className="w-full lg:ml-64 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto mt-12 lg:mt-0">
            <div className="bg-white border-2 border-red-500 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {!token ? ' Cần đăng nhập' : ' Không có quyền truy cập'}
                  </h3>
                  <p className="text-gray-600 mb-4">{authError}</p>                  
                  {!token && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Lưu ý:</strong> Chỉ tài khoản <strong>Quản lý </strong> hoặc <strong>Chủ sở hữu </strong> mới có thể truy cập trang quản lý bàn.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="/vi/login"
                      target="_blank"
                      className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all font-semibold inline-flex items-center justify-center gap-2"
                    >
                       Mở trang đăng nhập
                    </a>
                    <button
                      onClick={checkAuthAndPermission}
                      className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Đã đăng nhập-Tải lại
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span></span> Quyền truy cập trang quản lý bàn
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800">Chủ sở hữu </div>
                    <div className="text-sm text-gray-600">Có toàn quyền quản lý tất cả bàn</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800">Quản lý </div>
                    <div className="text-sm text-gray-600">Có quyền quản lý và cập nhật bàn</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800">Các quyền khác</div>
                    <div className="text-sm text-gray-600">Không có quyền truy cập trang này</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍽️</div>
          <div className="text-gray-600 text-lg">Đang tải danh sách bàn...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="w-full lg:ml-64 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto mt-12 lg:mt-0">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-800">Quản Lý Bàn</h1>
              {lastUpdate && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Cập nhật: {lastUpdate}</span>
                </div>
              )}
            </div>
            <p className="text-gray-600">
              Tổng cộng {stats.total} bàn | Quyền: <span className="font-semibold text-green-600">{userRole}</span>
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <div className="text-gray-600 text-sm mb-1">Tổng số bàn</div>
              <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <div className="text-gray-600 text-sm mb-1">Bàn trống</div>
              <div className="text-3xl font-bold text-green-600">{stats.available}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <div className="text-gray-600 text-sm mb-1">Có khách</div>
              <div className="text-3xl font-bold text-blue-600">{stats.occupied}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <div className="text-gray-600 text-sm mb-1">Đã đặt</div>
              <div className="text-3xl font-bold text-yellow-600">{stats.reserved}</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Tìm số bàn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="AVAILABLE">Trống</option>
              <option value="OCCUPIED">Có khách</option>
              <option value="RESERVED">Đã đặt</option>
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-semibold transition"
            >
              ➕ Thêm bàn
            </button>
            <button
              onClick={() => token && loadTablesFromAPI(token)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTables.map((table) => (
              <div
                key={table.table_id || table.number}
                className="bg-white border border-gray-200 p-6 rounded-lg hover:border-blue-400 transition shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">
                      Bàn {table.number}
                    </h3>
                    <p className="text-gray-600 text-sm">{table.capacity} chỗ ngồi</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                      table.status
                    )}`}
                  >
                    {getStatusText(table.status)}
                  </span>
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => updateTableStatus(table.number, 'AVAILABLE')}
                    className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded disabled:opacity-50"
                    disabled={table.status === 'AVAILABLE'}
                  >
                    Trống
                  </button>
                  <button
                    onClick={() => updateTableStatus(table.number, 'OCCUPIED')}
                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50"
                    disabled={table.status === 'OCCUPIED'}
                  >
                    Có khách
                  </button>
                  <button
                    onClick={() => updateTableStatus(table.number, 'RESERVED')}
                    className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded disabled:opacity-50"
                    disabled={table.status === 'RESERVED'}
                  >
                    Đặt
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openQR(table)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-semibold"
                  >
                     QR Code
                  </button>
                  <button
                    onClick={() => openEdit(table)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(table.number)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredTables.length === 0 && (
            <div className="text-center text-gray-500 py-16">
              <div className="text-6xl mb-4">🍽️</div>
              <div className="text-xl">Không tìm thấy bàn nào</div>
            </div>
          )}
        </div>
      </div>

      {/* Modals remain the same as original code... */}
      {/* I'll keep them for completeness but they're unchanged */}
      
      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Thêm Bàn Mới</h2>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm mb-2">Số bàn</label>
                <input
                  type="number"
                  name="tableNumber"
                  required
                  min="1"
                  className="w-full bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Nhập số bàn"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Số chỗ ngồi</label>
                <input
                  type="number"
                  name="tableCapacity"
                  required
                  min="1"
                  defaultValue="4"
                  className="w-full bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Trạng thái</label>
                <select
                  name="tableStatus"
                  className="w-full bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="AVAILABLE">Trống</option>
                  <option value="OCCUPIED">Có khách</option>
                  <option value="RESERVED">Đã đặt</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold"
                >
                  Thêm
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && currentEditTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Sửa Bàn {currentEditTable.number}
            </h2>
            <form onSubmit={handleUpdateTable} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm mb-2">Số chỗ ngồi</label>
                <input
                  type="number"
                  name="capacity"
                  required
                  min="1"
                  defaultValue={currentEditTable.capacity}
                  className="w-full bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Trạng thái</label>
                <select
                  name="status"
                  defaultValue={currentEditTable.status}
                  className="w-full bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="AVAILABLE">Trống</option>
                  <option value="OCCUPIED">Có khách</option>
                  <option value="RESERVED">Đã đặt</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold"
                >
                  💾 Lưu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setCurrentEditTable(null);
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {showQRModal && currentQRTable && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-5">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              QR Code - Bàn {currentQRTable.number}
            </h2>
            <div className="bg-white p-6 rounded-lg mb-4 border border-gray-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
                  getOrderUrl(currentQRTable)
                )}`}
                alt={`QR Code Bàn ${currentQRTable.number}`}
                className="mx-auto w-64 h-64 md:w-72 md:h-72"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm mb-2">Link gọi món:</label>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 break-all text-blue-600 text-sm">
                {getOrderUrl(currentQRTable)}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadQR}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold"
              >
                💾 Tải xuống
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getOrderUrl(currentQRTable));
                  alert('✅ Đã copy link!');
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg"
              >
                📋 Copy link
              </button>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setCurrentQRTable(null);
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for toast animations */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        
        .animate-slide-out {
          animation: slideOut 0.3s ease-in;
        }
      `}</style>
    </div>
  );
}