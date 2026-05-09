"use client";

import { useState, useEffect } from 'react';
import { BarChart3, Users, ShoppingCart, FileText, Package, CreditCard, Calendar, User, AlertCircle, CheckCircle, RefreshCw, X } from 'lucide-react';

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

interface MenuFormData {
  item_name_vi: string;
  item_name_en: string;
  category_id: string;
  price: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  description_vi: string;
  description_en: string;
  image_url: string;
}

// Menu Items Configuration
const menuItems2 = [
  { label: 'Thống kê', path: '/vi/thongke', icon: BarChart3, active: false },
  { label: 'Quản lý bàn', path: '/vi/qldatban', icon: Calendar, active: false },
  { label: 'Thực đơn', path: '/vi/qlmenu', icon: FileText, active: true },
  { label: 'Nhân viên', path: '/vi/qlnhanvien', icon: Users, active: false },
  { label: 'Đơn hàng', path: '/vi/order', icon: ShoppingCart, active: false },
  { label: 'Tài khoản', path: '/vi/qltk', icon: User, active: false },
  { label: 'Kho vận', path: '/vi/qlkho', icon: Package, active: false },
  { label: 'Thu ngân', path: '/vi/thungan', icon: CreditCard, active: false }
];

// Sidebar Component
const Sidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateTo = (path: string) => {
    window.location.href = path;
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1a1d29] text-white rounded-lg shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className={`w-64 bg-[#1a1d29] min-h-screen fixed left-0 top-0 text-gray-300 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Restaurant</h2>
              <p className="text-xs text-gray-400">Management</p>
            </div>
          </div>
        </div>

        <nav className="py-4">
          {menuItems2.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => navigateTo(item.path)}
                className={`w-full px-6 py-3 flex items-center gap-3 transition-all duration-200 ${item.active ? 'bg-green-500/10 text-green-400 border-r-4 border-green-500' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default function MenuManagement() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeLanguageTab, setActiveLanguageTab] = useState<'VI' | 'EN'>('VI');

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    }
    return 'http://localhost:8000';
  };
  const API_URL = `${getApiUrl()}/api/menu`;
  
  const [formData, setFormData] = useState<MenuFormData>({
    item_name_vi: '',
    item_name_en: '',
    category_id: '',
    price: '',
    status: 'AVAILABLE',
    description_vi: '',
    description_en: '',
    image_url: ''
  });

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '🍽️' },
    { id: 1, name: 'Cà phê', icon: '☕' },
    { id: 2, name: 'Món chính', icon: '🍛' },
    { id: 3, name: 'Đồ uống', icon: '🥤' },
    { id: 4, name: 'Sinh tố', icon: '🥤' }
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkAuthAndPermission();
  }, []);

  const checkAuthAndPermission = () => {
    const storedToken =localStorage.getItem('user');
    const storedUser = sessionStorage.getItem('user');

    if (!storedToken || !storedUser) {
      setAuthError('Vui lòng đăng nhập để tiếp tục');
      setIsAuthChecking(false);
      setIsLoading(false);
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const role = user.role || '';
      setUserRole(role);

      if (role !== 'OWNER' && role !== 'ADMIN') {
        setAuthError(`Bạn không có quyền truy cập trang này.`);
        setIsAuthChecking(false);
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      setAuthError('');
      setIsAuthChecking(false);
    } catch (error) {
      setAuthError('Dữ liệu đăng nhập không hợp lệ.');
      setIsAuthChecking(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadMenuFromAPI();
  }, [token]);

  const loadMenuFromAPI = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) {
        setMenuItems(result.data);
      }
    } catch (error) {
      alert('Lỗi tải menu từ server!');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return cat ? `${cat.icon} ${cat.name}` : categoryName;
  };

  const getCategoryCount = (category: string | number) => {
    if (category === 'all') return menuItems.length;
    return menuItems.filter(item => item.category_id === category).length;
  };

  const filteredItems = menuItems.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category_id.toString() === activeCategory.toString();
    const matchSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.status.toUpperCase() === statusFilter.toUpperCase();
    return matchCategory && matchSearch && matchStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.item_name.localeCompare(b.item_name);
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'newest': return b.item_id - a.item_id;
      default: return 0;
    }
  });

  const openMenuModal = (id?: number) => {
    if (id) {
      const item = menuItems.find(m => m.item_id === id);
      if (item) {
        setFormData({
          item_name_vi: item.item_name,
          item_name_en: item.item_name_en || '',
          category_id: item.category_id.toString(),
          price: item.price.toString(),
          status: item.status.toUpperCase() as 'AVAILABLE' | 'UNAVAILABLE',
          description_vi: item.description,
          description_en: item.description_en || '',
          image_url: item.image_url
        });
        setEditingId(id);
      }
    } else {
      setFormData({
        item_name_vi: '',
        item_name_en: '',
        category_id: '',
        price: '',
        status: 'AVAILABLE',
        description_vi: '',
        description_en: '',
        image_url: ''
      });
      setEditingId(null);
    }
    setActiveLanguageTab('VI');
    setIsModalOpen(true);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          let width = img.width;
          let height = img.height;
          const maxSize = 800;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh!');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh quá lớn! (max 5MB)');
      return;
    }

    try {
      setIsUploading(true);
      const compressed = await compressImage(file);
      setFormData(prev => ({...prev, image_url: compressed}));
    } catch (error) {
      alert('Lỗi tải ảnh!');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.item_name_vi || !formData.category_id || !formData.price || !formData.description_vi) {
      alert('⚠️ Vui lòng điền đầy đủ thông tin tiếng Việt bắt buộc!');
      return;
    }

    if (parseFloat(formData.price) <= 0) {
      alert('⚠️ Giá phải lớn hơn 0!');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        category_id: parseInt(formData.category_id),
        item_name: formData.item_name_vi.trim(),
        item_name_en: formData.item_name_en.trim() || formData.item_name_vi.trim(),
        description: formData.description_vi.trim(),
        description_en: formData.description_en.trim() || formData.description_vi.trim(),
        price: parseFloat(formData.price),
        image_url: formData.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
        status: formData.status
      };

      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const result = await res.json();
      if (result.success) {
        alert(editingId ? ' Cập nhật thành công!' : ' Thêm món mới thành công!');
        setIsModalOpen(false);
        await loadMenuFromAPI();
      }
    } catch (error) {
      alert(` Lỗi lưu món!`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMenuStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus.toUpperCase() === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error();
      const result = await res.json();
      if (result.success) {
        alert(' Cập nhật trạng thái thành công!');
        await loadMenuFromAPI();
      }
    } catch {
      alert(' Lỗi cập nhật!');
    }
  };

  const deleteMenuPermanently = async (id: number) => {
    if (!confirm(' XÓA VĨNH VIỄN?')) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
      });

      if (!res.ok) throw new Error();
      const result = await res.json();
      if (result.success) {
        alert('✅ Xóa thành công!');
        await loadMenuFromAPI();
      }
    } catch {
      alert('❌ Lỗi xóa!');
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔍</div>
          <div className="text-gray-600 text-lg">Đang kiểm tra...</div>
        </div>
      </div>
    );
  }

  if (!token || authError) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <div className="w-full lg:ml-64 p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md">
            <div className="text-center mb-6">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Không có quyền truy cập</h2>
              <p className="text-gray-600">{authError}</p>
            </div>
            <div className="space-y-3">
              <a href="/vi/login" target="_blank" className="block w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg text-center font-semibold">
                🔑 Đăng nhập
              </a>
              <button onClick={checkAuthAndPermission} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold">
                🔄 Tải lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="w-full lg:ml-64">
        {isLoading ? (
          <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🍽️</div>
              <div className="text-gray-600">Đang tải...</div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border-b px-4 md:px-8 py-4 mt-12 lg:mt-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold">🍽️ Quản lý Thực đơn</h1>
                  <p className="text-sm text-gray-600">Quyền: <span className="font-semibold text-green-600">{userRole}</span></p>
                </div>
                <div className="flex gap-3">
                  <button onClick={loadMenuFromAPI} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">🔄 Làm mới</button>
                  <button onClick={() => openMenuModal()} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">➕ Thêm món</button>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8">
              <div className="mb-6 bg-white rounded-xl p-5">
                <h3 className="font-bold mb-4">Danh mục</h3>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id.toString())}
                      className={`px-4 py-2 rounded-lg relative ${activeCategory === cat.id.toString() ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                    >
                      {cat.icon} {cat.name}
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                        {getCategoryCount(cat.id)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mb-6 flex-wrap">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                  placeholder="🔍 Tìm kiếm..."
                />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2 border rounded-lg">
                  <option value="name">Tên A-Z</option>
                  <option value="price-asc">Giá ↑</option>
                  <option value="price-desc">Giá ↓</option>
                  <option value="newest">Mới nhất</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border rounded-lg">
                  <option value="all">Tất cả</option>
                  <option value="available">Còn món</option>
                  <option value="unavailable">Hết món</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredItems.map(item => (
                  <div key={item.item_id} className="bg-white rounded-xl overflow-hidden hover:shadow-lg transition-all">
                    <img src={item.image_url} alt={item.item_name} className="w-full h-48 object-cover" />
                    <div className="p-5">
                      <div className="flex justify-between mb-3">
                        <div>
                          <div className="font-bold text-lg">{item.item_name}</div>
                          <div className="text-xs text-gray-500">{getCategoryIcon(item.category_name)}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${item.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.status === 'AVAILABLE' ? '✓ Còn' : '✕ Hết'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{item.description}</p>
                      <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-xl font-bold text-blue-600">{item.price.toLocaleString('vi-VN')}đ</div>
                        <div className="flex gap-2">
                          <button onClick={() => openMenuModal(item.item_id)} className="w-8 h-8 bg-blue-50 rounded hover:bg-blue-100">✏️</button>
                          <button onClick={() => toggleMenuStatus(item.item_id, item.status)} className="w-8 h-8 bg-yellow-50 rounded hover:bg-yellow-100">👁️</button>
                          <button onClick={() => deleteMenuPermanently(item.item_id)} className="w-8 h-8 bg-red-50 rounded hover:bg-red-100">🗑️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🍽️</div>
                  <div className="text-gray-500">Không tìm thấy món ăn</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingId ? '✏️ Sửa món' : '➕ Thêm món'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="flex border-b bg-gray-50">
              <button
                onClick={() => setActiveLanguageTab('VI')}
                className={`flex-1 py-3 font-medium transition-all ${activeLanguageTab === 'VI' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              >
                🇻🇳 VI
              </button>
              <button
                onClick={() => setActiveLanguageTab('EN')}
                className={`flex-1 py-3 font-medium transition-all ${activeLanguageTab === 'EN' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              >
                🇬🇧 EN
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div>
                <label className="block text-sm mb-2">Hình ảnh / Image</label>
                <div className="flex gap-4">
                  {formData.image_url && <img src={formData.image_url} alt="Preview" className="w-24 h-24 object-cover rounded-lg border" />}
                  <div className="flex-1">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="img" />
                    <label htmlFor="img" className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 ${isUploading ? 'opacity-50' : ''}`}>
                      <div className="text-3xl mb-2">📷</div>
                      <div className="text-sm">{isUploading ? 'Uploading...' : 'Click to upload'}</div>
                    </label>
                  </div>
                </div>
              </div>

              {activeLanguageTab === 'VI' && (
                <>
                  <div>
                    <label className="block text-sm mb-2">Tên món <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.item_name_vi}
                      onChange={(e) => setFormData(prev => ({...prev, item_name_vi: e.target.value}))}
                      className="w-full px-4 py-3 border rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="VD: Cà phê đen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Mô tả <span className="text-red-500">*</span></label>
                    <textarea
                      value={formData.description_vi}
                      onChange={(e) => setFormData(prev => ({...prev, description_vi: e.target.value}))}
                      className="w-full px-4 py-3 border rounded-lg focus:border-blue-500 focus:outline-none min-h-[100px]"
                      placeholder="Mô tả món ăn..."
                    />
                  </div>
                </>
              )}

              {activeLanguageTab === 'EN' && (
                <>
                  <div>
                    <label className="block text-sm mb-2">Item Name</label>
                    <input
                      type="text"
                      value={formData.item_name_en}
                      onChange={(e) => setFormData(prev => ({...prev, item_name_en: e.target.value}))}
                      className="w-full px-4 py-3 border rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="E.g: Black Coffee"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Description</label>
                    <textarea
                      value={formData.description_en}
                      onChange={(e) => setFormData(prev => ({...prev, description_en: e.target.value}))}
                      className="w-full px-4 py-3 border rounded-lg focus:border-blue-500 focus:outline-none min-h-[100px]"
                      placeholder="Item description..."
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">Category <span className="text-red-500">*</span></label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData(prev => ({...prev, category_id: e.target.value}))}
                    className="w-full px-4 py-3 border rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">--- Select ---</option>
                    {categories.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-2">Price ($) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({...prev, price: e.target.value}))}
                    className="w-full px-4 py-3 border rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="25000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.status === 'AVAILABLE'}
                      onChange={() => setFormData(prev => ({...prev, status: 'AVAILABLE'}))}
                    />
                    <span className="text-green-600">✓ Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.status === 'UNAVAILABLE'}
                      onChange={() => setFormData(prev => ({...prev, status: 'UNAVAILABLE'}))}
                    />
                    <span className="text-red-600">✕ Inactive</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 px-5 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium">
                Cancel / Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {isSaving ? 'Saving...' : (editingId ? 'Save / Lưu' : 'Add / Thêm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}