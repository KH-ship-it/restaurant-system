'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface MenuItem {
  item_id: number;
  item_name: string;
  category_id: number;
  category_name: string;
  price: number;
  status: string;
  description: string;
  image_url: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface DebugInfo {
  apiBase?: string;
  endpoint?: string;
  time?: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  hasData?: boolean;
  dataLength?: number;
  error?: string;
  errorType?: string;
}

function OrderPageContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '🍽️' },
    { id: 1, name: 'Cà phê', icon: '☕' },
    { id: 2, name: 'Món chính', icon: '🍖' },
    { id: 3, name: 'Đồ uống', icon: '🥤' },
    { id: 4, name: 'Sinh tố', icon: '🍹' }
  ];

  useEffect(() => {
    loadMenu();
  }, []);

  // 🔧 FIX: Check if item is available - handle empty string status
  const isItemAvailable = (status: string) => {
    if (!status || status.trim() === '') {
      // If status is empty or just whitespace, treat as available
      return true;
    }
    
    const normalizedStatus = status.trim().toUpperCase();
    return normalizedStatus === 'AVAILABLE' || normalizedStatus === 'ACTIVE';
  };

  const loadMenu = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const endpoint = `${API_BASE}/api/menu/public`;
      
      console.log('🔍 Loading menu from:', endpoint);
      
      setDebugInfo({
        apiBase: API_BASE,
        endpoint: endpoint,
        time: new Date().toISOString(),
      });

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📡 Response status:', response.status);

      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      }));

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorData.message || errorDetail;
        } catch (e) {
          const text = await response.text();
          errorDetail = text || errorDetail;
        }
        throw new Error(errorDetail);
      }

      const result = await response.json();
      console.log('✅ Menu data received:', result);

      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        hasData: !!result.data,
        dataLength: result.data?.length || 0,
      }));

      if (result.success && result.data && result.data.length > 0) {
        console.log(`✅ Loaded ${result.data.length} menu items`);
        setMenuItems(result.data);
      } else {
        console.log('⚠️ Menu is empty or no data returned');
        setMenuItems([]);
        setError('Thực đơn chưa có món nào');
      }
    } catch (err: any) {
      console.error('❌ Error loading menu:', err);
      setError(err.message || 'Không thể tải thực đơn');
      
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        error: err.message,
        errorType: err.name,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    console.log('➕ Adding to cart:', item.item_name);
    
    const existing = cart.find(i => i.item_id === item.item_id);
    if (existing) {
      setCart(cart.map(i => 
        i.item_id === item.item_id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: number) => {
    const existing = cart.find(i => i.item_id === itemId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(i => 
        i.item_id === itemId 
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ));
    } else {
      setCart(cart.filter(i => i.item_id !== itemId));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const syncWithStaffPage = (orderId: string, orderData: any) => {
    try {
      console.log('📤 Syncing order to staff page:', orderId);
      
      const staffOrder = {
        id: orderId,
        tableNumber: parseInt(tableNumber),
        customerName: orderData.customer_name,
        items: orderData.items.map((item: any) => ({
          id: item.item_id,
          name: menuItems.find(m => m.item_id === item.item_id)?.item_name || `Món ${item.item_id}`,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: orderData.total_amount,
        status: 'pending',
        orderTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        paymentStatus: 'unpaid',
        createdAt: Date.now()
      };

      console.log('✅ Order data:', staffOrder);
      
      const existingOrders = JSON.parse(localStorage.getItem('staff-orders') || '[]');
      const updatedOrders = [staffOrder, ...existingOrders];
      localStorage.setItem('staff-orders', JSON.stringify(updatedOrders));
      
      console.log('✅ Order synced successfully. Total orders:', updatedOrders.length);

      window.dispatchEvent(new CustomEvent('new-order', { 
        detail: staffOrder 
      }));

    } catch (error) {
      console.error('❌ Error syncing with staff page:', error);
    }
  };

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      alert('Vui lòng nhập tên khách hàng!');
      return;
    }

    if (cart.length === 0) {
      alert('Giỏ hàng trống!');
      return;
    }

    try {
      const orderData = {
        table_number: parseInt(tableNumber),
        customer_name: customerName.trim(),
        items: cart.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          price: item.price,
        })),
        total_amount: getTotalAmount(),
      };

      console.log('📤 Submitting order:', orderData);

      const response = await fetch(`${API_BASE}/api/orders/public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(orderData),
      });

      console.log('📡 Order response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Order response:', result);
        
        if (result.success) {
          syncWithStaffPage(result.data.order_id.toString(), orderData);
          
          alert(`✅ ${result.message || 'Đặt món thành công!'}\n\nMã đơn: #${result.data.order_id}\n\nNhân viên sẽ xử lý đơn của bạn ngay!`);
          
          setCart([]);
          setCustomerName('');
        } else {
          alert('❌ ' + (result.message || 'Không thể đặt món'));
        }
      } else {
        let errorMessage = 'Không thể đặt món';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
          console.error('❌ Order error (JSON):', errorData);
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
          console.error('❌ Order error (text):', errorText);
        }
        alert(`❌ Lỗi: ${errorMessage}\n\nHTTP ${response.status}`);
      }
    } catch (error: any) {
      console.error('❌ Order error:', error);
      alert('❌ Lỗi kết nối! Vui lòng kiểm tra:\n1. Backend có đang chạy?\n2. URL API có đúng không?');
    }
  };

  const filteredItems = menuItems.filter(item => 
    activeCategory === 'all' || item.category_id.toString() === activeCategory.toString()
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4 animate-bounce">🍽️</div>
          <div className="text-gray-800 text-xl mb-2">Đang tải thực đơn...</div>
          <div className="text-gray-500 text-sm mb-4">Bàn số {tableNumber}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl w-full">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-gray-800 text-2xl mb-2">Không thể tải menu</h1>
          <p className="text-red-600 mb-4 font-semibold">{error}</p>
          <button
            onClick={loadMenu}
            className="px-6 py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-semibold transition"
          >
            🔄 Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-gray-800 text-2xl mb-2">Thực đơn trống</h1>
          <p className="text-gray-500 mb-4">Chưa có món nào trong database</p>
          <button
            onClick={loadMenu}
            className="px-6 py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800"
          >
            🔄 Tải lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-amber-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-50 backdrop-blur-xl bg-white/95 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
            🍽️ Bàn số {tableNumber}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">Chọn món và đặt hàng · {menuItems.length} món có sẵn</p>
        </div>
      </div>

      {/* Customer Name Input */}
      {cart.length > 0 && !customerName && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 sm:py-3 sticky top-[72px] sm:top-[80px] z-40">
          <div className="max-w-7xl mx-auto">
            <input
              type="text"
              placeholder="👤 Nhập tên khách hàng..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white border-2 border-amber-300 text-gray-900 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full focus:outline-none focus:border-amber-500 transition-all text-sm sm:text-base"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2 sm:py-3 sticky top-[108px] sm:top-[120px] z-30 backdrop-blur-xl bg-white/95">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id.toString())}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full whitespace-nowrap transition-all font-medium text-sm ${
                  activeCategory === cat.id.toString()
                    ? 'bg-gray-900 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items Count */}
      <div className="px-4 sm:px-6 py-2 text-gray-500 text-xs max-w-7xl mx-auto">
        {filteredItems.length} món
      </div>

      {/* Menu Items Grid */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredItems.map(item => {
            const available = isItemAvailable(item.status);
            
            return (
              <div
                key={item.item_id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group"
              >
                {/* Image */}
                <div className="relative h-40 sm:h-48 overflow-hidden bg-gray-100">
                  <img
                    src={item.image_url}
                    alt={item.item_name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/400x300/f5f5f4/78716c?text=No+Image';
                    }}
                  />
                  {!available && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <span className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                        Hết hàng
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4">
                  <div className="mb-2">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-0.5" style={{ fontFamily: 'Georgia, serif' }}>
                      {item.item_name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-lg sm:text-xl font-bold text-gray-900">
                        {(item.price / 1000).toFixed(1)} đ
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {Math.round(item.price / 1000)} gr
                      </div>
                    </div>

                    <button
                      onClick={() => addToCart(item)}
                      disabled={!available}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-xl ${
                        available
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-110'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-xl text-gray-500">Không có món nào trong danh mục này</div>
          </div>
        )}
      </div>

      {/* Cart Summary Fixed Bottom */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:p-4 z-50 shadow-2xl">
          <div className="max-w-7xl mx-auto">
            {/* Cart Items Preview */}
            <div className="mb-2 max-h-24 overflow-y-auto">
              {cart.map(item => (
                <div key={item.item_id} className="flex justify-between items-center text-xs sm:text-sm mb-1.5">
                  <span className="text-gray-900 flex-1 truncate">{item.item_name} x{item.quantity}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-600 font-bold whitespace-nowrap">
                      {(item.price * item.quantity / 1000).toFixed(1)} đ
                    </span>
                    <button
                      onClick={() => removeFromCart(item.item_id)}
                      className="text-red-500 font-bold hover:text-red-700 transition w-5 h-5 flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-bold text-sm sm:text-base">Tổng cộng:</span>
              <span className="text-emerald-600 font-bold text-lg sm:text-xl">
                {(getTotalAmount() / 1000).toFixed(1)} đ
              </span>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitOrder}
              disabled={!customerName.trim()}
              className="w-full bg-indigo-600 text-white py-2.5 sm:py-3 rounded-full font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
            >
              {customerName.trim() ? `🛎️ Đặt món (${cart.length} món)` : '👤 Nhập tên trước khi đặt'}
            </button>
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

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-gray-800 text-xl">Loading...</div>
      </div>
    }>
      <OrderPageContent />
    </Suspense>
  );
}