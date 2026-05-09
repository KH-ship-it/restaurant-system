'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus, Pencil, Trash2, Eye, X, RefreshCw, AlertCircle, CheckCircle, Key,
  BarChart3, Calendar, FileText, Users, ShoppingCart, User, Package, CreditCard, Menu as MenuIcon
} from 'lucide-react';

interface Employee {
  employee_id: number;
  user_id: number;
  username: string;
  full_name: string;
  phone: string;
  position: string;
  hire_date: string;
  role: string;
  is_active: boolean;
}

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const menuItems: MenuItem[] = [
  { label: 'Thống kê', path: '/vi/thongke', icon: BarChart3 },
  { label: 'Quản lý bàn', path: '/vi/qldatban', icon: Calendar },
  { label: 'Thực đơn', path: '/vi/qlmenu', icon: FileText },
  { label: 'Nhân viên', path: '/vi/qlnhanvien', icon: Users },
  { label: 'Đơn hàng', path: '/vi/order', icon: ShoppingCart },
  { label: 'Tài khoản', path: '/vi/qltk', icon: User },
  { label: 'Kho vận', path: '/vi/qlkho', icon: Package },
  { label: 'Thu ngân', path: '/vi/thungan', icon: CreditCard }
];

function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateTo = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#161b22] border border-[#30363d] text-white rounded-lg shadow-lg hover:bg-[#21262d] transition-colors"
      >
        {isMobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
      </button>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className={`fixed left-0 top-0 h-screen w-[280px] bg-[#161b22] border-r border-[#30363d] z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#238636] to-[#2ea043] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">🏪</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Restaurant</h2>
              <p className="text-xs text-[#8b949e]">Management System</p>
            </div>
          </div>
        </div>

        <nav className="py-4 overflow-y-auto h-[calc(100vh-120px)]">
          <div className="px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigateTo(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-[#238636] text-white shadow-lg shadow-[#238636]/20' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'}`}
                >
                  <Icon size={20} className={active ? 'text-white' : ''} />
                  <span className="font-medium text-sm">{item.label}</span>
                  {active && <div className="ml-auto w-2 h-2 rounded-full bg-white" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#30363d] bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">A</div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-sm truncate">Admin</div>
              <div className="text-[#8b949e] text-xs">Quản trị viên</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    position: 'Phục vụ',
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const POSITION_ROLE_MAP: Record<string, { role: string; route: string; description: string }> = {
    'Quản lý': { role: 'OWNER', route: '/thongke', description: 'Quyền quản lý cao nhất, truy cập trang thống kê' },
    'Đầu bếp': { role: 'KITCHEN', route: '/order', description: 'Quyền bếp, xem và xử lý đơn hàng' },
    'Phục vụ': { role: 'STAFF', route: '/order', description: 'Quyền nhân viên, xem và tạo đơn hàng' },
    'Thu ngân': { role: 'CASHIER', route: '/thungan', description: 'Quyền thu ngân, thanh toán đơn hàng' },
  };

  const positions = Object.keys(POSITION_ROLE_MAP);

  useEffect(() => {
    checkToken();
    const handleFocus = () => checkToken();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const checkToken = () => {
    // ✅ sessionStorage: chỉ đọc token của tab hiện tại
    const token = sessionStorage.getItem('access_token');
    console.log('🔑 Token check:', token ? 'Found' : 'Not found');
    setHasToken(!!token);
    if (token) fetchEmployees();
  };

  const fetchEmployees = async () => {
    // ✅ sessionStorage
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Vui lòng đăng nhập để tiếp tục');
      setHasToken(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`${API_BASE}/api/employees`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.status === 403) {
        setError('Bạn không có quyền truy cập. Chỉ OWNER/ADMIN mới có thể xem danh sách nhân viên.');
        setEmployees([]);
        return;
      }

      if (response.status === 401) {
        // ✅ sessionStorage: chỉ xóa session tab này
        sessionStorage.removeItem('access_token');
        setHasToken(false);
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        setEmployees([]);
        return;
      }

      const result = await response.json();
      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      setError(error.message || 'Không thể tải danh sách nhân viên');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleCreateEmployee = async () => {
    if (!formData.username || !formData.password || !formData.full_name) {
      alert('⚠️ Vui lòng điền đầy đủ thông tin bắt buộc (*)');
      return;
    }
    if (formData.password.length < 6) {
      alert('⚠️ Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    // ✅ sessionStorage
    const token = sessionStorage.getItem('access_token');
    if (!token) { alert('⚠️ Phiên đăng nhập đã hết hạn.'); setHasToken(false); return; }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const roleInfo = POSITION_ROLE_MAP[formData.position];
        showSuccess(`✅ ${result.message || 'Tạo nhân viên thành công!'}\n📋 Quyền: ${roleInfo.role} → Trang: ${roleInfo.route}`);
        setShowModal(false);
        resetForm();
        fetchEmployees();
      } else {
        alert('❌ ' + (result.message || 'Tạo nhân viên thất bại'));
      }
    } catch (error: any) {
      alert('❌ Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee || !formData.full_name) {
      alert('⚠️ Vui lòng nhập họ tên');
      return;
    }

    // ✅ sessionStorage
    const token = sessionStorage.getItem('access_token');
    if (!token) { alert('⚠️ Phiên đăng nhập đã hết hạn.'); return; }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE}/api/employees/${selectedEmployee.employee_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ full_name: formData.full_name, phone: formData.phone, position: formData.position }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const roleInfo = POSITION_ROLE_MAP[formData.position];
        showSuccess(`✅ ${result.message || 'Cập nhật thành công!'}\n📋 Quyền mới: ${roleInfo.role}`);
        setShowModal(false);
        resetForm();
        fetchEmployees();
      } else {
        alert('❌ ' + (result.message || 'Cập nhật thất bại'));
      }
    } catch (error: any) {
      alert('❌ Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee) return;
    if (!newPassword || newPassword.length < 6) { alert('⚠️ Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    if (newPassword !== confirmPassword) { alert('⚠️ Mật khẩu xác nhận không khớp'); return; }

    // ✅ sessionStorage
    const token = sessionStorage.getItem('access_token');
    if (!token) { alert('⚠️ Phiên đăng nhập đã hết hạn.'); return; }

    if (!confirm(`⚠️ Xác nhận đặt lại mật khẩu cho nhân viên "${selectedEmployee.full_name}"?`)) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE}/api/employees/${selectedEmployee.employee_id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        showSuccess(`✅ ${result.message || 'Đặt lại mật khẩu thành công!'}`);
        setShowPasswordReset(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert('❌ ' + (result.message || 'Đặt lại mật khẩu thất bại'));
      }
    } catch (error: any) {
      alert('❌ Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`⚠️ Xác nhận xóa nhân viên "${employee.full_name}"?\n\nHành động này không thể hoàn tác!`)) return;

    // ✅ sessionStorage
    const token = sessionStorage.getItem('access_token');
    if (!token) { alert('⚠️ Phiên đăng nhập đã hết hạn.'); return; }

    try {
      const response = await fetch(`${API_BASE}/api/employees/${employee.employee_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        showSuccess(`✅ ${result.message || 'Xóa nhân viên thành công!'}`);
        fetchEmployees();
      } else {
        alert('❌ ' + (result.message || 'Xóa thất bại'));
      }
    } catch (error: any) {
      alert('❌ Lỗi: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', full_name: '', phone: '', position: 'Phục vụ' });
    setSelectedEmployee(null);
    setShowPasswordReset(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openCreateModal = () => { resetForm(); setModalMode('create'); setShowModal(true); };
  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({ username: employee.username, password: '', full_name: employee.full_name, phone: employee.phone || '', position: employee.position || 'Phục vụ' });
    setModalMode('edit');
    setShowModal(true);
  };
  const openViewModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('view');
    setShowPasswordReset(false);
    setNewPassword('');
    setConfirmPassword('');
    setShowModal(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'ADMIN': return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
      case 'KITCHEN': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'CASHIER': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'STAFF': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 lg:ml-[280px] p-4 sm:p-6 lg:p-8">
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 animate-slide-in">
            <div className="bg-green-500 text-white rounded-xl p-4 shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[500px]">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium whitespace-pre-line">{successMessage}</span>
            </div>
          </div>
        )}

        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl p-4 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <span className="text-3xl md:text-4xl">👥</span>
                <span>Quản Lý Nhân Viên</span>
              </h1>
              <p className="text-[#8b949e] text-sm md:text-base">
                {hasToken ? 'Quản lý toàn bộ nhân sự và phân quyền tự động' : 'Vui lòng đăng nhập để tiếp tục'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={checkToken} className="px-3 md:px-4 py-2 md:py-3 bg-[#238636] hover:bg-[#2ea043] text-white rounded-xl transition-all font-semibold flex items-center gap-2 shadow-lg text-sm md:text-base">
                <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Tải lại</span>
              </button>
              {hasToken && (
                <button onClick={openCreateModal} className="px-4 md:px-6 py-2 md:py-3 bg-[#238636] hover:bg-[#2ea043] text-white rounded-xl transition-all font-semibold flex items-center gap-2 shadow-lg text-sm md:text-base">
                  <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Thêm</span>
                  <span className="sm:hidden">NV</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${hasToken ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className={`text-xs md:text-sm font-medium ${hasToken ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              {hasToken ? '✓ Đã đăng nhập' : '✗ Chưa đăng nhập'}
            </span>
          </div>

          {hasToken && employees.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-6">
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                <div className="text-[#58a6ff] text-xs md:text-sm font-semibold mb-1">Tổng số nhân viên</div>
                <div className="text-2xl md:text-3xl font-bold text-white">{employees.length}</div>
              </div>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                <div className="text-[#3fb950] text-xs md:text-sm font-semibold mb-1">Đang hoạt động</div>
                <div className="text-2xl md:text-3xl font-bold text-white">{employees.filter(e => e.is_active).length}</div>
              </div>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                <div className="text-[#f85149] text-xs md:text-sm font-semibold mb-1">Tạm nghỉ</div>
                <div className="text-2xl md:text-3xl font-bold text-white">{employees.filter(e => !e.is_active).length}</div>
              </div>
            </div>
          )}
        </div>

        {!hasToken && (
          <div className="bg-[#161b22] border-2 border-[#f2c94c] rounded-2xl p-4 md:p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-2 md:p-3 bg-[#f2c94c]/20 rounded-xl">
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-[#f2c94c]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">Cần đăng nhập</h3>
                <p className="text-[#8b949e] mb-4 text-sm md:text-base">Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a href="/vi/login" target="_blank" className="px-4 md:px-6 py-2 md:py-2.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-all font-semibold inline-flex items-center justify-center gap-2 text-sm md:text-base">
                    Mở trang đăng nhập
                  </a>
                  <button onClick={checkToken} className="px-4 md:px-6 py-2 md:py-2.5 bg-[#58a6ff] hover:bg-[#79c0ff] text-white rounded-lg transition-all font-semibold inline-flex items-center justify-center gap-2 text-sm md:text-base">
                    <RefreshCw className="w-4 h-4" />
                    Đã đăng nhập - Tải lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && hasToken && (
          <div className="bg-[#161b22] border-2 border-[#f85149] rounded-2xl p-4 md:p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-[#f85149] flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-white mb-2">Có lỗi xảy ra</h3>
                <p className="text-[#f85149] mb-3 text-sm md:text-base">{error}</p>
                <button onClick={fetchEmployees} className="px-4 py-2 bg-[#f85149] hover:bg-[#da3633] text-white rounded-lg transition-all text-sm md:text-base">
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-xl p-8 md:p-12 text-center">
            <div className="text-[#8b949e] text-lg md:text-xl font-semibold">Đang tải dữ liệu...</div>
          </div>
        )}

        {hasToken && !isLoading && employees.length > 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d1117] border-b-2 border-[#30363d]">
                  <tr>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase">ID</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase">Tài khoản</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase">Họ tên</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase hidden md:table-cell">Liên hệ</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase">Vị trí</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase hidden lg:table-cell">Quyền</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-[#8b949e] uppercase hidden lg:table-cell">Ngày vào</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center text-xs font-bold text-[#8b949e] uppercase">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]">
                  {employees.map((employee) => (
                    <tr key={employee.employee_id} className="hover:bg-[#21262d] transition-colors">
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <span className="bg-[#21262d] text-[#8b949e] font-mono text-xs md:text-sm px-2 py-1 rounded">#{employee.employee_id}</span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-[#58a6ff] to-[#a371f7] rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                            {employee.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-white font-medium text-sm md:text-base">{employee.username}</span>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-white font-medium text-sm md:text-base">{employee.full_name}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-[#8b949e] text-xs md:text-sm hidden md:table-cell">
                        {employee.phone || <span className="italic text-[#8b949e]">Chưa cập nhật</span>}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-white font-semibold text-sm md:text-base">{employee.position}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                        <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(employee.role)}`}>{employee.role}</span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-[#8b949e] text-xs md:text-sm hidden lg:table-cell">
                        {new Date(employee.hire_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <div className="flex justify-center gap-1 md:gap-2">
                          <button onClick={() => openViewModal(employee)} className="p-1.5 md:p-2 text-[#58a6ff] hover:bg-[#21262d] rounded-lg transition-all" title="Xem"><Eye className="w-3 h-3 md:w-4 md:h-4" /></button>
                          <button onClick={() => openEditModal(employee)} className="p-1.5 md:p-2 text-[#f2c94c] hover:bg-[#21262d] rounded-lg transition-all" title="Sửa"><Pencil className="w-3 h-3 md:w-4 md:h-4" /></button>
                          <button onClick={() => handleDeleteEmployee(employee)} className="p-1.5 md:p-2 text-[#f85149] hover:bg-[#21262d] rounded-lg transition-all" title="Xóa"><Trash2 className="w-3 h-3 md:w-4 md:h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasToken && !isLoading && employees.length === 0 && !error && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-xl p-8 md:p-16 text-center">
            <div className="text-5xl md:text-6xl mb-4">👥</div>
            <div className="text-white text-lg md:text-xl font-semibold mb-2">Chưa có nhân viên nào</div>
            <div className="text-[#8b949e] mb-6 text-sm md:text-base">Nhấn "Thêm Nhân Viên" để bắt đầu</div>
            <button onClick={openCreateModal} className="px-4 md:px-6 py-2 md:py-3 bg-[#238636] hover:bg-[#2ea043] text-white rounded-xl transition-all font-semibold inline-flex items-center gap-2 text-sm md:text-base">
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              Thêm Nhân Viên Đầu Tiên
            </button>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-4 md:p-6 border-b border-[#30363d] sticky top-0 bg-[#161b22] z-10">
                <h2 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2">
                  {modalMode === 'create' && <><Plus className="w-5 h-5 md:w-6 md:h-6" /> Thêm Nhân Viên</>}
                  {modalMode === 'edit' && <><Pencil className="w-5 h-5 md:w-6 md:h-6" /> Chỉnh Sửa</>}
                  {modalMode === 'view' && <><Eye className="w-5 h-5 md:w-6 md:h-6" /> Chi Tiết</>}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-[#8b949e] hover:text-white"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
              </div>

              <div className="p-4 md:p-6 space-y-4">
                {modalMode !== 'view' ? (
                  <>
                    {modalMode === 'create' && (
                      <>
                        <div>
                          <label className="block text-[#8b949e] text-sm font-semibold mb-2">Tên đăng nhập <span className="text-[#f85149]">*</span></label>
                          <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#58a6ff] text-sm md:text-base" placeholder="vd: nguyenvana" />
                        </div>
                        <div>
                          <label className="block text-[#8b949e] text-sm font-semibold mb-2">Mật khẩu <span className="text-[#f85149]">*</span></label>
                          <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#58a6ff] text-sm md:text-base" placeholder="Tối thiểu 6 ký tự" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-[#8b949e] text-sm font-semibold mb-2">Họ và tên <span className="text-[#f85149]">*</span></label>
                      <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#58a6ff] text-sm md:text-base" placeholder="vd: Nguyễn Văn A" />
                    </div>
                    <div>
                      <label className="block text-[#8b949e] text-sm font-semibold mb-2">Số điện thoại</label>
                      <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#58a6ff] text-sm md:text-base" placeholder="vd: 0901234567" />
                    </div>
                    <div>
                      <label className="block text-[#8b949e] text-sm font-semibold mb-2">Vị trí <span className="text-[#f85149]">*</span></label>
                      <select value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#58a6ff] text-sm md:text-base">
                        {positions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                      </select>
                      {POSITION_ROLE_MAP[formData.position] && (
                        <div className="mt-2 p-3 bg-[#0d1117] border border-[#30363d] rounded-lg">
                          <div className="text-xs text-[#8b949e] space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Quyền:</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeColor(POSITION_ROLE_MAP[formData.position].role)}`}>{POSITION_ROLE_MAP[formData.position].role}</span>
                            </div>
                            <div><span className="font-semibold">Trang:</span> {POSITION_ROLE_MAP[formData.position].route}</div>
                            <div>{POSITION_ROLE_MAP[formData.position].description}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  selectedEmployee && (
                    <div className="space-y-3">
                      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                        <div className="text-[#8b949e] text-xs md:text-sm mb-1">Tên đăng nhập</div>
                        <div className="text-white font-semibold text-sm md:text-base">{selectedEmployee.username}</div>
                      </div>
                      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                        <div className="text-[#8b949e] text-xs md:text-sm mb-1">Họ và tên</div>
                        <div className="text-white font-semibold text-sm md:text-base">{selectedEmployee.full_name}</div>
                      </div>
                      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                        <div className="text-[#8b949e] text-xs md:text-sm mb-1">Số điện thoại</div>
                        <div className="text-white font-semibold text-sm md:text-base">{selectedEmployee.phone || <span className="text-[#8b949e] italic">Chưa cập nhật</span>}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                          <div className="text-[#8b949e] text-xs md:text-sm mb-1">Vị trí</div>
                          <div className="text-white font-semibold text-sm md:text-base">{selectedEmployee.position}</div>
                        </div>
                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                          <div className="text-[#8b949e] text-xs md:text-sm mb-1">Quyền hạn</div>
                          <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(selectedEmployee.role)}`}>{selectedEmployee.role}</span>
                        </div>
                      </div>
                      {POSITION_ROLE_MAP[selectedEmployee.position] && (
                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 md:p-4">
                          <div className="text-[#8b949e] text-xs md:text-sm space-y-1">
                            <div><span className="font-semibold">Trang truy cập:</span> {POSITION_ROLE_MAP[selectedEmployee.position].route}</div>
                            <div className="text-xs">{POSITION_ROLE_MAP[selectedEmployee.position].description}</div>
                          </div>
                        </div>
                      )}
                      <div className="border-t-2 border-[#30363d] pt-4 mt-4">
                        {!showPasswordReset ? (
                          <button onClick={() => setShowPasswordReset(true)} className="w-full px-4 py-2 md:py-3 bg-[#f2c94c] hover:bg-[#e5c03c] text-[#0d1117] rounded-xl transition-all font-semibold flex items-center justify-center gap-2 text-sm md:text-base">
                            <Key className="w-4 h-4 md:w-5 md:h-5" />
                            Đặt lại mật khẩu
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-[#f2c94c]/10 border-2 border-[#f2c94c]/30 rounded-xl p-3">
                              <p className="text-xs md:text-sm text-[#f2c94c] font-semibold">🔑 Đặt lại mật khẩu cho nhân viên</p>
                              <p className="text-xs text-[#8b949e] mt-1">Mật khẩu cũ đã được mã hóa và không thể xem. Vui lòng nhập mật khẩu mới.</p>
                            </div>
                            <div>
                              <label className="block text-[#8b949e] text-sm font-semibold mb-2">Mật khẩu mới <span className="text-[#f85149]">*</span></label>
                              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#f2c94c] text-sm md:text-base" placeholder="Tối thiểu 6 ký tự" disabled={isSubmitting} />
                            </div>
                            <div>
                              <label className="block text-[#8b949e] text-sm font-semibold mb-2">Xác nhận mật khẩu <span className="text-[#f85149]">*</span></label>
                              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border-2 border-[#30363d] bg-[#0d1117] text-white px-3 md:px-4 py-2 md:py-3 rounded-xl focus:outline-none focus:border-[#f2c94c] text-sm md:text-base" placeholder="Nhập lại mật khẩu" disabled={isSubmitting} />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setShowPasswordReset(false); setNewPassword(''); setConfirmPassword(''); }} disabled={isSubmitting} className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] rounded-xl transition-all font-semibold disabled:opacity-50 text-sm md:text-base">Hủy</button>
                              <button onClick={handleResetPassword} disabled={isSubmitting} className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-[#f2c94c] hover:bg-[#e5c03c] text-[#0d1117] rounded-xl transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base">
                                {isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" />Đang xử lý...</> : <><Key className="w-4 h-4" />Xác nhận</>}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="flex justify-end gap-3 p-4 md:p-6 border-t border-[#30363d] sticky bottom-0 bg-[#161b22]">
                <button onClick={() => setShowModal(false)} disabled={isSubmitting} className="px-4 md:px-6 py-2 md:py-2.5 bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] rounded-xl transition-all font-semibold disabled:opacity-50 text-sm md:text-base">
                  {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                </button>
                {modalMode !== 'view' && (
                  <button onClick={modalMode === 'create' ? handleCreateEmployee : handleUpdateEmployee} disabled={isSubmitting} className="px-4 md:px-6 py-2 md:py-2.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded-xl transition-all font-semibold disabled:opacity-50 flex items-center gap-2 text-sm md:text-base">
                    {isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" />Đang xử lý...</> : <>{modalMode === 'create' ? 'Tạo mới' : 'Cập nhật'}</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}