'use client';

import { useState, useEffect } from 'react';

interface Table {
  table_id?: number;
  number: number;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  token?: string;
  created_at?: string;
  updated_at?: string;
}

export default function TableManagementPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentQRTable, setCurrentQRTable] = useState<Table | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  // Load tables từ API
  useEffect(() => {
    loadTablesFromAPI();
  }, []);

  const loadTablesFromAPI = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading tables from:', `${API_URL}/api/tables`);
      
      const res = await fetch(`${API_URL}/api/tables`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log('✅ Tables loaded:', result);

      if (result.success && result.data) {
        setTables(result.data);
      }
    } catch (error) {
      console.error('❌ Error loading tables:', error);
      alert('Lỗi tải danh sách bàn từ server!');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTables = tables.filter(t => {
    const matchSearch = t.number.toString().includes(search);
    const matchFilter = filter === 'all' ? true : t.status === filter;
    return matchSearch && matchFilter;
  });

  const handleAddTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const number = Number((form.elements.namedItem('tableNumber') as HTMLInputElement).value);
    const capacity = Number((form.elements.namedItem('tableCapacity') as HTMLInputElement).value);
    const status = (form.elements.namedItem('tableStatus') as HTMLSelectElement).value as Table['status'];
    
    try {
      const res = await fetch(`${API_URL}/api/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        await loadTablesFromAPI();
      } else {
        alert(result.error || 'Lỗi thêm bàn!');
      }
    } catch (error) {
      console.error('❌ Error adding table:', error);
      alert('Lỗi thêm bàn!');
    }
  };

  const handleDelete = async (number: number) => {
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
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const result = await res.json();

      if (result.success) {
        alert('✅ Xóa bàn thành công!');
        await loadTablesFromAPI();
      } else {
        alert(result.error || 'Lỗi xóa bàn!');
      }
    } catch (error) {
      console.error('❌ Error deleting table:', error);
      alert('Lỗi xóa bàn!');
    }
  };

  const updateTableStatus = async (number: number, newStatus: Table['status']) => {
    const table = tables.find(t => t.number === number);
    if (!table) return;

    try {
      const res = await fetch(`${API_URL}/api/tables/${number}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          status: newStatus,
          capacity: table.capacity,
          changeToken: false,
        }),
      });

      const result = await res.json();

      if (result.success) {
        alert('✅ Cập nhật trạng thái thành công!');
        await loadTablesFromAPI();
      } else {
        alert(result.error || 'Lỗi cập nhật!');
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      alert('Lỗi cập nhật trạng thái!');
    }
  };

  const openQR = (table: Table) => {
    setCurrentQRTable(table);
    setShowQRModal(true);
  };

  const getOrderUrl = (table: Table) => {
    if (table.token) {
      return `${APP_URL}/vi/tables/${table.number}?token=${table.token}`;
    }
    return `${APP_URL}/vi/goimon?table=${table.number}`;
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
      case 'AVAILABLE': return 'bg-gray-700 text-gray-300';
      case 'OCCUPIED': return 'bg-blue-600 text-blue-100';
      case 'RESERVED': return 'bg-yellow-600 text-yellow-100';
    }
  };

  const getStatusText = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'Trống';
      case 'OCCUPIED': return 'Có khách';
      case 'RESERVED': return 'Đã đặt';
    }
  };

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'AVAILABLE').length,
    occupied: tables.filter(t => t.status === 'OCCUPIED').length,
    reserved: tables.filter(t => t.status === 'RESERVED').length,
  };

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

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white font-bold text-lg mb-5">
          H
        </div>
       
        <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all bg-[#238636] text-white" title="Quản lí bàn ăn">
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
          onClick={() => navigateTo('/vi/qltk')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí tài khoản"
        >
          ⚙️
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
              <h1 className="text-2xl text-white mb-1">Quản lý Bàn ăn</h1>
              <p className="text-sm text-[#8b949e]">Theo dõi và quản lý trạng thái bàn</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadTablesFromAPI}
                className="px-5 py-2.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm hover:bg-[#30363d]"
              >
                🔄 Làm mới
              </button>
              <button
                className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium transition-all hover:bg-[#2ea043] flex items-center gap-2"
                onClick={() => setShowAddModal(true)}
              >
                ➕ Thêm bàn
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-sm text-[#8b949e]">Tổng số bàn</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="text-3xl font-bold text-[#3fb950] mb-1">{stats.available}</div>
              <div className="text-sm text-[#8b949e]">Bàn trống</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="text-3xl font-bold text-[#58a6ff] mb-1">{stats.occupied}</div>
              <div className="text-sm text-[#8b949e]">Có khách</div>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="text-3xl font-bold text-[#f2c94c] mb-1">{stats.reserved}</div>
              <div className="text-sm text-[#8b949e]">Đã đặt</div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <input
              type="text"
              placeholder="Tìm số bàn..."
              className="flex-1 min-w-[200px] bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
              {(['all','AVAILABLE','OCCUPIED','RESERVED'] as const).map(f => (
                <button
                  key={f}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === f 
                      ? 'bg-[#238636] text-white border-[#238636]' 
                      : 'bg-[#161b22] text-[#8b949e] border-[#30363d] hover:border-[#58a6ff] hover:text-[#58a6ff]'
                  } border`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Tất cả' : f === 'AVAILABLE' ? 'Trống' : f === 'OCCUPIED' ? 'Có khách' : 'Đã đặt'}
                </button>
              ))}
            </div>
          </div>

          {/* Table Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredTables.map(table => (
              <div
                key={table.table_id || table.number}
                className={`bg-[#161b22] border rounded-xl p-5 text-center hover:-translate-y-1 transition-all ${
                  table.status === 'OCCUPIED' ? 'border-[#58a6ff]' : 
                  table.status === 'RESERVED' ? 'border-[#f2c94c]' : 
                  'border-[#30363d] hover:border-[#58a6ff]'
                }`}
              >
                <div className="text-4xl font-bold text-white mb-3">🪑 {table.number}</div>
                <div className="text-sm text-[#8b949e] mb-3">
                  👥 Sức chứa: {table.capacity} người
                </div>
                <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium mb-4 ${getStatusColor(table.status)}`}>
                  {getStatusText(table.status)}
                </div>

                {/* Status Change Buttons */}
                <div className="grid grid-cols-3 gap-1 mb-4">
                  <button
                    onClick={() => updateTableStatus(table.number, 'AVAILABLE')}
                    disabled={table.status === 'AVAILABLE'}
                    className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-30 transition"
                    title="Đặt trống"
                  >
                    Trống
                  </button>
                  <button
                    onClick={() => updateTableStatus(table.number, 'OCCUPIED')}
                    disabled={table.status === 'OCCUPIED'}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-30 transition"
                    title="Có khách"
                  >
                    Có khách
                  </button>
                  <button
                    onClick={() => updateTableStatus(table.number, 'RESERVED')}
                    disabled={table.status === 'RESERVED'}
                    className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 disabled:opacity-30 transition"
                    title="Đã đặt"
                  >
                    Đặt
                  </button>
                </div>

                <div className="flex justify-center gap-2">
                  <button 
                    className="flex-1 bg-[#21262d] p-2 rounded-lg hover:bg-[#30363d] transition text-sm"
                    onClick={() => openQR(table)}
                    title="QR Code"
                  >
                    📱
                  </button>
                  <button 
                    className="flex-1 bg-[#f85149] p-2 rounded-lg hover:bg-[#ff6b62] transition text-sm"
                    onClick={() => handleDelete(table.number)}
                    title="Xóa"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredTables.length === 0 && (
            <div className="text-center py-16 text-[#8b949e]">
              <div className="text-6xl mb-5 opacity-50">🪑</div>
              <div className="text-base mb-2">Không tìm thấy bàn nào</div>
            </div>
          )}
        </div>
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-5">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-white mb-5">Thêm bàn mới</h2>
            <form onSubmit={handleAddTable}>
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">Số bàn</label>
                  <input 
                    type="number" 
                    name="tableNumber" 
                    placeholder="Nhập số bàn" 
                    required 
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">Sức chứa</label>
                  <input 
                    type="number" 
                    name="tableCapacity" 
                    placeholder="Số người" 
                    required 
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">Trạng thái</label>
                  <select 
                    name="tableStatus" 
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                  >
                    <option value="AVAILABLE">Trống</option>
                    <option value="OCCUPIED">Có khách</option>
                    <option value="RESERVED">Đã đặt</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm transition-all hover:bg-[#30363d]"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm font-medium transition-all hover:bg-[#2ea043]"
                >
                  Thêm bàn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && currentQRTable && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-5" onClick={() => setShowQRModal(false)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-2">QR Code - Bàn {currentQRTable.number}</h2>
            <p className="text-[#8b949e] mb-6">Quét mã để gọi món</p>
            
            <div className="bg-white p-6 rounded-xl mb-6 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getOrderUrl(currentQRTable))}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            
            <div className="bg-[#0d1117] rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#8b949e] mb-2">Link gọi món:</p>
              <p className="text-sm text-[#58a6ff] break-all">
                {getOrderUrl(currentQRTable)}
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                className="flex-1 px-4 py-3 bg-[#58a6ff] text-white rounded-lg font-semibold hover:bg-[#79c0ff] transition"
                onClick={downloadQR}
              >
                📥 Tải xuống
              </button>
              <button 
                className="flex-1 px-4 py-3 bg-[#238636] text-white rounded-lg font-semibold hover:bg-[#2ea043] transition"
                onClick={() => setShowQRModal(false)}
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