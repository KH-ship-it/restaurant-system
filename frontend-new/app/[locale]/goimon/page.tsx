'use client';

import { useState, useEffect, Suspense, useTransition } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, CreditCard, Banknote, QrCode, CheckCircle, X, Loader2, ShoppingBag } from 'lucide-react';

// ============================================================
// INTERFACES
// ============================================================
interface MenuItem {
  item_id: number;
  item_name: string;
  item_name_en?: string;
  category_id: number;
  category_name: string;
  price: number;
  status: string;
  description: string;
  description_en?: string;
  image_url: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface OrderInfo {
  orderId: number;
  tableNumber: number;
  items: CartItem[];
  totalAmount: number;
  customerName: string;
  orderTime: string;
}

// ============================================================
// ✅ PERSISTENCE HELPERS
// ============================================================
const getTableOrdersKey = (tableNumber: string) => `table_orders_${tableNumber}`;

const saveTableOrders = (tableNumber: string, orders: OrderInfo[]) => {
  try { localStorage.setItem(getTableOrdersKey(tableNumber), JSON.stringify(orders)); } catch (e) {}
};

const loadTableOrders = (tableNumber: string): OrderInfo[] => {
  try {
    const stored = localStorage.getItem(getTableOrdersKey(tableNumber));
    return stored ? JSON.parse(stored) : [];
  } catch (e) { return []; }
};

const clearTableOrders = (tableNumber: string) => {
  try { localStorage.removeItem(getTableOrdersKey(tableNumber)); } catch (e) {}
};

// ============================================================
// SUCCESS MODAL
// ============================================================
function OrderSuccessModal({
  orderInfo, totalTableOrders, totalTableAmount, onClose, onProceedPayment,
}: {
  orderInfo: OrderInfo; totalTableOrders: number; totalTableAmount: number;
  onClose: () => void; onProceedPayment: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" style={{animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
        <div className="bg-gradient-to-br from-green-400 to-emerald-500 px-6 pt-8 pb-6 text-center">
          <div className="w-20 h-20 bg-white/25 rounded-full flex items-center justify-center mx-auto mb-4" style={{animation: 'bounceSlow 2s ease-in-out infinite'}}>
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Đặt món thành công!</h2>
          <p className="text-green-100 text-sm font-medium">Chúc quý khách ngon miệng</p>
        </div>
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-gray-500">Mã đơn hàng</span>
            <span className="font-bold text-gray-800">#{orderInfo.orderId}</span>
          </div>
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-gray-500">Bàn số</span>
            <span className="font-bold text-gray-800">{orderInfo.tableNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Đơn này</span>
            <span className="font-bold text-orange-600 text-lg">{orderInfo.totalAmount.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>
        {totalTableOrders > 1 && (
          <div className="mx-6 mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
            <ShoppingBag className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700">Bàn đã có {totalTableOrders} lần gọi món</p>
              <p className="text-xs text-amber-600 mt-0.5">Tổng cộng: <span className="font-bold">{totalTableAmount.toLocaleString('vi-VN')}đ</span></p>
            </div>
          </div>
        )}
        <div className="px-6 py-4 space-y-3">
          <button onClick={onProceedPayment}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 transition-all">
            <CreditCard className="w-5 h-5" />
            {totalTableOrders > 1 ? `Thanh toán tất cả (${totalTableOrders} đơn)` : 'Thanh toán ngay'}
          </button>
          <button onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium text-sm hover:bg-gray-200 active:scale-95 transition-all">
            Tiếp tục gọi thêm món
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT MODAL — với QR waiting confirmation flow
// ============================================================
function PaymentModal({
  orders, tableNumber, onClose, onPaymentDone, apiBase,
}: {
  orders: OrderInfo[]; tableNumber: string;
  onClose: () => void; onPaymentDone: () => void; apiBase: string;
}) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // ✅ 3 màn: idle | waiting_qr_confirm (chờ thu ngân xác nhận) | done
  const [screen, setScreen] = useState<'idle' | 'waiting_qr_confirm' | 'done'>('idle');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);

  const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const firstOrder = orders[0];

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bank_accounts_data');
      if (stored) {
        const accounts = JSON.parse(stored);
        const active = accounts.filter((a: any) => a.isActive && a.status === 'active');
        setBankAccounts(active);
        if (active.length > 0) setSelectedBank(active[0]);
      }
    } catch (e) {}
  }, []);

  // ✅ Lắng nghe PAYMENT_DONE từ thu ngân → chuyển sang màn done
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const ch = new BroadcastChannel('table-updates');
    ch.onmessage = (e) => {
      const { type, tableNumber: tbl } = e.data;
      if (type === 'PAYMENT_DONE' && tbl !== undefined && tbl.toString() === tableNumber.toString()) {
        setScreen('done');
        setTimeout(() => onPaymentDone(), 2500);
      }
    };
    return () => ch.close();
  }, [tableNumber, onPaymentDone]);

  const getQRUrl = (account: any) => {
    if (!account) return '';
    const bins: Record<string, string> = {
      'Vietcombank': '970436', 'MB Bank': '970422', 'VietinBank': '970415',
      'BIDV': '970418', 'Techcombank': '970407', 'ACB': '970416',
      'Sacombank': '970403', 'MSB': '970426', 'VPBank': '970432',
    };
    const bankBin = account.bin || bins[account.bankName] || '970436';
    const accNum = (account.accountNumber || '').replace(/\s/g, '');
    const holder = encodeURIComponent(account.accountHolder || 'NHA HANG');
    const content = encodeURIComponent(`Thanh toan ban ${tableNumber}`);
    if (account.vietQRUrl) {
      const base = account.vietQRUrl.split('?')[0];
      return `${base}?amount=${grandTotal}&addInfo=${content}&accountName=${holder}`;
    }
    return `https://img.vietqr.io/image/${bankBin}-${accNum}-compact2.jpg?amount=${grandTotal}&addInfo=${content}&accountName=${holder}`;
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      // Cập nhật payment status optimistic
      await Promise.allSettled(
        orders.map(order =>
          fetch(`${apiBase}/api/orders/${order.orderId}/payment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ payment_method: paymentMethod, payment_status: 'pending_confirmation' }),
          })
        )
      );

      // Cập nhật staff-orders localStorage
      try {
        const staffOrders = JSON.parse(localStorage.getItem('staff-orders') || '[]');
        const orderIds = new Set(orders.map(o => o.orderId.toString()));
        const updated = staffOrders.map((o: any) =>
          orderIds.has(o.id)
            ? { ...o, paymentStatus: 'pending_confirmation', paymentMethod, status: 'ready' }
            : o
        );
        localStorage.setItem('staff-orders', JSON.stringify(updated));
      } catch (e) {}

      if (paymentMethod === 'cash') {
        // ── Tiền mặt: thông báo nhân viên đến thu ──
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('staff-notifications');
          ch.postMessage({
            type: 'CASH_PAYMENT_REQUEST',
            tableNumber: firstOrder.tableNumber,
            grandTotal,
            customerName: firstOrder.customerName,
            orderIds: orders.map(o => o.orderId),
            timestamp: Date.now(),
          });
          ch.close();
        }
        // Gửi ORDER_PAID để thu ngân cập nhật
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('order-updates');
          orders.forEach(order => {
            ch.postMessage({
              type: 'ORDER_PAID',
              orderId: order.orderId.toString(),
              tableNumber: order.tableNumber.toString(),
              paymentMethod: 'cash',
              timestamp: Date.now(),
            });
          });
          ch.close();
        }
        // Gửi PAYMENT_DONE để đóng modal
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('table-updates');
          orders.forEach(order => {
            ch.postMessage({
              type: 'PAYMENT_DONE',
              tableNumber: order.tableNumber,
              orderId: order.orderId,
              orderIds: orders.map(o => o.orderId),
              paymentMethod: 'cash',
              timestamp: Date.now(),
            });
          });
          ch.close();
        }
        setScreen('done');
        setTimeout(() => onPaymentDone(), 2500);
        return;
      }

      // ── ✅ Chuyển khoản / QR: gửi thông báo cho thu ngân, CHỜ xác nhận ──
      if (paymentMethod === 'transfer') {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('staff-notifications');
          ch.postMessage({
            type: 'QR_PAYMENT_REQUEST',           // ✅ event type mới
            tableNumber: firstOrder.tableNumber,
            grandTotal,
            customerName: firstOrder.customerName,
            orderIds: orders.map(o => o.orderId),
            bankName: selectedBank?.bankName || '',
            accountNumber: selectedBank?.accountNumber || '',
            timestamp: Date.now(),
          });
          ch.close();
        }
        // ✅ Chuyển sang màn chờ — KHÔNG gọi onPaymentDone, KHÔNG đóng modal
        // Sẽ tự chuyển sang 'done' khi nhận PAYMENT_DONE từ thu ngân
        setScreen('waiting_qr_confirm');
        return;
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Màn: đang chờ thu ngân xác nhận QR ──
  if (screen === 'waiting_qr_confirm') {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl text-center p-8"
          style={{animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
          <div className="relative w-24 h-24 mx-auto mb-5">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center">
              <span className="text-5xl">📱</span>
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-300 animate-ping opacity-40" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Đang chờ xác nhận</h2>
          <p className="text-gray-500 text-sm mb-5 leading-relaxed">
            Thu ngân đang kiểm tra giao dịch chuyển khoản của bạn.<br/>
            <span className="font-medium text-blue-600">Vui lòng không tắt trang này.</span>
          </p>
          <div className="bg-blue-50 rounded-2xl p-4 mb-5 text-left space-y-2 border border-blue-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bàn</span>
              <span className="font-bold text-gray-800">{tableNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Số tiền</span>
              <span className="font-bold text-orange-600">{grandTotal.toLocaleString('vi-VN')}đ</span>
            </div>
            {selectedBank && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ngân hàng</span>
                <span className="font-semibold text-blue-700">{selectedBank.bankName}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Tự động cập nhật khi thu ngân xác nhận
          </div>
        </div>
      </div>
    );
  }

  // ── Màn: done (dùng chung cho cả cash và QR sau khi xác nhận) ──
  if (screen === 'done') {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl text-center p-8"
          style={{animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {paymentMethod === 'cash' ? 'Nhân viên sẽ đến thu tiền!' : 'Thanh toán thành công! 🎉'}
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            {paymentMethod === 'cash' ? 'Vui lòng chờ nhân viên xác nhận.' : 'Cảm ơn quý khách. Hẹn gặp lại!'}
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 space-y-1">
            <div>Bàn <strong>{tableNumber}</strong> · {orders.length} đơn hàng</div>
            <div className="text-orange-600 font-bold text-lg">{grandTotal.toLocaleString('vi-VN')}đ</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main payment modal UI ──
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl my-4"
        style={{animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">💳 Thanh toán</h2>
            <p className="text-xs text-gray-400">
              Bàn {tableNumber} · {orders.length} đơn · {orders.map(o => `#${o.orderId}`).join(', ')}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Tổng tiền */}
        <div className="px-5 pt-4">
          <div className="bg-orange-50 rounded-2xl p-4">
            <p className="text-xs text-orange-600 font-semibold mb-1 uppercase tracking-wide">Tổng thanh toán</p>
            <p className="text-3xl font-bold text-orange-600">{grandTotal.toLocaleString('vi-VN')}đ</p>
            <div className="mt-3 pt-2 border-t border-orange-100 space-y-3">
              {orders.map((order) => (
                <div key={order.orderId}>
                  {orders.length > 1 && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-orange-500">Đơn #{order.orderId}</span>
                      <span className="text-xs text-orange-400">{order.orderTime}</span>
                    </div>
                  )}
                  {order.items.map(item => (
                    <div key={`${order.orderId}-${item.item_id}`} className="flex justify-between text-xs text-gray-500">
                      <span>{item.item_name} × {item.quantity}</span>
                      <span>{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                  {orders.length > 1 && (
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5 pt-1 border-t border-orange-100">
                      <span>Cộng đơn #{order.orderId}</span>
                      <span className="font-medium text-orange-500">{order.totalAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {orders.length > 1 && (
              <div className="mt-2 pt-2 border-t border-orange-300 flex justify-between">
                <span className="text-xs font-bold text-orange-700">Tổng {orders.length} đơn</span>
                <span className="text-sm font-bold text-orange-700">{grandTotal.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
          </div>
        </div>

        {/* Phương thức */}
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Hình thức thanh toán</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setPaymentMethod('cash');
                // Gửi CASH_PAYMENT_REQUEST ngay khi chọn tiền mặt
                if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                  const ch = new BroadcastChannel('staff-notifications');
                  ch.postMessage({
                    type: 'CASH_PAYMENT_REQUEST',
                    tableNumber: firstOrder.tableNumber,
                    grandTotal,
                    customerName: firstOrder.customerName,
                    orderIds: orders.map(o => o.orderId),
                    timestamp: Date.now(),
                  });
                  ch.close();
                }
              }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                paymentMethod === 'cash' ? 'border-green-500 bg-green-50 shadow-md scale-[1.02]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-green-500' : 'bg-gray-100'}`}>
                <Banknote className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <span className={`text-sm font-semibold ${paymentMethod === 'cash' ? 'text-green-700' : 'text-gray-600'}`}>Tiền mặt</span>
            </button>

            <button
              onClick={() => setPaymentMethod('transfer')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                paymentMethod === 'transfer' ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'transfer' ? 'bg-blue-500' : 'bg-gray-100'}`}>
                <QrCode className={`w-5 h-5 ${paymentMethod === 'transfer' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <span className={`text-sm font-semibold ${paymentMethod === 'transfer' ? 'text-blue-700' : 'text-gray-600'}`}>Chuyển khoản</span>
            </button>
          </div>

          {paymentMethod === 'cash' && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <div className="text-4xl mb-2">💵</div>
              <p className="text-green-600 text-xs mt-1">Nhân viên sẽ đến thu tiền và xuất hóa đơn</p>
              <div className="mt-3 bg-white rounded-xl p-3 shadow-sm">
                <p className="text-2xl font-bold text-gray-800">{grandTotal.toLocaleString('vi-VN')}đ</p>
              </div>
            </div>
          )}

          {paymentMethod === 'transfer' && (
            <div className="mt-4">
              {bankAccounts.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {bankAccounts.map((acc) => (
                    <button key={acc.id} onClick={() => setSelectedBank(acc)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedBank?.id === acc.id ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-300'
                      }`}>
                      {acc.bankName}
                    </button>
                  ))}
                </div>
              )}
              {selectedBank ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-blue-600 font-semibold mb-3 uppercase tracking-wide">Quét mã QR để thanh toán</p>
                  <div className="bg-white rounded-xl p-2 inline-block shadow-sm mb-3">
                    <img
                      src={getQRUrl(selectedBank)}
                      alt="QR Thanh toán"
                      className="w-44 h-44 mx-auto rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${selectedBank.bankName} STK:${selectedBank.accountNumber} ${grandTotal}d`)}`;
                      }}
                    />
                  </div>
                  <div className="text-left space-y-1.5">
                    {[
                      { label: 'Ngân hàng', value: selectedBank.bankName },
                      { label: 'Số tài khoản', value: selectedBank.accountNumber, mono: true },
                      { label: 'Chủ tài khoản', value: selectedBank.accountHolder },
                      { label: 'Số tiền', value: `${grandTotal.toLocaleString('vi-VN')}đ`, orange: true },
                      { label: 'Nội dung', value: `Thanh toan ban ${tableNumber}` },
                    ].map(({ label, value, mono, orange }) => (
                      <div key={label} className="flex justify-between bg-white rounded-xl px-3 py-2 text-xs">
                        <span className="text-gray-400">{label}</span>
                        <span className={`font-semibold ${orange ? 'text-orange-600' : 'text-gray-800'} ${mono ? 'font-mono' : ''}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                  {/* ✅ Hướng dẫn rõ ràng cho khách */}
                  <div className="mt-3 bg-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-800 text-left flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5"></span>
                    <span> <strong></strong></span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                  <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Chưa có tài khoản ngân hàng</p>
                  <p className="text-xs text-gray-400 mt-1">Vui lòng thanh toán tiền mặt</p>
                </div>
              )}
            </div>
          )}

          {/* ✅ Nút xác nhận — text/màu khác nhau cho cash và QR */}
          {paymentMethod === 'transfer' && (
  <button
    onClick={handleConfirmPayment}
    disabled={isProcessing || !selectedBank}
    className="mt-4 w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg active:scale-95"
  >
    {isProcessing ? (
      <>
        <Loader2 className="w-5 h-5 animate-spin" />
        Đang xử lý...
      </>
    ) : (
      <>
        <CheckCircle className="w-5 h-5" />
        Đã chuyển khoản — Chờ xác nhận
      </>
    )}
  </button>
)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE CONTENT
// ============================================================
function OrderPageContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';
  const t = useTranslations('CustomerMenu');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);

  const [isCallingStaff, setIsCallingStaff] = useState(false);
  const [showCallStaffSuccess, setShowCallStaffSuccess] = useState(false);

  const [tableOrders, setTableOrders] = useState<OrderInfo[]>(() => loadTableOrders(tableNumber));
  const [latestOrder, setLatestOrder] = useState<OrderInfo | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  useEffect(() => { saveTableOrders(tableNumber, tableOrders); }, [tableOrders, tableNumber]);
  useEffect(() => { setTableOrders(loadTableOrders(tableNumber)); }, [tableNumber]);
  const resetPaymentState = () => {
    setTableOrders([]);
    setLatestOrder(null);
    setShowPaymentModal(false);
    setShowSuccessModal(false);
    clearTableOrders(tableNumber);
  };
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const ch = new BroadcastChannel('table-updates');
    ch.onmessage = (e) => {
      const { type, tableNumber: tbl } = e.data;
      if (type === 'PAYMENT_DONE' && tbl !== undefined && tbl.toString() === tableNumber.toString()) {
        resetPaymentState();
      }
    };
    return () => ch.close();
  }, [tableNumber]);
  const categories = [
    { id: 'all', name: t('allCategories'), icon: '🍽️', color: 'bg-gradient-to-br from-slate-500 to-slate-600' },
    { id: 1, name: t('coffee'), icon: '☕', color: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { id: 2, name: t('mainDish'), icon: '🍜', color: 'bg-gradient-to-br from-red-500 to-rose-600' },
    { id: 3, name: t('drinks'), icon: '🥤', color: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
    { id: 4, name: t('smoothie'), icon: '🥤', color: 'bg-gradient-to-br from-green-500 to-emerald-600' },
  ];
  const switchLanguage = (newLocale: string) => {
    if (newLocale === locale) return;
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
      const segments = pathname.split('/');
      segments[1] = newLocale;
      router.replace(`${segments.join('/')}?table=${tableNumber}`);
    });
  };
  const getItemName = (item: MenuItem) => locale === 'en' && item.item_name_en ? item.item_name_en : item.item_name;
  const getItemDescription = (item: MenuItem) => locale === 'en' && item.description_en ? item.description_en : item.description;

  const handleCallStaff = async () => {
    setIsCallingStaff(true);
    try {
      const callData = {
        tableNumber: parseInt(tableNumber), timestamp: Date.now(), type: 'CALL_STAFF',
        status: 'pending', requestedBy: customerName || 'Khách',
        note: `Khách hàng bàn ${tableNumber} cần hỗ trợ`,
      };
      const existingCalls = JSON.parse(localStorage.getItem('staff-calls') || '[]');
      localStorage.setItem('staff-calls', JSON.stringify([callData, ...existingCalls.filter((c: any) => c.tableNumber !== parseInt(tableNumber))]));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('staff-notifications');
        channel.postMessage({ type: 'CALL_STAFF', tableNumber: parseInt(tableNumber), customerName: customerName || 'Khách', timestamp: Date.now() });
        channel.close();
      }
      setShowCallStaffSuccess(true);
      setTimeout(() => setShowCallStaffSuccess(false), 3000);
    } catch (error) {
      alert(' Không thể gọi nhân viên. Vui lòng thử lại!');
    } finally {
      setIsCallingStaff(false);
    }
  };
  const checkAndResetDailyOrders = () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = localStorage.getItem('last_order_reset_date');
      if (lastResetDate !== today) {
        const allOrders = JSON.parse(localStorage.getItem('staff-orders') || '[]');
        const completedOrders = allOrders.filter((o: any) => o.status === 'completed' || o.status === 'cancelled');
        if (completedOrders.length > 0) {
          const orderHistory = JSON.parse(localStorage.getItem('order_history') || '[]');
          localStorage.setItem('order_history', JSON.stringify([...orderHistory, {
            date: lastResetDate || new Date(Date.now() - 86400000).toDateString(),
            orders: completedOrders, totalOrders: completedOrders.length,
            totalRevenue: completedOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
            archivedAt: Date.now(),
          }]));
        }
        localStorage.setItem('staff-orders', JSON.stringify([]));
        localStorage.setItem('last_order_reset_date', today);
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('order-updates');
          ch.postMessage({ type: 'DAILY_RESET', date: today, timestamp: Date.now() });
          ch.close();
        }
      }
    } catch (e) {}
  };

  const updateTableStatusToOccupied = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tables/public/${tableNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ status: 'OCCUPIED' }),
      });
      if (response.ok && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('table-updates');
        ch.postMessage({ type: 'TABLE_STATUS_CHANGE', tableNumber: parseInt(tableNumber), status: 'OCCUPIED', timestamp: Date.now() });
        ch.close();
      }
    } catch (e) {}
  };

  useEffect(() => {
    (async () => {
      try {
        await fetch(`${API_BASE}/api/tables/public/${tableNumber}`, {
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        });
      } catch (e) {}
    })();
    checkAndResetDailyOrders();
  }, [tableNumber]);

  useEffect(() => { loadMenu(); }, []);

  const isItemAvailable = (status: string) => {
    if (!status || status.trim() === '') return true;
    const s = status.trim().toUpperCase();
    return s === 'AVAILABLE' || s === 'ACTIVE';
  };

  const loadMenu = async () => {
    try {
      setIsLoading(true); setError('');
      const response = await fetch(`${API_BASE}/api/menu/public`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });
      if (!response.ok) {
        let e = `HTTP ${response.status}`;
        try { const d = await response.json(); e = d.detail || d.message || e; } catch {}
        throw new Error(e);
      }
      const result = await response.json();
      if (result.success && result.data?.length > 0) setMenuItems(result.data);
      else { setMenuItems([]); setError(t('noItems')); }
    } catch (err: any) {
      setError(err.message || t('alerts.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    const existing = cart.find(i => i.item_id === item.item_id);
    if (existing) setCart(cart.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i));
    else setCart([...cart, { ...item, quantity: 1 }]);
    setShowCart(true);
    setTimeout(() => setShowCart(false), 2000);
  };

  const removeFromCart = (itemId: number) => {
    const existing = cart.find(i => i.item_id === itemId);
    if (existing && existing.quantity > 1) setCart(cart.map(i => i.item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i));
    else setCart(cart.filter(i => i.item_id !== itemId));
  };

  const getTotalAmount = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const syncWithStaffPage = (orderId: string, orderData: any) => {
    try {
      checkAndResetDailyOrders();
      const staffOrder = {
        id: orderId, tableNumber: parseInt(tableNumber),
        customerName: orderData.customer_name,
        items: orderData.items.map((item: any) => ({
          id: item.item_id,
          name: menuItems.find(m => m.item_id === item.item_id)?.item_name || `Món ${item.item_id}`,
          quantity: item.quantity, price: item.price,
        })),
        totalAmount: orderData.total_amount, status: 'pending',
        orderTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        paymentStatus: 'unpaid', createdAt: Date.now(), orderDate: new Date().toDateString(),
      };
      const existingOrders = JSON.parse(localStorage.getItem('staff-orders') || '[]');
      localStorage.setItem('staff-orders', JSON.stringify([staffOrder, ...existingOrders]));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('table-updates');
        ch.postMessage({ type: 'NEW_ORDER', tableNumber: parseInt(tableNumber), orderId, timestamp: Date.now() });
        ch.close();
      }
    } catch (e) {}
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) { alert(t('alerts.cartEmpty')); return; }
    try {
      const orderData = {
        table_number: parseInt(tableNumber),
        customer_name: customerName.trim() || 'Khách',
        items: cart.map(item => ({ item_id: item.item_id, quantity: item.quantity, price: item.price })),
        total_amount: getTotalAmount(),
      };
      const response = await fetch(`${API_BASE}/api/orders/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(orderData),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          syncWithStaffPage(result.data.order_id.toString(), orderData);
          updateTableStatusToOccupied();
          const newOrder: OrderInfo = {
            orderId: result.data.order_id, tableNumber: parseInt(tableNumber),
            items: [...cart], totalAmount: getTotalAmount(),
            customerName: customerName.trim() || 'Khách',
            orderTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
          setTableOrders(prev => [...prev, newOrder]);
          setLatestOrder(newOrder);
          setCart([]); setCustomerName(''); setShowCart(false); setShowSuccessModal(true);
        } else alert('❌ ' + (result.message || t('alerts.orderError')));
      } else {
        let errorMessage = t('alerts.orderError');
        try { const d = await response.json(); errorMessage = d.detail || d.message || errorMessage; } catch {}
        alert(`❌ ${errorMessage}`);
      }
    } catch (error: any) { alert(t('alerts.connectionError')); }
  };

  const filteredItems = menuItems.filter(item =>
    activeCategory === 'all' || item.category_id.toString() === activeCategory.toString()
  );
  const grandTableTotal = tableOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="text-8xl mb-4 animate-bounce">🍽️</div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} className="w-2 h-2 bg-orange-500 rounded-full animate-ping" style={{ animationDelay: `${delay}s` }}></div>
              ))}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 mt-4">{t('loadingMessage')}</h2>
          <p className="text-gray-600">{t('table')} {tableNumber}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="text-7xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('errorTitle')}</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button onClick={loadMenu} className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-semibold hover:shadow-lg transition-all">🔄 {t('retry')}</button>
        </div>
      </div>
    );
  }

  if (menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="text-7xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('menuUpdating')}</h2>
          <p className="text-gray-600 mb-6">{t('comeBackLater')}</p>
          <button onClick={loadMenu} className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-semibold hover:shadow-lg transition-all">🔄 {t('reload')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {showSuccessModal && latestOrder && (
        <OrderSuccessModal
          orderInfo={latestOrder}
          totalTableOrders={tableOrders.length}
          totalTableAmount={grandTableTotal}
          onClose={() => setShowSuccessModal(false)}
          onProceedPayment={() => { setShowSuccessModal(false); setShowPaymentModal(true); }}
        />
      )}

      {showPaymentModal && tableOrders.length > 0 && (
        <PaymentModal
          orders={tableOrders}
          tableNumber={tableNumber}
          onClose={() => setShowPaymentModal(false)}
          onPaymentDone={resetPaymentState}
          apiBase={API_BASE}
        />
      )}

      {showCallStaffSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60]" style={{ animation: 'slideIn 0.3s ease-out' }}>
          <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg">✅ Đã gọi nhân viên!</div>
              <div className="text-sm opacity-90">Nhân viên sẽ đến ngay bàn {tableNumber}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span>🍽️</span><span>{t('table')} {tableNumber}</span>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{menuItems.length} {t('itemsAvailable')}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {tableOrders.length > 0 && !showPaymentModal && !showSuccessModal && (
                <button onClick={() => setShowPaymentModal(true)}
                  className="px-3 py-2.5 rounded-full font-semibold bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm flex items-center gap-1.5 hover:shadow-lg active:scale-95 transition-all">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">{grandTableTotal.toLocaleString('vi-VN')}đ</span>
                  {tableOrders.length > 1 && (
                    <span className="bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{tableOrders.length}</span>
                  )}
                </button>
              )}
              <button onClick={handleCallStaff} disabled={isCallingStaff}
                className={`relative px-3 sm:px-4 py-2.5 rounded-full font-semibold transition-all shadow-md flex items-center gap-2 ${
                  isCallingStaff ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:scale-105 active:scale-95'
                }`}>
                <Bell className={`w-5 h-5 ${isCallingStaff ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{isCallingStaff ? 'Đang gọi...' : 'Gọi nhân viên'}</span>
              </button>
              <div className={`flex bg-gray-100 rounded-full p-1 transition-all duration-200 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
                <button onClick={() => switchLanguage('vi')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${locale === 'vi' ? 'bg-white text-gray-800 shadow-sm scale-105' : 'text-gray-600 hover:text-gray-800'}`}>🇻🇳 VI</button>
                <button onClick={() => switchLanguage('en')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${locale === 'en' ? 'bg-white text-gray-800 shadow-sm scale-105' : 'text-gray-600 hover:text-gray-800'}`}>🇬🇧 EN</button>
              </div>
              {cart.length > 0 && (
                <button onClick={() => setShowCart(!showCart)} className="relative bg-orange-500 text-white px-4 py-2.5 rounded-full font-semibold hover:bg-orange-600 transition-all shadow-md flex items-center gap-2">
                  <span>🛒</span>
                  <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                  <span className="hidden sm:inline">{t('cart.items')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white border-b sticky top-[76px] z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id.toString())}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all font-medium text-sm ${
                  activeCategory === cat.id.toString() ? `${cat.color} text-white shadow-md` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                <span className="mr-1">{cat.icon}</span>{cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const available = isItemAvailable(item.status);
            const inCart = cart.find(i => i.item_id === item.item_id);
            return (
              <div key={item.item_id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="relative h-44 bg-gray-100">
                  <img src={item.image_url} alt={getItemName(item)} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300/f5f5f5/9ca3af?text=Món+ăn'; }} />
                  {!available && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold">{t('outOfStock')}</span>
                    </div>
                  )}
                  {inCart && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">{inCart.quantity}</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 mb-1 line-clamp-1">{getItemName(item)}</h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{getItemDescription(item)}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold text-orange-600">{item.price.toLocaleString('vi-VN')}đ</div>
                    <button onClick={() => addToCart(item)} disabled={!available}
                      className={`px-5 py-2 rounded-full font-semibold transition-all ${available ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                      {available ? `+ ${t('addToCart')}` : t('outOfStock')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-3 opacity-50">🍽️</div>
            <p className="text-gray-500">{t('noItemsInCategory')}</p>
          </div>
        )}
      </div>

      {/* Floating Cart */}
      {cart.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 bg-white shadow-2xl transition-all duration-300 z-50 ${showCart ? 'translate-y-0' : 'translate-y-[calc(100%-88px)]'}`}>
          <div className="max-w-7xl mx-auto">
            <button onClick={() => setShowCart(!showCart)} className="w-full px-4 py-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <span className="text-xl">🛒</span>
                <span className="font-semibold text-gray-800">{t('cart.title')} ({cart.reduce((sum, item) => sum + item.quantity, 0)} {t('cart.items')})</span>
              </div>
              <span className="text-gray-400">{showCart ? '▼' : '▲'}</span>
            </button>
            <div className="max-h-64 overflow-y-auto px-4 py-3">
              {cart.map(item => (
                <div key={item.item_id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <img src={item.image_url} alt={getItemName(item)} className="w-14 h-14 rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100/f5f5f5/9ca3af'; }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{getItemName(item)}</p>
                    <p className="text-sm text-gray-500">{item.price.toLocaleString('vi-VN')}đ × {item.quantity}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.item_id)} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center">✕</button>
                </div>
              ))}
            </div>
            <div className="px-4 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-medium">{t('cart.total')}</span>
                <span className="text-2xl font-bold text-orange-600">{getTotalAmount().toLocaleString('vi-VN')}đ</span>
              </div>
              <button onClick={handleSubmitOrder} className="w-full py-3 rounded-full font-bold text-white transition-all bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-lg active:scale-98">
                🛎️ {t('cart.orderNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes bounceSlow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-7xl mb-4 animate-bounce">🍽️</div>
          <div className="text-gray-800 text-xl font-semibold">Đang tải...</div>
        </div>
      </div>
    }>
      <OrderPageContent />
    </Suspense>
  );
}