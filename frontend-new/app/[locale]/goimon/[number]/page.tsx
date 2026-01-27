'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

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

export default function OrderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableNumber = params.number as string;
  const token = searchParams.get('token');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tableValid, setTableValid] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // ✅ Fix: Lấy API URL từ environment hoặc tự động detect
  const getApiUrl = () => {
    // Nếu có NEXT_PUBLIC_API_URL thì dùng
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    
    // Nếu đang ở client-side, dùng window.location để tự động detect
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      
      // Nếu là localhost, dùng localhost:8000
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000';
      }
      
      // Nếu là production/ngrok, dùng cùng domain nhưng port 8000
      return `${protocol}//${hostname}:8000`;
    }
    
    return 'http://localhost:8000';
  };

  const API_URL = getApiUrl();

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '🍽️' },
    { id: 1, name: 'Cà phê', icon: '☕' },
    { id: 2, name: 'Món chính', icon: '🍖' },
    { id: 3, name: 'Đồ uống', icon: '🥤' },
    { id: 4, name: 'Sinh tố', icon: '🍹' }
  ];

  useEffect(() => {
    const info = [
      `API URL: ${API_URL}`,
      `Table: ${tableNumber}`,
      `Token: ${token ? 'Yes' : 'No'}`,
      `User Agent: ${typeof window !== 'undefined' ? navigator.userAgent : 'SSR'}`
    ];
    setDebugInfo(info);
    console.log('🔧 Debug Info:', info);
    
    verifyTableAndLoadMenu();
  }, [tableNumber, token]);

  const verifyTableAndLoadMenu = async () => {
    const log = (msg: string) => {
      console.log(msg);
      setDebugInfo(prev => [...prev, msg]);
    };

    try {
      setIsVerifying(true);
      setErrorMessage('');

      log('🔍 Starting verification...');
      log(`API URL: ${API_URL}`);

      // Verify table token
      if (token) {
        log('🔐 Verifying token...');
        
        const verifyUrl = `${API_URL}/api/tables/${tableNumber}/verify?token=${token}`;
        log(`Verify URL: ${verifyUrl}`);
        
        try {
          const verifyRes = await fetch(verifyUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            // ✅ Add timeout
            signal: AbortSignal.timeout(10000), // 10 seconds timeout
          });

          log(`✅ Verify response status: ${verifyRes.status}`);

          if (!verifyRes.ok) {
            log(`❌ Verification failed with status: ${verifyRes.status}`);
            setTableValid(false);
            setErrorMessage(`Lỗi xác thực (HTTP ${verifyRes.status}). Vui lòng thử lại.`);
            setIsVerifying(false);
            setIsLoading(false);
            return;
          }

          const verifyResult = await verifyRes.json();
          log(`📋 Verify result: ${JSON.stringify(verifyResult)}`);
          
          if (!verifyResult.success) {
            log('❌ Token invalid');
            setTableValid(false);
            setErrorMessage('Mã QR không hợp lệ hoặc đã hết hạn.');
            setIsVerifying(false);
            setIsLoading(false);
            return;
          }
          
          log('✅ Token verified successfully');
          setTableValid(true);
        } catch (verifyError: any) {
          log(`❌ Verify error: ${verifyError.message}`);
          setTableValid(false);
          setErrorMessage(`Lỗi kết nối API: ${verifyError.message}`);
          setIsVerifying(false);
          setIsLoading(false);
          return;
        }
      } else {
        log('⚠️ No token provided, skipping verification');
        setTableValid(true);
      }

      // Load menu
      log('📖 Loading menu...');
      setIsLoading(true);
      
      const menuUrl = `${API_URL}/api/menu/public`;
      log(`Menu URL: ${menuUrl}`);
      
      try {
        const menuRes = await fetch(menuUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          signal: AbortSignal.timeout(10000), // 10 seconds timeout
        });

        log(`✅ Menu response status: ${menuRes.status}`);

        if (!menuRes.ok) {
          throw new Error(`Menu fetch failed with status: ${menuRes.status}`);
        }

        const menuResult = await menuRes.json();
        log(`📋 Menu result: ${JSON.stringify(menuResult).substring(0, 200)}...`);
        
        if (menuResult.success && menuResult.data) {
          log(`✅ Menu loaded: ${menuResult.data.length} items`);
          setMenuItems(menuResult.data);
        } else {
          throw new Error('Invalid menu data structure');
        }
      } catch (menuError: any) {
        log(`❌ Menu error: ${menuError.message}`);
        throw menuError;
      }
    } catch (error: any) {
      log(`❌ Fatal error: ${error.message}`);
      console.error('❌ Error in verifyTableAndLoadMenu:', error);
      setErrorMessage(`Không thể tải dữ liệu: ${error.message}`);
      setTableValid(false);
    } finally {
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

  const addToCart = (item: MenuItem) => {
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
      console.log('📤 Submitting order...');
      
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

      console.log('📋 Order data:', orderData);

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(10000),
      });

      console.log('✅ Order response status:', response.status);

      if (!response.ok) {
        throw new Error(`Order submission failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📋 Order result:', result);

      if (result.success) {
        alert('✅ Đặt món thành công! Nhân viên sẽ phục vụ trong giây lát.');
        setCart([]);
        setCustomerName('');
      } else {
        alert('❌ Đặt món thất bại: ' + (result.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('❌ Order error:', error);
      alert(`❌ Lỗi kết nối: ${error.message}`);
    }
  };

  const filteredItems = menuItems.filter(item => 
    activeCategory === 'all' || item.category_id.toString() === activeCategory.toString()
  );

  // ✅ Show debug info in development
  const [showDebug, setShowDebug] = useState(false);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔐</div>
          <div className="text-white text-xl mb-2">Đang xác thực...</div>
          <div className="text-[#8b949e] text-sm">Table: {tableNumber}</div>
          <div className="text-[#8b949e] text-xs mt-4">API: {API_URL}</div>
        </div>
      </div>
    );
  }

  if (!tableValid) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-white text-2xl mb-2">Không thể tải trang</h1>
          <p className="text-[#8b949e] mb-4">
            {errorMessage || 'QR code đã hết hạn hoặc không chính xác.'}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-[#238636] text-white rounded-lg hover:bg-[#2ea043]"
            >
              🔄 Thử lại
            </button>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-full px-4 py-2 bg-[#161b22] text-[#8b949e] rounded-lg text-sm"
            >
              {showDebug ? '🔽' : '🔼'} Debug Info
            </button>
          </div>
          {showDebug && (
            <div className="mt-4 p-4 bg-[#161b22] rounded-lg text-left">
              <div className="text-xs text-[#8b949e] font-mono space-y-1">
                {debugInfo.map((info, i) => (
                  <div key={i}>{info}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍽️</div>
          <div className="text-white text-xl mb-2">Đang tải thực đơn...</div>
          <div className="text-[#8b949e] text-sm">Bàn số {tableNumber}</div>
          <div className="text-[#8b949e] text-xs mt-4">API: {API_URL}</div>
        </div>
      </div>
    );
  }

  if (menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-white text-2xl mb-2">Thực đơn trống</h1>
          <p className="text-[#8b949e] mb-4">
            Hiện tại chưa có món ăn nào. Vui lòng liên hệ nhân viên.
          </p>
          <button
            onClick={() => verifyTableAndLoadMenu()}
            className="px-6 py-3 bg-[#238636] text-white rounded-lg hover:bg-[#2ea043]"
          >
            🔄 Tải lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] pb-24">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-4 sticky top-0 z-50">
        <h1 className="text-xl text-white font-bold">Bàn số {tableNumber}</h1>
        <p className="text-sm text-[#8b949e]">Chọn món và đặt hàng</p>
      </div>

      {/* Customer Name Input */}
      {cart.length > 0 && !customerName && (
        <div className="bg-yellow-900/20 border-b border-yellow-500 px-4 py-3">
          <input
            type="text"
            placeholder="👤 Nhập tên khách hàng..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] text-white px-4 py-2 rounded-lg"
          />
        </div>
      )}

      {/* Categories */}
      <div className="px-4 py-4 overflow-x-auto">
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id.toString())}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                activeCategory === cat.id.toString()
                  ? 'bg-[#238636] text-white'
                  : 'bg-[#161b22] text-[#8b949e] border border-[#30363d]'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4">
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.item_id}
              className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex gap-4"
            >
              <img
                src={item.image_url}
                alt={item.item_name}
                className="w-20 h-20 object-cover rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/80?text=No+Image';
                }}
              />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">{item.item_name}</h3>
                <p className="text-xs text-[#8b949e] mb-2 line-clamp-2">{item.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-[#58a6ff] font-bold">
                    {item.price.toLocaleString('vi-VN')} ₫
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    className="px-3 py-1 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043]"
                  >
                    ➕ Thêm
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Summary (Fixed Bottom) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#161b22] border-t border-[#30363d] p-4 z-50">
          <div className="mb-3 max-h-32 overflow-y-auto">
            {cart.map(item => (
              <div key={item.item_id} className="flex justify-between items-center text-sm mb-2">
                <span className="text-white">{item.item_name} x{item.quantity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#58a6ff]">{(item.price * item.quantity).toLocaleString('vi-VN')} ₫</span>
                  <button
                    onClick={() => removeFromCart(item.item_id)}
                    className="text-red-500 font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mb-3 pt-3 border-t border-[#30363d]">
            <span className="text-white font-bold">Tổng cộng:</span>
            <span className="text-[#3fb950] font-bold text-lg">
              {getTotalAmount().toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <button
            onClick={handleSubmitOrder}
            disabled={!customerName.trim()}
            className="w-full bg-[#238636] text-white py-3 rounded-lg font-bold hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🛎️ Đặt món ({cart.length})
          </button>
        </div>
      )}
    </div>
  );
}