"use client";

import { useState, useEffect } from 'react';

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

interface MenuFormData {
  item_name: string;
  category_id: string;
  price: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  description: string;
  image_url: string;
}

export default function MenuManagement() {
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

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    }
    return 'http://localhost:8000';
  };
  const API_URL = `${getApiUrl()}/api/menu`;
  
  const [formData, setFormData] = useState<MenuFormData>({
    item_name: '',
    category_id: '',
    price: '',
    status: 'AVAILABLE',
    description: '',
    image_url: ''
  });

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '' },
    { id: 1, name: 'Cà phê', icon: '☕' },
    { id: 2, name: 'Món chính', icon: '🍛' },
    { id: 3, name: 'Đồ uống', icon: '🥤' },
    { id: 4, name: 'Sinh tố', icon: '🧃' }
  ];

  // Navigation function
  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  useEffect(() => {
    loadMenuFromAPI();
  }, []);

  const loadMenuFromAPI = async () => {
    try {
      setIsLoading(true);
      console.log('Loading menu from:', API_URL);
      
      const res = await fetch(API_URL, {
        method: 'GET',
        headers: {   
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        signal: AbortSignal.timeout(10000)
      });
      
      console.log('Response status:', res.status);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      console.log('Menu loaded:', result);

      if (result.success && result.data) {
        setMenuItems(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('Error loading menu:', error);
      
      let errorMessage = 'Lỗi tải menu từ server!';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout: Server không phản hồi sau 10 giây';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Không thể kết nối tới server';
      }
      alert(errorMessage);
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
    const matchSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       item.description.toLowerCase().includes(searchQuery.toLowerCase());
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
          item_name: item.item_name,
          category_id: item.category_id.toString(),
          price: item.price.toString(),
          status: item.status.toUpperCase() as 'AVAILABLE' | 'UNAVAILABLE',
          description: item.description,
          image_url: item.image_url
        });
        setEditingId(id);
      }
    } else {
      setFormData({
        item_name: '',
        category_id: '',
        price: '',
        status: 'AVAILABLE',
        description: '',
        image_url: ''
      });
      setEditingId(null);
    }
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
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          console.log('Image compressed:', {
            original: `${(file.size / 1024).toFixed(2)} KB`,
            compressed: `${(compressedBase64.length / 1024).toFixed(2)} KB`,
            dimensions: `${width}x${height}`
          });

          resolve(compressedBase64);
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
      alert('Vui lòng chọn file ảnh (JPG, PNG, GIF...)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB');
      return;
    }

    try {
      setIsUploading(true);
      console.log('Uploading image:', file.name);
      const compressedBase64 = await compressImage(file);
      
      setFormData({...formData, image_url: compressedBase64});
      console.log('Image uploaded and compressed successfully');
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Lỗi tải ảnh! Vui lòng thử lại');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.item_name || !formData.category_id || !formData.price || !formData.description) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc!');
      return;
    }

    if (parseFloat(formData.price) <= 0) {
      alert('Giá phải lớn hơn 0!');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        category_id: parseInt(formData.category_id),
        item_name: formData.item_name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        image_url: formData.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
        status: formData.status
      };

      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true', 
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const result = await res.json();
      if (result.success) {
        alert(editingId ? 'Cập nhật món thành công!' : 'Thêm món mới thành công!');
        setIsModalOpen(false);
        await loadMenuFromAPI();
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert(`Lỗi lưu món: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMenuStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus.toUpperCase() === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    const action = newStatus === 'UNAVAILABLE' ? 'ẩn' : 'hiện';
    
    if (!confirm(`Bạn có chắc chắn muốn ${action} món này?`)) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      if (result.success) {
        alert(`${action === 'ẩn' ? 'Đã ẩn món' : 'Đã hiện món'} thành công!`);
        await loadMenuFromAPI();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert(`Lỗi cập nhật trạng thái!`);
    }
  };

  const deleteMenuPermanently = async (id: number) => {
    if (!confirm('XÓA VĨNH VIỄN? Hành động này không thể hoàn tác!')) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      if (result.success) {
        alert('Xóa vĩnh viễn thành công!');
        await loadMenuFromAPI();
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Lỗi xóa món!');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {isLoading ? (
        <div className="fixed inset-0 bg-[#0d1117] flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🍽️</div>
            <div className="text-[#8b949e] text-lg">Đang tải...</div>
          </div>
        </div>
      ) : (
        <>
          {/* 🎨 SIDEBAR - GIỐNG DASHBOARD */}
          <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
            {/* Logo */}
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white font-bold text-lg mb-5">
              R
            </div>
            
            {/* Dashboard */}
            <div 
              onClick={() => navigateTo('/vi/thongke')}
              className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] transition-all"
              title="Dashboard"
            >
              📊
            </div>
            
            {/* Quản lý bàn */}
            <div 
              onClick={() => navigateTo('/vi/qldatban')}
              className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] transition-all"
              title="Quản lý bàn"
            >
              🪑
            </div>
            
            {/* Thực đơn - ACTIVE */}
            <div 
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white"
              title="Thực đơn"
            >
              🍽️
            </div>
            
            {/* Nhân viên */}
            <div 
              onClick={() => navigateTo('/vi/qlnhanvien')}
              className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] transition-all"
              title="Nhân viên"
            >
              👥
            </div>
            
            {/* Đơn hàng */}
            <div 
              onClick={() => navigateTo('/vi/order')}
              className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] transition-all"
              title="Đơn hàng"
            >
              📋
            </div>
            
            {/* Thu ngân */}
            <div 
              onClick={() => navigateTo('/vi/thungan')}
              className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] transition-all"
              title="Thu ngân"
            >
              💰
            </div>
            
            {/* Quản lý Ngân hàng */}
            <div 
              onClick={() => navigateTo('/vi/qltk')}
              className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] transition-all"
              title="Quản lý Tài khoản"
            >
              🏦
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="ml-[60px]">
            <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4 flex justify-between items-center">
              <div>
                <h1 className="text-2xl text-white mb-1">Quản lý Thực đơn</h1>
                <p className="text-sm text-[#8b949e]">Quản lý món ăn, giá cả và phân loại</p>
              </div>
              <div className="flex gap-4">
                <button onClick={loadMenuFromAPI} className="px-5 py-2.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm hover:bg-[#30363d] transition-colors">
                  🔄 Làm mới
                </button>
                <button onClick={() => openMenuModal()} className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium hover:bg-[#2ea043] transition-colors">
                  ➕ Thêm món mới
                </button>
              </div>
            </div>

            <div className="p-8">
              {/* Category Filter */}
              <div className="mb-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5">
                <h3 className="text-base text-white mb-5">Danh mục món ăn</h3>
                <div className="flex gap-2.5 flex-wrap">
                  {categories.map(cat => (
                    <div
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id.toString())}
                      className={`px-5 py-2.5 border rounded-lg text-sm cursor-pointer transition-all relative ${
                        activeCategory === cat.id.toString() ? 'bg-[#238636] border-[#238636] text-white' : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
                      }`}
                    >
                      {cat.icon && `${cat.icon} `}{cat.name}
                      <span className="absolute -top-2 -right-2 bg-[#f85149] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                        {getCategoryCount(cat.id)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-[300px] relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#8b949e]">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 pl-12 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                    placeholder="Tìm kiếm món ăn..."
                  />
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 rounded-lg text-sm">
                  <option value="name">Tên A-Z</option>
                  <option value="price-asc">Giá: Thấp → Cao</option>
                  <option value="price-desc">Giá: Cao → Thấp</option>
                  <option value="newest">Mới nhất</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 rounded-lg text-sm">
                  <option value="all">Tất cả</option>
                  <option value="available">Còn món</option>
                  <option value="unavailable">Hết món</option>
                </select>
              </div>

              {/* Menu Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredItems.map(item => (
                  <div key={item.item_id} className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden hover:border-[#58a6ff] hover:-translate-y-1 transition-all">
                    <img src={item.image_url} alt={item.item_name} className="w-full h-[200px] object-cover" />
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-lg font-semibold text-white mb-1">{item.item_name}</div>
                          <span className="text-xs text-[#8b949e] px-2 py-0.5 bg-[#21262d] rounded">
                            {getCategoryIcon(item.category_name)}
                          </span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-xl font-medium ${
                          item.status.toUpperCase() === 'AVAILABLE' ? 'bg-[rgba(35,134,54,0.15)] text-[#3fb950]' : 'bg-[rgba(218,54,51,0.15)] text-[#f85149]'
                        }`}>
                          {item.status.toUpperCase() === 'AVAILABLE' ? 'Còn món' : 'Hết món'}
                        </span>
                      </div>
                      <p className="text-sm text-[#8b949e] mb-4 line-clamp-2">{item.description}</p>
                      <div className="flex justify-between items-center pt-4 border-t border-[#30363d]">
                        <div className="text-xl font-bold text-[#58a6ff]">{item.price.toLocaleString('vi-VN')} ₫</div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openMenuModal(item.item_id)} 
                            className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center hover:text-[#58a6ff] hover:border-[#58a6ff] transition-all"
                            title="Chỉnh sửa"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => toggleMenuStatus(item.item_id, item.status)} 
                            className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center hover:text-[#f0ad4e] hover:border-[#f0ad4e] transition-all"
                            title={item.status.toUpperCase() === 'AVAILABLE' ? 'Ẩn món' : 'Hiện món'}
                          >
                            {item.status.toUpperCase() === 'AVAILABLE' ? '👁️' : '👁️‍🗨️'}
                          </button>
                          <button 
                            onClick={() => deleteMenuPermanently(item.item_id)} 
                            className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center hover:text-[#f85149] hover:border-[#f85149] transition-all"
                            title="Xóa vĩnh viễn"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-16 text-[#8b949e]">
                  <div className="text-6xl mb-5 opacity-50">🍽️</div>
                  <div>Không tìm thấy món ăn</div>
                </div>
              )}
            </div>
          </div>

          {/* Modal - Keep existing modal code... */}
        </>
      )}
    </div>
  );
}