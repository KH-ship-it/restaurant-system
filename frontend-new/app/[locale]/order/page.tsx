'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, CheckCircle, BarChart3, Users, ShoppingCart, FileText, Package, CreditCard, Calendar, User, Bell, X as XIcon } from 'lucide-react';

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

interface StaffCall {
  tableNumber: number;
  customerName: string;
  timestamp: number;
  status: 'pending' | 'acknowledged' | 'completed';
  type: 'CALL_STAFF' | 'CASH_PAYMENT';
  grandTotal?: number;
  orderIds?: number[];
}

const STAFF_NOTIFICATIONS_KEY = 'staff-notifications-pending';
// ✅ KEY để track order ids đã paid (tránh hiện lại sau reload)
const PAID_ORDERS_KEY = 'om-paid-order-ids';

const saveNotifications = (calls: StaffCall[]) => {
  try { localStorage.setItem(STAFF_NOTIFICATIONS_KEY, JSON.stringify(calls)); } catch (_) {}
};

const loadNotifications = (): StaffCall[] => {
  try {
    const stored = localStorage.getItem(STAFF_NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (_) { return []; }
};

// ✅ Đánh dấu order ids đã được thanh toán
const markOrdersAsPaidLocal = (orderIds: (number | string)[]) => {
  try {
    const stored = localStorage.getItem(PAID_ORDERS_KEY);
    const existing: string[] = stored ? JSON.parse(stored) : [];
    const updated = [...new Set([...existing, ...orderIds.map(String)])];
    // Giữ tối đa 500 ids
    localStorage.setItem(PAID_ORDERS_KEY, JSON.stringify(updated.slice(-500)));
  } catch (_) {}
};

const getPaidOrderIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(PAID_ORDERS_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch (_) { return new Set(); }
};

const sidebarItems = [
  { label: 'Thống kê',    path: '/vi/thongke',   icon: BarChart3,    active: false },
  { label: 'Quản lý bàn', path: '/vi/qldatban',  icon: Calendar,     active: false },
  { label: 'Thực đơn',    path: '/vi/qlmenu',     icon: FileText,     active: false },
  { label: 'Nhân viên',   path: '/vi/qlnhanvien', icon: Users,        active: false },
  { label: 'Đơn hàng',    path: '/vi/order',      icon: ShoppingCart, active: true  },
  { label: 'Tài khoản',   path: '/vi/qltk',       icon: User,         active: false },
  { label: 'Kho vận',     path: '/vi/qlkho',      icon: Package,      active: false },
  { label: 'Thu ngân',    path: '/vi/thungan',    icon: CreditCard,   active: false },
];

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
          {sidebarItems.map((item, index) => {
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

// ============================================================
// STAFF CALL NOTIFICATION
// ============================================================
const StaffCallNotification = ({
  onCallApiForCashPayment,
}: {
  // ✅ FIX: Nhận callback gọi API từ main component
  onCallApiForCashPayment: (orderIds: number[], tableNumber: number, grandTotal: number) => Promise<boolean>;
}) => {
  const [calls, setCalls] = useState<StaffCall[]>([]);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [dismissing, setDismissing] = useState<number | null>(null);

  const displayedCall = calls.length > 0 ? (calls[viewingIndex] ?? calls[0]) : null;

  useEffect(() => {
    const stored = loadNotifications();
    if (stored.length > 0) {
      setCalls(stored);
      setShowNotification(true);
    }
  }, []);

  const playNotificationSound = () => {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  };

  useEffect(() => {
    const channel = new BroadcastChannel('staff-notifications');

    channel.onmessage = (event) => {
      const { type, tableNumber, customerName, timestamp, grandTotal, orderIds } = event.data;

      if (type === 'CALL_STAFF') {
        const newCall: StaffCall = {
          tableNumber, customerName, timestamp,
          status: 'pending', type: 'CALL_STAFF',
        };
        setCalls(prev => {
          const updated = [newCall, ...prev.filter(c => !(c.tableNumber === tableNumber && c.type === 'CALL_STAFF'))];
          saveNotifications(updated);
          return updated;
        });
        setViewingIndex(0);
        setShowNotification(true);
        playNotificationSound();
        setTimeout(() => setShowNotification(false), 15000);
      }

      if (type === 'CASH_PAYMENT_REQUEST') {
        const newCall: StaffCall = {
          tableNumber,
          customerName: customerName || 'Khách',
          timestamp,
          status: 'pending',
          type: 'CASH_PAYMENT',
          grandTotal,
          orderIds,
        };
        setCalls(prev => {
          const updated = [newCall, ...prev.filter(c => !(c.tableNumber === tableNumber && c.type === 'CASH_PAYMENT'))];
          saveNotifications(updated);
          return updated;
        });
        setViewingIndex(0);
        setShowNotification(true);
        playNotificationSound();
        setTimeout(() => setShowNotification(false), 20000);
      }
    };

    const syncCallStaffFromStorage = () => {
      try {
        const stored = localStorage.getItem('staff-calls');
        if (!stored) return;
        const pending = (JSON.parse(stored) as any[])
          .filter(c => c.status === 'pending')
          .map(c => ({
            tableNumber: c.tableNumber,
            customerName: c.requestedBy || c.customerName || 'Khách',
            timestamp: c.timestamp,
            status: 'pending' as const,
            type: 'CALL_STAFF' as const,
          }));

        setCalls(prev => {
          const cashCalls = prev.filter(c => c.type === 'CASH_PAYMENT');
          const existingCallStaff = prev.filter(c => c.type === 'CALL_STAFF');
          const newCallStaff = pending.filter(p =>
            !existingCallStaff.some(e => e.tableNumber === p.tableNumber)
          );
          if (newCallStaff.length === 0) return prev;
          const merged = [...newCallStaff, ...existingCallStaff, ...cashCalls];
          saveNotifications(merged);
          setViewingIndex(i => Math.min(i, merged.length - 1));
          return merged;
        });
      } catch (_) {}
    };

    syncCallStaffFromStorage();
    const interval = setInterval(syncCallStaffFromStorage, 3000);
    return () => { channel.close(); clearInterval(interval); };
  }, []);

  // Lắng nghe PAYMENT_DONE → xóa thông báo CASH_PAYMENT cho bàn đó
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const tableChannel = new BroadcastChannel('table-updates');
    tableChannel.onmessage = (event) => {
      const { type, tableNumber } = event.data;
      if (type === 'PAYMENT_DONE' && tableNumber !== undefined) {
        setCalls(prev => {
          const remaining = prev.filter(c => !(c.tableNumber === tableNumber && c.type === 'CASH_PAYMENT'));
          saveNotifications(remaining);
          if (remaining.length === 0) { setShowNotification(false); setViewingIndex(0); }
          else { setViewingIndex(i => Math.min(i, remaining.length - 1)); }
          return remaining;
        });
      }
    };
    return () => tableChannel.close();
  }, []);

  // ✅ FIX: acknowledgeCall gọi API thực sự khi xác nhận cash payment
  const acknowledgeCall = async (call: StaffCall) => {
    if (dismissing === call.tableNumber) return;

    if (call.type === 'CALL_STAFF') {
      // Xử lý CALL_STAFF như cũ
      try {
        const stored = localStorage.getItem('staff-calls');
        if (stored) {
          localStorage.setItem('staff-calls', JSON.stringify(
            (JSON.parse(stored) as any[]).map(c =>
              c.tableNumber === call.tableNumber ? { ...c, status: 'acknowledged' } : c
            )
          ));
        }
      } catch (_) {}

      setCalls(prev => {
        const remaining = prev.filter(c => !(c.tableNumber === call.tableNumber && c.type === call.type));
        saveNotifications(remaining);
        if (remaining.length === 0) { setShowNotification(false); setViewingIndex(0); }
        else { setViewingIndex(i => Math.min(i, remaining.length - 1)); }
        return remaining;
      });
      return;
    }

    // ✅ FIX: CASH_PAYMENT → gọi API backend trước khi dismiss
    if (call.type === 'CASH_PAYMENT') {
      setDismissing(call.tableNumber);
      try {
        const orderIds = call.orderIds || [];
        const grandTotal = call.grandTotal || 0;

        // Gọi API thanh toán
        await onCallApiForCashPayment(orderIds, call.tableNumber, grandTotal);

        // Đánh dấu paid trong localStorage để tránh hiện lại sau reload
        if (orderIds.length > 0) markOrdersAsPaidLocal(orderIds);

      } catch (e) {
        console.error('Error calling payment API:', e);
      } finally {
        setDismissing(null);
      }

      // Broadcast PAYMENT_DONE để trang thu ngân và trang gọi món cập nhật
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('table-updates');
          ch.postMessage({
            type: 'PAYMENT_DONE',
            tableNumber: call.tableNumber,
            orderIds: call.orderIds || [],
            paymentMethod: 'cash',
            timestamp: Date.now(),
          });
          ch.close();
        }
      } catch (_) {}

      // Broadcast ORDER_PAID cho từng orderId để trang thu ngân xóa bill
      if (call.orderIds && call.orderIds.length > 0) {
        try {
          const ch = new BroadcastChannel('order-updates');
          call.orderIds.forEach(id => {
            ch.postMessage({
              type: 'ORDER_PAID',
              orderId: id.toString(),
              tableNumber: call.tableNumber.toString(),
              paymentMethod: 'cash',
              timestamp: Date.now(),
            });
          });
          ch.close();
        } catch (_) {}
      }

      setCalls(prev => {
        const remaining = prev.filter(c => !(c.tableNumber === call.tableNumber && c.type === 'CASH_PAYMENT'));
        saveNotifications(remaining);
        if (remaining.length === 0) { setShowNotification(false); setViewingIndex(0); }
        else { setViewingIndex(i => Math.min(i, remaining.length - 1)); }
        return remaining;
      });
    }
  };

  const dismissNotification = () => setShowNotification(false);
  const openNotification    = () => { if (calls.length > 0) { setViewingIndex(0); setShowNotification(true); } };

  const isCash   = displayedCall?.type === 'CASH_PAYMENT';
  const hasCash  = calls.some(c => c.type === 'CASH_PAYMENT');
  const gradient = isCash ? 'from-orange-500 to-red-600' : 'from-blue-500 to-purple-600';
  const floatBg  = hasCash ? 'bg-orange-500' : 'bg-red-500';

  return (
    <>
      {showNotification && displayedCall && (
        <div className="fixed top-20 right-4 z-[100] animate-slide-in">
          <div className={`bg-gradient-to-r ${gradient} text-white rounded-2xl shadow-2xl p-6 max-w-sm border-2 border-white`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce flex-shrink-0">
                {isCash ? <span className="text-2xl">💵</span> : <Bell className="w-6 h-6" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg mb-1 flex items-center gap-2">
                  {isCash ? '💳 Khách thanh toán tiền mặt!' : '🔔 Khách gọi nhân viên!'}
                  {calls.length > 1 && (
                    <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full flex-shrink-0">
                      {viewingIndex + 1}/{calls.length}
                    </span>
                  )}
                </div>

                <div className="text-sm opacity-90 mb-3">
                  <div>🪑 Bàn {displayedCall.tableNumber}</div>
                  <div>👤 {displayedCall.customerName}</div>

                  {isCash && displayedCall.grandTotal != null && (
                    <div className="mt-2 bg-white/20 rounded-xl px-3 py-2">
                      <div className="text-xs opacity-80">
                        {(displayedCall.orderIds?.length ?? 0) > 1 ? `${displayedCall.orderIds!.length} đơn · ` : ''}
                        Cần thu:
                      </div>
                      <div className="text-xl font-bold tracking-tight">
                        {displayedCall.grandTotal.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  )}

                  <div className="text-xs mt-1.5 opacity-75">
                    {new Date(displayedCall.timestamp).toLocaleTimeString('vi-VN')}
                  </div>
                </div>

                {calls.length > 1 && (
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {calls.map((c, i) => (
                      <button key={`${c.tableNumber}-${c.type}`} onClick={() => setViewingIndex(i)}
                        className={`flex-1 py-1 rounded text-xs font-medium transition truncate min-w-0 ${i === viewingIndex ? 'bg-white text-blue-600' : 'bg-white/20 hover:bg-white/30'}`}>
                        {c.type === 'CASH_PAYMENT' ? '💵' : '🔔'} Bàn {c.tableNumber}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => acknowledgeCall(displayedCall)}
                    disabled={dismissing === displayedCall.tableNumber}
                    className="flex-1 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center justify-center gap-1 disabled:opacity-70 disabled:cursor-wait"
                  >
                    {dismissing === displayedCall.tableNumber ? (
                      <><svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Đang xử lý...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" />{isCash ? 'Đã thu tiền' : 'Đã xử lý'}</>
                    )}
                  </button>
                  <button onClick={dismissNotification}
                    className="px-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Ẩn popup">
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {calls.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[90]">
          <button onClick={openNotification}
            className={`${floatBg} text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all relative animate-pulse`}>
            {hasCash ? <span className="text-xl">💵</span> : <Bell className="w-6 h-6" />}
            <div className="absolute -top-1 -right-1 bg-white text-red-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {calls.length}
            </div>
          </button>
        </div>
      )}
    </>
  );
};

// ============================================================
// MAIN
// ============================================================
export default function StaffOrderManagement() {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [filter, setFilter]               = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling]   = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const CASHIER_API = `${API_BASE}/api/cashier`;

  // Ref để truy cập orders mới nhất trong callbacks
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  useEffect(() => {
    const loadOrders = () => {
      try {
        const stored = localStorage.getItem('staff-orders');
        if (stored) {
          // ✅ FIX: Lọc bỏ các đơn hàng đã được mark là paid
          const paidIds = getPaidOrderIds();
          const allOrders: Order[] = JSON.parse(stored);
          const filtered = allOrders.filter(o => !paidIds.has(o.id.toString()));
          setOrders(filtered.sort((a, b) => b.createdAt - a.createdAt));
        } else {
          setOrders([]);
        }
      } catch (e) {}
    };
    loadOrders();
    const interval = setInterval(loadOrders, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel('order-updates');
    channel.onmessage = (event) => {
      const { type, orderId, tableNumber } = event.data;
      if (type === 'ORDER_PAID') handleOrderPaid(orderId, tableNumber);
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'staff-orders' && e.newValue) {
        try {
          const paidIds = getPaidOrderIds();
          const allOrders: Order[] = JSON.parse(e.newValue);
          setOrders(allOrders.filter(o => !paidIds.has(o.id.toString())));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => { channel.close(); window.removeEventListener('storage', handleStorageChange); };
  }, []);

  const handleOrderPaid = (orderId: string, tableNumber: string) => {
    // Đánh dấu vào localStorage để tránh hiện lại sau reload
    markOrdersAsPaidLocal([orderId]);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setSelectedOrder(prev => { if (prev?.id === orderId) { setShowDetailModal(false); return null; } return prev; });
    showToast(`✅ Đơn hàng bàn ${tableNumber} đã được thanh toán`);
  };

  const showToast = (message: string, color = 'bg-green-500') => {
    const n = document.createElement('div');
    n.className = `fixed top-20 right-4 ${color} text-white px-6 py-3 rounded-lg shadow-lg z-[100] animate-slide-in`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => { n.classList.add('animate-slide-out'); setTimeout(() => { if (document.body.contains(n)) document.body.removeChild(n); }, 300); }, 4000);
  };

  // ✅ FIX: Hàm gọi API cashier để đánh dấu paid trên backend
  // → Dùng khi nhấn "Đã thu tiền" từ notification của trang order-management
  const callApiForCashPayment = useCallback(async (
    orderIds: number[],
    tableNumber: number,
    grandTotal: number
  ): Promise<boolean> => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;

      const currentOrders = ordersRef.current;
      let allSuccess = true;

      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const order = currentOrders.find(o => o.id === orderId.toString());
        const orderTotal = order ? order.totalAmount : (grandTotal / Math.max(orderIds.length, 1));

        try {
          // Lấy server total chính xác
          let serverTotal = orderTotal;
          try {
            const dr = await fetch(`${CASHIER_API}/orders/${orderId}/details`, {
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
            amount_paid: Math.max(serverTotal, orderTotal),
            bank_transaction_id: null,
            notes: orderIds.length > 1
              ? `Thu tiền mặt tại bàn - Gộp ${orderIds.length} bill`
              : 'Thu tiền mặt tại bàn',
          };

          const res = await fetch(`${CASHIER_API}/payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();

          if (!data.success) {
            console.error(`Payment API failed for order ${orderId}:`, data.message);
            allSuccess = false;
          } else {
            // Đánh dấu paid trong localStorage
            markOrdersAsPaidLocal([orderId]);
            // Xóa khỏi staff-orders trong localStorage
            try {
              const stored = localStorage.getItem('staff-orders');
              if (stored) {
                const allOrders: Order[] = JSON.parse(stored);
                const updated = allOrders.map(o =>
                  o.id === orderId.toString()
                    ? { ...o, status: 'completed' as const, paymentStatus: 'paid' as const }
                    : o
                );
                localStorage.setItem('staff-orders', JSON.stringify(updated));
              }
            } catch (_) {}
          }
        } catch (e) {
          console.error(`Error processing payment for order ${orderId}:`, e);
          allSuccess = false;
        }
      }

      // Xóa cash requests trong notifications storage
      try {
        const notifications = loadNotifications();
        const cleaned = notifications.filter(
          n => !(n.tableNumber === tableNumber && n.type === 'CASH_PAYMENT')
        );
        saveNotifications(cleaned);
      } catch (_) {}

      // Cập nhật trạng thái bàn về AVAILABLE
      try {
        await fetch(`${API_BASE}/api/tables/public/${tableNumber}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({ status: 'AVAILABLE' }),
        });
      } catch (_) {}

      // Broadcast TABLE_STATUS_CHANGE
      try {
        const ch = new BroadcastChannel('table-updates');
        ch.postMessage({ type: 'TABLE_STATUS_CHANGE', tableNumber, status: 'AVAILABLE', timestamp: Date.now() });
        ch.close();
      } catch (_) {}

      // Xóa đơn hàng của bàn khỏi UI
      setOrders(prev => {
        const tableStr = tableNumber.toString();
        if (orderIds.length > 0) {
          const orderIdSet = new Set(orderIds.map(String));
          return prev.filter(o => !orderIdSet.has(o.id.toString()));
        }
        return prev.filter(o => o.tableNumber.toString() !== tableStr);
      });

      showToast(`💳 Bàn ${tableNumber} đã thanh toán tiền mặt`);
      return allSuccess;
    } catch (e) {
      console.error('callApiForCashPayment error:', e);
      return false;
    }
  }, [API_BASE, CASHIER_API]);

  const updatePaymentStatus = async (orderId: string) => {
    const stored = localStorage.getItem('staff-orders');
    if (!stored) return;
    const allOrders: Order[] = JSON.parse(stored);
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    const tableNumber = order.tableNumber;

    // Đánh dấu paid ngay lập tức để tránh hiện lại sau reload
    markOrdersAsPaidLocal([orderId]);

    const updatedOrders = allOrders.map(o =>
      o.id === orderId ? { ...o, paymentStatus: 'paid' as const, status: 'completed' as const } : o
    );
    localStorage.setItem('staff-orders', JSON.stringify(updatedOrders));
    setOrders(updatedOrders.filter(o => !getPaidOrderIds().has(o.id.toString())).sort((a, b) => b.createdAt - a.createdAt));

    // Xóa thông báo tiền mặt cho bàn này
    try {
      const notifications = loadNotifications();
      const cleaned = notifications.filter(
        n => !(n.tableNumber === tableNumber && n.type === 'CASH_PAYMENT')
      );
      saveNotifications(cleaned);
    } catch (_) {}

    // Cập nhật trạng thái bàn
    try {
      const res = await fetch(`${API_BASE}/api/tables/public/${tableNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ status: 'AVAILABLE' }),
      });
      if (res.ok) console.log(`✅ [PAYMENT] Table ${tableNumber} set to AVAILABLE`);
    } catch (e) {
      console.warn('⚠️ [PAYMENT] API not reachable, broadcast only');
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const tableCh = new BroadcastChannel('table-updates');
      tableCh.postMessage({ type: 'TABLE_STATUS_CHANGE', tableNumber, status: 'AVAILABLE', timestamp: Date.now() });
      tableCh.close();

      const orderCh = new BroadcastChannel('order-updates');
      orderCh.postMessage({ type: 'ORDER_PAID', orderId, tableNumber: String(tableNumber), timestamp: Date.now() });
      orderCh.close();

      const paymentCh = new BroadcastChannel('table-updates');
      paymentCh.postMessage({
        type: 'PAYMENT_DONE',
        tableNumber,
        orderId,
        orderIds: [parseInt(orderId)],
        paymentMethod: 'staff_confirmed',
        timestamp: Date.now(),
      });
      paymentCh.close();
    }

    showToast(`💳 Bàn ${tableNumber} đã thanh toán → Đang chuyển về Trống`);
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    try {
      const stored = localStorage.getItem('staff-orders');
      if (stored) {
        const updated = JSON.parse(stored).map((o: Order) => o.id === orderId ? { ...o, status: newStatus } : o);
        localStorage.setItem('staff-orders', JSON.stringify(updated));
        setOrders(updated);
      }
    } catch (e) {}
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    setIsCancelling(true);
    try {
      await fetch(`${API_BASE}/api/orders/public/${orderToCancel.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      }).catch(() => {});

      const stored = localStorage.getItem('staff-orders');
      if (stored) {
        const updated = JSON.parse(stored).map((o: Order) => o.id === orderToCancel.id ? { ...o, status: 'cancelled' as const } : o);
        localStorage.setItem('staff-orders', JSON.stringify(updated));
        setOrders(updated);
      }

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('order-updates');
        ch.postMessage({ type: 'ORDER_CANCELLED', orderId: orderToCancel.id, tableNumber: orderToCancel.tableNumber, timestamp: Date.now() });
        ch.close();
      }

      await fetch(`${API_BASE}/api/tables/public/${orderToCancel.tableNumber}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ status: 'AVAILABLE' }),
      }).catch(() => {});

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('table-updates');
        ch.postMessage({ type: 'TABLE_STATUS_CHANGE', tableNumber: orderToCancel.tableNumber, status: 'AVAILABLE', timestamp: Date.now() });
        ch.close();
      }

     // alert(`✅ Đã hủy đơn hàng Bàn ${orderToCancel.tableNumber}\n\n🪑 Bàn đã được đánh dấu trống.`);
      setShowCancelModal(false);
      setOrderToCancel(null);
    } catch (e: any) {
      alert(`❌ Lỗi: ${e.message || 'Không thể hủy'}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    filter === 'all' ? order.status !== 'completed' && order.status !== 'cancelled' : order.status === filter
  );

  const getStatusColor = (status: Order['status']) => ({
    pending:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    preparing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    ready:     'bg-green-500/15 text-green-400 border-green-500/30',
    completed: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  }[status]);

  const getStatusText = (status: Order['status']) => ({
    pending:   'Chờ xử lý',
    preparing: ' Đang chuẩn bị',
    ready:     'Sẵn sàng',
    completed: 'Hoàn thành',
    cancelled: ' Đã hủy',
  }[status]);

  const getOrderCount = (status: string) => {
    if (status === 'all') return orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
    return orders.filter(o => o.status === status).length;
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      {/* Truyền callback để gọi API khi nhấn "Đã thu tiền" */}
      <StaffCallNotification onCallApiForCashPayment={callApiForCashPayment} />

      <div className="w-full lg:ml-64">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 mt-12 lg:mt-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl text-gray-800 mb-1 sm:mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                <span>🍽️ Quản lý đơn hàng</span>
                <span className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 bg-red-100 text-red-600 rounded-full font-normal animate-pulse">{getOrderCount('all')} đơn chờ</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">Theo dõi và xử lý đơn hàng (Tự động cập nhật)</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-end">
              <div className="text-right hidden sm:block">
                <div className="text-xs sm:text-sm text-gray-600">Nhân viên phục vụ</div>
                <div className="text-gray-800 font-medium text-sm">Staff</div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-base sm:text-lg">NV</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {[
              { value: 'all',       label: 'Tất cả',        icon: '📋', shortLabel: 'Tất cả'   },
              { value: 'pending',   label: 'Chờ xử lý',     icon: '⏳', shortLabel: 'Chờ'      },
              { value: 'preparing', label: 'Đang chuẩn bị', icon: '🍳', shortLabel: 'Chuẩn bị' },
              { value: 'ready',     label: 'Sẵn sàng',      icon: '✅', shortLabel: 'Sẵn sàng' },
            ].map((tab) => (
              <button key={tab.value} onClick={() => setFilter(tab.value as any)}
                className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs sm:text-sm flex-shrink-0 ${filter === tab.value ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'}`}>
                <span className="mr-1 sm:mr-2">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs bg-white/20">{getOrderCount(tab.value)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 sm:py-16 md:py-20">
              <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📭</div>
              <div className="text-base sm:text-lg md:text-xl text-gray-600">Không có đơn hàng nào</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-2">Đơn hàng từ khách sẽ hiện ở đây</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 sm:p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-bold text-base sm:text-lg">Bàn {order.tableNumber}</div>
                        <div className="text-white/80 text-xs sm:text-sm">{order.customerName}</div>
                      </div>
                      <div className="text-white/90 text-xs sm:text-sm font-mono">{order.orderTime}</div>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-white text-xs opacity-80 truncate">#{order.id}</div>
                      <div className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusColor(order.status)}`}>{getStatusText(order.status)}</div>
                    </div>
                  </div>

                  <div className="p-3 sm:p-4">
                    <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 max-h-32 sm:max-h-40 overflow-y-auto">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-start text-xs sm:text-sm">
                          <div className="flex-1 pr-2"><span className="text-gray-800">{item.name}</span><span className="text-gray-500 ml-1 sm:ml-2">x{item.quantity}</span></div>
                          <span className="text-blue-600 font-medium whitespace-nowrap">{(item.price * item.quantity).toLocaleString('vi-VN')} ₫</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-200 pt-2 sm:pt-3 mb-3 sm:mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium text-xs sm:text-sm">Tổng cộng:</span>
                        <span className="text-gray-800 text-base sm:text-lg font-bold">{order.totalAmount.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <button onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }} className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-200 transition text-xs sm:text-sm font-medium">👁️ Xem chi tiết</button>
                      {order.status === 'pending' && <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm font-medium">🍳 Bắt đầu chuẩn bị</button>}
                      {order.status === 'preparing' && <button onClick={() => updateOrderStatus(order.id, 'ready')} className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium">✅ Hoàn thành món</button>}
                      {order.status === 'ready' && (
                        <button onClick={() => updatePaymentStatus(order.id)} className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition text-xs sm:text-sm font-medium">
                          💳 Xác nhận thanh toán
                        </button>
                      )}
                      {['pending', 'preparing'].includes(order.status) && (
                        <button onClick={() => { setOrderToCancel(order); setShowCancelModal(true); }} className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-red-50 border border-red-300 text-red-600 rounded-lg hover:bg-red-100 transition text-xs sm:text-sm font-medium flex items-center justify-center gap-1 sm:gap-2">
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />Hủy bàn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 sm:p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-white text-lg sm:text-xl font-bold">Đơn #{selectedOrder.id}</h2>
                  <p className="text-white/80 text-xs sm:text-sm">Bàn {selectedOrder.tableNumber} · {selectedOrder.customerName}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 transition"><XIcon className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div><p className="font-medium text-gray-800 text-sm">{item.name}</p><p className="text-xs text-gray-500">x{item.quantity} · {item.price.toLocaleString('vi-VN')}đ/món</p></div>
                    <span className="font-bold text-blue-600 text-sm">{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800">Tổng cộng:</span>
                  <span className="text-xl font-bold text-green-600">{selectedOrder.totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {selectedOrder.status === 'pending' && <button onClick={() => { updateOrderStatus(selectedOrder.id, 'preparing'); setShowDetailModal(false); }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">🍳 Bắt đầu chuẩn bị</button>}
                {selectedOrder.status === 'preparing' && <button onClick={() => { updateOrderStatus(selectedOrder.id, 'ready'); setShowDetailModal(false); }} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">✅ Hoàn thành</button>}
                {selectedOrder.status === 'ready' && <button onClick={() => { updatePaymentStatus(selectedOrder.id); setShowDetailModal(false); }} className="flex-1 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg text-sm font-medium">💳 Xác nhận TT</button>}
                <button onClick={() => setShowDetailModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && orderToCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận hủy đơn hàng</h3>
              <p className="text-gray-600 text-sm">Bạn có chắc muốn hủy đơn hàng <strong>Bàn {orderToCancel.tableNumber}</strong>?</p>
              <p className="text-gray-500 text-xs mt-1">Bàn sẽ được đánh dấu trống sau khi hủy.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCancelModal(false); setOrderToCancel(null); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" disabled={isCancelling}>Quay lại</button>
              <button onClick={handleCancelOrder} disabled={isCancelling} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50">
                {isCancelling ? '⏳ Đang hủy...' : '🗑️ Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn  { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        .animate-slide-in  { animation: slideIn  0.3s ease-out; }
        .animate-slide-out { animation: slideOut 0.3s ease-in;  }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}