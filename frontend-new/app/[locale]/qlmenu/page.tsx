"use client";

import { useState, useEffect } from 'react';

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  status: 'available' | 'unavailable';
  description: string;
  image: string;
  addedDate: string;
  views: number;
}

// Type definition cho window.storage
declare global {
  interface Window {
    storage: {
      get: (key: string) => Promise<{ key: string; value: string } | null>;
      set: (key: string, value: string) => Promise<{ key: string; value: string } | null>;
      delete: (key: string) => Promise<{ key: string; deleted: boolean } | null>;
      list: (prefix?: string) => Promise<{ keys: string[] } | null>;
    };
  }
}

export default function MenuManagement() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  const defaultMenuItems: MenuItem[] = [
    {
      id: 1,
      name: 'Espresso',
      category: 'coffee',
      price: 45000,
      status: 'available',
      description: 'Cà phê đậm đặc, đậm vị Ý, đánh thức mọi giác quan',
      image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
      addedDate: '15/12/2024',
      views: 324
    },
    {
      id: 2,
      name: 'Cappuccino',
      category: 'coffee',
      price: 55000,
      status: 'available',
      description: 'Lớp bọt mịn màng trên nền cà phê đậm đà',
      image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400',
      addedDate: '14/12/2024',
      views: 298
    },
    {
      id: 3,
      name: 'Beef Steak',
      category: 'main',
      price: 180000,
      status: 'available',
      description: 'Bò bít tết Mỹ cao cấp, kèm khoai tây và salad',
      image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=400',
      addedDate: '10/12/2024',
      views: 456
    },
    {
      id: 4,
      name: 'Spaghetti',
      category: 'main',
      price: 50000,
      status: 'unavailable',
      description: 'Mì Ý truyền thống với sốt cà chua tươi và thịt bò xay',
      image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400',
      addedDate: '08/12/2024',
      views: 189
    },
    {
      id: 5,
      name: 'Orange Fresh',
      category: 'drink',
      price: 35000,
      status: 'available',
      description: 'Cam ép 100% nguyên chất, tươi mát',
      image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400',
      addedDate: '12/12/2024',
      views: 234
    },
    {
      id: 6,
      name: 'Tropical Bliss',
      category: 'smoothie',
      price: 45000,
      status: 'available',
      description: 'Sinh tố xoài, dứa, chuối và sữa chua',
      image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400',
      addedDate: '11/12/2024',
      views: 267
    }
  ];

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    status: 'available' as 'available' | 'unavailable',
    description: '',
    image: ''
  });

  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        console.log('🔍 Loading from localStorage...');
        // Sử dụng key chung 'menu-items' để chia sẻ với trang gọi món
        const stored = localStorage.getItem('menu-items');
        
        if (stored) {
          const parsedData = JSON.parse(stored);
          console.log('✅ Loaded items:', parsedData.length);
          setMenuItems(parsedData);
        } else {
          console.log('⚠️ No stored data, using defaults');
          setMenuItems(defaultMenuItems);
          localStorage.setItem('menu-items', JSON.stringify(defaultMenuItems));
          console.log('💾 Saved defaults');
        }
      } catch (error) {
        console.error('❌ Error loading:', error);
        setMenuItems(defaultMenuItems);
        try {
          localStorage.setItem('menu-items', JSON.stringify(defaultMenuItems));
        } catch (e) {
          console.error('❌ Error saving:', e);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadMenuItems();
  }, []);

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '' },
    { id: 'coffee', name: 'Cà phê', icon: '☕' },
    { id: 'main', name: 'Món chính', icon: '🍖' },
    { id: 'drink', name: 'Đồ uống', icon: '🥤' },
    { id: 'smoothie', name: 'Sinh tố', icon: '🍹' }
  ];

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat ? `${cat.icon} ${cat.name}` : category;
  };

  const getCategoryCount = (category: string) => {
    if (category === 'all') return menuItems.length;
    return menuItems.filter(item => item.category === category).length;
  };

  const filteredItems = menuItems.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchCategory && matchSearch && matchStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'price-asc':
        return a.price - b.price;
      case 'price-desc':
        return b.price - a.price;
      case 'newest':
        return b.id - a.id;
      default:
        return 0;
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFormData({...formData, image: result});
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const openMenuModal = (id?: number) => {
    if (id) {
      const item = menuItems.find(m => m.id === id);
      if (item) {
        setFormData({
          name: item.name,
          category: item.category,
          price: item.price.toString(),
          status: item.status,
          description: item.description,
          image: item.image
        });
        setImagePreview(item.image);
        setEditingId(id);
      }
    } else {
      setFormData({
        name: '',
        category: '',
        price: '',
        status: 'available',
        description: '',
        image: ''
      });
      setImagePreview('');
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const closeMenuModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setImagePreview('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.price || !formData.description) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }
    
    let updatedItems;
    
    if (editingId) {
      updatedItems = menuItems.map(item => 
        item.id === editingId 
          ? {
              ...item,
              name: formData.name,
              category: formData.category,
              price: Number(formData.price),
              status: formData.status,
              description: formData.description,
              image: formData.image || item.image
            }
          : item
      );
      console.log('✏️ Updated item:', editingId);
    } else {
      const newItem: MenuItem = {
        id: menuItems.length > 0 ? Math.max(...menuItems.map(m => m.id)) + 1 : 1,
        name: formData.name,
        category: formData.category,
        price: Number(formData.price),
        status: formData.status,
        description: formData.description,
        image: formData.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
        addedDate: new Date().toLocaleDateString('vi-VN'),
        views: 0
      };
      updatedItems = [...menuItems, newItem];
      console.log('➕ Added new item:', newItem.name);
    }
    
    setMenuItems(updatedItems);
    console.log('📊 Total items:', updatedItems.length);
    
    try {
      // Lưu vào key 'menu-items' để chia sẻ với trang gọi món
      localStorage.setItem('menu-items', JSON.stringify(updatedItems));
      console.log('💾 Saved to localStorage ✅');
      
      // Trigger storage event để các tab khác cập nhật
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('❌ Error saving:', error);
    }
    
    closeMenuModal();
  };

  const deleteMenu = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa món này?')) {
      const updatedItems = menuItems.filter(item => item.id !== id);
      setMenuItems(updatedItems);
      
      try {
        if (typeof window !== 'undefined' && window.storage) {
          await window.storage.set('restaurant-menu-items', JSON.stringify(updatedItems));
        }
      } catch (error) {
        console.error('Lỗi lưu dữ liệu:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {isLoading ? (
        <div className="fixed inset-0 bg-[#0d1117] flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🍽️</div>
            <div className="text-[#8b949e] text-lg">Đang tải dữ liệu...</div>
          </div>
        </div>
      ) : (
        <>
      <div className="fixed left-0 top-0 w-[60px] h-screen bg-[#161b22] flex flex-col items-center py-5 gap-5 border-r border-[#30363d] z-50">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#238636] text-white font-bold text-lg mb-5">
          H
        </div>
        <div 
          onClick={() => navigateTo('/vi/qldatban')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí bàn ăn"
        >
          📋
        </div>
        <div 
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all bg-[#238636] text-white" 
          title="Quản lí thực đơn"
        >
          🍽️
        </div>
        <div 
          onClick={() => navigateTo('/vi/qlnhanvien')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí nhân viên"
        >
          👥
        </div>
 <div 
          onClick={() => navigateTo('/vi/qlkho')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Quản lí kho"
        >
          📦
        </div>
        <div 
          onClick={() => navigateTo('/vi/thungan')}
          className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]" 
          title="Thu ngân"
        >
          💰
        </div>
      </div>

      <div className="ml-[60px]">
        <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl text-white mb-1">Quản lý Thực đơn</h1>
            <p className="text-sm text-[#8b949e]">Quản lý món ăn, giá cả và phân loại</p>
          </div>
          <div className="flex gap-4">
            <button className="px-5 py-2.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm transition-all hover:bg-[#30363d]">
              ⚙️ Quản lý danh mục
            </button>
            <button 
              onClick={() => openMenuModal()}
              className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium transition-all hover:bg-[#2ea043] flex items-center gap-2"
            >
              ➕ Thêm món mới
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base text-white">Danh mục món ăn</h3>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-5 py-2.5 border rounded-lg text-sm cursor-pointer transition-all relative ${
                    activeCategory === cat.id
                      ? 'bg-[#238636] border-[#238636] text-white'
                      : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff]'
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
                placeholder="Tìm kiếm món ăn..."
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 rounded-lg text-sm cursor-pointer"
            >
              <option value="name">Sắp xếp: Tên A-Z</option>
              <option value="price-asc">Giá: Thấp đến cao</option>
              <option value="price-desc">Giá: Cao đến thấp</option>
              <option value="newest">Mới nhất</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#161b22] border border-[#30363d] text-[#c9d1d9] py-3 px-4 rounded-lg text-sm cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="available">Còn món</option>
              <option value="unavailable">Hết món</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden transition-all cursor-pointer hover:border-[#58a6ff] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(88,166,255,0.2)]"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-[200px] object-cover"
                />
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-lg font-semibold text-white mb-1">{item.name}</div>
                      <span className="text-xs text-[#8b949e] inline-block px-2 py-0.5 bg-[#21262d] rounded">
                        {getCategoryIcon(item.category)}
                      </span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-xl font-medium ${
                      item.status === 'available'
                        ? 'bg-[rgba(35,134,54,0.15)] text-[#3fb950]'
                        : 'bg-[rgba(218,54,51,0.15)] text-[#f85149]'
                    }`}>
                      {item.status === 'available' ? 'Còn món' : 'Hết món'}
                    </span>
                  </div>
                  <p className="text-sm text-[#8b949e] mb-4 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="flex justify-between items-center pt-4 border-t border-[#30363d]">
                    <div className="text-xl font-bold text-[#58a6ff]">
                      {item.price.toLocaleString('vi-VN')} ₫
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openMenuModal(item.id)}
                        className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center transition-all hover:bg-[#30363d] hover:text-[#58a6ff] hover:border-[#58a6ff]"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteMenu(item.id)}
                        className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] flex items-center justify-center transition-all hover:bg-[#30363d] hover:text-[#f85149] hover:border-[#f85149]"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-[#8b949e] mt-2.5 flex justify-between">
                    <span>📅 Thêm: {item.addedDate}</span>
                    <span>👁️ {item.views} lượt xem</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-16 text-[#8b949e]">
              <div className="text-6xl mb-5 opacity-50">🍽️</div>
              <div className="text-base mb-2">Không tìm thấy món ăn</div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center overflow-y-auto p-5">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-[700px] p-8 max-h-[90vh] overflow-y-auto my-5">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl text-white">
                {editingId ? 'Chỉnh sửa món' : 'Thêm món mới'}
              </h2>
              <button
                onClick={closeMenuModal}
                className="w-8 h-8 rounded-md bg-[#21262d] text-[#8b949e] flex items-center justify-center transition-all hover:bg-[#30363d] hover:text-[#c9d1d9]"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2 font-medium">
                    Tên món ăn <span className="text-[#f85149]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                    placeholder="VD: Espresso"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2 font-medium">
                    Danh mục <span className="text-[#f85149]">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                  >
                    <option value="">Chọn danh mục</option>
                    <option value="coffee">☕ Cà phê</option>
                    <option value="main">🍖 Món chính</option>
                    <option value="drink">🥤 Đồ uống</option>
                    <option value="smoothie">🍹 Sinh tố</option>
                    <option value="dessert">🍰 Tráng miệng</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2 font-medium">
                    Giá bán <span className="text-[#f85149]">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                    placeholder="VD: 45000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2 font-medium">
                    Trạng thái <span className="text-[#f85149]">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as 'available' | 'unavailable'})}
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff]"
                  >
                    <option value="available">Còn món</option>
                    <option value="unavailable">Hết món</option>
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm text-[#8b949e] mb-2 font-medium">
                  Mô tả món ăn <span className="text-[#f85149]">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-sm focus:outline-none focus:border-[#58a6ff] min-h-[100px] resize-y"
                  placeholder="Mô tả chi tiết về món ăn..."
                />
              </div>

              <div className="mb-5">
                <label className="block text-sm text-[#8b949e] mb-2 font-medium">
                  Hình ảnh món ăn
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="imageUpload"
                  />
                  <label
                    htmlFor="imageUpload"
                    className="flex items-center justify-center gap-2 w-full bg-[#0d1117] border border-[#30363d] text-[#8b949e] py-2.5 px-4 rounded-lg text-sm cursor-pointer hover:border-[#58a6ff] hover:text-[#58a6ff] transition-all"
                  >
                    📁 Chọn ảnh từ máy
                  </label>
                  {imagePreview && (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-[#30363d]">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({...formData, image: ''});
                          setImagePreview('');
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-md bg-[#161b22]/90 border border-[#30363d] text-[#f85149] flex items-center justify-center hover:bg-[#21262d]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-5 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={closeMenuModal}
                  className="px-5 py-2.5 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-lg text-sm transition-all hover:bg-[#30363d]"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm font-medium transition-all hover:bg-[#2ea043]"
                >
                  {editingId ? 'Cập nhật' : 'Thêm món'}
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