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
      {/* Rest of component - see full code */}
    </div>
  );
}