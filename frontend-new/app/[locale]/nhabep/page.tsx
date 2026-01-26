'use client';

import { useState, useEffect } from 'react';


interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  note?: string;
  status: 'pending' | 'preparing' | 'ready';
}
interface KitchenOrder {
  id: string;
  orderNumber: string;
  tableNumber: number;
  items: OrderItem[];
  orderTime: string;
  elapsedTime: number;
  priority: 'normal' | 'urgent';
  status: 'pending' | 'preparing' | 'ready';
}

export default function KitchenDisplaySystem() {
   const [currentTime, setCurrentTime] = useState<string>('--:--');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing'>('all');
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);


  // Mock data - thay bằng WebSocket/API real-time
  const mockOrders: KitchenOrder[] = [
    {
      id: '1',
      orderNumber: 'HD001',
      tableNumber: 5,
      items: [
        { id: 1, name: 'Beef Steak', quantity: 2, status: 'pending', note: 'Medium rare' },
        { id: 2, name: 'Spaghetti', quantity: 1, status: 'pending' }
      ],
      orderTime: '14:30',
      elapsedTime: 2,
      priority: 'normal',
      status: 'pending'
    },
    {
      id: '2',
      orderNumber: 'HD002',
      tableNumber: 3,
      items: [
        { id: 3, name: 'Bánh mì Việt Nam', quantity: 3, status: 'preparing' },
        { id: 4, name: 'Cappuccino', quantity: 3, status: 'preparing' }
      ],
      orderTime: '14:25',
      elapsedTime: 7,
      priority: 'normal',
      status: 'preparing'
    },
    {
      id: '3',
      orderNumber: 'HD003',
      tableNumber: 8,
      items: [
        { id: 5, name: 'Beef Steak', quantity: 1, status: 'pending', note: 'Well done, no garlic' }
      ],
      orderTime: '14:28',
      elapsedTime: 4,
      priority: 'normal',
      status: 'pending'
    },
    {
      id: '4',
      orderNumber: 'HD004',
      tableNumber: 12,
      items: [
        { id: 6, name: 'Spaghetti', quantity: 2, status: 'preparing' },
        { id: 7, name: 'Orange Fresh', quantity: 2, status: 'ready' }
      ],
      orderTime: '14:20',
      elapsedTime: 12,
      priority: 'urgent',
      status: 'preparing'
    }
  ];

 useEffect(() => {
  // init orders
  setOrders(mockOrders);

  // ===== CLOCK =====
  const updateTime = () => {
    setCurrentTime(
      new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  updateTime(); // set ngay khi mount
  const clockTimer = setInterval(updateTime, 60000);

  // ===== ORDER TIMER =====
  const orderTimer = setInterval(() => {
    setOrders(prev =>
      prev.map(order => ({
        ...order,
        elapsedTime: order.elapsedTime + 1,
        priority: order.elapsedTime + 1 >= 10 ? 'urgent' : 'normal',
      }))
    );
  }, 60000);

  // ===== CLEANUP =====
  return () => {
    clearInterval(clockTimer);
    clearInterval(orderTimer);
  };
}, []);


  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return order.status !== 'ready';
    return order.status === filter;
  }).sort((a, b) => {
    // Urgent orders first
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
    // Then by elapsed time
    return b.elapsedTime - a.elapsedTime;
  });

  const updateOrderStatus = (orderId: string, newStatus: KitchenOrder['status']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  const updateItemStatus = (orderId: string, itemId: number, newStatus: OrderItem['status']) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedItems = order.items.map(item => 
          item.id === itemId ? { ...item, status: newStatus } : item
        );
        
        // Auto update order status based on items
        const allReady = updatedItems.every(item => item.status === 'ready');
        const anyPreparing = updatedItems.some(item => item.status === 'preparing');
        
        return {
          ...order,
          items: updatedItems,
          status: allReady ? 'ready' : anyPreparing ? 'preparing' : 'pending'
        };
      }
      return order;
    }));
  };

  const startOrder = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            status: 'preparing',
            items: order.items.map(item => ({ ...item, status: 'preparing' }))
          } 
        : order
    ));
  };

  const completeOrder = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            status: 'ready',
            items: order.items.map(item => ({ ...item, status: 'ready' }))
          } 
        : order
    ));
    
    // Play notification sound
    // new Audio('/notification.mp3').play();
  };

  const getStatusColor = (status: OrderItem['status']) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      preparing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      ready: 'bg-green-500/20 text-green-400 border-green-500/30'
    };
    return colors[status];
  };

  const getPriorityColor = (priority: KitchenOrder['priority'], elapsedTime: number) => {
    if (elapsedTime >= 15) return 'border-red-500 bg-red-500/10';
    if (priority === 'urgent' || elapsedTime >= 10) return 'border-orange-500 bg-orange-500/10';
    return 'border-[#30363d]';
  };

  const viewOrderDetail = (order: KitchenOrder) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const getOrderCount = (status: string) => {
    if (status === 'all') return orders.filter(o => o.status !== 'ready').length;
    return orders.filter(o => o.status === status).length;
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl text-white mb-1 flex items-center gap-3">
              👨‍🍳 Bếp - Kitchen Display
              <span className="text-base px-3 py-1 bg-red-500/15 text-red-400 rounded-full font-normal animate-pulse">
                {getOrderCount('all')} đơn đang chờ
              </span>
            </h1>
            <p className="text-sm text-[#8b949e]">Theo dõi và chuẩn bị món ăn</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm text-[#8b949e]">Thời gian</div>
              <div className="text-2xl text-white font-bold font-mono">
            
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-[#8b949e]">Đơn hôm nay</div>
              <div className="text-2xl text-[#3fb950] font-bold">
                {orders.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4">
        <div className="flex gap-3">
          {[
            { value: 'all', label: 'Tất cả', icon: '📋' },
            { value: 'pending', label: 'Chờ làm', icon: '⏳' },
            { value: 'preparing', label: 'Đang làm', icon: '🔥' }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-8 py-4 rounded-lg font-semibold transition-all text-lg ${
                filter === tab.value
                  ? 'bg-[#238636] text-white scale-105'
                  : 'bg-[#0d1117] text-[#8b949e] hover:bg-[#21262d] hover:text-white border border-[#30363d]'
              }`}
            >
              <span className="mr-2 text-2xl">{tab.icon}</span>
              {tab.label}
              <span className="ml-3 px-3 py-1 rounded-full text-sm bg-white/15">
                {getOrderCount(tab.value)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="p-8">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-4">✅</div>
            <div className="text-2xl text-[#3fb950] font-bold mb-2">Tuyệt vời!</div>
            <div className="text-lg text-[#8b949e]">Không có đơn hàng nào đang chờ</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-[#161b22] border-2 rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-2xl ${getPriorityColor(order.priority, order.elapsedTime)}`}
              >
                {/* Card Header */}
                <div className={`p-5 ${
                  order.elapsedTime >= 15 
                    ? 'bg-gradient-to-r from-red-600 to-red-700' 
                    : order.priority === 'urgent' 
                    ? 'bg-gradient-to-r from-orange-600 to-orange-700'
                    : 'bg-gradient-to-r from-[#238636] to-[#2ea043]'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-white font-bold text-2xl mb-1">Bàn {order.tableNumber}</div>
                      <div className="text-white/90 text-sm font-mono">#{order.orderNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white/90 text-sm mb-1">Thời gian</div>
                      <div className={`text-2xl font-bold font-mono ${
                        order.elapsedTime >= 15 ? 'text-white animate-pulse' : 'text-white'
                      }`}>
                        {order.elapsedTime} phút
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <span>🕐 Đặt lúc: {order.orderTime}</span>
                    {order.priority === 'urgent' && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs animate-pulse">
                        ⚠️ KHẨN CẤP
                      </span>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div className="p-5">
                  <div className="space-y-3 mb-5">
                    {order.items.map((item) => (
                      <div 
                        key={item.id}
                        className="bg-[#0d1117] rounded-xl p-4 border border-[#30363d]"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="text-white font-semibold text-lg mb-1">
                              {item.name}
                            </div>
                            <div className="text-[#8b949e] text-sm">
                              Số lượng: <span className="text-[#58a6ff] font-bold text-xl">{item.quantity}</span>
                            </div>
                            {item.note && (
                              <div className="mt-2 text-yellow-400 text-sm bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/30">
                                📝 {item.note}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const nextStatus = item.status === 'pending' ? 'preparing' : 'ready';
                              updateItemStatus(order.id, item.id, nextStatus);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${getStatusColor(item.status)}`}
                          >
                            {item.status === 'pending' && '⏳ Chờ'}
                            {item.status === 'preparing' && '🔥 Đang làm'}
                            {item.status === 'ready' && '✅ Xong'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => viewOrderDetail(order)}
                      className="w-full px-4 py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-xl hover:bg-[#21262d] hover:border-[#58a6ff] transition text-sm font-semibold"
                    >
                      👁️ Xem chi tiết
                    </button>

                    {order.status === 'pending' && (
                      <button
                        onClick={() => startOrder(order.id)}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-semibold"
                      >
                        🔥 Bắt đầu làm
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => completeOrder(order.id)}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition text-sm font-semibold shadow-lg"
                      >
                        ✅ Hoàn thành
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="bg-[#161b22] rounded-2xl shadow-2xl w-full max-w-2xl border border-[#30363d]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-6 rounded-t-2xl ${
              selectedOrder.elapsedTime >= 15 
                ? 'bg-gradient-to-r from-red-600 to-red-700' 
                : selectedOrder.priority === 'urgent' 
                ? 'bg-gradient-to-r from-orange-600 to-orange-700'
                : 'bg-gradient-to-r from-[#238636] to-[#2ea043]'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Bàn {selectedOrder.tableNumber}
                  </h2>
                  <div className="flex items-center gap-4 text-white/90">
                    <span className="font-mono text-lg">#{selectedOrder.orderNumber}</span>
                    <span>🕐 {selectedOrder.orderTime}</span>
                    <span className="px-3 py-1 bg-white/20 rounded-full font-bold">
                      ⏱️ {selectedOrder.elapsedTime} phút
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white/80 hover:text-white text-3xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <h3 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">
                <span>📋</span> Chi tiết món ({selectedOrder.items.length} món)
              </h3>
              
              <div className="space-y-4">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="bg-[#0d1117] rounded-xl p-5 border border-[#30363d]">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-white font-semibold text-xl mb-2">{item.name}</div>
                        <div className="text-[#8b949e]">
                          Số lượng: <span className="text-[#58a6ff] font-bold text-2xl">{item.quantity}</span>
                        </div>
                        {item.note && (
                          <div className="mt-3 text-yellow-400 text-sm bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/30">
                            <span className="font-semibold">📝 Ghi chú:</span> {item.note}
                          </div>
                        )}
                      </div>
                      <div className={`px-4 py-2 rounded-lg text-sm font-medium border ${getStatusColor(item.status)}`}>
                        {item.status === 'pending' && '⏳ Chờ làm'}
                        {item.status === 'preparing' && '🔥 Đang làm'}
                        {item.status === 'ready' && '✅ Hoàn thành'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-6 py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-xl hover:bg-[#21262d] transition font-semibold"
                >
                  Đóng
                </button>
                {selectedOrder.status === 'preparing' && (
                  <button
                    onClick={() => {
                      completeOrder(selectedOrder.id);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition font-semibold"
                  >
                    ✅ Hoàn thành đơn
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}