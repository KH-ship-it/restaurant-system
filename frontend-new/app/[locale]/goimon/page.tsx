'use client';

import { useState, useEffect } from 'react';

interface MenuItem {
  item_id: number;
  item_name: string;
  category_id: number;
  category_name: string;
  description: string;
  price: number;
  image_url: string;
  status: string;
}

interface CartItem {
  quantity: number;
}

export default function CustomerMenuPage() {
  const [cart, setCart] = useState<{ [key: number]: CartItem }>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderInfo, setOrderInfo] = useState({ totalPrice: 0, orderId: '' });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [currentLocale, setCurrentLocale] = useState('vi');

  // ⚠️ THAY ĐỔI URL NÀY BẰNG NGROK URL CỦA BẠN
  const API_URL = 'http://localhost:8000/api/menu'; // Hoặc thay bằng ngrok URL

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    
    if (table) {
      setTableNumber(parseInt(table));
      localStorage.setItem('current-table', table);
    } else {
      const savedTable = localStorage.getItem('current-table');
      if (savedTable) {
        setTableNumber(parseInt(savedTable));
      }
    }
  }, []);

  useEffect(() => {
    loadMenu();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(loadMenu, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMenu = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 Fetching menu from API...');

      const res = await fetch(`${API_URL}/public`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Mozilla/5.0',
        },
        cache: 'no-store'
      });

      console.log('📡 Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`HTTP error ${res.status}: ${errorText}`);
      }

      const result = await res.json();
      console.log('✅ Fetched data:', result);

      if (!result.success || !result.data) {
        throw new Error('Invalid API response format');
      }

      console.log('✅ Loaded items:', result.data.length);
      setMenuItems(result.data);

    } catch (err) {
      console.error('❌ Lỗi load menu:', err);
      alert(`Lỗi tải menu: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setMenuItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const switchLanguage = (newLocale: string) => {
    setCurrentLocale(newLocale);
  };

  const updateQuantity = (id: number, change: number) => {
    setCart(prevCart => {
      const currentQty = prevCart[id]?.quantity || 0;
      const newQty = Math.max(0, currentQty + change);
      
      if (newQty === 0) {
        const { [id]: removed, ...rest } = prevCart;
        return rest;
      }
      return {
        ...prevCart,
        [id]: { quantity: newQty }
      };
    });
  };

  const getCartTotal = () => {
    let totalItems = 0;
    let totalPrice = 0;
    
    Object.keys(cart).forEach(id => {
      const itemId = parseInt(id);
      const item = menuItems.find(m => m.item_id === itemId);
      if (item) {
        const qty = cart[itemId].quantity;
        totalItems += qty;
        totalPrice += item.price * qty;
      }
    });
    
    return { totalItems, totalPrice };
  };

  const handleCheckout = () => {
    if (Object.keys(cart).length === 0) {
      alert(currentLocale === 'vi' ? 'Giỏ hàng trống!' : 'Cart is empty!');
      return;
    }

    if (!tableNumber) {
      setShowTableModal(true);
      return;
    }

    const { totalPrice } = getCartTotal();
    const orderId = 'HD' + Date.now().toString().slice(-8);
    
    setOrderInfo({ totalPrice, orderId });
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = () => {
    const customerName = prompt(currentLocale === 'vi' ? 'Nhập tên khách hàng:' : 'Enter customer name:') || (currentLocale === 'vi' ? 'Khách hàng' : 'Customer');

    const orderItems = Object.keys(cart).map(id => {
      const itemId = parseInt(id);
      const item = menuItems.find(m => m.item_id === itemId);
      if (!item) return null;
      
      return {
        id: item.item_id,
        name: item.item_name,
        quantity: cart[itemId].quantity,
        price: item.price,
        note: ''
      };
    }).filter(item => item !== null);

    const newOrder = {
      id: orderInfo.orderId,
      tableNumber: tableNumber!,
      customerName: customerName,
      items: orderItems,
      totalAmount: orderInfo.totalPrice,
      status: 'pending',
      orderTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      paymentStatus: 'unpaid',
      createdAt: Date.now()
    };

    try {
      const existingOrders = localStorage.getItem('staff-orders');
      const orders = existingOrders ? JSON.parse(existingOrders) : [];
      
      orders.push(newOrder);
      localStorage.setItem('staff-orders', JSON.stringify(orders));
      
      alert(currentLocale === 'vi' ? '✅ Đặt món thành công!' : '✅ Order placed successfully!');
      setCart({});
      setShowPaymentModal(false);
    } catch (error) {
      console.error('❌ Lỗi lưu đơn hàng:', error);
      alert(currentLocale === 'vi' ? '❌ Lỗi đặt món!' : '❌ Order failed!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = `/${currentLocale}/login`;
  };

  const getCategoryIcon = (categoryName: string) => {
    const icons: { [key: string]: string } = {
      'Cà phê': '☕',
      'Món chính': '🍖',
      'Đồ uống': '🥤',
      'Sinh tố': '🍹'
    };
    return icons[categoryName] || '🍽️';
  };

  const { totalItems, totalPrice } = getCartTotal();

  const t = {
    vi: {
      loading: 'Đang tải...',
      title: 'Thực đơn',
      table: 'Bàn',
      itemsAvailable: 'món có sẵn',
      noItems: 'Chưa có món nào',
      comeBackLater: 'Vui lòng quay lại sau',
      refresh: 'Làm mới',
      header: {
        home: 'Trang chủ',
        menu: 'Thực đơn',
        order: 'Đặt món',
        logout: 'Đăng xuất'
      },
      cart: {
        title: 'Giỏ hàng',
        empty: 'Giỏ hàng trống',
        addItems: 'Thêm món để đặt',
        itemCount: 'món',
        items: 'Số món',
        total: 'Tổng cộng',
        checkout: 'Thanh toán'
      },
      payment: {
        title: 'Thanh toán đơn hàng',
        subtitle: 'Quét mã QR để thanh toán',
        orderId: 'Mã đơn',
        tableNumber: 'Số bàn',
        bank: 'Ngân hàng',
        accountNumber: 'Số tài khoản',
        accountName: 'Tên tài khoản',
        amount: 'Số tiền',
        orderDetails: 'Chi tiết đơn hàng',
        notes: 'Lưu ý',
        note1: 'Quét mã QR để thanh toán',
        note2: 'Ghi mã đơn hàng vào nội dung CK',
        note3: 'Đơn hàng sẽ được xử lý sau khi thanh toán',
        confirm: 'Đã thanh toán',
        cancel: 'Hủy'
      },
      tableModal: {
        title: 'Chọn số bàn',
        subtitle: 'Vui lòng chọn bàn của bạn',
        close: 'Đóng'
      }
    },
    en: {
      loading: 'Loading...',
      title: 'Menu',
      table: 'Table',
      itemsAvailable: 'items available',
      noItems: 'No items available',
      comeBackLater: 'Please come back later',
      refresh: 'Refresh',
      header: {
        home: 'Home',
        menu: 'Menu',
        order: 'Order',
        logout: 'Logout'
      },
      cart: {
        title: 'Cart',
        empty: 'Cart is empty',
        addItems: 'Add items to order',
        itemCount: 'items',
        items: 'Items',
        total: 'Total',
        checkout: 'Checkout'
      },
      payment: {
        title: 'Payment',
        subtitle: 'Scan QR code to pay',
        orderId: 'Order ID',
        tableNumber: 'Table',
        bank: 'Bank',
        accountNumber: 'Account Number',
        accountName: 'Account Name',
        amount: 'Amount',
        orderDetails: 'Order Details',
        notes: 'Notes',
        note1: 'Scan QR code to pay',
        note2: 'Include order ID in transfer note',
        note3: 'Order will be processed after payment',
        confirm: 'Paid',
        cancel: 'Cancel'
      },
      tableModal: {
        title: 'Select Table',
        subtitle: 'Please select your table',
        close: 'Close'
      }
    }
  };

  const trans = t[currentLocale as 'vi' | 'en'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-100 via-pink-100 to-rose-200 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl sm:text-5xl md:text-6xl mb-4 animate-bounce">🍽️</div>
          <div className="text-gray-700 text-base sm:text-lg">{trans.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-pink-100 to-rose-200">
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 flex justify-between items-center gap-2">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex-shrink-0">
            🏠 Haven
          </div>
          
          <nav className="hidden lg:flex gap-4 xl:gap-8">
            <a href="#home" className="text-gray-700 hover:text-rose-500 px-3 py-2 rounded-lg hover:bg-rose-50 transition font-medium text-sm">
              {trans.header.home}
            </a>
            <a href="#menu" className="text-gray-700 hover:text-rose-500 px-3 py-2 rounded-lg hover:bg-rose-50 transition font-medium text-sm">
              {trans.header.menu}
            </a>
            <a href="#order" className="text-gray-700 hover:text-rose-500 px-3 py-2 rounded-lg hover:bg-rose-50 transition font-medium text-sm">
              {trans.header.order}
            </a>
            <button 
              onClick={handleLogout}
              className="text-gray-700 hover:text-rose-500 px-3 py-2 rounded-lg hover:bg-rose-50 transition font-medium text-sm"
            >
              {trans.header.logout}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={loadMenu}
              className="p-2 bg-rose-50 hover:bg-rose-100 rounded-lg transition text-sm"
              title={trans.refresh}
            >
              🔄
            </button>
            <select 
              value={currentLocale}
              onChange={(e) => switchLanguage(e.target.value)}
              className="bg-rose-50 border border-rose-200 text-gray-700 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg cursor-pointer font-medium text-xs sm:text-sm flex-shrink-0"
            >
              <option value="vi">🇻🇳 VI</option>
              <option value="en">🇬🇧 EN</option>
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        <div className="text-center mb-6 sm:mb-8 md:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-2 sm:mb-3">
            🍽️ {trans.title}
          </h1>
          {tableNumber && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full shadow-lg mb-3 sm:mb-4">
              <span className="text-lg sm:text-xl md:text-2xl">🪑</span>
              <span className="font-bold text-sm sm:text-base md:text-lg">{trans.table} {tableNumber}</span>
            </div>
          )}
          <p className="text-gray-600 text-xs sm:text-sm md:text-base mt-2">
            {menuItems.length} {trans.itemsAvailable}
          </p>
        </div>

        {menuItems.length === 0 ? (
          <div className="text-center py-12 sm:py-16 md:py-20">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-4">🍽️</div>
            <p className="text-gray-600 text-base sm:text-lg">{trans.noItems}</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-2">{trans.comeBackLater}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
              {menuItems.map(item => (
                <div 
                  key={item.item_id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-gray-200 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6">
                    <img 
                      src={item.image_url} 
                      alt={item.item_name}
                      className="w-full sm:w-24 md:w-28 lg:w-32 h-40 sm:h-24 md:h-28 lg:h-32 rounded-lg sm:rounded-xl object-cover flex-shrink-0"
                    />
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">
                            {item.item_name}
                          </h3>
                          <span className="text-sm sm:text-base md:text-lg">{getCategoryIcon(item.category_name)}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-1.5 sm:mb-2 line-clamp-2 sm:line-clamp-none">
                          {item.description}
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center mt-3 sm:mt-4 gap-2">
                        <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                          {item.price.toLocaleString('vi-VN')} ₫
                        </span>
                        
                        <div className="flex items-center gap-2 sm:gap-3 bg-rose-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full border border-rose-200">
                          <button
                            onClick={() => updateQuantity(item.item_id, -1)}
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-rose-200 hover:bg-rose-600 hover:text-white text-gray-800 flex items-center justify-center transition font-bold text-sm sm:text-base"
                          >
                            −
                          </button>
                          <span className="min-w-[20px] sm:min-w-[25px] md:min-w-[30px] text-center font-semibold text-sm sm:text-base">
                            {cart[item.item_id]?.quantity || 0}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.item_id, 1)}
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-rose-200 hover:bg-rose-600 hover:text-white text-gray-800 flex items-center justify-center transition font-bold text-sm sm:text-base"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 border border-gray-200 shadow-lg lg:sticky lg:top-24">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6 pb-3 sm:pb-4 md:pb-5 border-b border-gray-200">
                  <span className="text-2xl sm:text-3xl">🛒</span>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">{trans.cart.title}</h2>
                </div>

                {Object.keys(cart).length === 0 ? (
                  <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500">
                    <p className="text-base sm:text-lg">{trans.cart.empty}</p>
                    <p className="text-xs sm:text-sm mt-2">{trans.cart.addItems}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5 md:mb-6 max-h-60 sm:max-h-80 md:max-h-96 overflow-y-auto">
                      {Object.keys(cart).map(id => {
                        const itemId = parseInt(id);
                        const item = menuItems.find(m => m.item_id === itemId);
                        if (!item) return null;
                        
                        const qty = cart[itemId].quantity;
                        const itemTotal = item.price * qty;
                        
                        return (
                          <div 
                            key={itemId}
                            className="flex justify-between items-center p-2.5 sm:p-3 md:p-4 bg-white/60 rounded-lg border border-gray-200"
                          >
                            <div>
                              <h4 className="font-medium text-gray-800 text-sm sm:text-base">{item.item_name}</h4>
                              <p className="text-xs sm:text-sm text-gray-600">{qty} {trans.cart.itemCount}</p>
                            </div>
                            <div className="font-bold text-rose-600 text-sm sm:text-base">
                              {itemTotal.toLocaleString('vi-VN')} ₫
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-5 space-y-3 sm:space-y-4">
                      <div className="flex justify-between text-gray-700 text-sm sm:text-base">
                        <span>{trans.cart.items}</span>
                        <span>{totalItems} {trans.cart.itemCount}</span>
                      </div>
                      <div className="flex justify-between text-lg sm:text-xl font-bold text-rose-600">
                        <span>{trans.cart.total}</span>
                        <span>{totalPrice.toLocaleString('vi-VN')} ₫</span>
                      </div>
                      <button
                        onClick={handleCheckout}
                        className="w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white py-3 sm:py-3.5 md:py-4 rounded-xl font-semibold text-base sm:text-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
                      >
                        {trans.cart.checkout} · {totalItems} {trans.cart.itemCount}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 md:p-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold">{trans.payment.title}</h2>
                <button onClick={() => setShowPaymentModal(false)} className="text-2xl">✕</button>
              </div>
              <p className="text-gray-600 mb-4">{trans.payment.subtitle}</p>
              
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 mb-4 inline-block mx-auto">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `Haven Restaurant|Order:${orderInfo.orderId}|Amount:${orderInfo.totalPrice}|Table:${tableNumber}`
                  )}`}
                  alt="QR"
                  className="w-40 h-40"
                />
              </div>

              <div className="bg-rose-50 rounded-xl p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{trans.payment.orderId}</span>
                    <span className="font-bold">{orderInfo.orderId}</span>
                  </div>
                  {tableNumber && (
                    <div className="flex justify-between">
                      <span>{trans.payment.tableNumber}</span>
                      <span className="font-bold">{tableNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{trans.payment.amount}</span>
                    <span className="text-xl font-bold text-rose-600">{orderInfo.totalPrice.toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePaymentComplete}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-600 mb-2"
              >
                ✓ {trans.payment.confirm}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full border-2 border-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-50"
              >
                {trans.payment.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTableModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold mb-4">{trans.tableModal.title}</h2>
            <p className="text-gray-600 mb-6">{trans.tableModal.subtitle}</p>
            
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                <button
                  key={num}
                  onClick={() => {
                    setTableNumber(num);
                    localStorage.setItem('current-table', num.toString());
                    setShowTableModal(false);
                  }}
                  className="aspect-square bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-rose-600 hover:to-pink-600 shadow-lg"
                >
                  {num}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowTableModal(false)}
              className="w-full bg-gray-200 py-3 rounded-xl font-semibold hover:bg-gray-300"
            >
              {trans.tableModal.close}
            </button>
          </div>
        </div>
      )}

      {Object.keys(cart).length > 0 && (
        <div className="lg:hidden fixed bottom-4 right-4 z-40">
          <button
            onClick={handleCheckout}
            className="bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full shadow-2xl px-5 py-3 flex items-center gap-2 font-bold animate-bounce"
          >
            <span className="text-xl">🛒</span>
            <span>{totalItems}</span>
            <span>|</span>
            <span>{(totalPrice / 1000).toFixed(0)}K</span>
          </button>
        </div>
      )}
    </div>
  );
}