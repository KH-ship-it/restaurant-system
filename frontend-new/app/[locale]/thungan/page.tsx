'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, Users, ShoppingCart, FileText, Package, CreditCard, Calendar, User, X, Search, Bell, CheckCircle, QrCode } from 'lucide-react';

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
  qrImage?: string;
  vietQRUrl?: string;
  defaultAmount?: number;
  transferContent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CashRequest {
  tableNumber: number;
  grandTotal: number;
  customerName: string;
  orderIds: number[];
  timestamp: number;
}

// ✅ NEW: Interface for QR payment requests
interface QRPaymentRequest {
  tableNumber: number;
  grandTotal: number;
  customerName: string;
  orderIds: number[];
  bankName: string;
  accountNumber: string;
  timestamp: number;
}

// ✅ KEY để persist cash requests qua reload
const CASH_REQUESTS_KEY = 'cashier-cash-requests-pending';
const QR_REQUESTS_KEY = 'cashier-qr-requests-pending'; // ✅ NEW
const PAID_ORDERS_KEY = 'cashier-paid-order-ids';

const saveCashRequests = (requests: CashRequest[]) => {
  try { localStorage.setItem(CASH_REQUESTS_KEY, JSON.stringify(requests)); } catch (_) {}
};

const loadCashRequests = (): CashRequest[] => {
  try {
    const stored = localStorage.getItem(CASH_REQUESTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (_) { return []; }
};

// ✅ NEW: QR request persistence helpers
const saveQRRequests = (requests: QRPaymentRequest[]) => {
  try { localStorage.setItem(QR_REQUESTS_KEY, JSON.stringify(requests)); } catch (_) {}
};

const loadQRRequests = (): QRPaymentRequest[] => {
  try {
    const stored = localStorage.getItem(QR_REQUESTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (_) { return []; }
};

const markOrdersAsPaid = (orderIds: number[]) => {
  try {
    const stored = localStorage.getItem(PAID_ORDERS_KEY);
    const existing: number[] = stored ? JSON.parse(stored) : [];
    const updated = [...new Set([...existing, ...orderIds])];
    localStorage.setItem(PAID_ORDERS_KEY, JSON.stringify(updated));
  } catch (_) {}
};

const getPaidOrderIds = (): Set<number> => {
  try {
    const stored = localStorage.getItem(PAID_ORDERS_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch (_) { return new Set(); }
};

const cleanupPaidOrders = () => {
  try {
    const stored = localStorage.getItem(PAID_ORDERS_KEY);
    if (stored) {
      const ids: number[] = JSON.parse(stored);
      if (ids.length > 200) {
        localStorage.setItem(PAID_ORDERS_KEY, JSON.stringify(ids.slice(-200)));
      }
    }
  } catch (_) {}
};

// ============================================================================
// API CONFIGURATION
// ============================================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/cashier`
  : 'http://localhost:8000/api/cashier';
const STORAGE_KEY = 'bank_accounts_data';

const BANK_BINS: { [key: string]: string } = {
  'Vietcombank': '970436', 'MB Bank': '970422', 'VietinBank': '970415',
  'BIDV': '970418', 'Techcombank': '970407', 'ACB': '970416',
  'Sacombank': '970403', 'VPBank': '970432', 'Agribank': '970405',
  'SHB': '970443', 'TPBank': '970423', 'OCB': '970448',
  'MSB': '970426', 'VIB': '970441', 'HDBank': '970437',
  'SeABank': '970440', 'PVcomBank': '970412', 'LienVietPostBank': '970449',
  'ABBank': '970425', 'NCB': '970419'
};

const menuItems = [
  { label: 'Thống kê',    path: '/vi/thongke',   icon: BarChart3,    active: false },
  { label: 'Quản lý bàn', path: '/vi/qldatban',  icon: Calendar,     active: false },
  { label: 'Thực đơn',    path: '/vi/qlmenu',     icon: FileText,     active: false },
  { label: 'Nhân viên',   path: '/vi/qlnhanvien', icon: Users,        active: false },
  { label: 'Đơn hàng',    path: '/vi/order',      icon: ShoppingCart, active: false },
  { label: 'Tài khoản',   path: '/vi/qltk',       icon: User,         active: false },
  { label: 'Kho vận',     path: '/vi/qlkho',      icon: Package,      active: false },
  { label: 'Thu ngân',    path: '/vi/thungan',    icon: CreditCard,   active: true  },
];

const BANK_COLORS: { [key: string]: string } = {
  'Vietcombank': 'bg-green-600', 'MB Bank': 'bg-red-600', 'VietinBank': 'bg-blue-600',
  'BIDV': 'bg-blue-700', 'Techcombank': 'bg-green-700', 'ACB': 'bg-purple-600',
  'Sacombank': 'bg-indigo-600', 'VPBank': 'bg-emerald-600'
};

const getBankColor = (bankName: string): string => BANK_COLORS[bankName] || 'bg-gray-600';

const loadActiveBankAccountsFromStorage = (): BankAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const allAccounts: BankAccount[] = JSON.parse(stored);
      return allAccounts.filter(account => account.isActive === true);
    }
  } catch (error) { console.error('Error loading bank accounts:', error); }
  return [];
};

const getBankBin = (bankName: string): string => BANK_BINS[bankName] || '';

const generateVietQRUrl = (bankBin: string, accountNumber: string, accountName: string, amount?: number, description?: string): string => {
  const cleanAccountNumber = accountNumber.replace(/\s/g, '');
  let url = `https://img.vietqr.io/image/${bankBin}-${cleanAccountNumber}-compact2.jpg`;
  const params = new URLSearchParams();
  if (amount && amount > 0) params.append('amount', amount.toString());
  if (description) params.append('addInfo', description);
  params.append('accountName', accountName);
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;
  return url;
};

const getPaymentQRUrl = (account: BankAccount, orderAmount: number, orderId: number, tableNumber: string): string | null => {
  if (!account) return null;
  const bankBin = getBankBin(account.bankName);
  const paymentDescription = `DH${orderId} Ban${tableNumber}`;
  if (bankBin) return generateVietQRUrl(bankBin, account.accountNumber, account.accountHolder, orderAmount, paymentDescription);
  if (account.vietQRUrl) return account.vietQRUrl;
  if (account.qrImage) return account.qrImage;
  return null;
};

const getOrderTotal = (order: Order): number => {
  if (order.payment_breakdown?.subtotal && order.payment_breakdown.subtotal > 0) {
    return order.payment_breakdown.subtotal;
  }
  if (order.items && order.items.length > 0) {
    return order.items.reduce((sum, item) => {
      const price = parseFloat(String(item.price)) || 0;
      const qty = parseInt(String(item.quantity)) || 0;
      return sum + (price * qty);
    }, 0);
  }
  return order.total_amount || 0;
};

// ============================================================================
// Sidebar
// ============================================================================
const Sidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigateTo = (path: string) => { window.location.href = path; setIsMobileMenuOpen(false); };
  return (
    <>
      <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1a1d29] text-white rounded-lg shadow-lg">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMobileMenuOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      {isMobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={`w-64 bg-[#1a1d29] min-h-screen fixed left-0 top-0 text-gray-300 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">R</span></div>
            <div><h2 className="text-white font-bold text-lg">Restaurant</h2><p className="text-xs text-gray-400">Management</p></div>
          </div>
        </div>
        <nav className="py-4">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={index} onClick={() => navigateTo(item.path)}
                className={`w-full px-6 py-3 flex items-center gap-3 transition-all duration-200 ${item.active ? 'bg-green-500/10 text-green-400 border-r-4 border-green-500' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                <Icon size={20} /><span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

// ===============================================================
// CASH PAYMENT NOTIFICATION
// ===============================================================
const CashPaymentNotification = ({
  onPaymentDoneForTable,
  onCallApiForCashPayment,
}: {
  onPaymentDoneForTable: (tableNumber: number, orderIds: number[]) => void;
  onCallApiForCashPayment: (orderIds: number[], tableNumber: number, grandTotal: number) => Promise<boolean>;
}) => {
  const [requests, setRequests] = useState<CashRequest[]>([]);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [dismissing, setDismissing] = useState<number | null>(null);
  const displayed = requests.length > 0 ? (requests[viewingIndex] ?? requests[0]) : null;

  useEffect(() => {
    cleanupPaidOrders();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    const paidIds = getPaidOrderIds();
    const stored = loadCashRequests();

    const fresh = stored.filter(r => {
      if (now - r.timestamp >= TWO_HOURS) return false;
      if (r.orderIds.length > 0 && r.orderIds.every(id => paidIds.has(id))) return false;
      return true;
    });

    if (fresh.length !== stored.length) saveCashRequests(fresh);
    if (fresh.length > 0) { setRequests(fresh); setShowPopup(true); }
  }, []);

  const playSound = () => {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1046, ctx.currentTime);
      osc.frequency.setValueAtTime(784,  ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  };

  useEffect(() => {
    const ch = new BroadcastChannel('staff-notifications');
    ch.onmessage = (e) => {
      if (e.data?.type !== 'CASH_PAYMENT_REQUEST') return;
      const { tableNumber, grandTotal, customerName, orderIds, timestamp } = e.data;
      const req: CashRequest = { tableNumber, grandTotal, customerName: customerName || 'Khách', orderIds: orderIds || [], timestamp };
      setRequests(prev => {
        const updated = [req, ...prev.filter(r => r.tableNumber !== tableNumber)];
        saveCashRequests(updated);
        return updated;
      });
      setViewingIndex(0);
      setShowPopup(true);
      playSound();
      setTimeout(() => setShowPopup(false), 25000);
    };
    return () => ch.close();
  }, []);

  const pendingCallbackRef = useRef<{ tableNumber: number; orderIds: number[] } | null>(null);

  useEffect(() => {
    if (pendingCallbackRef.current) {
      const { tableNumber, orderIds } = pendingCallbackRef.current;
      pendingCallbackRef.current = null;
      onPaymentDoneForTable(tableNumber, orderIds);
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const tableChannel = new BroadcastChannel('table-updates');
    tableChannel.onmessage = (e) => {
      const { type, tableNumber, orderIds: paidOrderIds } = e.data;
      if (type === 'PAYMENT_DONE' && tableNumber !== undefined) {
        if (paidOrderIds?.length > 0) markOrdersAsPaid(paidOrderIds);
        setRequests(prev => {
          const matchingReq = prev.find(r => r.tableNumber === tableNumber);
          const idsToRemove = paidOrderIds || matchingReq?.orderIds || [];
          pendingCallbackRef.current = { tableNumber, orderIds: idsToRemove };
          const remaining = prev.filter(r => r.tableNumber !== tableNumber);
          saveCashRequests(remaining);
          if (remaining.length === 0) { setShowPopup(false); setViewingIndex(0); }
          else setViewingIndex(i => Math.min(i, remaining.length - 1));
          return remaining;
        });
      }
    };
    return () => tableChannel.close();
  }, [onPaymentDoneForTable]);

  const dismiss = async (req: CashRequest) => {
    if (dismissing === req.tableNumber) return;
    setDismissing(req.tableNumber);
    try {
      await onCallApiForCashPayment(req.orderIds, req.tableNumber, req.grandTotal);
    } catch (e) {
      console.error('Error calling payment API:', e);
    } finally {
      setDismissing(null);
    }

    markOrdersAsPaid(req.orderIds);

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('table-updates');
        ch.postMessage({ type: 'PAYMENT_DONE', tableNumber: req.tableNumber, orderIds: req.orderIds, paymentMethod: 'cash', timestamp: Date.now() });
        ch.close();
      }
    } catch (_) {}

    onPaymentDoneForTable(req.tableNumber, req.orderIds);

    setRequests(prev => {
      const remaining = prev.filter(r => r.tableNumber !== req.tableNumber);
      saveCashRequests(remaining);
      if (remaining.length === 0) { setShowPopup(false); setViewingIndex(0); }
      else setViewingIndex(i => Math.min(i, remaining.length - 1));
      return remaining;
    });
  };

  const openPopup = () => { if (requests.length > 0) { setViewingIndex(0); setShowPopup(true); } };

  return (
    <>
      {showPopup && displayed && (
        <div className="fixed top-20 right-4 z-[100] animate-cash-in">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl shadow-2xl p-5 w-80 border-2 border-white">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 animate-bounce">
                <span className="text-2xl">💵</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base mb-0.5 flex items-center gap-2">
                  Khách thanh toán tiền mặt!
                  {requests.length > 1 && (
                    <span className="text-xs bg-white/30 px-1.5 py-0.5 rounded-full">{viewingIndex + 1}/{requests.length}</span>
                  )}
                </div>
                <div className="text-sm opacity-90 mb-2">
                  <div>🪑 Bàn {displayed.tableNumber} · {displayed.customerName}</div>
                  {displayed.orderIds.length > 1 && (
                    <div className="text-xs opacity-80">{displayed.orderIds.length} đơn hàng</div>
                  )}
                </div>
                <div className="bg-white/20 rounded-xl px-3 py-2 mb-3">
                  <div className="text-xs opacity-80">Cần thu:</div>
                  <div className="text-2xl font-bold tracking-tight">{displayed.grandTotal.toLocaleString('vi-VN')}đ</div>
                </div>
                {requests.length > 1 && (
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {requests.map((r, i) => (
                      <button key={r.tableNumber} onClick={() => setViewingIndex(i)}
                        className={`flex-1 py-1 rounded text-xs font-medium transition truncate min-w-0 ${i === viewingIndex ? 'bg-white text-orange-600' : 'bg-white/20 hover:bg-white/30'}`}>
                        Bàn {r.tableNumber}
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-xs opacity-70 mb-3">{new Date(displayed.timestamp).toLocaleTimeString('vi-VN')}</div>
                <div className="flex gap-2">
                  <button onClick={() => dismiss(displayed)} disabled={dismissing === displayed.tableNumber}
                    className="flex-1 bg-white text-orange-600 px-3 py-2 rounded-lg font-semibold hover:bg-orange-50 transition flex items-center justify-center gap-1 text-sm disabled:opacity-70 disabled:cursor-wait">
                    {dismissing === displayed.tableNumber ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Đang xử lý...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" />Đã thu tiền</>
                    )}
                  </button>
                  <button onClick={() => setShowPopup(false)} className="px-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Ẩn popup">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[90]">
          <button onClick={openPopup}
            className="bg-orange-500 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all relative animate-pulse">
            <span className="text-xl">💵</span>
            <div className="absolute -top-1 -right-1 bg-white text-orange-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {requests.length}
            </div>
          </button>
        </div>
      )}
    </>
  );
};

// ===============================================================
// ✅ NEW: QR PAYMENT NOTIFICATION COMPONENT
// ===============================================================
const QRPaymentNotification = ({
  onPaymentConfirmed,
  onCallApiForQRPayment,
}: {
  onPaymentConfirmed: (tableNumber: number, orderIds: number[]) => void;
  onCallApiForQRPayment: (orderIds: number[], tableNumber: number, grandTotal: number) => Promise<boolean>;
}) => {
  const [requests, setRequests] = useState<QRPaymentRequest[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const displayed = requests.length > 0 ? (requests[viewingIndex] ?? requests[0]) : null;

  // Load persisted QR requests on mount
  useEffect(() => {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    const paidIds = getPaidOrderIds();
    const stored = loadQRRequests();

    const fresh = stored.filter(r => {
      if (now - r.timestamp >= TWO_HOURS) return false;
      if (r.orderIds.length > 0 && r.orderIds.every(id => paidIds.has(id))) return false;
      return true;
    });

    if (fresh.length !== stored.length) saveQRRequests(fresh);
    if (fresh.length > 0) { setRequests(fresh); setShowPopup(true); }
  }, []);

  const playQRSound = () => {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      // Higher pitched, "digital" sound for QR
      osc.frequency.setValueAtTime(1318, ctx.currentTime);
      osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.16);
      osc.frequency.setValueAtTime(1568, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45);
    } catch (_) {}
  };

  // Listen for incoming QR payment requests
  useEffect(() => {
    const ch = new BroadcastChannel('staff-notifications');
    ch.onmessage = (e) => {
      if (e.data?.type !== 'QR_PAYMENT_REQUEST') return;
      const { tableNumber, grandTotal, customerName, orderIds, bankName, accountNumber, timestamp } = e.data;
      const req: QRPaymentRequest = {
        tableNumber,
        grandTotal,
        customerName: customerName || 'Khách',
        orderIds: orderIds || [],
        bankName: bankName || '',
        accountNumber: accountNumber || '',
        timestamp,
      };
      setRequests(prev => {
        const updated = [req, ...prev.filter(r => r.tableNumber !== tableNumber)];
        saveQRRequests(updated);
        return updated;
      });
      setViewingIndex(0);
      setShowPopup(true);
      playQRSound();
      // Keep popup visible longer for QR (needs manual confirmation)
    };
    return () => ch.close();
  }, []);

  // Listen for PAYMENT_DONE from other sources (e.g. if paid manually)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const ch = new BroadcastChannel('table-updates');
    ch.onmessage = (e) => {
      const { type, tableNumber, orderIds: paidOrderIds } = e.data;
      if (type === 'PAYMENT_DONE' && tableNumber !== undefined) {
        setRequests(prev => {
          const remaining = prev.filter(r => r.tableNumber !== tableNumber);
          saveQRRequests(remaining);
          if (remaining.length === 0) { setShowPopup(false); setViewingIndex(0); }
          else setViewingIndex(i => Math.min(i, remaining.length - 1));
          return remaining;
        });
      }
    };
    return () => ch.close();
  }, []);

  // ✅ Confirm: thu ngân xác nhận đã nhận tiền chuyển khoản
  const confirmQRPayment = async (req: QRPaymentRequest) => {
    if (confirming === req.tableNumber) return;
    setConfirming(req.tableNumber);

    try {
      await onCallApiForQRPayment(req.orderIds, req.tableNumber, req.grandTotal);
    } catch (e) {
      console.error('QR payment confirm error:', e);
    } finally {
      setConfirming(null);
    }

    markOrdersAsPaid(req.orderIds);

    // Notify customer page that payment is confirmed → close their waiting screen
    try {
      const ch = new BroadcastChannel('table-updates');
      ch.postMessage({
        type: 'PAYMENT_DONE',
        tableNumber: req.tableNumber,
        orderIds: req.orderIds,
        paymentMethod: 'transfer',
        timestamp: Date.now(),
      });
      ch.close();
    } catch (_) {}

    // Broadcast ORDER_PAID
    try {
      const ch = new BroadcastChannel('order-updates');
      req.orderIds.forEach(id => ch.postMessage({
        type: 'ORDER_PAID',
        orderId: id.toString(),
        tableNumber: req.tableNumber.toString(),
        paymentMethod: 'transfer',
        timestamp: Date.now(),
      }));
      ch.close();
    } catch (_) {}

    onPaymentConfirmed(req.tableNumber, req.orderIds);

    setRequests(prev => {
      const remaining = prev.filter(r => r.tableNumber !== req.tableNumber);
      saveQRRequests(remaining);
      if (remaining.length === 0) { setShowPopup(false); setViewingIndex(0); }
      else setViewingIndex(i => Math.min(i, remaining.length - 1));
      return remaining;
    });
  };

  // ✅ Reject: thu ngân từ chối (chưa thấy tiền về)
  const rejectQRPayment = async (req: QRPaymentRequest) => {
    if (rejecting === req.tableNumber) return;
    setRejecting(req.tableNumber);

    try {
      // Notify customer page that payment was NOT confirmed (back to payment screen)
      const ch = new BroadcastChannel('table-updates');
      ch.postMessage({
        type: 'PAYMENT_REJECTED',
        tableNumber: req.tableNumber,
        orderIds: req.orderIds,
        reason: 'Chưa nhận được tiền chuyển khoản',
        timestamp: Date.now(),
      });
      ch.close();
    } catch (_) {}

    setRejecting(null);

    // Remove from pending but keep it possible to re-confirm later if needed
    setRequests(prev => {
      const remaining = prev.filter(r => r.tableNumber !== req.tableNumber);
      saveQRRequests(remaining);
      if (remaining.length === 0) { setShowPopup(false); setViewingIndex(0); }
      else setViewingIndex(i => Math.min(i, remaining.length - 1));
      return remaining;
    });
  };

  const openPopup = () => { if (requests.length > 0) { setViewingIndex(0); setShowPopup(true); } };

  return (
    <>
      {/* ✅ QR popup notification — positioned slightly lower than cash to avoid overlap */}
      {showPopup && displayed && (
        <div className="fixed top-20 right-[340px] z-[100] animate-cash-in">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-2xl p-5 w-80 border-2 border-white">
            <div className="flex items-start gap-3">
              {/* Animated QR icon */}
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 relative">
                <QrCode className="w-6 h-6 text-white" />
                <div className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping" />
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="font-bold text-base mb-1 flex items-center gap-2">
                  <span>Khách thanh toán qua mã QR</span>
                  {requests.length > 1 && (
                    <span className="text-xs bg-white/30 px-1.5 py-0.5 rounded-full">{viewingIndex + 1}/{requests.length}</span>
                  )}
                </div>

                {/* Table & customer info */}
                <div className="text-sm opacity-90 mb-2 space-y-0.5">
                  <div>🪑 Bàn {displayed.tableNumber} · {displayed.customerName}</div>
                  {displayed.orderIds.length > 1 && (
                    <div className="text-xs opacity-80">{displayed.orderIds.length} đơn hàng · #{displayed.orderIds.join(', #')}</div>
                  )}
                </div>

                {/* Amount */}
                <div className="bg-white/20 rounded-xl px-3 py-2 mb-2">
                  <div className="text-xs opacity-80">Số tiền chuyển khoản:</div>
                  <div className="text-2xl font-bold tracking-tight">{displayed.grandTotal.toLocaleString('vi-VN')}đ</div>
                </div>

                {/* Bank info */}
                {displayed.bankName && (
                  <div className="bg-white/10 rounded-xl px-3 py-2 mb-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="opacity-70">Ngân hàng</span>
                      <span className="font-semibold">{displayed.bankName}</span>
                    </div>
                    {displayed.accountNumber && (
                      <div className="flex justify-between">
                        <span className="opacity-70">Số TK</span>
                        <span className="font-mono font-semibold">{displayed.accountNumber}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-table switcher */}
                {requests.length > 1 && (
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {requests.map((r, i) => (
                      <button key={r.tableNumber} onClick={() => setViewingIndex(i)}
                        className={`flex-1 py-1 rounded text-xs font-medium transition truncate min-w-0 ${i === viewingIndex ? 'bg-white text-blue-600' : 'bg-white/20 hover:bg-white/30'}`}>
                        Bàn {r.tableNumber}
                      </button>
                    ))}
                  </div>
                )}

                <div className="text-xs opacity-70 mb-3">{new Date(displayed.timestamp).toLocaleTimeString('vi-VN')}</div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {/* Confirm button */}
                  <button
                    onClick={() => confirmQRPayment(displayed)}
                    disabled={confirming === displayed.tableNumber || rejecting === displayed.tableNumber}
                    className="flex-1 bg-white text-blue-600 px-3 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center justify-center gap-1 text-sm disabled:opacity-70 disabled:cursor-wait"
                  >
                    {confirming === displayed.tableNumber ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Đang xử lý...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" />Xác nhận nhận tiền</>
                    )}
                  </button>

                  {/* Reject / hide button */}
                  <button
                    onClick={() => rejectQRPayment(displayed)}
                    disabled={confirming === displayed.tableNumber || rejecting === displayed.tableNumber}
                    className="px-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-1 text-xs disabled:opacity-50"
                    title="Chưa nhận được — bỏ qua"
                  >
                    {rejecting === displayed.tableNumber ? (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Hide popup without dismissing */}
                  <button onClick={() => setShowPopup(false)}
                    className="px-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition" title="Ẩn popup">
                    <span className="text-xs">–</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating badge when popup is hidden */}
      {requests.length > 0 && (
        <div className="fixed bottom-24 right-6 z-[90]">
          <button onClick={openPopup}
            className="bg-blue-500 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all relative animate-pulse">
            <QrCode className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 bg-white text-blue-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {requests.length}
            </div>
          </button>
        </div>
      )}
    </>
  );
};

// ============================================================================
// MAIN
// ============================================================================
export default function PaymentSystem() {
  const [orders, setOrders]                   = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder]     = useState<Order | null>(null);
  const [transactions, setTransactions]       = useState<Transaction[]>([]);
  const [payments, setPayments]               = useState<Payment[]>([]);
  const [bankAccounts, setBankAccounts]       = useState<BankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading]                 = useState(false);

  const [showPaymentModal, setShowPaymentModal]         = useState(false);
  const [showHistoryModal, setShowHistoryModal]         = useState(false);
  const [showQRModal, setShowQRModal]                   = useState(false);
  const [showBankSelectModal, setShowBankSelectModal]   = useState(false);
  const [showMergeModal, setShowMergeModal]             = useState(false);

  const [paymentMethod, setPaymentMethod]       = useState<'cash' | 'bank_transfer' | 'qr_code'>('cash');
  const [amountPaid, setAmountPaid]             = useState('');
  const [bankTransactionId, setBankTransactionId] = useState('');
  const [notes, setNotes]                       = useState('');
  const [dynamicQRUrl, setDynamicQRUrl]         = useState('');
  const [qrLoadError, setQrLoadError]           = useState(false);
  const [serverOrderTotal, setServerOrderTotal] = useState<number>(0);

  const [totalRevenue, setTotalRevenue] = useState(0);

  const [historyFilter, setHistoryFilter] = useState<'all' | 'cash' | 'bank_transfer' | 'qr_code'>('all');
  const [historySearch, setHistorySearch] = useState('');

  const [selectedTableForMerge, setSelectedTableForMerge] = useState<string | null>(null);
  const [ordersToMerge, setOrdersToMerge]               = useState<number[]>([]);
  const [mergedOrderPreview, setMergedOrderPreview]     = useState<Order | null>(null);

  const ordersRef       = useRef<Order[]>([]);
  const selectedOrderRef = useRef<Order | null>(null);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { selectedOrderRef.current = selectedOrder; }, [selectedOrder]);

  const callApiForCashPayment = useCallback(async (orderIds: number[], tableNumber: number, grandTotal: number): Promise<boolean> => {
    try {
     const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) return false;

      const currentOrders = ordersRef.current;
      let allSuccess = true;

      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const order = currentOrders.find(o => o.order_id === orderId);
        const orderTotal = order ? getOrderTotal(order) : grandTotal / orderIds.length;
        const amountForThisOrder = i === 0 ? grandTotal : orderTotal;

        try {
          let serverTotal = orderTotal;
          try {
            const dr = await fetch(`${API_URL}/orders/${orderId}/details`, {
              headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
            });
            const dd = await dr.json();
            if (dd.success && dd.data?.payment_breakdown?.total) {
              serverTotal = dd.data.payment_breakdown.total;
            }
          } catch (_) {}

          const payload = {
            order_id: orderId,
            payment_method: 'cash',
            amount_paid: Math.max(serverTotal, amountForThisOrder),
            bank_transaction_id: null,
            notes: orderIds.length > 1 ? `Thu tiền mặt - Gộp ${orderIds.length} bill` : 'Thu tiền mặt tại bàn',
          };

          const res = await fetch(`${API_URL}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!data.success) { allSuccess = false; } else { markOrdersAsPaid([orderId]); }
        } catch (e) { allSuccess = false; }
      }

      try {
        const stored = localStorage.getItem('staff-orders');
        if (stored) {
          const orderIdSet = new Set(orderIds.map(id => id.toString()));
          const updated = JSON.parse(stored).map((o: any) =>
            orderIdSet.has(o.id.toString()) ? { ...o, status: 'completed', paymentStatus: 'paid' } : o
          );
          localStorage.setItem('staff-orders', JSON.stringify(updated));
        }
      } catch (_) {}

      try {
        const remaining = loadCashRequests().filter(r => r.tableNumber !== tableNumber);
        saveCashRequests(remaining);
      } catch (_) {}

      try {
        const ch = new BroadcastChannel('order-updates');
        orderIds.forEach(id => ch.postMessage({
          type: 'ORDER_PAID', orderId: id.toString(), tableNumber: tableNumber.toString(), paymentMethod: 'cash', timestamp: Date.now(),
        }));
        ch.close();
      } catch (_) {}

      return allSuccess;
    } catch (e) { return false; }
  }, []);

  // ✅ NEW: API handler for QR payments (same flow as cash but method = 'bank_transfer')
  const callApiForQRPayment = useCallback(async (orderIds: number[], tableNumber: number, grandTotal: number): Promise<boolean> => {
    try {
     const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) return false;

      const currentOrders = ordersRef.current;
      let allSuccess = true;

      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const order = currentOrders.find(o => o.order_id === orderId);
        const orderTotal = order ? getOrderTotal(order) : grandTotal / orderIds.length;

        try {
          let serverTotal = orderTotal;
          try {
            const dr = await fetch(`${API_URL}/orders/${orderId}/details`, {
              headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
            });
            const dd = await dr.json();
            if (dd.success && dd.data?.payment_breakdown?.total) serverTotal = dd.data.payment_breakdown.total;
          } catch (_) {}

          const payload = {
            order_id: orderId,
            payment_method: 'bank_transfer',
            amount_paid: Math.max(serverTotal, i === 0 ? grandTotal : orderTotal),
            bank_transaction_id: null,
            notes: orderIds.length > 1 ? `Chuyển khoản QR - Gộp ${orderIds.length} bill` : 'Chuyển khoản QR tại bàn',
          };

          const res = await fetch(`${API_URL}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!data.success) { allSuccess = false; } else { markOrdersAsPaid([orderId]); }
        } catch (e) { allSuccess = false; }
      }

      try {
        const stored = localStorage.getItem('staff-orders');
        if (stored) {
          const orderIdSet = new Set(orderIds.map(id => id.toString()));
          const updated = JSON.parse(stored).map((o: any) =>
            orderIdSet.has(o.id.toString()) ? { ...o, status: 'completed', paymentStatus: 'paid' } : o
          );
          localStorage.setItem('staff-orders', JSON.stringify(updated));
        }
      } catch (_) {}

      try {
        const remaining = loadQRRequests().filter(r => r.tableNumber !== tableNumber);
        saveQRRequests(remaining);
      } catch (_) {}

      return allSuccess;
    } catch (e) { return false; }
  }, []);

  const handlePaymentDoneForTable = useCallback((tableNumber: number, orderIds: number[]) => {
    setOrders(prev => {
      const tableNumberStr = tableNumber.toString();
      if (orderIds && orderIds.length > 0) {
        const orderIdSet = new Set(orderIds.map(id => id.toString()));
        return prev.filter(o => !orderIdSet.has(o.order_id.toString()));
      }
      return prev.filter(o => o.table_number !== tableNumberStr);
    });

    setSelectedOrder(prev => {
      if (prev && prev.table_number === tableNumber.toString()) {
        setShowPaymentModal(false); setShowQRModal(false);
        setAmountPaid(''); setBankTransactionId(''); setNotes(''); setDynamicQRUrl(''); setPaymentMethod('cash'); setQrLoadError(false);
        return null;
      }
      return prev;
    });

    showCashierNotification(`✅ Bàn ${tableNumber} đã thanh toán xong`);
  }, []);

  // ✅ NEW: handler specifically for QR confirmation (shows different message)
  const handleQRPaymentConfirmed = useCallback((tableNumber: number, orderIds: number[]) => {
    setOrders(prev => {
      if (orderIds && orderIds.length > 0) {
        const orderIdSet = new Set(orderIds.map(id => id.toString()));
        return prev.filter(o => !orderIdSet.has(o.order_id.toString()));
      }
      return prev.filter(o => o.table_number !== tableNumber.toString());
    });

    setSelectedOrder(prev => {
      if (prev && prev.table_number === tableNumber.toString()) {
        setShowPaymentModal(false); setShowQRModal(false);
        setAmountPaid(''); setBankTransactionId(''); setNotes(''); setDynamicQRUrl(''); setPaymentMethod('cash'); setQrLoadError(false);
        return null;
      }
      return prev;
    });

    showCashierNotification(`✅ Bàn ${tableNumber} đã thanh toán qua mã QR`);
  }, []);

  const getTablesWithMultipleOrders = (): { [table: string]: Order[] } => {
    const groups: { [table: string]: Order[] } = {};
    orders.forEach(o => { if (!groups[o.table_number]) groups[o.table_number] = []; groups[o.table_number].push(o); });
    const filtered: { [table: string]: Order[] } = {};
    Object.keys(groups).forEach(t => { if (groups[t].length >= 2) filtered[t] = groups[t]; });
    return filtered;
  };

  const generateMergedPreview = (orderIds: number[]): Order | null => {
    const selected = orders.filter(o => orderIds.includes(o.order_id));
    if (!selected.length) return null;
    const merged: { [key: number]: OrderItem } = {};
    selected.forEach(order => {
      order.items.forEach(item => {
        const price = parseFloat(String(item.price)) > 0 ? parseFloat(String(item.price))
          : (item.subtotal && item.quantity ? parseFloat(String(item.subtotal)) / parseInt(String(item.quantity)) : 0);
        const qty = parseInt(String(item.quantity)) || 0;
        if (merged[item.item_id]) { merged[item.item_id].quantity += qty; merged[item.item_id].subtotal = merged[item.item_id].quantity * price; }
        else merged[item.item_id] = { ...item, price, quantity: qty, subtotal: qty * price };
      });
    });
    const items   = Object.values(merged);
    const subtotal = items.reduce((s, i) => s + (i.subtotal || 0), 0);
    return { order_id: selected[0].order_id, table_number: selected[0].table_number, customer_name: selected[0].customer_name, items, total_amount: subtotal, status: 'pending', payment_breakdown: { subtotal, tax: 0, service_charge: 0, discount: 0, total: subtotal } };
  };

  const handleMergeBillClick = (tableNumber: string) => {
    const tableOrders = orders.filter(o => o.table_number === tableNumber);
    setSelectedTableForMerge(tableNumber);
    const ids = tableOrders.map(o => o.order_id);
    setOrdersToMerge(ids);
    setMergedOrderPreview(generateMergedPreview(ids));
    setShowMergeModal(true);
  };

  const toggleOrderForMerge = (orderId: number) => {
    const updated = ordersToMerge.includes(orderId) ? ordersToMerge.filter(id => id !== orderId) : [...ordersToMerge, orderId];
    setOrdersToMerge(updated);
    setMergedOrderPreview(updated.length > 0 ? generateMergedPreview(updated) : null);
  };

  const confirmMergeBills = () => {
    if (!mergedOrderPreview || ordersToMerge.length < 2) { alert('⚠️ Vui lòng chọn ít nhất 2 đơn hàng để gộp!'); return; }
    setSelectedOrder(mergedOrderPreview);
    setAmountPaid(mergedOrderPreview.payment_breakdown?.total.toString() || '');
    setServerOrderTotal(0);
    setShowMergeModal(false);
    setShowPaymentModal(true);
  };

  useEffect(() => { loadBankAccountsFromLocalStorage(); }, []);
  useEffect(() => {
    const handler = (e: StorageEvent) => { if (e.key === STORAGE_KEY) loadBankAccountsFromLocalStorage(); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const loadBankAccountsFromLocalStorage = () => {
    const active = loadActiveBankAccountsFromStorage();
    setBankAccounts(active);
    if (active.length > 0) {
      const still = active.find(a => a.id === selectedBankAccount?.id);
      setSelectedBankAccount(still || active[0]);
    } else setSelectedBankAccount(null);
  };

  useEffect(() => {
  loadInitialData();
  const bankInterval = setInterval(loadBankFeed, 10000);
  const orderInterval = setInterval(loadPendingOrders, 8000);
  return () => {
    clearInterval(bankInterval);
    clearInterval(orderInterval);
  };
}, []);
  const loadInitialData   = async () => { await Promise.all([loadPendingOrders(), loadBankFeed(), loadTodayTransactions()]); };

  const loadPendingOrders = async () => {
    try {
      const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${API_URL}/pending`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
      const data = await res.json();
      if (data.success) {
        const paidIds = getPaidOrderIds();
        const filteredOrders = (data.data || []).filter((o: Order) => !paidIds.has(o.order_id));
        setOrders(filteredOrders);
      }
    } catch (e) { console.error(e); }
  };

  const handleOrderCancellation = useCallback((orderId: string, tableNumber: string, _source: string) => {
    const id = orderId.toString();
    setOrders(prev => prev.filter(o => o.order_id.toString() !== id));
    setSelectedOrder(prev => {
      if (prev?.order_id.toString() === id) {
        setShowPaymentModal(false); setShowQRModal(false);
        setAmountPaid(''); setBankTransactionId(''); setNotes(''); setDynamicQRUrl(''); setPaymentMethod('cash'); setQrLoadError(false);
        return null;
      }
      return prev;
    });
    setTimeout(loadPendingOrders, 500);
    showCashierNotification(`Đơn hàng bàn ${tableNumber} đã bị hủy`);
  }, []);

  useEffect(() => {
    const ch = new BroadcastChannel('order-updates');
   ch.onmessage = (e) => {
  if (e.data?.type === 'ORDER_CANCELLED') {
    handleOrderCancellation(e.data.orderId, e.data.tableNumber, 'bc');

  } else if (e.data?.type === 'NEW_ORDER' || e.data?.type === 'ORDER_UPDATED' || e.data?.type === 'ORDER_STATUS_CHANGE') {
    // ← PHẢI Ở ĐÂY, NGANG CẤP với ORDER_CANCELLED và ORDER_PAID
    setTimeout(() => loadPendingOrders(), 300);

  } else if (e.data?.type === 'ORDER_PAID') {
    const paidOrderId = e.data.orderId?.toString();
    const paidTableNumber = e.data.tableNumber?.toString();
    if (paidOrderId) {
      setOrders(prev => prev.filter(o => o.order_id.toString() !== paidOrderId));
      setSelectedOrder(prev => {
        if (prev?.order_id.toString() === paidOrderId) {
          setShowPaymentModal(false); setShowQRModal(false);
          setAmountPaid(''); setBankTransactionId(''); setNotes(''); setDynamicQRUrl(''); setPaymentMethod('cash'); setQrLoadError(false);
          return null;
        }
        return prev;

      });
    }

        if (paidTableNumber) {
          const tableNum = parseInt(paidTableNumber);
          saveCashRequests(loadCashRequests().filter(r => r.tableNumber !== tableNum));
          saveQRRequests(loadQRRequests().filter(r => r.tableNumber !== tableNum)); // NEW
        }
      }
    };
    const handler = (e: StorageEvent) => {
      if (e.key === 'order_cancellation_trigger' && e.newValue) {
        try { const d = JSON.parse(e.newValue); if (d.type === 'ORDER_CANCELLED') handleOrderCancellation(d.orderId, d.tableNumber, 'ls'); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => { ch.close(); window.removeEventListener('storage', handler); };
  }, [handleOrderCancellation]);

  const showCashierNotification = (message: string) => {
    const n = document.createElement('div');
    n.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100] animate-slide-in';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => { n.classList.add('animate-slide-out'); setTimeout(() => { if (document.body.contains(n)) document.body.removeChild(n); }, 300); }, 4000);
  };

  const loadBankFeed = async () => {
    try {
    const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${API_URL}/bank-feed?status=PENDING`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
      const data = await res.json();
      if (data.success) setTransactions(data.data.transactions || []);
    } catch (e) {}
  };

  const loadTodayTransactions = async () => {
    try {
     const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${API_URL}/transactions/today`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
      const data = await res.json();
      if (data.success) { setPayments(data.data.transactions || []); setTotalRevenue(data.data.summary?.total_revenue || 0); }
    } catch (e) {}
  };

  const handlePaymentClick = async (order: Order) => {
    setLoading(true);
    try {
    const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) { alert('Vui lòng đăng nhập!'); return; }
      const res  = await fetch(`${API_URL}/orders/${order.order_id}/details`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
      const data = await res.json();
      if (data.success) {
        const od: Order = data.data;
        const subtotal  = getOrderTotal(od);
        const svrTotal  = od.payment_breakdown?.total ?? subtotal;
        setServerOrderTotal(svrTotal);
        od.payment_breakdown = { subtotal, tax: 0, service_charge: 0, discount: 0, total: subtotal };
        setSelectedOrder(od);
        setAmountPaid(subtotal.toString());
        setShowPaymentModal(true);
      } else alert(data.message || 'Không thể lấy thông tin đơn hàng');
    } catch (e) { alert('Lỗi khi lấy thông tin đơn hàng'); }
    finally { setLoading(false); }
  };

  const processPayment = async () => {
    if (!selectedOrder) return;
    const isMerged    = ordersToMerge.length > 1;
    const displayTotal = getOrderTotal(selectedOrder);
    const paidAmount  = parseFloat(amountPaid) || 0;
    const clientChange = Math.max(0, paidAmount - displayTotal);
    setLoading(true);
    try {
     const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) { alert('Vui lòng đăng nhập!'); return; }

      if (isMerged) {
        const failed: number[] = [];
        for (let i = 0; i < ordersToMerge.length; i++) {
          const orderId = ordersToMerge[i];
          const isFirst = i === 0;
          try {
            let svrTotal: number | null = null;
            try {
              const dr = await fetch(`${API_URL}/orders/${orderId}/details`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
              const dd = await dr.json();
              if (dd.success && dd.data?.payment_breakdown?.total) svrTotal = dd.data.payment_breakdown.total;
            } catch {}
            const local       = orders.find(o => o.order_id === orderId);
            const localTotal  = local ? getOrderTotal(local) : 0;
            const orderPaid   = isFirst ? paidAmount : (svrTotal ?? localTotal);
            const payload     = { order_id: orderId, payment_method: paymentMethod, amount_paid: orderPaid, bank_transaction_id: null, notes: isFirst ? (notes || `Gộp ${ordersToMerge.length} bill - Đơn chính`) : `Gộp với đơn #${ordersToMerge[0]}` };
            const r           = await fetch(`${API_URL}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify(payload) });
            const rd          = await r.json();
            if (!rd.success) {
              if (isFirst) { alert(' ' + (rd.detail || rd.message || 'Thanh toán thất bại')); setLoading(false); return; }
              if (svrTotal !== null && orderPaid !== svrTotal) {
                try {
                  const rr = await fetch(`${API_URL}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify({ ...payload, amount_paid: svrTotal }) });
                  const rrd = await rr.json();
                  if (!rrd.success) failed.push(orderId);
                } catch { failed.push(orderId); }
              } else failed.push(orderId);
            }
          } catch (e) { if (i === 0) { alert(' Lỗi khi xử lý thanh toán'); setLoading(false); return; } failed.push(orderId); }
        }
        alert(failed.length > 0
          ? ` Thanh toán gộp hoàn tất!\n\nTổng: ${displayTotal.toLocaleString('vi-VN')}đ\nTiền nhận: ${paidAmount.toLocaleString('vi-VN')}đ\nTiền thừa: ${clientChange.toLocaleString('vi-VN')}đ\n\n⚠️ Đơn #${failed.join(', #')} cần đánh dấu thủ công.`
          : ` Thanh toán gộp ${ordersToMerge.length} bill thành công!\n\nTổng: ${displayTotal.toLocaleString('vi-VN')}đ\nTiền nhận: ${paidAmount.toLocaleString('vi-VN')}đ\nTiền thừa: ${clientChange.toLocaleString('vi-VN')}đ`);
      } else {
        const apiPaid = serverOrderTotal > 0 ? Math.max(serverOrderTotal, paidAmount) : paidAmount;
        const res   = await fetch(`${API_URL}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify({ order_id: selectedOrder.order_id, payment_method: paymentMethod, amount_paid: apiPaid, bank_transaction_id: null, notes }) });
        const data  = await res.json();
        if (!data.success) { alert(' ' + (data.detail || data.message || 'Thanh toán thất bại')); setLoading(false); return; }
      }

      try {
        const tableNum = parseInt(selectedOrder.table_number);
        saveCashRequests(loadCashRequests().filter(r => r.tableNumber !== tableNum));
        saveQRRequests(loadQRRequests().filter(r => r.tableNumber !== tableNum)); // NEW
      } catch (_) {}

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch  = new BroadcastChannel('order-updates');
        const ids = isMerged ? ordersToMerge : [selectedOrder.order_id];
        ids.forEach(id => ch.postMessage({ type: 'ORDER_PAID', orderId: id.toString(), tableNumber: selectedOrder.table_number, paymentMethod, isMerged, timestamp: Date.now() }));
        ch.close();
      }

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('table-updates');
        ch.postMessage({
          type: 'PAYMENT_DONE',
          tableNumber: parseInt(selectedOrder.table_number),
          orderIds: isMerged ? ordersToMerge : [selectedOrder.order_id],
          paymentMethod,
          timestamp: Date.now(),
        });
        ch.close();
      }

      try {
        const stored = localStorage.getItem('staff-orders');
        if (stored) {
          const ids = isMerged ? ordersToMerge : [selectedOrder.order_id];
          markOrdersAsPaid(ids);
          localStorage.setItem('staff-orders', JSON.stringify(JSON.parse(stored).map((o: any) => ids.includes(parseInt(o.id)) ? { ...o, status: 'completed', paymentStatus: 'paid' } : o)));
        }
      } catch {}

      setShowPaymentModal(false); setShowQRModal(false); setPaymentMethod('cash');
      setAmountPaid(''); setBankTransactionId(''); setNotes(''); setSelectedOrder(null);
      setDynamicQRUrl(''); setServerOrderTotal(0); setOrdersToMerge([]); setMergedOrderPreview(null); setSelectedTableForMerge(null);
      await Promise.all([loadPendingOrders(), loadTodayTransactions()]);
    } catch (e) { alert('Lỗi khi xử lý thanh toán'); }
    finally { setLoading(false); }
  };

  const calculateChange = () => !selectedOrder || !amountPaid ? 0 : Math.max(0, parseFloat(amountPaid) - getOrderTotal(selectedOrder));

  const handleModalBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) { setShowQRModal(false); setShowPaymentModal(true); }
  };

  const handleQRCodePayment = () => {
    if (!bankAccounts.length) { alert(' Không có tài khoản ngân hàng nào được kích hoạt!'); return; }
    if (!selectedBankAccount || !selectedOrder) return;
    const displayTotal = getOrderTotal(selectedOrder);
    const qrUrl = getPaymentQRUrl(selectedBankAccount, displayTotal, selectedOrder.order_id, selectedOrder.table_number);
    if (!qrUrl) { alert('Không thể tạo mã QR. Vui lòng kiểm tra thông tin tài khoản!'); return; }
    setPaymentMethod('qr_code'); setQrLoadError(false); setDynamicQRUrl(qrUrl);
    setBankTransactionId(`DH${selectedOrder.order_id} Ban${selectedOrder.table_number}`);
    setShowPaymentModal(false); setShowQRModal(true);
  };

  const filteredPayments = payments.filter(p => {
    const mf = historyFilter === 'all' || p.payment_method === historyFilter;
    const ms = p.order_id.toString().includes(historySearch) || (p.table_number?.toLowerCase().includes(historySearch.toLowerCase()) ?? false);
    return mf && ms;
  });

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'cash':          return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">💵 Tiền mặt</span>;
      case 'bank_transfer': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">🏦 Chuyển khoản</span>;
      case 'qr_code':       return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">📱 QR Code</span>;
      default:              return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">{method}</span>;
    }
  };

  const mergeableTables = getTablesWithMultipleOrders();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      {/* ✅ Cash payment notification (unchanged) */}
      <CashPaymentNotification
        onPaymentDoneForTable={handlePaymentDoneForTable}
        onCallApiForCashPayment={callApiForCashPayment}
      />

      {/* ✅ NEW: QR payment notification */}
      <QRPaymentNotification
        onPaymentConfirmed={handleQRPaymentConfirmed}
        onCallApiForQRPayment={callApiForQRPayment}
      />

      <div className="w-full lg:ml-64 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

            {/* Left Panel */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 mt-12 lg:mt-0">

              {/* Revenue Card */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-4 sm:p-6 border-2 border-yellow-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-400 rounded-full flex items-center justify-center text-xl sm:text-2xl">💰</div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">THU NGÂN</h2>
                </div>
                <div className="mb-2 text-sm text-gray-600">Tổng doanh thu (Hôm nay)</div>
                <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-4">{totalRevenue.toLocaleString('vi-VN')}đ</div>

                {bankAccounts.length > 0 ? (
                  <div className="bg-white rounded-lg p-3 sm:p-4 mb-3 border border-yellow-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-gray-500">🏦 Tài khoản nhận thanh toán</div>
                      {bankAccounts.length > 1 && (
                        <button onClick={() => setShowBankSelectModal(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Đổi ({bankAccounts.length} TK)</button>
                      )}
                    </div>
                    {selectedBankAccount && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 ${getBankColor(selectedBankAccount.bankName)} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                            {selectedBankAccount.bankLogo || selectedBankAccount.bankName.substring(0, 3)}
                          </div>
                          <span className="font-semibold text-gray-800 text-sm sm:text-base">{selectedBankAccount.bankName}</span>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ VietQR</span>
                        </div>
                        <div className="font-mono text-sm font-semibold text-blue-600">{selectedBankAccount.accountNumber}</div>
                        <div className="text-xs sm:text-sm text-gray-700">{selectedBankAccount.accountHolder}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-orange-50 rounded-lg p-3 sm:p-4 mb-3 border-2 border-orange-200">
                    <div className="flex items-center gap-2 text-orange-700">
                      <span className="text-xl">⚠️</span>
                      <div className="text-xs sm:text-sm">
                        <div className="font-semibold">Chưa có tài khoản ngân hàng</div>
                        <div className="text-xs">Vui lòng kích hoạt tài khoản trong phần quản lý</div>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={() => { loadBankFeed(); loadBankAccountsFromLocalStorage(); }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm sm:text-base">
                  🔄 Làm mới
                </button>
              </div>

              {/* Orders Section */}
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Đơn hàng chờ thanh toán ({orders.length})</h3>

                {Object.keys(mergeableTables).length > 0 && (
                  <div className="mb-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-yellow-800 mb-3">
                      <span className="text-2xl">🔀</span>
                      <div><div className="font-bold">Có thể gộp hóa đơn</div><div className="text-sm">{Object.keys(mergeableTables).length} bàn có nhiều đơn hàng</div></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(mergeableTables).map(([table, tableOrders]) => (
                        <button key={table} onClick={() => handleMergeBillClick(table)} className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                          Gộp Bàn {table} ({tableOrders.length} bill)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500"><div className="text-4xl mb-2">📭</div><div>Không có đơn hàng nào</div></div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const orderTotal = getOrderTotal(order);
                      return (
                        <div key={order.order_id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-sm font-semibold text-gray-700">#{order.order_id}</span>
                                <span className="font-medium text-gray-800">Bàn {order.table_number}</span>
                                {orders.filter(o => o.table_number === order.table_number).length > 1 && (
                                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                                    Có {orders.filter(o => o.table_number === order.table_number).length} bill
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 mb-3">
                                {order.items.map((item) => (
                                  <div key={item.item_id} className="text-xs sm:text-sm text-gray-600">
                                    {item.quantity}x {item.item_name} = {(item.quantity * item.price).toLocaleString('vi-VN')}đ
                                  </div>
                                ))}
                              </div>
                              <div className="border-t pt-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-500">Tổng cộng</span>
                                  <span className="font-bold text-lg sm:text-xl text-orange-600">{orderTotal.toLocaleString('vi-VN')}đ</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3 pt-3 border-t">
                            <button onClick={() => handlePaymentClick(order)} disabled={loading} className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-2 sm:py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm sm:text-base">
                              💳 Thanh toán
                            </button>
                            {orders.filter(o => o.table_number === order.table_number).length > 1 && (
                              <button onClick={() => handleMergeBillClick(order.table_number)} className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors flex items-center gap-1 text-sm sm:text-base" title="Gộp bill cùng bàn">
                                <span>🔀</span><span className="hidden sm:inline">Gộp</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4"><span className="text-2xl">⚡</span><h3 className="text-base sm:text-lg font-bold text-gray-800">Thao tác nhanh</h3></div>
                <div className="space-y-3">
                  <button onClick={() => { setShowHistoryModal(true); loadTodayTransactions(); }} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 sm:py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base">
                    📋 Lịch sử giao dịch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MERGE MODAL */}
      {showMergeModal && selectedTableForMerge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3"><span className="text-2xl">🔀</span><div><h2 className="text-xl font-bold">Gộp Hóa Đơn</h2><p className="text-sm opacity-90">Bàn {selectedTableForMerge}</p></div></div>
              <button onClick={() => { setShowMergeModal(false); setSelectedTableForMerge(null); setOrdersToMerge([]); setMergedOrderPreview(null); }} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span>📋</span><span>Chọn hóa đơn muốn gộp</span></h3>
                  <div className="space-y-3">
                    {orders.filter(o => o.table_number === selectedTableForMerge).map(order => {
                      const isSelected = ordersToMerge.includes(order.order_id);
                      const subtotal   = getOrderTotal(order);
                      return (
                        <div key={order.order_id} onClick={() => toggleOrderForMerge(order.order_id)}
                          className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${isSelected ? 'border-yellow-500 bg-yellow-50 shadow-md' : 'border-gray-200 hover:border-yellow-300 hover:bg-gray-50'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div><div className="font-mono text-sm font-semibold text-gray-700 mb-1">Đơn #{order.order_id}</div>{order.customer_name && <div className="text-xs text-gray-600">{order.customer_name}</div>}</div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-yellow-500 bg-yellow-500' : 'border-gray-300'}`}>{isSelected && <span className="text-white text-sm">✓</span>}</div>
                          </div>
                          <div className="space-y-1 mb-3">
                            {order.items.map(item => (
                              <div key={item.item_id} className="text-xs text-gray-600 flex justify-between">
                                <span>{item.quantity}x {item.item_name}</span>
                                <span className="font-medium">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t pt-2 flex justify-between items-center">
                            <span className="text-sm text-gray-600">Tổng</span>
                            <span className="font-bold text-gray-800">{subtotal.toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>
                      );
                    })}     
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span>👁️</span><span>Xem trước hóa đơn gộp</span></h3>
                  {mergedOrderPreview ? (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-green-200">
                        <div><div className="text-sm text-gray-600">Hóa đơn gộp</div><div className="font-bold text-lg">Bàn {mergedOrderPreview.table_number}</div></div>
                        <div className="text-right"><div className="text-xs text-gray-600">Số bill gộp</div><div className="text-2xl font-bold text-yellow-600">{ordersToMerge.length}</div></div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="font-semibold text-gray-700 mb-2">🍽️ Chi tiết:</div>
                        {mergedOrderPreview.items.map(item => (
                          <div key={item.item_id} className="flex justify-between text-sm bg-white rounded-lg p-2">
                            <span className="font-medium">{item.quantity}x {item.item_name}</span>
                            <span className="font-bold text-gray-800">{(item.subtotal || 0).toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800 text-lg">TỔNG CỘNG</span>
                          <span className="text-2xl font-bold text-green-600">{(mergedOrderPreview.payment_breakdown?.total || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-8 border-2 border-dashed border-gray-300 text-center">
                      <div className="text-5xl mb-3 opacity-50">🧾</div>
                      <div className="text-gray-500 font-medium mb-2">Chưa chọn hóa đơn</div>
                      <div className="text-sm text-gray-400">Chọn ít nhất 2 hóa đơn để xem trước</div>
                    </div>
                  )}                 
                </div>
              </div>
            </div>
            <div className="border-t p-4 bg-gray-50 flex flex-col sm:flex-row gap-3">
              <button onClick={() => { setShowMergeModal(false); setSelectedTableForMerge(null); setOrdersToMerge([]); setMergedOrderPreview(null); }} className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors">← Hủy</button>
              <button onClick={confirmMergeBills} disabled={!mergedOrderPreview || ordersToMerge.length < 2} className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-lg font-bold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {ordersToMerge.length < 2 ? 'Chọn ít nhất 2 bill' : `✅ Xác nhận gộp và thanh toán (${ordersToMerge.length} bill)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3"><span className="text-2xl">📋</span><h2 className="text-xl font-bold">Lịch Sử Giao Dịch</h2></div>
              <button onClick={() => setShowHistoryModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-4 border-b bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input type="text" placeholder="Tìm theo mã đơn hoặc bàn..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div className="flex gap-2">
                  {(['all', 'cash', 'qr_code'] as const).map((f) => (
                    <button key={f} onClick={() => setHistoryFilter(f)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${historyFilter === f ? (f === 'all' ? 'bg-blue-500' : f === 'cash' ? 'bg-green-500' : 'bg-purple-500') + ' text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                      {f === 'all' ? 'Tất cả' : f === 'cash' ? '💵 Tiền mặt' : '📱 QR'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><div className="text-5xl mb-3">📭</div><div className="font-semibold">Không có giao dịch nào</div></div>
              ) : (
                <div className="space-y-3">
                  {filteredPayments.map(payment => (
                    <div key={payment.payment_id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-sm font-semibold text-gray-700">Đơn #{payment.order_id}</span>
                            {payment.table_number && <span className="text-sm text-gray-600">• Bàn {payment.table_number}</span>}
                          </div>
                          <div className="mb-2">{getPaymentMethodBadge(payment.payment_method)}</div>
                          <div className="text-xs text-gray-500">{payment.created_at ? new Date(payment.created_at).toLocaleString('vi-VN') : 'N/A'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">{(payment.total_amount || 0).toLocaleString('vi-VN')}đ</div>
                          <div className="text-xs text-gray-500 mt-1">Nhận: {(payment.amount_paid || 0).toLocaleString('vi-VN')}đ</div>
                          {(payment.change_given || 0) > 0 && <div className="text-xs text-orange-600">Thối: {(payment.change_given || 0).toLocaleString('vi-VN')}đ</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">Tổng: <span className="font-bold">{filteredPayments.length}</span> giao dịch</div>
              <button onClick={() => setShowHistoryModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium transition-colors">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* BANK SELECT MODAL */}
      {showBankSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-bold">Chọn tài khoản ngân hàng</h2>
              <button onClick={() => setShowBankSelectModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              {bankAccounts.map(account => (
                <button key={account.id} onClick={() => { setSelectedBankAccount(account); setShowBankSelectModal(false); }}
                  className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all text-left ${selectedBankAccount?.id === account.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 ${getBankColor(account.bankName)} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                      {account.bankLogo || account.bankName.substring(0, 3)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-800 text-sm sm:text-base">{account.bankName}</div>
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">VietQR</span>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">{account.accountHolder}</div>
                    </div>
                    {selectedBankAccount?.id === account.id && <div className="text-blue-500 text-xl">✓</div>}
                  </div>
                  <div className="font-mono text-xs sm:text-sm text-gray-700">{account.accountNumber}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-t-2xl flex justify-between items-center">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">💳 Thanh Toán</h2>
                {ordersToMerge.length > 1 && <p className="text-sm opacity-90 mt-1">🔀 Gộp {ordersToMerge.length} hóa đơn</p>}
              </div>
              <button onClick={() => { setShowPaymentModal(false); setOrdersToMerge([]); setMergedOrderPreview(null); }} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">✕</button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs sm:text-sm text-gray-600">{ordersToMerge.length > 1 ? 'Hóa đơn gộp' : 'Đơn hàng'}</div>
                    <div className="font-mono text-lg sm:text-xl font-bold">{ordersToMerge.length > 1 ? `#${ordersToMerge.join(', #')}` : `#${selectedOrder.order_id}`}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs sm:text-sm text-gray-600">Bàn</div>
                    <div className="text-lg sm:text-xl font-bold">{selectedOrder.table_number}</div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {selectedOrder.items.map((item) => (
                    <div key={item.item_id} className="flex justify-between text-xs sm:text-sm">
                      <span>{item.quantity}x {item.item_name}</span>
                      <span className="font-semibold">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-base sm:text-lg">TỔNG CỘNG</span>
                    <span className="text-xl sm:text-2xl font-bold text-orange-600">{getOrderTotal(selectedOrder).toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Phương thức thanh toán</label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <button onClick={() => setPaymentMethod('cash')} className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                    <div className="text-xl sm:text-2xl mb-1">💵</div>
                    <div className="text-xs sm:text-sm font-semibold">Tiền mặt</div>
                  </button>
                  <button onClick={handleQRCodePayment} disabled={bankAccounts.length === 0} className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${paymentMethod === 'qr_code' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'} ${bankAccounts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="text-xl sm:text-2xl mb-1">📱</div>
                    <div className="text-xs sm:text-sm font-semibold">QR Code</div>
                    {bankAccounts.length === 0 && <div className="text-xs text-red-500 mt-1">Chưa có TK</div>}
                  </button>
                </div>
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền nhận</label>
                <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none text-base sm:text-lg font-semibold" placeholder="Nhập số tiền..." />
                {parseFloat(amountPaid) > 0 && (
                  <div className="mt-2 text-xs sm:text-sm">
                    <span className="text-gray-600">Tiền thừa: </span>
                    <span className="font-bold text-green-600">{calculateChange().toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
              </div>

              {paymentMethod !== 'cash' && (
                <div className="mb-4 sm:mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mã giao dịch ngân hàng</label>
                  <input type="text" value={bankTransactionId} onChange={(e) => setBankTransactionId(e.target.value)} className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none text-sm sm:text-base" placeholder="VCB_123456..." />
                </div>
              )}

              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú (tùy chọn)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none text-sm sm:text-base" rows={3} placeholder="Ghi chú thêm..." />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={processPayment} disabled={loading || !amountPaid || parseFloat(amountPaid) < getOrderTotal(selectedOrder)}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-colors">
                  {loading ? 'Đang xử lý...' : '✅ Xác nhận thanh toán'}
                </button>
                <button onClick={() => { setShowPaymentModal(false); setOrdersToMerge([]); setMergedOrderPreview(null); }} className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 sm:py-4 rounded-xl font-medium transition-colors">Hủy</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {showQRModal && selectedOrder && selectedBankAccount && dynamicQRUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]" onClick={handleModalBackdropClick}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-base sm:text-lg font-bold">📱 Quét Mã QR Thanh Toán</h2>
              <button onClick={() => { setShowQRModal(false); setShowPaymentModal(true); }} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">✕</button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 sm:p-4 mb-4 border-2 border-green-200 text-center">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">💰 Số tiền thanh toán</div>
                <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">{getOrderTotal(selectedOrder).toLocaleString('vi-VN')}đ</div>
                <div className="text-xs text-gray-500 border-t pt-2">
                  {ordersToMerge.length > 1 ? `Gộp ${ordersToMerge.length} bill - Bàn ${selectedOrder.table_number}` : `Đơn #${selectedOrder.order_id} - Bàn ${selectedOrder.table_number}`}
                </div>
                <div className="text-xs text-blue-600 font-mono mt-1">ND: DH{selectedOrder.order_id} Ban{selectedOrder.table_number}</div>
              </div>
              <div className="bg-white rounded-xl border-4 border-blue-100 p-2 mb-4 min-h-[300px] flex items-center justify-center">
                {qrLoadError ? (
                  <div className="text-center p-8">
                    <div className="text-4xl mb-4">⚠️</div>
                    <div className="text-gray-700 font-semibold mb-2">Không thể tạo mã QR</div>
                    <button onClick={() => { setShowQRModal(false); setShowPaymentModal(true); }} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">← Quay lại</button>
                  </div>
                ) : (
                  <div className="relative">
                    <img src={dynamicQRUrl} alt="VietQR Thanh Toán" className="w-full h-auto max-h-96 object-contain rounded-lg" onError={() => setQrLoadError(true)} />
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">VietQR</div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 ${getBankColor(selectedBankAccount.bankName)} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                    {selectedBankAccount.bankLogo || selectedBankAccount.bankName.substring(0, 3)}
                  </div>
                  <div className="font-semibold text-gray-800 text-sm">{selectedBankAccount.bankName}</div>
                </div>
                <div className="font-mono text-xs sm:text-sm font-semibold text-gray-800">{selectedBankAccount.accountNumber}</div>
                <div className="text-xs sm:text-sm text-gray-700">{selectedBankAccount.accountHolder}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={processPayment} disabled={loading} className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                  {loading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Đang xử lý...</> : '✓ Xác nhận đã chuyển khoản'}
                </button>
                <button onClick={() => { setShowQRModal(false); setShowPaymentModal(true); }} disabled={loading} className="px-4 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium text-sm">← Quay lại</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn    { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut   { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes cashIn     { from { transform: translateX(100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
        .animate-slide-in  { animation: slideIn  0.3s ease-out; }
        .animate-slide-out { animation: slideOut 0.3s ease-in;  }
        .animate-cash-in   { animation: cashIn   0.35s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>
    </div>
  );
}