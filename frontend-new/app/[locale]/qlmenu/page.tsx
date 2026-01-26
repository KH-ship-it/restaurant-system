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

  // ⚠️ THAY ĐỔI URL NÀY BẰNG NGROK URL CỦA BẠN
  const API_URL = 'http://localhost:8000/api/menu'; // Hoặc thay bằng ngrok URL
  
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
    { id: 2, name: 'Món chính', icon: '🍖' },
    { id: 3, name: 'Đồ uống', icon: '🥤' },
    { id: 4, name: 'Sinh tố', icon: '🍹' }
  ];

  useEffect(() => {
    loadMenuFromAPI();
  }, []);

  const loadMenuFromAPI = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_URL}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Mozilla/5.0',
        },
        cache: 'no-store'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      if (result.success && result.data) {
        setMenuItems(result.data);
      }
    } catch (error) {
      console.error('❌ Error loading menu:', error);
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

  const handleSubmit = async () => {
    if (!formData.item_name || !formData.category_id || !formData.price || !formData.description) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        category_id: parseInt(formData.category_id),
        item_name: formData.item_name,
        description: formData.description,
        price: parseFloat(formData.price),
        image_url: formData.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
        status: formData.status
      };

      const url = editingId ? `${API_URL}/${editingId}` : `${API_URL}`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      if (result.success) {
        alert(editingId ? '✅ Cập nhật thành công!' : '✅ Thêm món thành công!');
        setIsModalOpen(false);
        await loadMenuFromAPI();
      }
    } catch (error) {
      console.error('❌ Error saving:', error);
      alert('Lỗi lưu món!');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMenuStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus.toUpperCase() === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    const action = newStatus === 'UNAVAILABLE' ? 'ẩn' : 'hiện';
    
    if (!confirm(`Bạn có chắc chắn muốn ${action} món này?`)) return;

    try {
      console.log(`🔄 Changing status of item ${id} to ${newStatus}`);
      
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      if (result.success) {
        alert(`✅ ${action === 'ẩn' ? 'Đã ẩn món' : 'Đã hiện món'} thành công!`);
        await loadMenuFromAPI();
      }
    } catch (error) {
      console.error('❌ Error updating status:', error);
      alert(`Lỗi cập nhật trạng thái!`);
    }
  };

  const deleteMenuPermanently = async (id: number) => {
    if (!confirm('⚠️ XÓA VĨNH VIỄN? Hành động này không thể hoàn tác!')) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Mozilla/5.0',
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      if (result.success) {
        alert('✅ Xóa vĩnh viễn thành công!');
        await loadMenuFromAPI();
      }
    } catch (error) {
      console.error('❌ Error deleting:', error);
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
          <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white font-bold text-lg mb-5">H</div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d]">📋</div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white">🍽️</div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d]">👥</div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d]">📦</div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer text-[#8b949e] hover:bg-[#21262d]">💰</div>
          </div>

          <div className="ml-[60px]">
            <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4 flex justify-between items-center">
              <div>
                <h1 className="text-2xl text-white mb-1">Quản lý Thực đơn</h1>
                <p className="text-sm text-[#8b949e]">Quản lý món ăn, giá cả và phân loại</p>
              </div>
              <div className="flex gap-4">
                <button onClick={loadMenuFromAPI} className="px-5 py-2.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm hover:bg-[#30363d]">
                  🔄 Làm mới
                </button>
                <button onClick={() => openMenuModal()} className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium hover:bg-[#2ea043]">
                  ➕ Thêm món mới
                </button>
              </div>
            </div>

            <div className="p-8">
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

              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-[300px] relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#8b949e]">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 pl-12 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                    placeholder="Tìm kiếm..."
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
                            className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center hover:text-[#58a6ff] hover:border-[#58a6ff]"
                            title="Chỉnh sửa"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => toggleMenuStatus(item.item_id, item.status)} 
                            className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center hover:text-[#f0ad4e] hover:border-[#f0ad4e]"
                            title={item.status.toUpperCase() === 'AVAILABLE' ? 'Ẩn món' : 'Hiện món'}
                          >
                            {item.status.toUpperCase() === 'AVAILABLE' ? '👁️' : '👁️‍🗨️'}
                          </button>
                          <button 
                            onClick={() => deleteMenuPermanently(item.item_id)} 
                            className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center hover:text-[#f85149] hover:border-[#f85149]"
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

          {isModalOpen && (
            <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-5">
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-[700px] p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl text-white">{editingId ? 'Chỉnh sửa món' : 'Thêm món mới'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-md bg-[#21262d] text-[#8b949e] flex items-center justify-center hover:bg-[#30363d]">✕</button>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-sm text-[#8b949e] mb-2 font-medium">Tên món <span className="text-[#f85149]">*</span></label>
                      <input type="text" value={formData.item_name} onChange={(e) => setFormData({...formData, item_name: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#8b949e] mb-2 font-medium">Danh mục <span className="text-[#f85149]">*</span></label>
                      <select value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]">
                        <option value="">Chọn danh mục</option>
                        <option value="1">☕ Cà phê</option>
                        <option value="2">🍖 Món chính</option>
                        <option value="3">🥤 Đồ uống</option>
                        <option value="4">🍹 Sinh tố</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-sm text-[#8b949e] mb-2 font-medium">Giá <span className="text-[#f85149]">*</span></label>
                      <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#8b949e] mb-2 font-medium">Trạng thái</label>
                      <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as 'AVAILABLE' | 'UNAVAILABLE'})} className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]">
                        <option value="AVAILABLE">Còn món</option>
                        <option value="UNAVAILABLE">Hết món</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-sm text-[#8b949e] mb-2 font-medium">Mô tả <span className="text-[#f85149]">*</span></label>
                    <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff] min-h-[100px]" />
                  </div>

                  <div className="mb-5">
                    <label className="block text-sm text-[#8b949e] mb-2 font-medium">URL hình ảnh</label>
                    <input type="text" value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]" placeholder="https://..." />
                    {formData.image_url && (
                      <img src={formData.image_url} alt="Preview" className="mt-3 w-full h-48 object-cover rounded-lg" onError={(e) => (e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400')} />
                    )}
                  </div>

                  <div className="flex gap-2.5 justify-end pt-5 border-t border-[#30363d]">
                    <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-5 py-2.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm hover:bg-[#30363d]">Hủy</button>
                    <button onClick={handleSubmit} disabled={isSaving} className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium hover:bg-[#2ea043] disabled:opacity-50">
                      {isSaving ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm món')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}