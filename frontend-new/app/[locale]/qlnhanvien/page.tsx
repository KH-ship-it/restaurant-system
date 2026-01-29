'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, X } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    position: 'Phục vụ',
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('access_token');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'Mozilla/5.0',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `HTTP ${response.status}`;

        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } else {
          errorMessage = `Lỗi kết nối server (status ${response.status})`;
        }

        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối.');
      }
      throw error;
    }
  };

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const result = await fetchWithAuth(`${API_BASE}/api/employees`);
      
      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        setError('Không có dữ liệu nhân viên');
      }
    } catch (error: any) {
      setError(error.message || 'Không thể tải danh sách nhân viên');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleCreateEmployee = async () => {
    try {
      if (!formData.username || !formData.password || !formData.full_name) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
      }

      const result = await fetchWithAuth(`${API_BASE}/api/employees`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (result.success) {
        alert('✅ ' + result.message);
        setShowModal(false);
        resetForm();
        fetchEmployees();
      } else {
        alert('❌ ' + (result.message || 'Tạo nhân viên thất bại'));
      }
    } catch (error: any) {
      alert('❌ Lỗi: ' + error.message);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      const updateData = {
        full_name: formData.full_name,
        phone: formData.phone,
        position: formData.position,
      };

      const result = await fetchWithAuth(
        `${API_BASE}/api/employees/${selectedEmployee.employee_id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
        }
      );

      if (result.success) {
        alert('✅ ' + result.message);
        setShowModal(false);
        resetForm();
        fetchEmployees();
      } else {
        alert('❌ ' + (result.message || 'Cập nhật thất bại'));
      }
    } catch (error: any) {
      alert('❌ Lỗi: ' + error.message);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Xác nhận xóa nhân viên ${employee.full_name}?`)) return;

    try {
      const result = await fetchWithAuth(
        `${API_BASE}/api/employees/${employee.employee_id}`,
        {
          method: 'DELETE',
        }
      );

      if (result.success) {
        alert('✅ ' + result.message);
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
    setShowModal(true);
  };

  const positions = [
    'Quản lý',
    'Đầu bếp',
    'Phó bếp',
    'Phục vụ',
    'Thu ngân',
    'Bảo vệ',
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <div className="text-white text-xl">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <span>👥</span> Quản Lý Nhân Viên
            </h1>
            <p className="text-[#8b949e] text-sm">
              Hệ thống quản lý nhân sự nhà hàng với phân quyền tự động
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-[#238636] text-white rounded-lg hover:bg-[#2ea043] transition font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Thêm Nhân Viên
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-[#0d1117] rounded-lg p-4 border border-[#30363d]">
            <div className="text-[#8b949e] text-sm mb-1">Tổng số nhân viên</div>
            <div className="text-2xl font-bold text-white">{employees.length}</div>
          </div>
          <div className="bg-[#0d1117] rounded-lg p-4 border border-[#30363d]">
            <div className="text-[#8b949e] text-sm mb-1">Đang hoạt động</div>
            <div className="text-2xl font-bold text-[#3fb950]">
              {employees.filter(e => e.is_active).length}
            </div>
          </div>
          <div className="bg-[#0d1117] rounded-lg p-4 border border-[#30363d]">
            <div className="text-[#8b949e] text-sm mb-1">Ngừng hoạt động</div>
            <div className="text-2xl font-bold text-[#f85149]">
              {employees.filter(e => !e.is_active).length}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display - Minimized */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={fetchEmployees}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
            >
              🔄 Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0d1117] border-b border-[#30363d]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">Họ Tên</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">Số Điện Thoại</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">Vị Trí</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b949e] uppercase">Ngày Vào Làm</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#8b949e] uppercase">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {employees.map((employee) => (
                <tr key={employee.employee_id} className="hover:bg-[#0d1117] transition">
                  <td className="px-4 py-3 text-white font-mono text-sm">{employee.employee_id}</td>
                  <td className="px-4 py-3 text-[#58a6ff] font-medium">{employee.username}</td>
                  <td className="px-4 py-3 text-white">{employee.full_name}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{employee.phone || '-'}</td>
                  <td className="px-4 py-3 text-white">{employee.position}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      employee.role === 'OWNER' ? 'bg-purple-500/20 text-purple-400' :
                      employee.role === 'KITCHEN' ? 'bg-orange-500/20 text-orange-400' :
                      employee.role === 'CASHIER' ? 'bg-green-500/20 text-green-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8b949e] text-sm">
                    {new Date(employee.hire_date).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openViewModal(employee)}
                        className="p-2 text-[#58a6ff] hover:bg-[#58a6ff]/10 rounded transition"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(employee)}
                        className="p-2 text-[#8b949e] hover:bg-[#8b949e]/10 rounded transition"
                        title="Sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee)}
                        className="p-2 text-[#f85149] hover:bg-[#f85149]/10 rounded transition"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {employees.length === 0 && !error && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">👥</div>
              <div className="text-[#8b949e] text-lg mb-2">Chưa có nhân viên nào</div>
              <div className="text-[#8b949e] text-sm">Nhấn "Thêm Nhân Viên" để bắt đầu</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] rounded-lg border border-[#30363d] w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-[#30363d]">
              <h2 className="text-xl font-bold text-white">
                {modalMode === 'create' && '➕ Thêm Nhân Viên Mới'}
                {modalMode === 'edit' && '✏️ Sửa Thông Tin Nhân Viên'}
                {modalMode === 'view' && '👁️ Chi Tiết Nhân Viên'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#8b949e] hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalMode !== 'view' ? (
                <>
                  {modalMode === 'create' && (
                    <>
                      <div>
                        <label className="block text-[#8b949e] text-sm mb-2">Username *</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded focus:outline-none focus:border-[#58a6ff]"
                          placeholder="username123"
                        />
                      </div>

                      <div>
                        <label className="block text-[#8b949e] text-sm mb-2">Password *</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded focus:outline-none focus:border-[#58a6ff]"
                          placeholder="••••••••"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[#8b949e] text-sm mb-2">Họ và Tên *</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded focus:outline-none focus:border-[#58a6ff]"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8b949e] text-sm mb-2">Số Điện Thoại</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded focus:outline-none focus:border-[#58a6ff]"
                      placeholder="0901234567"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8b949e] text-sm mb-2">Vị Trí *</label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded focus:outline-none focus:border-[#58a6ff]"
                    >
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                selectedEmployee && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[#8b949e] text-sm">Username:</div>
                      <div className="text-white font-medium">{selectedEmployee.username}</div>
                    </div>
                    <div>
                      <div className="text-[#8b949e] text-sm">Họ Tên:</div>
                      <div className="text-white font-medium">{selectedEmployee.full_name}</div>
                    </div>
                    <div>
                      <div className="text-[#8b949e] text-sm">Số Điện Thoại:</div>
                      <div className="text-white font-medium">{selectedEmployee.phone || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[#8b949e] text-sm">Vị Trí:</div>
                      <div className="text-white font-medium">{selectedEmployee.position}</div>
                    </div>
                    <div>
                      <div className="text-[#8b949e] text-sm">Role:</div>
                      <div className="text-white font-medium">{selectedEmployee.role}</div>
                    </div>
                    <div>
                      <div className="text-[#8b949e] text-sm">Ngày Vào Làm:</div>
                      <div className="text-white font-medium">
                        {new Date(selectedEmployee.hire_date).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-[#30363d]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#0d1117] border border-[#30363d] text-white rounded hover:bg-[#21262d] transition"
              >
                {modalMode === 'view' ? 'Đóng' : 'Hủy'}
              </button>
              {modalMode !== 'view' && (
                <button
                  onClick={modalMode === 'create' ? handleCreateEmployee : handleUpdateEmployee}
                  className="px-4 py-2 bg-[#238636] text-white rounded hover:bg-[#2ea043] transition"
                >
                  {modalMode === 'create' ? 'Tạo Mới' : 'Cập Nhật'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}