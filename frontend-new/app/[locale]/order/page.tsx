'use client';

import { useState, useEffect } from 'react';
import { Trash2, Eye, Clock, CheckCircle } from 'lucide-react';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  note?: string;
}

interface Order {
  id: string;
  tableNumber: number;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  orderTime: string;
  paymentStatus: 'unpaid' | 'paid';
  createdAt: number;
}

export default function StaffOrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const loadOrders = () => {
      try {
        const stored = localStorage.getItem('staff-orders');
        
        if (stored) {
          const allOrders = JSON.parse(stored);
          const sortedOrders = allOrders.sort((a: Order, b: Order) => b.createdAt - a.createdAt);
          setOrders(sortedOrders);
        } else {
          setOrders([]);
        }
      } catch (error) {
        console.error('❌ Lỗi tải đơn hàng:', error);
      }
    };

    loadOrders();
    const interval = setInterval(loadOrders, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredOrders = orders.filter(order => 
    filter === 'all' ? order.status !== 'completed' && order.status !== 'cancelled' : order.status === filter
  );

  const getStatusColor = (status: Order['status']) => {
    const colors = {
      pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      preparing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      ready: 'bg-green-500/15 text-green-400 border-green-500/30',
      completed: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
      cancelled: 'bg-red-500/15 text-red-400 border-red-500/30'
    };
    return colors[status];
  };

  const getStatusText = (status: Order['status']) => {
    const texts = {
      pending: '⏳ Chờ xử lý',
      preparing: '🍳 Đang chuẩn bị',
      ready: '✅ Sẵn sàng',
      completed: '✓ Hoàn thành',
      cancelled: '✕ Đã hủy'
    };
    return texts[status];
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    try {
      const stored = localStorage.getItem('staff-orders');
      if (stored) {
        const allOrders = JSON.parse(stored);
        const updatedOrders = allOrders.map((order: Order) => 
          order.id === orderId ? { ...order, status: newStatus } : order
        );
        localStorage.setItem('staff-orders', JSON.stringify(updatedOrders));
        setOrders(updatedOrders);
      }
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái:', error);
    }
  };

  const updatePaymentStatus = (orderId: string) => {
    try {
      const stored = localStorage.getItem('staff-orders');
      if (stored) {
        const allOrders = JSON.parse(stored);
        const updatedOrders = allOrders.map((order: Order) => 
          order.id === orderId 
            ? { ...order, paymentStatus: 'paid', status: 'completed' } 
            : order
        );
        localStorage.setItem('staff-orders', JSON.stringify(updatedOrders));
        setOrders(updatedOrders);
      }
    } catch (error) {
      console.error('Lỗi cập nhật thanh toán:', error);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    
    setIsCancelling(true);
    
    try {
      const stored = localStorage.getItem('staff-orders');
      if (stored) {
        const allOrders = JSON.parse(stored);
        const updatedOrders = allOrders.map((order: Order) => 
          order.id === orderToCancel.id 
            ? { ...order, status: 'cancelled' as const } 
            : order
        );
        localStorage.setItem('staff-orders', JSON.stringify(updatedOrders));
        setOrders(updatedOrders);
      }

      alert(`✅ Đã hủy đơn hàng Bàn ${orderToCancel.tableNumber}`);
      setShowCancelModal(false);
      setOrderToCancel(null);
      
    } catch (error: any) {
      console.error('Lỗi hủy đơn:', error);
      alert(`❌ Lỗi: ${error.message || 'Không thể hủy đơn hàng'}`);
    } finally {
      setIsCancelling(false);
    }
  };
  const viewOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const openCancelModal = (order: Order) => {
    setOrderToCancel(order);
    setShowCancelModal(true);
  };

  const getOrderCount = (status: string) => {
    if (status === 'all') return orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
    return orders.filter(o => o.status === status).length;
  };

  const canCancelOrder = (status: Order['status']) => {
    return ['pending', 'preparing'].includes(status);
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header - Responsive */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-lg sm:text-xl md:text-2xl text-white mb-1 sm:mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <span>🍽️ Quản lý đơn hàng</span>
              <span className="text-xs sm:text-sm md:text-base px-2 sm:px-3 py-0.5 sm:py-1 bg-red-500/15 text-red-400 rounded-full font-normal animate-pulse">
                {getOrderCount('all')} đơn chờ
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#8b949e]">Theo dõi và xử lý đơn hàng (Tự động cập nhật)</p>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-end">
            <div className="text-right hidden sm:block">
              <div className="text-xs sm:text-sm text-[#8b949e]">Nhân viên phục vụ</div>
              <div className="text-white font-medium text-sm"></div>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-base sm:text-lg">
              NV
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs - Responsive */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {[
            { value: 'all', label: 'Tất cả', icon: '📋', shortLabel: 'Tất cả' },
            { value: 'pending', label: 'Chờ xử lý', icon: '⏳', shortLabel: 'Chờ' },
            { value: 'preparing', label: 'Đang chuẩn bị', icon: '🍳', shortLabel: 'Chuẩn bị' },
            { value: 'ready', label: 'Sẵn sàng', icon: '✅', shortLabel: 'Sẵn sàng' }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-lg font-medium transition-all whitespace-nowrap text-xs sm:text-sm md:text-base flex-shrink-0 ${
                filter === tab.value
                  ? 'bg-[#238636] text-white'
                  : 'bg-[#0d1117] text-[#8b949e] hover:bg-[#21262d] hover:text-white border border-[#30363d]'
              }`}
            >
              <span className="mr-1 sm:mr-2">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs bg-white/10">
                {getOrderCount(tab.value)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid - Responsive */}
      <div className="p-3 sm:p-4 md:p-6 lg:p-8">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 sm:py-16 md:py-20">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📭</div>
            <div className="text-base sm:text-lg md:text-xl text-[#8b949e]">Không có đơn hàng nào</div>
            <div className="text-xs sm:text-sm text-[#8b949e] mt-2">Đơn hàng từ khách sẽ hiện ở đây</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden hover:border-[#58a6ff] transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Card Header - Responsive */}
                <div className="bg-gradient-to-r from-[#238636] to-[#2ea043] p-3 sm:p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-white font-bold text-base sm:text-lg">Bàn {order.tableNumber}</div>
                      <div className="text-white/80 text-xs sm:text-sm">{order.customerName}</div>
                    </div>
                    <div className="text-white/90 text-xs sm:text-sm font-mono">{order.orderTime}</div>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <div className="text-white text-xs opacity-80 truncate">#{order.id}</div>
                    <div className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </div>
                  </div>
                </div>

                {/* Order Items - Responsive */}
                <div className="p-3 sm:p-4">
                  <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 max-h-32 sm:max-h-40 overflow-y-auto">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start text-xs sm:text-sm">
                        <div className="flex-1 pr-2">
                          <span className="text-white">{item.name}</span>
                          <span className="text-[#8b949e] ml-1 sm:ml-2">x{item.quantity}</span>
                        </div>
                        <span className="text-[#58a6ff] font-medium whitespace-nowrap">
                          {(item.price * item.quantity).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total - Responsive */}
                  <div className="border-t border-[#30363d] pt-2 sm:pt-3 mb-3 sm:mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[#8b949e] font-medium text-xs sm:text-sm">Tổng cộng:</span>
                      <span className="text-white text-base sm:text-lg font-bold">
                        {order.totalAmount.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                  </div>

                  {/* Actions - Responsive */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <button
                      onClick={() => viewOrderDetail(order)}
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg hover:bg-[#21262d] hover:border-[#58a6ff] transition text-xs sm:text-sm font-medium"
                    >
                      👁️ Xem chi tiết
                    </button>

                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm font-medium"
                      >
                        🍳 Bắt đầu chuẩn bị
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium"
                      >
                        ✅ Hoàn thành món
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        onClick={() => updatePaymentStatus(order.id)}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition text-xs sm:text-sm font-medium"
                      >
                        💳 Xác nhận thanh toán
                      </button>
                    )}

                    {canCancelOrder(order.status) && (
                      <button
                        onClick={() => openCancelModal(order)}
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-600/20 hover:border-red-500 transition text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        Hủy bàn
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal - Responsive */}
      {showCancelModal && orderToCancel && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#161b22] rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md border border-red-500/30">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl">
              <div className="flex items-center justify-center mb-2 sm:mb-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white text-center">
                Xác nhận hủy đơn
              </h2>
              <p className="text-white/80 text-xs sm:text-sm text-center mt-1 sm:mt-2">
                Hành động này không thể hoàn tác
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="bg-[#0d1117] rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-[#30363d]">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[#8b949e] text-xs sm:text-sm">Bàn:</span>
                  <span className="text-white font-bold text-base sm:text-lg">
                    Bàn {orderToCancel.tableNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[#8b949e] text-xs sm:text-sm">Khách hàng:</span>
                  <span className="text-white text-xs sm:text-sm">{orderToCancel.customerName}</span>
                </div>
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[#8b949e] text-xs sm:text-sm">Mã đơn:</span>
                  <span className="text-white font-mono text-xs">#{orderToCancel.id}</span>
                </div>
                <div className="border-t border-[#30363d] pt-2 sm:pt-3 mt-2 sm:mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#8b949e] text-xs sm:text-sm">Tổng tiền:</span>
                    <span className="text-red-400 font-bold text-lg sm:text-xl">
                      {orderToCancel.totalAmount.toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                  }}
                  className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg sm:rounded-xl hover:bg-[#21262d] transition font-medium text-xs sm:text-sm"
                  disabled={isCancelling}
                >
                  Không
                </button>
                <button
                  onClick={handleCancelOrder}
                  className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg sm:rounded-xl hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <span className="flex items-center justify-center gap-1 sm:gap-2">
                      <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Đang hủy...
                    </span>
                  ) : (
                    'Xác nhận hủy'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal - Responsive */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#161b22] rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg sm:max-w-xl md:max-w-2xl border border-[#30363d] max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#238636] to-[#2ea043] p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl sticky top-0 z-10">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2">
                    Chi tiết đơn #{selectedOrder.id}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-white/90 text-xs sm:text-sm">
                    <span>🪑 Bàn {selectedOrder.tableNumber}</span>
                    <span>👤 {selectedOrder.customerName}</span>
                    <span>🕐 {selectedOrder.orderTime}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white/80 hover:text-white text-xl sm:text-2xl w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className={`inline-flex px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium border mb-4 sm:mb-6 ${getStatusColor(selectedOrder.status)}`}>
                {getStatusText(selectedOrder.status)}
              </div>

              <div className="mb-4 sm:mb-6">
                <h3 className="text-white font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                  <span>📋</span> Danh sách món ({selectedOrder.items.length} món)
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 sm:p-4 bg-[#0d1117] rounded-lg border border-[#30363d]">
                      <div className="flex-1 pr-2">
                        <div className="text-white font-medium text-sm sm:text-base">{item.name}</div>
                        <div className="text-[#8b949e] text-xs sm:text-sm">
                          {item.price.toLocaleString('vi-VN')} ₫ x {item.quantity}
                        </div>
                        {item.note && (
                          <div className="text-yellow-400 text-xs mt-1">📝 {item.note}</div>
                        )}
                      </div>
                      <div className="text-[#58a6ff] font-bold text-base sm:text-lg whitespace-nowrap">
                        {(item.price * item.quantity).toLocaleString('vi-VN')} ₫
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#238636]/10 to-[#2ea043]/10 border border-[#238636]/30 rounded-lg sm:rounded-xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-2 sm:mb-3 text-xs sm:text-sm">
                  <span className="text-[#c9d1d9]">Tổng số món:</span>
                  <span className="text-white font-medium">
                    {selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0)} món
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <span className="text-[#c9d1d9] text-xs sm:text-sm">Thanh toán:</span>
                  <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                    selectedOrder.paymentStatus === 'paid' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedOrder.paymentStatus === 'paid' ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
                  </span>
                </div>
                <div className="border-t border-[#238636]/30 pt-2 sm:pt-3 mt-2 sm:mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-base sm:text-lg font-semibold">Tổng:</span>
                    <span className="text-[#3fb950] text-xl sm:text-2xl font-bold">
                      {selectedOrder.totalAmount.toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-lg sm:rounded-xl hover:bg-[#21262d] transition font-medium text-xs sm:text-sm"
                >
                  Đóng
                </button>
                
                {selectedOrder.status === 'ready' && selectedOrder.paymentStatus === 'unpaid' && (
                  <button
                    onClick={() => {
                      updatePaymentStatus(selectedOrder.id);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg sm:rounded-xl hover:from-green-600 hover:to-green-700 transition font-medium text-xs sm:text-sm"
                  >
                    💳 Thanh toán
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}