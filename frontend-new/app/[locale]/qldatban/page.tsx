'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Table {
  table_id?: number;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  qr_code?: string;
  created_at?: string;
  updated_at?: string;
}

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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const CUSTOMER_APP_URL = 'https://frontend-new-mu-one.vercel.app';

  const getOrderUrl = (table: Table) => {
    return `${CUSTOMER_APP_URL}/vi/goimon?table=${table.number}`;
  };

  // ========================================
  // CHECK AUTHENTICATION
  // ========================================
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!storedToken || !user) {
      alert('Vui lòng đăng nhập!');
      router.push('/vi/login');
      return;
    }

    setToken(storedToken);
    loadTablesFromAPI(storedToken);
  }, []);

  // ========================================
  // LOAD TABLES
  // ========================================
  const loadTablesFromAPI = async (authToken: string) => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading tables...');

      const res = await fetch(`${API_URL}/api/tables`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`, // ✅ ADD TOKEN
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (res.status === 401) {
        alert('Phiên đăng nhập hết hạn!');
        router.push('/vi/login');
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      console.log('✅ Tables loaded:', result);

      if (result.success && Array.isArray(result.data)) {
        setTables(result.data);
      }
    } catch (err) {
      console.error('❌ Error loading tables:', err);
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
    if (!token) return;

    const form = e.currentTarget;
    const number = Number((form.elements.namedItem('tableNumber') as HTMLInputElement).value);
    const capacity = Number((form.elements.namedItem('tableCapacity') as HTMLInputElement).value);
    const status = (form.elements.namedItem('tableStatus') as HTMLSelectElement).value as Table['status'];

    try {
      const res = await fetch(`${API_URL}/api/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // ✅ ADD TOKEN
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
        alert('✅ Thêm bàn thành công!');
        setShowAddModal(false);
        form.reset();
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || result.message || 'Lỗi thêm bàn!');
      }
    } catch (error) {
      console.error('❌ Error adding table:', error);
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
          'Authorization': `Bearer ${token}`, // ✅ ADD TOKEN
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          capacity: capacity,
          status: status,
        }),
      });

      const result = await res.json();

      if (result.success) {
        alert('✅ Cập nhật thành công!');
        setShowEditModal(false);
        setCurrentEditTable(null);
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || 'Lỗi cập nhật!');
      }
    } catch (error) {
      console.error('❌ Error updating table:', error);
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
      alert('Không thể xóa bàn đang có khách!');
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa bàn số ${number}?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/tables/${number}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // ✅ ADD TOKEN
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const result = await res.json();

      if (result.success) {
        alert('✅ Xóa bàn thành công!');
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || 'Lỗi xóa bàn!');
      }
    } catch (error) {
      console.error('❌ Error deleting table:', error);
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
          'Authorization': `Bearer ${token}`, // ✅ ADD TOKEN
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          status: newStatus,
          capacity: table.capacity,
        }),
      });

      const result = await res.json();

      if (result.success) {
        alert('✅ Cập nhật trạng thái thành công!');
        await loadTablesFromAPI(token);
      } else {
        alert(result.detail || 'Lỗi cập nhật!');
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      alert('Lỗi cập nhật trạng thái!');
    }
  };

  // ========================================
  // OPEN QR MODAL
  // ========================================
  const openQR = (table: Table) => {
    setCurrentQRTable(table);
    setShowQRModal(true);
  };

  // ========================================
  // OPEN EDIT MODAL
  // ========================================
  const openEdit = (table: Table) => {
    setCurrentEditTable(table);
    setShowEditModal(true);
  };

  // ========================================
  // DOWNLOAD QR CODE
  // ========================================
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

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
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

  // ========================================
  // LOADING STATE
  // ========================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍽️</div>
          <div className="text-[#8b949e] text-lg">Đang tải danh sách bàn...</div>
        </div>
      </div>
    );
  }

  // ========================================
  // MAIN RENDER
  // ========================================
  return (
    <div className="min-h-screen bg-[#0d1117] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Quản Lý Bàn</h1>
        <p className="text-[#8b949e]">Tổng cộng {stats.total} bàn</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-lg">
          <div className="text-[#8b949e] text-sm mb-1">Tổng số bàn</div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-lg">
          <div className="text-[#8b949e] text-sm mb-1">Bàn trống</div>
          <div className="text-3xl font-bold text-[#3fb950]">{stats.available}</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-lg">
          <div className="text-[#8b949e] text-sm mb-1">Có khách</div>
          <div className="text-3xl font-bold text-[#58a6ff]">{stats.occupied}</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-lg">
          <div className="text-[#8b949e] text-sm mb-1">Đã đặt</div>
          <div className="text-3xl font-bold text-[#d29922]">{stats.reserved}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Tìm số bàn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-[#161b22] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="bg-[#161b22] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
        >
          <option value="all">Tất cả</option>
          <option value="AVAILABLE">Trống</option>
          <option value="OCCUPIED">Có khách</option>
          <option value="RESERVED">Đã đặt</option>
        </select>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#238636] hover:bg-[#2ea043] text-white px-6 py-2 rounded-lg font-semibold transition"
        >
          ➕ Thêm bàn
        </button>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <div
            key={table.table_id || table.number}
            className="bg-[#161b22] border border-[#30363d] p-6 rounded-lg hover:border-[#58a6ff] transition"
          >
            {/* Table Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Bàn {table.number}
                </h3>
                <p className="text-[#8b949e] text-sm">{table.capacity} chỗ ngồi</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                  table.status
                )}`}
              >
                {getStatusText(table.status)}
              </span>
            </div>

            {/* Quick Status Change */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => updateTableStatus(table.number, 'AVAILABLE')}
                className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                disabled={table.status === 'AVAILABLE'}
              >
                Trống
              </button>
              <button
                onClick={() => updateTableStatus(table.number, 'OCCUPIED')}
                className="flex-1 px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded"
                disabled={table.status === 'OCCUPIED'}
              >
                Có khách
              </button>
              <button
                onClick={() => updateTableStatus(table.number, 'RESERVED')}
                className="flex-1 px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white text-xs rounded"
                disabled={table.status === 'RESERVED'}
              >
                Đặt
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => openQR(table)}
                className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-2 rounded text-sm font-semibold"
              >
                📱 QR Code
              </button>
              <button
                onClick={() => openEdit(table)}
                className="bg-[#1f6feb] hover:bg-[#388bfd] text-white px-3 py-2 rounded text-sm"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(table.number)}
                className="bg-[#da3633] hover:bg-[#f85149] text-white px-3 py-2 rounded text-sm"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredTables.length === 0 && (
        <div className="text-center text-[#8b949e] py-16">
          <div className="text-6xl mb-4">🔍</div>
          <div className="text-xl">Không tìm thấy bàn nào</div>
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Thêm Bàn Mới</h2>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-[#8b949e] text-sm mb-2">Số bàn</label>
                <input
                  type="number"
                  name="tableNumber"
                  required
                  min="1"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                  placeholder="Nhập số bàn"
                />
              </div>
              <div>
                <label className="block text-[#8b949e] text-sm mb-2">Số chỗ ngồi</label>
                <input
                  type="number"
                  name="tableCapacity"
                  required
                  min="1"
                  defaultValue="4"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                />
              </div>
              <div>
                <label className="block text-[#8b949e] text-sm mb-2">Trạng thái</label>
                <select
                  name="tableStatus"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                >
                  <option value="AVAILABLE">Trống</option>
                  <option value="OCCUPIED">Có khách</option>
                  <option value="RESERVED">Đã đặt</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-lg font-semibold"
                >
                  ✅ Thêm
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-white py-2 rounded-lg"
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
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">
              Sửa Bàn {currentEditTable.number}
            </h2>
            <form onSubmit={handleUpdateTable} className="space-y-4">
              <div>
                <label className="block text-[#8b949e] text-sm mb-2">Số chỗ ngồi</label>
                <input
                  type="number"
                  name="capacity"
                  required
                  min="1"
                  defaultValue={currentEditTable.capacity}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                />
              </div>
              <div>
                <label className="block text-[#8b949e] text-sm mb-2">Trạng thái</label>
                <select
                  name="status"
                  defaultValue={currentEditTable.status}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                >
                  <option value="AVAILABLE">Trống</option>
                  <option value="OCCUPIED">Có khách</option>
                  <option value="RESERVED">Đã đặt</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#1f6feb] hover:bg-[#388bfd] text-white py-2 rounded-lg font-semibold"
                >
                  💾 Lưu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setCurrentEditTable(null);
                  }}
                  className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-white py-2 rounded-lg"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-white mb-4">
              QR Code - Bàn {currentQRTable.number}
            </h2>

            {/* QR Code */}
            <div className="bg-white p-6 rounded-lg mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
                  getOrderUrl(currentQRTable)
                )}`}
                alt={`QR Code Bàn ${currentQRTable.number}`}
                className="w-full h-auto"
              />
            </div>

            {/* Link */}
            <div className="mb-4">
              <label className="block text-[#8b949e] text-sm mb-2">Link gọi món:</label>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 break-all text-[#58a6ff] text-sm">
                {getOrderUrl(currentQRTable)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={downloadQR}
                className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-lg font-semibold"
              >
                📥 Tải xuống
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getOrderUrl(currentQRTable));
                  alert('Đã copy link!');
                }}
                className="flex-1 bg-[#1f6feb] hover:bg-[#388bfd] text-white py-2 rounded-lg"
              >
                📋 Copy link
              </button>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setCurrentQRTable(null);
                }}
                className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-white py-2 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}