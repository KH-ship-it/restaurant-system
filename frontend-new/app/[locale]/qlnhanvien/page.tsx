'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Users, ChefHat, DollarSign, UserCog } from 'lucide-react';

interface Employee {
  employee_id: number;
  user_id: number;
  full_name: string;
  phone: string;
  position: string;
  hire_date: string;
  username?: string;
  is_active?: boolean;
  role_name?: string;
}

interface FormData {
  username: string;
  password: string;
  full_name: string;
  phone: string;
  position: string;
  hire_date: string;
}

// Role mapping configuration
const POSITION_ROLE_MAP: Record<string, { role: string; icon: any; color: string; description: string }> = {
  'Quản lý': { 
    role: 'OWNER', 
    icon: Shield, 
    color: 'text-purple-400 bg-purple-500/15',
    description: 'Toàn quyền quản lý hệ thống' 
  },
  'Đầu bếp': { 
    role: 'KITCHEN', 
    icon: ChefHat, 
    color: 'text-orange-400 bg-orange-500/15',
    description: 'Quản lý bếp và chế biến món ăn' 
  },
  'Phục vụ': { 
    role: 'EMPLOYEE', 
    icon: Users, 
    color: 'text-blue-400 bg-blue-500/15',
    description: 'Phục vụ khách hàng, nhận order' 
  },
  'Thu ngân': { 
    role: 'CASHIER', 
    icon: DollarSign, 
    color: 'text-green-400 bg-green-500/15',
    description: 'Xử lý thanh toán và thu ngân' 
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0]
  });

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/api/employees`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setEmployees(result.data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.phone || !formData.position || !formData.hire_date) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        alert('Phiên đăng nhập đã hết hạn');
        return;
      }

      if (editingEmployee) {
        const response = await fetch(`${API_URL}/api/employees/${editingEmployee.employee_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: formData.full_name,
            phone: formData.phone,
            position: formData.position
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to update employee');
        }

        const result = await response.json();
        if (result.success) {
          alert('✅ Cập nhật nhân viên thành công!');
          await fetchEmployees();
        }
      } else {
        if (!formData.username || !formData.password) {
          alert('Vui lòng nhập Username và Password!');
          return;
        }

        if (formData.password.length < 6) {
          alert('Mật khẩu phải có ít nhất 6 ký tự!');
          return;
        }

        // Get role from position mapping
        const roleInfo = POSITION_ROLE_MAP[formData.position];
        const role = roleInfo?.role || 'EMPLOYEE';

        const response = await fetch(`${API_URL}/api/employees`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            full_name: formData.full_name,
            phone: formData.phone,
            position: formData.position,
            hire_date: formData.hire_date,
            role: role // Send role to backend
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to create employee');
        }

        const result = await response.json();
        if (result.success) {
          alert(`✅ Thêm nhân viên thành công!\n🔑 Role: ${role}\n👤 Username: ${formData.username}`);
          await fetchEmployees();
        }
      }

      resetForm();
    } catch (err) {
      console.error('Error saving employee:', err);
      alert('❌ ' + (err instanceof Error ? err.message : 'Không thể lưu nhân viên'));
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      username: employee.username || '',
      password: '',
      full_name: employee.full_name,
      phone: employee.phone,
      position: employee.position,
      hire_date: employee.hire_date
    });
    setShowModal(true);
  };

 // Thay thế hàm handleDelete trong page.tsx

const handleDelete = async (employee_id: number, employee_name: string, username: string) => {
  // Confirm dialog với thông tin chi tiết
  const confirmMessage = `⚠️ XÁC NHẬN XÓA NHÂN VIÊN

👤 Nhân viên: ${employee_name}
🔑 Username: ${username}
🆔 ID: #${employee_id}

❗ Lưu ý:
• Tài khoản user sẽ bị vô hiệu hóa (soft delete)
• Nhân viên sẽ không thể đăng nhập nữa
• Dữ liệu sẽ vẫn được lưu trong hệ thống

Bạn có chắc chắn muốn xóa?`;

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const token = getAuthToken();
    if (!token) {
      alert('⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      window.location.href = '/login';
      return;
    }

    console.log(`🗑️ Deleting employee_id: ${employee_id}`);

    const response = await fetch(`${API_URL}/api/employees/${employee_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('Delete response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('Delete error:', error);
      
      if (response.status === 403) {
        alert('❌ Bạn không có quyền xóa nhân viên.\n\nChỉ chủ nhà hàng (OWNER) và quản lý (admin) mới có quyền này.');
      } else if (response.status === 400) {
        alert(`❌ ${error.detail || 'Không thể xóa nhân viên này'}`);
      } else if (response.status === 404) {
        alert('❌ Không tìm thấy nhân viên này trong hệ thống.');
      } else {
        throw new Error(error.detail || 'Failed to delete employee');
      }
      return;
    }

    const result = await response.json();
    console.log('Delete result:', result);

    if (result.success) {
      alert(`✅ Đã xóa nhân viên thành công!

👤 ${employee_name} (${username})

Nhân viên này sẽ không thể đăng nhập nữa.`);
      
      // Refresh danh sách
      await fetchEmployees();
    } else {
      alert('❌ Xóa nhân viên thất bại: ' + (result.message || 'Unknown error'));
    }

  } catch (err) {
    console.error('Error deleting employee:', err);
    alert('❌ Lỗi khi xóa nhân viên:\n\n' + (err instanceof Error ? err.message : 'Không thể kết nối đến server'));
  }
};

// Update button trong table để truyền đầy đủ thông tin
// Trong phần render table, sửa button Xóa:


  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      full_name: '',
      phone: '',
      position: '',
      hire_date: new Date().toISOString().split('T')[0]
    });
    setEditingEmployee(null);
    setShowModal(false);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.phone.includes(searchTerm) ||
    (emp.username && emp.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const positions = Object.keys(POSITION_ROLE_MAP);

  // Get role info for selected position
  const selectedRoleInfo = formData.position ? POSITION_ROLE_MAP[formData.position] : null;
  const RoleIcon = selectedRoleInfo?.icon;

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white font-bold text-lg mb-5">
          H
        </div>
        <div onClick={() => navigateTo('/vi/qldatban')} className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" title="Quản lí bàn ăn">📋</div>
        <div onClick={() => navigateTo('/vi/qlmenu')} className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" title="Quản lí thực đơn">🍽️</div>
        <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all bg-[#238636] text-white" title="Quản lí nhân viên">👥</div>
         <div 
          onClick={() => navigateTo('/vi/qlkho')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí kho"
        >
          📦
        </div>
        <div onClick={() => navigateTo('/thungan')} className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" title="Thu ngân">💰</div>
      </div>

      {/* Main Content */}
      <div className="ml-[60px]">
        <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4">
          <div>
            <h1 className="text-2xl text-white mb-1">👥 Quản Lý Nhân Viên</h1>
            <p className="text-sm text-[#8b949e]">Hệ thống quản lý nhân sự nhà hàng với phân quyền tự động</p>
          </div>
        </div>

        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Stats */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 text-sm text-[#8b949e]">
                <span>📊 Tổng số nhân viên: <strong className="text-[#58a6ff]">{employees.length}</strong></span>
                {loading && <span className="ml-4 text-yellow-400">⏳ Đang tải...</span>}
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                ⚠️ Lỗi: {error}
              </div>
            )}

            {/* Search and Add */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="🔍 Tìm kiếm theo tên, vị trí, số điện thoại, username..."
                    className="w-full px-4 py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={fetchEmployees} className="bg-[#0d1117] border border-[#30363d] hover:bg-[#21262d] text-[#c9d1d9] px-6 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium whitespace-nowrap" disabled={loading}>
                    🔄 Làm mới
                  </button>
                  <button onClick={() => setShowModal(true)} className="bg-[#238636] hover:bg-[#2ea043] text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium whitespace-nowrap">
                    ➕ Thêm Nhân Viên
                  </button>
                </div>
              </div>
            </div>

            {/* Employee Table */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0d1117]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">Username</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">Họ Tên</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">Số Điện Thoại</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">Vị Trí</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[#8b949e] uppercase">Ngày Vào Làm</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-[#8b949e] uppercase">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]">
                    {loading && employees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-[#8b949e]">
                          <div className="text-6xl mb-3">⏳</div>
                          <p className="text-lg">Đang tải dữ liệu...</p>
                        </td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-[#8b949e]">
                          <div className="text-6xl mb-3">👤</div>
                          <p className="text-lg">Không tìm thấy nhân viên nào</p>
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((employee) => {
                        const roleInfo = POSITION_ROLE_MAP[employee.position];
                        return (
                          <tr key={employee.employee_id} className="hover:bg-[#21262d] transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono text-sm text-[#8b949e]">#{employee.employee_id}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-medium text-[#58a6ff]">👤 {employee.username}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#238636] to-[#2ea043] rounded-full flex items-center justify-center text-white font-bold text-lg">
                                  {employee.full_name.charAt(0)}
                                </div>
                                <span className="font-medium text-white">{employee.full_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[#c9d1d9]">📞 {employee.phone}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleInfo?.color || 'bg-gray-500/15 text-gray-400'}`}>
                                💼 {employee.position}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                                🔑 {employee.role_name || roleInfo?.role || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[#8b949e]">📅 {new Date(employee.hire_date).toLocaleDateString('vi-VN')}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEdit(employee)} className="px-3 py-1 text-sm text-[#58a6ff] hover:bg-[#21262d] rounded-lg transition-colors font-medium">
                                  ✏️ Sửa
                                </button>
                                <button onClick={() => handleDelete(employee.employee_id,employee.full_name,employee.username||'N/A')} className="px-3 py-1 text-sm text-[#f85149] hover:bg-[#21262d] rounded-lg transition-colors font-medium">
                                  🗑️ Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[1000]">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0d1117] border-b border-[#30363d] px-6 py-4 rounded-t-xl">
              <h2 className="text-2xl font-bold text-white">
                {editingEmployee ? '✏️ Cập Nhật Nhân Viên' : '➕ Thêm Nhân Viên Mới'}
              </h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!editingEmployee && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
                        Username * <span className="text-xs text-[#8b949e]">(Tên đăng nhập)</span>
                      </label>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                        placeholder="vd: nhanvien01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
                        Password * <span className="text-xs text-[#8b949e]">(Tối thiểu 6 ký tự)</span>
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                        placeholder="••••••"
                      />
                    </div>
                  </>
                )}

                {editingEmployee && (
                  <div className="md:col-span-2">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-400">
                        🔒 <strong>Username:</strong> {formData.username} (không thể thay đổi)
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
                    Họ và Tên * <span className="text-xs text-[#8b949e]">(Tối đa 150 ký tự)</span>
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    maxLength={150}
                    className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
                    Số Điện Thoại * <span className="text-xs text-[#8b949e]">(Tối đa 20 ký tự)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    maxLength={20}
                    className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                    placeholder="0901234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
                    Vị Trí * <span className="text-xs text-[#8b949e]">(Tự động phân quyền)</span>
                  </label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                  >
                    <option value="">Chọn vị trí</option>
                    {positions.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
                    Ngày Vào Làm *
                  </label>
                  <input
                    type="date"
                    name="hire_date"
                    value={formData.hire_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              {/* Role Preview - Show when position is selected */}
              {selectedRoleInfo && !editingEmployee && (
                <div className="mt-6 p-5 bg-gradient-to-r from-[#238636]/10 to-[#2ea043]/10 border border-[#238636]/30 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${selectedRoleInfo.color}`}>
                      {RoleIcon && <RoleIcon className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-[#3fb950] mb-2 flex items-center gap-2">
                        🔑 Phân quyền tự động
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-[#8b949e]">Vị trí:</span>
                          <span className="font-semibold text-white">{formData.position}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#8b949e]">Role hệ thống:</span>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {selectedRoleInfo.role}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 mt-3">
                          <span className="text-[#8b949e]">Quyền hạn:</span>
                          <span className="text-[#c9d1d9]">{selectedRoleInfo.description}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Information Box */}
              <div className="mt-6 p-4 bg-[#238636]/10 border border-[#238636]/30 rounded-lg">
                <h3 className="text-sm font-semibold text-[#3fb950] mb-2"></h3>
                <ul className="text-sm text-[#8b949e] space-y-1">
                  {!editingEmployee && (
                    <>
                      
                    </>
                  )}
                  <li></li>
                </ul>
              </div>

              {/* Role Mapping Reference */}
              {!editingEmployee && (
                <div className="mt-4 p-4 bg-[#0d1117] border border-[#30363d] rounded-lg">
                  <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">📋 Bảng phân quyền tự động:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {Object.entries(POSITION_ROLE_MAP).map(([position, info]) => {
                      const Icon = info.icon;
                      return (
                        <div key={position} className="flex items-center gap-2 p-2 bg-[#161b22] rounded border border-[#30363d]">
                          <div className={`p-1.5 rounded ${info.color}`}>
                            <Icon className="w-3 h-3" />
                          </div>
                          <span className="text-[#c9d1d9]">{position}</span>
                          <span className="ml-auto text-[#8b949e]">→</span>
                          <span className="font-mono text-blue-400">{info.role}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {editingEmployee ? '💾 Cập Nhật' : '➕ Thêm Mới'}
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#c9d1d9] py-3 rounded-lg font-medium transition-colors"
                >
                  ❌ Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}