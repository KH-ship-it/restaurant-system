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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '🍽️' },
    { id: 1, name: 'Cà phê', icon: '☕' },
    { id: 2, name: 'Món chính', icon: '🍖' },
    { id: 3, name: 'Đồ uống', icon: '🥤' },
    { id: 4, name: 'Sinh tố', icon: '🍹' }
  ];

  useEffect(() => {
    verifyTableAndLoadMenu();
  }, []);

  const verifyTableAndLoadMenu = async () => {
    try {
      setIsVerifying(true);

      // Verify table token
      if (token) {
        const verifyRes = await fetch(
          `${API_URL}/api/tables/${tableNumber}/verify?token=${token}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
          }
        );

        const verifyResult = await verifyRes.json();
        
        if (!verifyResult.success) {
          alert('❌ Mã QR không hợp lệ hoặc đã hết hạn!');
          setTableValid(false);
          return;
        }
        
        setTableValid(true);
      } else {
        setTableValid(true); // Allow without token for backward compatibility
      }

      // Load menu
      setIsLoading(true);
      const menuRes = await fetch(`${API_URL}/api/menu/public`, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const menuResult = await menuRes.json();
      
      if (menuResult.success && menuResult.data) {
        setMenuItems(menuResult.data);
      } else {
        throw new Error('Failed to load menu');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Lỗi tải thực đơn!');
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

  const handleSubmitOrder = () => {
    if (!customerName.trim()) {
      alert('Vui lòng nhập tên khách hàng!');
      return;
    }

    if (cart.length === 0) {
      alert('Giỏ hàng trống!');
      return;
    }

    const order = {
      id: `ORD-${Date.now()}`,
      tableNumber: parseInt(tableNumber),
      customerName: customerName.trim(),
      items: cart.map(item => ({
        id: item.item_id,
        name: item.item_name,
        price: item.price,
        quantity: item.quantity,
      })),
      totalAmount: getTotalAmount(),
      status: 'pending',
      orderTime: new Date().toLocaleTimeString('vi-VN'),
      createdAt: Date.now(),
    };

    // Save to localStorage for staff to see
    const existingOrders = JSON.parse(localStorage.getItem('staff-orders') || '[]');
    localStorage.setItem('staff-orders', JSON.stringify([...existingOrders, order]));

    alert('✅ Đặt món thành công! Nhân viên sẽ phục vụ trong giây lát.');
    setCart([]);
    setCustomerName('');
  };

  const filteredItems = menuItems.filter(item => 
    activeCategory === 'all' || item.category_id.toString() === activeCategory.toString()
  );

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔐</div>
          <div className="text-white text-xl">Đang xác thực...</div>
        </div>
      </div>
    );
  }

  if (!tableValid) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-white text-2xl mb-2">Mã QR không hợp lệ</h1>
          <p className="text-[#8b949e]">
            QR code đã hết hạn hoặc không chính xác. Vui lòng quét lại mã mới từ nhân viên.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍽️</div>
          <div className="text-white text-xl">Đang tải thực đơn...</div>
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