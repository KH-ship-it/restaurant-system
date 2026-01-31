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
  const [showCart, setShowCart] = useState(false);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '🍽️', color: 'bg-gradient-to-br from-slate-500 to-slate-600' },
    { id: 1, name: 'Cà phê', icon: '☕', color: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { id: 2, name: 'Món chính', icon: '🍖', color: 'bg-gradient-to-br from-red-500 to-rose-600' },
    { id: 3, name: 'Đồ uống', icon: '🥤', color: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
    { id: 4, name: 'Sinh tố', icon: '🍹', color: 'bg-gradient-to-br from-green-500 to-emerald-600' }
  ];

  useEffect(() => {
    loadMenu();
  }, []);

  const isItemAvailable = (status: string) => {
    if (!status || status.trim() === '') {
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
      
      console.log('🔄 Loading menu from:', endpoint);
      
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
    
    // Show cart briefly when adding item
    setShowCart(true);
    setTimeout(() => setShowCart(false), 2000);
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
      console.log('🔄 Syncing order to staff page:', orderId);
      
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

      console.log('📦 Order data:', staffOrder);
      
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
      alert('Vui lòng nhập tên của bạn trước khi đặt món! 😊');
      return;
    }

    if (cart.length === 0) {
      alert('Giỏ hàng của bạn đang trống! Hãy chọn món bạn thích nhé! 🍽️');
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
          
          alert(`🎉 Đặt món thành công!\n\nMã đơn hàng: #${result.data.order_id}\nBàn số: ${tableNumber}\nTổng tiền: ${(getTotalAmount() / 1000).toFixed(1)}đ\n\nNhân viên sẽ phục vụ bạn ngay! ✨`);         
          setCart([]);
          setCustomerName('');
          setShowCart(false);
        } else {
          alert('❌ ' + (result.message || 'Không thể đặt món. Vui lòng thử lại!'));
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
        alert(`❌ Lỗi: ${errorMessage}\n\nVui lòng thử lại sau!`);
      }
    } catch (error: any) {
      console.error('❌ Order error:', error);
      alert('❌ Không thể kết nối đến hệ thống!\nVui lòng kiểm tra kết nối và thử lại.');
    }
  };

  const filteredItems = menuItems.filter(item => 
    activeCategory === 'all' || item.category_id.toString() === activeCategory.toString()
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="text-8xl mb-4 animate-bounce">🍽️</div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Đang tải thực đơn</h2>
          <p className="text-gray-600">Bàn số {tableNumber}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="text-7xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Oops! Có lỗi xảy ra</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={loadMenu}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-semibold hover:shadow-lg transition-all"
          >
            🔄 Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="text-7xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Thực đơn đang cập nhật</h2>
          <p className="text-gray-600 mb-6">Hiện tại chưa có món nào. Vui lòng quay lại sau!</p>
          <button
            onClick={loadMenu}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-semibold hover:shadow-lg transition-all"
          >
            🔄 Tải lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header - Clean & Simple */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span>🍽️</span>
                <span>Bàn {tableNumber}</span>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{menuItems.length} món có sẵn</p>
            </div>
            
            {/* Cart Button */}
            {cart.length > 0 && (
              <button
                onClick={() => setShowCart(!showCart)}
                className="relative bg-orange-500 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-orange-600 transition-all shadow-md flex items-center gap-2"
              >
                <span>🛒</span>
                <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                <span className="hidden sm:inline">món</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customer Name Input - Simple */}
      {cart.length > 0 && !customerName && (
        <div className="bg-amber-50 border-b border-amber-200 sticky top-[76px] z-40">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👋</span>
              <input
                type="text"
                placeholder="Tên của bạn là gì?"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="flex-1 bg-white border border-amber-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Categories - Horizontal Scroll */}
      <div className="bg-white border-b sticky top-[76px] z-30" style={{top: cart.length > 0 && !customerName ? '132px' : '76px'}}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id.toString())}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all font-medium text-sm ${
                  activeCategory === cat.id.toString()
                    ? `${cat.color} text-white shadow-md`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items - Card Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const available = isItemAvailable(item.status);
            const inCart = cart.find(i => i.item_id === item.item_id);
            
            return (
              <div
                key={item.item_id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                {/* Image */}
                <div className="relative h-44 bg-gray-100">
                  <img
                    src={item.image_url}
                    alt={item.item_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/400x300/f5f5f5/9ca3af?text=Món+ăn';
                    }}
                  />
                  
                  {/* Overlay for unavailable items */}
                  {!available && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                        Hết món
                      </span>
                    </div>
                  )}
                  
                  {/* Cart badge */}
                  {inCart && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                      {inCart.quantity}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 mb-1 line-clamp-1">
                    {item.item_name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-bold text-orange-600">
                        {(item.price / 1000).toFixed(1)}đ
                      </div>
                    </div>

                    <button
                      onClick={() => addToCart(item)}
                      disabled={!available}
                      className={`px-5 py-2 rounded-full font-semibold transition-all ${
                        available
                          ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {available ? '+ Thêm' : 'Hết'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-3 opacity-50">🔍</div>
            <p className="text-gray-500">Không có món nào trong danh mục này</p>
          </div>
        )}
      </div>

      {/* Floating Cart Summary - Bottom Sheet */}
      {cart.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 bg-white shadow-2xl transition-all duration-300 z-50 ${
          showCart ? 'translate-y-0' : 'translate-y-[calc(100%-88px)]'
        }`}>
          <div className="max-w-7xl mx-auto">
            {/* Drag Handle & Toggle */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="w-full px-4 py-3 flex items-center justify-between border-b"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🛒</span>
                <span className="font-semibold text-gray-800">
                  Giỏ hàng ({cart.reduce((sum, item) => sum + item.quantity, 0)} món)
                </span>
              </div>
              <span className="text-gray-400">
                {showCart ? '▼' : '▲'}
              </span>
            </button>

            {/* Cart Items */}
            <div className="max-h-64 overflow-y-auto px-4 py-3">
              {cart.map(item => (
                <div key={item.item_id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <img
                    src={item.image_url}
                    alt={item.item_name}
                    className="w-14 h-14 rounded-lg object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/100/f5f5f5/9ca3af';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{item.item_name}</p>
                    <p className="text-sm text-gray-500">
                      {(item.price / 1000).toFixed(1)}đ × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-600 whitespace-nowrap">
                      {(item.price * item.quantity / 1000).toFixed(1)}đ
                    </span>
                    <button
                      onClick={() => removeFromCart(item.item_id)}
                      className="w-8 h-8 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total & Submit */}
            <div className="px-4 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-medium">Tổng cộng:</span>
                <span className="text-2xl font-bold text-orange-600">
                  {(getTotalAmount() / 1000).toFixed(1)}đ
                </span>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={!customerName.trim()}
                className={`w-full py-3 rounded-full font-bold text-white transition-all ${
                  customerName.trim()
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-lg active:scale-98'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {customerName.trim() ? (
                  <span>🛎️ Đặt món ngay</span>
                ) : (
                  <span>👤 Nhập tên để đặt món</span>
                )}
              </button>
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