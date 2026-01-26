'use client';

import React, { useState } from 'react';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  status: 'pending' | 'confirmed';
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  time: string;
}

export default function CashierSystem() {
  const [orders, setOrders] = useState<OrderItem[]>([
    { id: 1024, name: 'Bún bò', quantity: 1, price: 250000, status: 'confirmed' },
    { id: 1025, name: 'Bò 7 món', quantity: 2, price: 85000, status: 'pending' }
  ]);

  const [transactions] = useState<Transaction[]>([
    { id: '+415.2k', amount: 250000, type: 'NHD THANHTODA 1024', time: '10:15' },
    { id: '+10.05', amount: 500000, type: 'NHD Anh Tùng ck bàn cafe', time: '09:30' }
  ]);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const totalRevenue = 15450000;
  const todayTransactions = 3;

  const calculateTotal = () => {
    return orders.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleConfirmOrder = (id: number) => {
    setOrders(orders.map(order => 
      order.id === id ? { ...order, status: 'confirmed' as const } : order
    ));
  };

  const handleCancelOrder = (id: number) => {
    setOrders(orders.filter(order => order.id !== id));
  };

  const handleViewHistory = () => {
    setShowHistoryModal(true);
  };

  const handlePrintInvoice = () => {
    setShowInvoiceModal(true);
  };

  const handleShiftReport = () => {
    setShowReportModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel - Revenue & Orders */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Revenue Card */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-6 border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <h2 className="text-2xl font-bold text-gray-800">THU NGÂN</h2>
            </div>
            
            <div className="mb-2 text-sm text-gray-600">
              Tổng chuyển khoản (Hôm nay)
            </div>
            <div className="text-4xl font-bold text-green-600 mb-4">
              {totalRevenue.toLocaleString('vi-VN')}đ
            </div>

            <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
              🔄 Làm mới Bank Feed
            </button>
          </div>

          {/* Orders Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Đơn hàng chờ xác nhận</h3>
            
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-semibold text-gray-700">
                          #{order.id}
                        </span>
                        <span className="font-medium text-gray-800">{order.name}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Số lượng</div>
                          <div className="font-semibold">{order.quantity}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Thành tiền</div>
                          <div className="font-semibold">{(order.price * order.quantity).toLocaleString('vi-VN')}đ</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Thanh toán</div>
                          <div className="font-semibold">
                            {order.status === 'confirmed' ? (
                              <span className="text-green-600 flex items-center gap-1">
                                ✓ Đã nhận tiền
                              </span>
                            ) : (
                              <span className="text-yellow-600 flex items-center gap-1">
                                ⏳ Chờ khách...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => handleConfirmOrder(order.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        Duyệt đơn
                      </button>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  )}

                  {order.status === 'confirmed' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                        <span className="text-green-700 font-medium">✓ Đơn hàng đã được xác nhận</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="mt-6 pt-6 border-t-2 border-gray-200">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Tổng cộng:</span>
                <span className="text-orange-600">{calculateTotal().toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Real-time Transactions */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="text-xl font-bold mb-4">Biến động số dư (Real-time)</h3>
            
            <div className="space-y-4">
              {transactions.map((transaction, index) => (
                <div key={index} className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-20">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-300">{transaction.id}</span>
                    <span className="text-xs text-gray-400">{transaction.time}</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    + {transaction.amount.toLocaleString('vi-VN')}đ
                  </div>
                  <div className="text-sm text-gray-300">
                    {transaction.type}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white border-opacity-20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Giao dịch hôm nay</span>
                <span className="font-bold text-lg">{todayTransactions}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Thống kê nhanh</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-gray-700">Đơn chờ xử lý</span>
                <span className="font-bold text-blue-600">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-gray-700">Đơn đã hoàn thành</span>
                <span className="font-bold text-green-600">
                  {orders.filter(o => o.status === 'confirmed').length}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-gray-700">Tổng đơn</span>
                <span className="font-bold text-orange-600">{orders.length}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚡</span>
              <h3 className="text-lg font-bold text-gray-800">Thao tác nhanh</h3>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => handleViewHistory()}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                📋 Xem lịch sử giao dịch
              </button>
              <button 
                onClick={() => handlePrintInvoice()}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                📄 In hóa đơn
              </button>
              <button 
                onClick={() => handleShiftReport()}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                📊 Báo cáo ca làm
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Lịch Sử Giao Dịch */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">📋 Lịch Sử Giao Dịch</h2>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 flex gap-3">
                <input 
                  type="date" 
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
                <select className="px-4 py-2 border border-gray-300 rounded-lg">
                  <option>Tất cả</option>
                  <option>Chuyển khoản</option>
                  <option>Tiền mặt</option>
                </select>
              </div>

              <div className="space-y-3">
                {transactions.map((transaction, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-blue-600">{transaction.id}</span>
                          <span className="text-xs text-gray-500">{transaction.time}</span>
                        </div>
                        <div className="text-gray-700">{transaction.type}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          + {transaction.amount.toLocaleString('vi-VN')}đ
                        </div>
                        <span className="text-xs text-gray-500">Chuyển khoản</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t-2 border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Tổng cộng:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal In Hóa Đơn */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">📄 In Hóa Đơn</h2>
              <button 
                onClick={() => setShowInvoiceModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-white">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">NHÀ HÀNG ABC</h3>
                  <p className="text-gray-600">123 Đường A, Quận 1, VP</p>
                  <p className="text-gray-600">SĐT: 0123 456 </p>
                </div>

                <div className="border-t border-b border-gray-300 py-4 mb-4">
                  <h4 className="text-center font-bold text-lg mb-2">HÓA ĐƠN THANH TOÁN</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Ngày: {new Date().toLocaleDateString('vi-VN')}</p>
                    <p>Giờ: {new Date().toLocaleTimeString('vi-VN')}</p>
                    <p>Thu ngân: Nhân viên A</p>
                  </div>
                </div>

                <table className="w-full mb-4">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Món</th>
                      <th className="text-center py-2">SL</th>
                      <th className="text-right py-2">Đơn giá</th>
                      <th className="text-right py-2">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b">
                        <td className="py-2">{order.name}</td>
                        <td className="text-center py-2">{order.quantity}</td>
                        <td className="text-right py-2">{order.price.toLocaleString('vi-VN')}đ</td>
                        <td className="text-right py-2">{(order.price * order.quantity).toLocaleString('vi-VN')}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t-2 border-gray-800 pt-3">
                  <div className="flex justify-between text-xl font-bold">
                    <span>TỔNG CỘNG:</span>
                    <span>{calculateTotal().toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
                <div className="text-center mt-6 text-sm text-gray-600">
                  <p>Cảm ơn quý khách!</p>
                  <p>Hẹn gặp lại!</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  🖨️ In hóa đơn
                </button>
                <button 
                  onClick={() => setShowInvoiceModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Báo Cáo Ca Làm */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">📊 Báo Cáo Ca Làm</h2>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>         
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="text-sm text-blue-600 mb-1">Ca làm việc</div>
                  <div className="text-2xl font-bold text-blue-800">Ca sáng</div>
                  <div className="text-sm text-gray-600 mt-1">06:00 - 14:00</div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <div className="text-sm text-purple-600 mb-1">Thu ngân</div>
                  <div className="text-2xl font-bold text-purple-800">Nhân viên A</div>
                  <div className="text-sm text-gray-600 mt-1">ID: NV001</div>
                </div>

                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="text-sm text-green-600 mb-1">Tổng doanh thu</div>
                  <div className="text-2xl font-bold text-green-800">{totalRevenue.toLocaleString('vi-VN')}đ</div>
                  <div className="text-sm text-gray-600 mt-1">↑ +12% so với hôm qua</div>
                </div>

                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="text-sm text-orange-600 mb-1">Tổng đơn hàng</div>
                  <div className="text-2xl font-bold text-orange-800">{orders.length}</div>
                  <div className="text-sm text-gray-600 mt-1">Hoàn thành: {orders.filter(o => o.status === 'confirmed').length}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-bold text-gray-800 mb-3">Chi tiết thanh toán</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">💳 Chuyển khoản</span>
                    <span className="font-semibold">{transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">💵 Tiền mặt</span>
                    <span className="font-semibold">0đ</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t-2 border-gray-300">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="font-bold text-green-600">{totalRevenue.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  🖨️ In báo cáo
                </button>
                <button 
                  onClick={() => alert('Xuất Excel')}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  📥 Xuất Excel
                </button>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}