'use client';

import { useState, useEffect } from 'react';

interface Table {
  id: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  reservationName?: string;
  reservationTime?: string;
  orderId?: string;
  orderAmount?: number;
}
interface Order {
  id: string;
  tableNumber: number;
  customerName: string;
  items: any[];
  totalAmount: number;
  status: string;
  orderTime: string;
  createdAt: number;
}
export default function TableManagementPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'reserved'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentQRTable, setCurrentQRTable] = useState<Table | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  // Load tables từ localStorage
  useEffect(() => {
    const loadTables = () => {
      try {
        const stored = localStorage.getItem('restaurant-tables');
        if (stored) {
          setTables(JSON.parse(stored));
        } else {
          // Khởi tạo bàn mặc định
          const defaultTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            capacity: [2, 4, 6, 4, 4, 2, 6, 4, 2, 4, 6, 8][i],
            status: 'available'
          }));
          setTables(defaultTables);
          localStorage.setItem('restaurant-tables', JSON.stringify(defaultTables));
        }
      } catch (error) {
        console.error('Lỗi tải bàn:', error);
      }
    };

    loadTables();
  }, []);

  // Cập nhật trạng thái bàn từ đơn hàng
  useEffect(() => {
    const updateTableStatus = () => {
      try {
        const ordersData = localStorage.getItem('staff-orders');
        if (!ordersData) return;

        const orders: Order[] = JSON.parse(ordersData);
        const pendingOrders = orders.filter(o => o.status === 'pending');

        setTables(prevTables => {
          return prevTables.map(table => {
            const tableOrder = pendingOrders.find(o => o.tableNumber === table.id);
            
            if (tableOrder) {
              return {
                ...table,
                status: 'occupied' as const,
                reservationName: tableOrder.customerName,
                reservationTime: tableOrder.orderTime,
                orderId: tableOrder.id,
                orderAmount: tableOrder.totalAmount
              };
            }
            
            // Nếu không còn đơn pending cho bàn này, set về available
            if (table.status === 'occupied' && !tableOrder) {
              return {
                ...table,
                status: 'available' as const,
                reservationName: undefined,
                reservationTime: undefined,
                orderId: undefined,
                orderAmount: undefined
              };
            }
            
            return table;
          });
        });
      } catch (error) {
        console.error('Lỗi cập nhật trạng thái bàn:', error);
      }
    };

    updateTableStatus();
    const interval = setInterval(updateTableStatus, 2000); // Cập nhật mỗi 2 giây
    
    return () => clearInterval(interval);
  }, []);

  // Lưu tables vào localStorage khi thay đổi
  useEffect(() => {
    if (tables.length > 0) {
      localStorage.setItem('restaurant-tables', JSON.stringify(tables));
    }
  }, [tables]);

  const filteredTables = tables.filter(t => {
    const matchSearch = t.id.toString().includes(search);
    const matchFilter = filter === 'all' ? true : t.status === filter;
    return matchSearch && matchFilter;
  });

  const handleAddTable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const id = Number((form.elements.namedItem('tableNumber') as HTMLInputElement).value);
    const capacity = Number((form.elements.namedItem('tableCapacity') as HTMLInputElement).value);
    const status = (form.elements.namedItem('tableStatus') as HTMLSelectElement).value as Table['status'];
    
    if (tables.find(t => t.id === id)) {
      alert('Số bàn đã tồn tại!');
      return;
    }
    
    setTables(prev => [...prev, { id, capacity, status }]);
    setShowAddModal(false);
    form.reset();
  };

  const handleDelete = (id: number) => {
    const table = tables.find(t => t.id === id);
    if (table?.status === 'occupied') {
      alert('Không thể xóa bàn đang có khách!');
      return;
    }
    
    if (confirm(`Bạn có chắc muốn xóa bàn số ${id}?`)) {
      setTables(prev => prev.filter(t => t.id !== id));
    }
  };

  const openQR = (table: Table) => {
    setCurrentQRTable(table);
    setShowQRModal(true);
  };
  const getOrderUrl = (tableId: number) =>
  `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/vi/goimon?table=${tableId}`;

  const downloadQR = () => {
    if (!currentQRTable) return;
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getOrderUrl(currentQRTable.id))}`;
    
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `QR-Ban-${currentQRTable.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const viewOrderDetails = (table: Table) => {
    if (!table.orderId) return;
    
    try {
      const ordersData = localStorage.getItem('staff-orders');
      if (!ordersData) return;
      
      const orders: Order[] = JSON.parse(ordersData);
      const order = orders.find(o => o.id === table.orderId);
      
      if (order) {
        setSelectedOrder(order);
        setShowOrderModal(true);
      }
    } catch (error) {
      console.error('Lỗi tải thông tin đơn hàng:', error);
    }
  };

  const completeOrder = (table: Table) => {
    if (!table.orderId) return;
    
    if (confirm('Xác nhận hoàn thành đơn hàng và thu tiền?')) {
      try {
        // Cập nhật trạng thái đơn hàng
        const ordersData = localStorage.getItem('staff-orders');
        if (ordersData) {
          const orders: Order[] = JSON.parse(ordersData);
          const updatedOrders = orders.map(o => 
            o.id === table.orderId ? { ...o, status: 'completed' } : o
          );
          localStorage.setItem('staff-orders', JSON.stringify(updatedOrders));
        }
        
        // Cập nhật trạng thái bàn
        setTables(prev => prev.map(t => 
          t.id === table.id 
            ? { ...t, status: 'available' as const, reservationName: undefined, reservationTime: undefined, orderId: undefined, orderAmount: undefined }
            : t
        ));
        
        alert('Đã hoàn thành đơn hàng!');
      } catch (error) {
        console.error('Lỗi hoàn thành đơn hàng:', error);
      }
    }
  };

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'available': return 'bg-gray-700 text-gray-300';
      case 'occupied': return 'bg-blue-600 text-blue-100';
      case 'reserved': return 'bg-yellow-600 text-yellow-100';
    }
  };

  const getStatusText = (status: Table['status']) => {
    switch (status) {
      case 'available': return 'Trống';
      case 'occupied': return 'Có khách';
      case 'reserved': return 'Đã đặt';
    }
  };
  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length
  };

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
            <button
              className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium transition-all hover:bg-[#2ea043] flex items-center gap-2"
              onClick={() => setShowAddModal(true)}
            >
              ➕ Thêm bàn
            </button>
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
              {(['all','available','occupied','reserved'] as const).map(f => (
                <button
                  key={f}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === f 
                      ? 'bg-[#238636] text-white border-[#238636]' 
                      : 'bg-[#161b22] text-[#8b949e] border-[#30363d] hover:border-[#58a6ff] hover:text-[#58a6ff]'
                  } border`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Tất cả' : f === 'available' ? 'Trống' : f === 'occupied' ? 'Có khách' : 'Đã đặt'}
                </button>
              ))}
            </div>
          </div>

          {/* Table Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredTables.map(table => (
              <div
                key={table.id}
                className={`bg-[#161b22] border rounded-xl p-5 text-center hover:-translate-y-1 transition-all ${
                  table.status === 'occupied' ? 'border-[#58a6ff]' : 
                  table.status === 'reserved' ? 'border-[#f2c94c]' : 
                  'border-[#30363d] hover:border-[#58a6ff]'
                }`}
              >
                <div className="text-4xl font-bold text-white mb-3">🪑 {table.id}</div>
                <div className="text-sm text-[#8b949e] mb-3">
                  👥 Sức chứa: {table.capacity} người
                </div>
                <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium mb-4 ${getStatusColor(table.status)}`}>
                  {getStatusText(table.status)}
                </div>

                {table.status === 'occupied' && (
                  <div className="bg-[#0d1117] rounded-lg p-3 mb-4 text-left">
                    <div className="text-xs text-[#8b949e] mb-2">
                      <div className="flex justify-between mb-1">
                        <span>👤 Khách:</span>
                        <span className="text-[#c9d1d9] font-medium">{table.reservationName}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>🕐 Giờ đặt:</span>
                        <span className="text-[#c9d1d9] font-medium">{table.reservationTime}</span>
                      </div>
                      {table.orderAmount && (
                        <div className="flex justify-between">
                          <span>💰 Tổng tiền:</span>
                          <span className="text-[#3fb950] font-bold">
                            {table.orderAmount.toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => viewOrderDetails(table)}
                      className="w-full mt-2 px-3 py-1.5 bg-[#58a6ff] text-white rounded text-xs font-medium hover:bg-[#79c0ff] transition"
                    >
                      Xem chi tiết đơn →
                    </button>
                  </div>
                )}

                <div className="flex justify-center gap-2">
                  <button 
                    className="flex-1 bg-[#21262d] p-2 rounded-lg hover:bg-[#30363d] transition text-sm"
                    onClick={() => openQR(table)}
                    title="QR Code"
                  >
                    📱
                  </button>
                  {table.status === 'occupied' && (
                    <button 
                      className="flex-1 bg-[#3fb950] p-2 rounded-lg hover:bg-[#4ec961] transition text-sm text-white font-medium"
                      onClick={() => completeOrder(table)}
                      title="Hoàn thành"
                    >
                      ✓
                    </button>
                  )}
                  <button 
                    className="flex-1 bg-[#f85149] p-2 rounded-lg hover:bg-[#ff6b62] transition text-sm"
                    onClick={() => handleDelete(table.id)}
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
                    <option value="available">Trống</option>
                    <option value="occupied">Có khách</option>
                    <option value="reserved">Đã đặt</option>
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
            <h2 className="text-2xl font-bold text-white mb-2">QR Code - Bàn {currentQRTable.id}</h2>
            <p className="text-[#8b949e] mb-6">Quét mã để gọi món</p>
            
            <div className="bg-white p-6 rounded-xl mb-6 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getOrderUrl(currentQRTable.id))}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            
            <div className="bg-[#0d1117] rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#8b949e] mb-2">Link gọi món:</p>
              <p className="text-sm text-[#58a6ff] break-all">
                {getOrderUrl(currentQRTable.id)}
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

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-5" onClick={() => setShowOrderModal(false)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Chi tiết đơn hàng</h2>
                <p className="text-[#8b949e] text-sm">Mã: {selectedOrder.id}</p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-[#8b949e] hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between py-2 border-b border-[#30363d]">
                <span className="text-[#8b949e]">Bàn số:</span>
                <span className="text-white font-semibold">Bàn {selectedOrder.tableNumber}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#30363d]">
                <span className="text-[#8b949e]">Khách hàng:</span>
                <span className="text-white font-semibold">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#30363d]">
                <span className="text-[#8b949e]">Giờ đặt:</span>
                <span className="text-white font-semibold">{selectedOrder.orderTime}</span>
              </div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-3">Danh sách món:</h3>
              <div className="space-y-2">
                {selectedOrder.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-[#c9d1d9]">{item.name} x{item.quantity}</span>
                    <span className="text-[#58a6ff] font-medium">
                      {(item.price * item.quantity).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#30363d] mt-3 pt-3 flex justify-between">
                <span className="text-white font-bold">Tổng cộng:</span>
                <span className="text-[#3fb950] font-bold text-lg">
                  {selectedOrder.totalAmount.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowOrderModal(false)}
              className="w-full px-4 py-3 bg-[#238636] text-white rounded-lg font-semibold hover:bg-[#2ea043] transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}