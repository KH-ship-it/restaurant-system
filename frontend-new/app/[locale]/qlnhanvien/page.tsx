'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, X, RefreshCw, AlertCircle, CheckCircle, Key } from 'lucide-react';

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
  
  // Password reset state
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

  //  POSITION TO ROLE MAPPING - CRITICAL INFO
  const POSITION_ROLE_MAP: Record<string, { role: string; route: string; description: string }> = {
    'Quản lý': {
      role: 'ADMIN',
      route: '/thongke',
      description: 'Quyền quản lý, truy cập trang thống kê'
    },
    'Đầu bếp': {
      role: 'KITCHEN',
      route: '/order',
      description: 'Quyền bếp, xem và xử lý đơn hàng'
    },
    'Phục vụ': {
      role: 'STAFF',
      route: '/order', 
      description: 'Quyền nhân viên, xem và tạo đơn hàng'
    },
    'Thu ngân': {
      role: 'CASHIER',
      route: '/thungan',
      description: 'Quyền thu ngân, thanh toán đơn hàng'
    },
  };

  const positions = Object.keys(POSITION_ROLE_MAP);

  // Check token on mount
  useEffect(() => {
    checkToken();
    
    const handleFocus = () => {
      console.log('🔍 Window focused, checking token...');
      checkToken();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const checkToken = () => {
    const token = localStorage.getItem('access_token');
    console.log('🔑 Token check:', token ? 'Found' : 'Not found');
    setHasToken(!!token);
    
    if (token) {
      fetchEmployees();
    }
  };

  const fetchEmployees = async () => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      setError('Vui lòng đăng nhập để tiếp tục');
      setHasToken(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      console.log('📡 Fetching employees...');
      
      const response = await fetch(`${API_BASE}/api/employees`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📥 Response status:', response.status);

      if (response.status === 403) {
        setError('Bạn không có quyền truy cập. Chỉ OWNER/ADMIN mới có thể xem danh sách nhân viên.');
        setEmployees([]);
        return;
      }

      if (response.status === 401) {
        localStorage.removeItem('access_token');
        setHasToken(false);
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        setEmployees([]);
        return;
      }

      const result = await response.json();
      console.log('✅ Employees loaded:', result.data?.length || 0);
      
      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
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

    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setHasToken(false);
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
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
    if (!selectedEmployee) return;

    if (!formData.full_name) {
      alert('⚠️ Vui lòng nhập họ tên');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE}/api/employees/${selectedEmployee.employee_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone: formData.phone,
          position: formData.position,
        }),
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

  // ========================================
  // 🔑 NEW: PASSWORD RESET FUNCTION
  // ========================================
  const handleResetPassword = async () => {
    if (!selectedEmployee) return;

    // Validate
    if (!newPassword || newPassword.length < 6) {
      alert('⚠️ Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('⚠️ Mật khẩu xác nhận không khớp');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    if (!confirm(`🔑 Xác nhận đặt lại mật khẩu cho nhân viên "${selectedEmployee.full_name}"?`)) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE}/api/employees/${selectedEmployee.employee_id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          new_password: newPassword,
        }),
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
    if (!confirm(`⚠️ Xác nhận xóa nhân viên "${employee.full_name}"?\n\nHành động này không thể hoàn tác!`)) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/employees/${employee.employee_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
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
    setFormData({
      username: '',
      password: '',
      full_name: '',
      phone: '',
      position: 'Phục vụ',
    });
    setSelectedEmployee(null);
    setShowPasswordReset(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      username: employee.username,
      password: '',
      full_name: employee.full_name,
      phone: employee.phone || '',
      position: employee.position || 'Phục vụ',
    });
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
      case 'OWNER':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'ADMIN':
        return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
      case 'KITCHEN':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'CASHIER':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'STAFF':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6 lg:p-8">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-500 text-white rounded-xl p-4 shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[500px]">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium whitespace-pre-line">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <span className="text-4xl">👥</span> 
              <span>Quản Lý Nhân Viên</span>
            </h1>
            <p className="text-gray-600">
              {hasToken ? 'Quản lý toàn bộ nhân sự và phân quyền tự động' : 'Vui lòng đăng nhập để tiếp tục'}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={checkToken}
              className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all font-semibold flex items-center gap-2 shadow-lg"
              title="Kiểm tra token và tải lại"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Tải lại</span>
            </button>
            
            {hasToken && (
              <button
                onClick={openCreateModal}
                className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all font-semibold flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Thêm Nhân Viên
              </button>
            )}
          </div>
        </div>

        {/* Position-Role Mapping Info */}
        {hasToken && (
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
            <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span>🔐</span> Tự động phân quyền theo vị trí
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(POSITION_ROLE_MAP).map(([position, info]) => (
                <div key={position} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="font-semibold text-gray-800 mb-1">{position}</div>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeColor(info.role)}`}>
                        {info.role}
                      </span>
                    </div>
                    <div className="text-gray-600">→ {info.route}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Token Status */}
        <div className="mt-4 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${hasToken ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className={`text-sm font-medium ${hasToken ? 'text-green-600' : 'text-red-600'}`}>
            {hasToken ? '✓ Đã đăng nhập' : '✗ Chưa đăng nhập'}
          </span>
        </div>

        {/* Stats */}
        {hasToken && employees.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
              <div className="text-blue-600 text-sm font-semibold mb-1">Tổng số nhân viên</div>
              <div className="text-3xl font-bold text-blue-900">{employees.length}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
              <div className="text-green-600 text-sm font-semibold mb-1">Đang hoạt động</div>
              <div className="text-3xl font-bold text-green-900">
                {employees.filter(e => e.is_active).length}
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
              <div className="text-red-600 text-sm font-semibold mb-1">Tạm nghỉ</div>
              <div className="text-3xl font-bold text-red-900">
                {employees.filter(e => !e.is_active).length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error/Login Prompt */}
      {!hasToken && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-200 rounded-xl">
              <AlertCircle className="w-8 h-8 text-yellow-700" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-yellow-900 mb-2">
                ⚠️ Cần đăng nhập
              </h3>
              <p className="text-yellow-800 mb-4">
                Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.
              </p>
              <div className="flex gap-3">
                <a
                  href="/vi/login"
                  target="_blank"
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold inline-flex items-center gap-2"
                >
                  🔑 Mở trang đăng nhập
                </a>
                <button
                  onClick={checkToken}
                  className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Đã đăng nhập - Tải lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && hasToken && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">Có lỗi xảy ra</h3>
              <p className="text-red-700 mb-3">{error}</p>
              <button
                onClick={fetchEmployees}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="text-gray-700 text-xl font-semibold">Đang tải dữ liệu...</div>
        </div>
      )}

      {/* Table */}
      {hasToken && !isLoading && employees.length > 0 && (
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Tài khoản</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Họ tên</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Liên hệ</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Vị trí</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Quyền</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Trang</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Ngày vào</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {employees.map((employee) => {
                  const roleInfo = POSITION_ROLE_MAP[employee.position];
                  return (
                    <tr key={employee.employee_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="bg-gray-200 text-gray-700 font-mono text-sm px-2 py-1 rounded">
                          #{employee.employee_id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {employee.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-900 font-medium">{employee.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{employee.full_name}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {employee.phone || <span className="italic text-gray-400">Chưa cập nhật</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-semibold">{employee.position}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(employee.role)}`}>
                          {employee.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm font-mono">
                        {roleInfo?.route || '/order'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {new Date(employee.hire_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openViewModal(employee)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                            title="Xem"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(employee)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all"
                            title="Sửa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {hasToken && !isLoading && employees.length === 0 && !error && (
        <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
          <div className="text-6xl mb-4">👥</div>
          <div className="text-gray-700 text-xl font-semibold mb-2">Chưa có nhân viên nào</div>
          <div className="text-gray-500 mb-6">Nhấn "Thêm Nhân Viên" để bắt đầu</div>
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Thêm Nhân Viên Đầu Tiên
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {modalMode === 'create' && <><Plus className="w-6 h-6" /> Thêm Nhân Viên</>}
                {modalMode === 'edit' && <><Pencil className="w-6 h-6" /> Chỉnh Sửa</>}
                {modalMode === 'view' && <><Eye className="w-6 h-6" /> Chi Tiết</>}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalMode !== 'view' ? (
                <>
                  {/* CREATE MODE */}
                  {modalMode === 'create' && (
                    <>
                      <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2">
                          Tên đăng nhập <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500"
                          placeholder="vd: nguyenvana"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2">
                          Mật khẩu <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500"
                          placeholder="Tối thiểu 6 ký tự"
                        />
                      </div>
                    </>                    
                  )}

                  {/* EDIT MODE */}
                 
                  {/* COMMON FIELDS */}
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500"
                      placeholder="vd: Nguyễn Văn A"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">Số điện thoại</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500"
                      placeholder="vd: 0901234567"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">
                      Vị trí <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500"
                    >
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    {POSITION_ROLE_MAP[formData.position] && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-xs text-blue-900 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Quyền:</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeColor(POSITION_ROLE_MAP[formData.position].role)}`}>
                              {POSITION_ROLE_MAP[formData.position].role}
                            </span>
                          </div>
                          <div><span className="font-semibold">Trang:</span> {POSITION_ROLE_MAP[formData.position].route}</div>
                          <div className="text-gray-600">{POSITION_ROLE_MAP[formData.position].description}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // ========================================
                //  VIEW MODE WITH PASSWORD RESET
                // ========================================
                selectedEmployee && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-gray-600 text-sm mb-1">Tên đăng nhập</div>
                      <div className="text-gray-900 font-semibold">{selectedEmployee.username}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-gray-600 text-sm mb-1">Họ và tên</div>
                      <div className="text-gray-900 font-semibold">{selectedEmployee.full_name}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-gray-600 text-sm mb-1">Số điện thoại</div>
                      <div className="text-gray-900 font-semibold">
                        {selectedEmployee.phone || <span className="text-gray-400 italic">Chưa cập nhật</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-gray-600 text-sm mb-1">Vị trí</div>
                        <div className="text-gray-900 font-semibold">{selectedEmployee.position}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-gray-600 text-sm mb-1">Quyền hạn</div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(selectedEmployee.role)}`}>
                          {selectedEmployee.role}
                        </span>
                      </div>
                    </div>
                    {POSITION_ROLE_MAP[selectedEmployee.position] && (
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <div className="text-blue-900 text-sm space-y-1">
                          <div><span className="font-semibold">Trang truy cập:</span> {POSITION_ROLE_MAP[selectedEmployee.position].route}</div>
                          <div className="text-xs text-blue-700">{POSITION_ROLE_MAP[selectedEmployee.position].description}</div>
                        </div>
                      </div>
                    )}

                    {/* ========================================= */}
                    {/* 🔑 PASSWORD RESET SECTION */}
                    {/* ========================================= */}
                    <div className="border-t-2 border-gray-200 pt-4 mt-4">
                      {!showPasswordReset ? (
                        <button
                          onClick={() => setShowPasswordReset(true)}
                          className="w-full px-4 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-all font-semibold flex items-center justify-center gap-2"
                        >
                          <Key className="w-5 h-5" />
                          Đặt lại mật khẩu
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3">
                            <p className="text-sm text-yellow-900 font-semibold">
                              🔑 Đặt lại mật khẩu cho nhân viên
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Mật khẩu cũ đã được mã hóa và không thể xem. Vui lòng nhập mật khẩu mới.
                            </p>
                          </div>

                          <div>
                            <label className="block text-gray-700 text-sm font-semibold mb-2">
                              Mật khẩu mới <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-yellow-500"
                              placeholder="Tối thiểu 6 ký tự"
                              disabled={isSubmitting}
                            />
                          </div>

                          <div>
                            <label className="block text-gray-700 text-sm font-semibold mb-2">
                              Xác nhận mật khẩu <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:border-yellow-500"
                              placeholder="Nhập lại mật khẩu"
                              disabled={isSubmitting}
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setShowPasswordReset(false);
                                setNewPassword('');
                                setConfirmPassword('');
                              }}
                              disabled={isSubmitting}
                              className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold disabled:opacity-50"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={handleResetPassword}
                              disabled={isSubmitting}
                              className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isSubmitting ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Đang xử lý...
                                </>
                              ) : (
                                <>
                                  <Key className="w-4 h-4" />
                                  Xác nhận
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold disabled:opacity-50"
              >
                {modalMode === 'view' ? 'Đóng' : 'Hủy'}
              </button>
              {modalMode !== 'view' && (
                <button
                  onClick={modalMode === 'create' ? handleCreateEmployee : handleUpdateEmployee}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>{modalMode === 'create' ? 'Tạo mới' : 'Cập nhật'}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}