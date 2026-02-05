'use client';

import React, { useState, useEffect } from 'react';

interface OrderItem {
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  subtotal?: number;
}

interface Order {
  order_id: number;
  table_number: string;
  customer_name?: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  payment_status?: string;
  payment_breakdown?: {
    subtotal: number;
    tax: number;
    service_charge: number;
    discount: number;
    total: number;
  };
}

interface Transaction {
  transaction_id: string;
  amount: number;
  description: string;
  time?: string;
  transaction_date?: string;
  status: string;
}

interface Payment {
  payment_id: number;
  order_id: number;
  total_amount: number;
  amount_paid: number;
  change_given: number;
  payment_method: string;
  created_at: string;
  table_number?: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  bankLogo?: string;
  accountNumber: string;
  accountHolder: string;
  status: 'active' | 'locked';
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
//  API CONFIGURATION
// ============================================================================
const API_URL = 'http://localhost:8000/api/cashier';
const STORAGE_KEY = 'bank_accounts_data';

// Bank code mapping for VietQR
const BANK_CODE_MAP: { [key: string]: string } = {
  'Vietcombank': 'VCB',
  'MB Bank': 'MB',
  'VietinBank': 'CTG',
  'BIDV': 'BIDV',
  'Techcombank': 'TCB',
  'ACB': 'ACB',
  'Sacombank': 'STB',
  'VPBank': 'VPB'
};

// Bank color mapping
const BANK_COLORS: { [key: string]: string } = {
  'Vietcombank': 'bg-green-600',
  'MB Bank': 'bg-red-600',
  'VietinBank': 'bg-blue-600',
  'BIDV': 'bg-blue-700',
  'Techcombank': 'bg-green-700',
  'ACB': 'bg-purple-600',
  'Sacombank': 'bg-indigo-600',
  'VPBank': 'bg-emerald-600'
};

const getBankColor = (bankName: string): string => {
  return BANK_COLORS[bankName] || 'bg-gray-600';
};

const getBankCode = (bankName: string): string => {
  return BANK_CODE_MAP[bankName] || 'VCB';
};

// VietQR Generator Function
const generateVietQRUrl = (
  bankAccount: BankAccount,
  amount: number,
  description: string
): string => {
  const bankCode = getBankCode(bankAccount.bankName);
  const accountNumber = bankAccount.accountNumber.replace(/\s/g, '');
  const accountName = encodeURIComponent(bankAccount.accountHolder);
  const cleanDescription = encodeURIComponent(description);
  
  // VietQR API URL
  // Format: https://img.vietqr.io/image/[BANK_CODE]-[ACCOUNT_NUMBER]-compact2.jpg?amount=[AMOUNT]&addInfo=[DESCRIPTION]&accountName=[ACCOUNT_NAME]
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.jpg?amount=${amount}&addInfo=${cleanDescription}&accountName=${accountName}`;
  
  console.log('Generated VietQR URL:', qrUrl);
  return qrUrl;
};

// Load active bank accounts from localStorage
const loadActiveBankAccountsFromStorage = (): BankAccount[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const allAccounts: BankAccount[] = JSON.parse(stored);
      return allAccounts.filter(account => account.isActive === true);
    }
  } catch (error) {
    console.error('Error loading bank accounts from localStorage:', error);
  }
  
  return [];
};

export default function PaymentSystem() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBankFeedModal, setShowBankFeedModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showBankSelectModal, setShowBankSelectModal] = useState(false);
  
  // Payment form
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'qr_code'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [bankTransactionId, setBankTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');

  // Stats
  const [totalRevenue, setTotalRevenue] = useState(0);

  // Load bank accounts from localStorage on mount
  useEffect(() => {
    loadBankAccountsFromLocalStorage();
  }, []);

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadBankAccountsFromLocalStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      loadBankAccountsFromLocalStorage();
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const loadBankAccountsFromLocalStorage = () => {
    const activeAccounts = loadActiveBankAccountsFromStorage();
    setBankAccounts(activeAccounts);
    
    if (activeAccounts.length > 0) {
      const currentStillActive = activeAccounts.find(
        acc => acc.id === selectedBankAccount?.id
      );
      
      if (currentStillActive) {
        setSelectedBankAccount(currentStillActive);
      } else {
        setSelectedBankAccount(activeAccounts[0]);
      }
    } else {
      setSelectedBankAccount(null);
    }
  };

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadBankFeed, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    await Promise.all([
      loadPendingOrders(),
      loadBankFeed(),
      loadTodayTransactions()
    ]);
  };
  
  const loadPendingOrders = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const data = await response.json();
      if (data.success) {
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadBankFeed = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/bank-feed?status=PENDING`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const data = await response.json();
      if (data.success) {
        setTransactions(data.data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading bank feed:', error);
    }
  };

  const loadTodayTransactions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/transactions/today`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPayments(data.data.transactions || []);
        setTotalRevenue(data.data.summary?.total_revenue || 0);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handlePaymentClick = async (order: Order) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('Vui lòng đăng nhập!');
        return;
      }
      const response = await fetch(`${API_URL}/orders/${order.order_id}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setSelectedOrder(data.data);
        setAmountPaid(data.data.payment_breakdown.total.toString());
        setShowPaymentModal(true);
      } else {
        alert(data.message || 'Không thể lấy thông tin đơn hàng');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Lỗi khi lấy thông tin đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!selectedOrder) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('Vui lòng đăng nhập!');
        return;
      }

      const response = await fetch(`${API_URL}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          order_id: selectedOrder.order_id,
          payment_method: paymentMethod,
          amount_paid: parseFloat(amountPaid),
          bank_transaction_id: paymentMethod !== 'cash' ? bankTransactionId : null,
          notes: notes
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Thanh toán thành công!\nTiền thừa: ${data.data.change.toLocaleString('vi-VN')}đ`);
        setShowPaymentModal(false);
        setShowQRModal(false);
        
        setPaymentMethod('cash');
        setAmountPaid('');
        setBankTransactionId('');
        setNotes('');
        setSelectedOrder(null);
        
        await loadInitialData();
      } else {
        alert('' + (data.detail || data.message || 'Thanh toán thất bại'));
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Lỗi khi xử lý thanh toán');
    } finally {
      setLoading(false);
    }
  };

  const verifyBankTransaction = async (transactionId: string, orderId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(
        `${API_URL}/bank-feed/verify?transaction_id=${transactionId}&order_id=${orderId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      const data = await response.json();
      
      if (data.success && data.amount_match) {
        setBankTransactionId(transactionId);
        alert(' Giao dịch hợp lệ!');
      } else {
        alert(' ' + data.message);
      }
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const calculateChange = () => {
    if (!selectedOrder || !amountPaid) return 0;
    const total = selectedOrder.payment_breakdown?.total || selectedOrder.total_amount;
    return Math.max(0, parseFloat(amountPaid) - total);
  };

  const handleModalBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setShowQRModal(false);
      setShowPaymentModal(true);
    }
  };

  const handleQRCodePayment = () => {
    if (bankAccounts.length === 0) {
      alert('Không có tài khoản ngân hàng nào được kích hoạt!');
      return;
    }

    if (!selectedBankAccount) {
      alert('Vui lòng chọn tài khoản ngân hàng!');
      return;
    }

    if (!selectedOrder) return;

    setPaymentMethod('qr_code');
    
    const amount = selectedOrder.payment_breakdown?.total || selectedOrder.total_amount;
    const description = `DH${selectedOrder.order_id} Ban${selectedOrder.table_number}`;
    
    // Generate VietQR URL with selected bank account
    const qrUrl = generateVietQRUrl(
      selectedBankAccount,
      amount,
      description
    );
    
    setQrCodeDataURL(qrUrl);
    setShowPaymentModal(false);
    setShowQRModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel - Orders */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Revenue Card */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-6 border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-2xl">
                💰
              </div>
              <h2 className="text-2xl font-bold text-gray-800">THU NGÂN</h2>
            </div>
            
            <div className="mb-2 text-sm text-gray-600">
              Tổng doanh thu (Hôm nay)
            </div>
            <div className="text-4xl font-bold text-green-600 mb-4">
              {totalRevenue.toLocaleString('vi-VN')}đ
            </div>
            {/* Active Bank Accounts Display */}
            {bankAccounts.length > 0 ? (
              <div className="bg-white rounded-lg p-4 mb-3 border border-yellow-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-500">🏦 Tài khoản nhận thanh toán</div>
                  {bankAccounts.length > 1 && (
                    <button
                      onClick={() => setShowBankSelectModal(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Đổi ({bankAccounts.length} TK)
                    </button>
                  )}
                </div>
                
                {selectedBankAccount && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${getBankColor(selectedBankAccount.bankName)} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                        {selectedBankAccount.bankLogo || selectedBankAccount.bankName.substring(0, 3)}
                      </div>
                      <span className="font-semibold text-gray-800">{selectedBankAccount.bankName}</span>
                    </div>
                    <div className="font-mono text-sm font-semibold text-blue-600">
                      {selectedBankAccount.accountNumber}
                    </div>
                    <div className="text-sm text-gray-700">{selectedBankAccount.accountHolder}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-orange-50 rounded-lg p-4 mb-3 border-2 border-orange-200">
                <div className="flex items-center gap-2 text-orange-700">
                  <span className="text-xl"></span>
                  <div className="text-sm">
                    <div className="font-semibold">Chưa có tài khoản ngân hàng</div>
                    <div className="text-xs">Vui lòng kích hoạt tài khoản trong phần quản lý</div>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                loadBankFeed();
                loadBankAccountsFromLocalStorage();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              🔄 Làm mới Bank Feed
            </button>
          </div>

          {/* Orders Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Đơn hàng chờ thanh toán</h3>
            
            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📭</div>
                <div>Không có đơn hàng nào</div>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.order_id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-semibold text-gray-700">
                            #{order.order_id}
                          </span>
                          <span className="font-medium text-gray-800">
                            Bàn {order.table_number}
                          </span>
                        </div>
                        <div className="space-y-1 mb-3">
                          {order.items.map((item: OrderItem) => (
                            <div key={item.item_id} className="text-sm text-gray-600">
                              {item.quantity}x {item.item_name} = {(item.quantity * item.price).toLocaleString('vi-VN')}đ
                            </div>
                          ))}
                        </div>
                        {order.payment_breakdown && (
                          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
                            <div>
                              <div className="text-gray-500">Tạm tính</div>
                              <div className="font-semibold">{order.payment_breakdown.subtotal.toLocaleString('vi-VN')}đ</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Thuế & phí</div>
                              <div className="font-semibold">
                                {(order.payment_breakdown.tax + order.payment_breakdown.service_charge).toLocaleString('vi-VN')}đ
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-gray-500">Tổng cộng</div>
                              <div className="font-bold text-xl text-orange-600">
                                {order.payment_breakdown.total.toLocaleString('vi-VN')}đ
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => handlePaymentClick(order)}
                        disabled={loading}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        💳 Thanh toán
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Bank Feed & Stats */}
        <div className="space-y-6">         
          {/* Bank Feed */}
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Biến động số dư</h3>
              <button 
                onClick={() => setShowBankFeedModal(true)}
                className="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-lg transition-colors"
              >
                Xem tất cả
              </button>
            </div>
            
            <div className="space-y-3">
              {transactions.slice(0, 3).map((transaction, index) => (
                <div key={index} className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-20">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-300">{transaction.transaction_id}</span>
                    <span className="text-xs text-gray-400">
                      {transaction.time || new Date(transaction.transaction_date || '').toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    + {transaction.amount.toLocaleString('vi-VN')}đ
                  </div>
                  <div className="text-sm text-gray-300">
                    {transaction.description}
                  </div>
                  {transaction.status === 'PENDING' && (
                    <div className="mt-2">
                      <span className="text-xs bg-yellow-500 bg-opacity-30 text-yellow-200 px-2 py-1 rounded">
                        Chưa đối soát
                      </span>
                    </div>
                  )}
                </div>
              ))}
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
                onClick={() => setShowHistoryModal(true)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                📋 Lịch sử giao dịch
              </button>
              <button 
                onClick={() => setShowReportModal(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                📊 Báo cáo ca làm
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Account Selection Modal */}
      {showBankSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-xl font-bold">Chọn tài khoản ngân hàng</h2>
              <button 
                onClick={() => setShowBankSelectModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              {bankAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setSelectedBankAccount(account);
                    setShowBankSelectModal(false);
                  }}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedBankAccount?.id === account.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 ${getBankColor(account.bankName)} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                      {account.bankLogo || account.bankName.substring(0, 3)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{account.bankName}</div>
                      <div className="text-sm text-gray-600">{account.accountHolder}</div>
                    </div>
                    {selectedBankAccount?.id === account.id && (
                      <div className="text-blue-500">✓</div>
                    )}
                  </div>
                  <div className="font-mono text-sm text-gray-700 ml-13">
                    {account.accountNumber}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">💳 Thanh Toán</h2>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Đơn hàng</div>
                    <div className="font-mono text-xl font-bold">#{selectedOrder.order_id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Bàn</div>
                    <div className="text-xl font-bold">{selectedOrder.table_number}</div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  {selectedOrder.items.map((item: OrderItem) => (
                    <div key={item.item_id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.item_name}</span>
                      <span className="font-semibold">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>

                {selectedOrder.payment_breakdown && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tạm tính</span>
                      <span>{selectedOrder.payment_breakdown.subtotal.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Thuế (10%)</span>
                      <span>{selectedOrder.payment_breakdown.tax.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Phí phục vụ (5%)</span>
                      <span>{selectedOrder.payment_breakdown.service_charge.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t-2 pt-2">
                      <span>TỔNG CỘNG</span>
                      <span className="text-orange-600">{selectedOrder.payment_breakdown.total.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">💵</div>
                    <div className="text-sm font-semibold">Tiền mặt</div>
                  </button>
                
                  <button
                    onClick={handleQRCodePayment}
                    disabled={bankAccounts.length === 0}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'qr_code'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    } ${bankAccounts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-2xl mb-1">📱</div>
                    <div className="text-sm font-semibold">QR Code</div>
                    {bankAccounts.length === 0 && (
                      <div className="text-xs text-red-500 mt-1">Chưa có TK</div>
                    )}
                  </button>
                </div>
              </div>

              {/* Amount Paid */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số tiền nhận
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none text-lg font-semibold"
                  placeholder="Nhập số tiền..."
                />
                {parseFloat(amountPaid) > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-600">Tiền thừa: </span>
                    <span className="font-bold text-green-600">
                      {calculateChange().toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
              </div>

              {/* Bank Transaction (if not cash) */}
              {paymentMethod !== 'cash' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mã giao dịch ngân hàng
                  </label>
                  <input
                    type="text"
                    value={bankTransactionId}
                    onChange={(e) => setBankTransactionId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
                    placeholder="VCB_123456..."
                  />
                  <div className="mt-3">
                    <button
                      onClick={() => setShowBankFeedModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Chọn từ Bank Feed
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ghi chú (tùy chọn)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
                  rows={3}
                  placeholder="Ghi chú thêm..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={processPayment}
                  disabled={loading || !amountPaid || (selectedOrder.payment_breakdown && parseFloat(amountPaid) < selectedOrder.payment_breakdown.total)}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-4 rounded-xl font-bold text-lg transition-colors"
                >
                  {loading ? 'Đang xử lý...' : '✓ Xác nhận thanh toán'}
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-800 py-4 rounded-xl font-medium transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && selectedOrder && selectedBankAccount && qrCodeDataURL && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]"
          onClick={handleModalBackdropClick}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-lg font-bold">📱 Quét Mã QR Thanh Toán</h2>
              <button 
                onClick={() => {
                  setShowQRModal(false);
                  setShowPaymentModal(true);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {/* Payment Amount Display */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border-2 border-green-200">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Số tiền thanh toán</div>
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {selectedOrder.payment_breakdown?.total.toLocaleString('vi-VN') || selectedOrder.total_amount.toLocaleString('vi-VN')}đ
                  </div>
                  <div className="text-xs text-gray-500 border-t pt-2">
                    Đơn #{selectedOrder.order_id} - Bàn {selectedOrder.table_number}
                  </div>
                </div>
              </div>

              {/* QR Code Display */}
              <div className="bg-white rounded-xl border-4 border-blue-100 p-2 mb-4">
                <img 
                  src={qrCodeDataURL} 
                  alt="VietQR Payment Code" 
                  className="w-full h-auto object-contain rounded-lg"
                  onError={(e) => {
                    console.error('QR Code failed to load');
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="%23f0f0f0" width="400" height="400"/><text x="50%" y="50%" text-anchor="middle" fill="%23999" font-size="16">Không thể tải QR</text></svg>';
                  }}
                />
              </div>

              {/* Bank Info */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 ${getBankColor(selectedBankAccount.bankName)} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                    {selectedBankAccount.bankLogo || selectedBankAccount.bankName.substring(0, 3)}
                  </div>
                  <div className="font-semibold text-gray-800">{selectedBankAccount.bankName}</div>
                </div>
                <div className="font-mono text-sm font-semibold text-gray-800">
                  {selectedBankAccount.accountNumber}
                </div>
                <div className="text-sm text-gray-700">{selectedBankAccount.accountHolder}</div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="text-sm text-blue-900 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <span></span>
                    <span>Hướng dẫn thanh toán:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs ml-2">
                  </ol>
                </div>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setShowPaymentModal(true);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
        
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}