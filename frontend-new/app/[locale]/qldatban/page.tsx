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

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  // ✅ THAY ĐỔI URL NÀY BẰNG URL VERCEL CỦA BẠN
  const getOrderUrl = (table: Table) => {
    const CUSTOMER_APP_URL = 'https://frontend-new-mu-one.vercel.app';
    return `${CUSTOMER_APP_URL}/vi/goimon?table=${table.number}`;
  };

  useEffect(() => {
    loadTablesFromAPI();
  }, []);

  const loadTablesFromAPI = async () => {
  try {
    setIsLoading(true);
    console.log('🔄 Loading tables from:', `${API_URL}/api/tables`);

    const res = await fetch(`${API_URL}/api/tables`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();
    console.log('✅ Tables loaded:', result);

    // ✅ FIX: Check result.success và result.data
    if (result.success && Array.isArray(result.data)) {
      const mappedTables = result.data.map((t: any) => ({
        table_id: t.table_id,
        number: t.number,        // Backend alias: table_number as number
        capacity: t.capacity,
        status: t.status,
        token: t.qr_code,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      console.log('📊 Mapped tables:', mappedTables);
      setTables(mappedTables);
    } else if (Array.isArray(result)) {
      // Fallback nếu API trả mảng trực tiếp
      const mappedTables = result.map((t: any) => ({
        table_id: t.table_id,
        number: t.table_number || t.number,
        capacity: t.capacity,
        status: t.status,
        token: t.qr_code,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      console.log('📊 Mapped tables (fallback):', mappedTables);
      setTables(mappedTables);
    } else {
      console.error('❌ API response invalid:', result);
    }
  } catch (err) {
    console.error('❌ Error loading tables:', err);
    alert('Lỗi tải danh sách bàn!');
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
      console.log('✅ Tables loaded:', result);
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
     console.log(' Tables loaded:', result);

      if (result.success) {
        alert(' Cập nhật trạng thái thành công!');
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
  <div className="min-h-screen bg-[#0d1117] p-6">
    {/* Header */}
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white mb-2">Quản Lý Bàn</h1>
      <p className="text-gray-400">Tổng cộng {stats.total} bàn</p>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">Tổng số bàn</div>
        <div className="text-2xl font-bold text-white">{stats.total}</div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">Bàn trống</div>
        <div className="text-2xl font-bold text-green-500">{stats.available}</div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">Có khách</div>
        <div className="text-2xl font-bold text-blue-500">{stats.occupied}</div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">Đã đặt</div>
        <div className="text-2xl font-bold text-yellow-500">{stats.reserved}</div>
      </div>
    </div>

    {/* Controls */}
    <div className="flex gap-4 mb-6">
      <input
        type="text"
        placeholder="Tìm số bàn..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg"
      />
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value as any)}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg"
      >
        <option value="all">Tất cả</option>
        <option value="AVAILABLE">Trống</option>
        <option value="OCCUPIED">Có khách</option>
        <option value="RESERVED">Đã đặt</option>
      </select>
      <button
        onClick={() => setShowAddModal(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
      >
        + Thêm bàn
      </button>
    </div>

    {/* Tables Grid */}
    <div className="grid grid-cols-4 gap-4">
      {filteredTables.map((table) => (
        <div
          key={table.table_id}
          className="bg-gray-800 p-6 rounded-lg hover:bg-gray-750 transition"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Bàn {table.number}</h3>
              <p className="text-gray-400 text-sm">{table.capacity} chỗ ngồi</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(table.status)}`}>
              {getStatusText(table.status)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => openQR(table)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
            >
              QR Code
            </button>
            <button
              onClick={() => handleDelete(table.number)}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
            >
              Xóa
            </button>
          </div>
        </div>
      ))}
    </div>

    {filteredTables.length === 0 && (
      <div className="text-center text-gray-400 py-12">
        Không tìm thấy bàn nào
      </div>
    )}
  </div>
);
}