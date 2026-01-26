'use client'
import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, TrendingDown, TrendingUp, Download, Upload, Edit, Trash2, RefreshCw, Calendar, History, MapPin, Layers } from 'lucide-react';

type InventoryStatus = 'low' | 'ok' | 'out';

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  price: number;
  status: InventoryStatus;
  lastUpdate: string;
  supplier: string;
  batchNumber?: string;
  productionDate?: string;
  expiryDate?: string;
  location?: string;
}

interface NewItemForm {
  name: string;
  category: string;
  unit: string;
  stock: string;
  minStock: string;
  price: string;
  supplier: string;
  batchNumber: string;
  productionDate: string;
  expiryDate: string;
  location: string;
}

interface StockHistory {
  id: number;
  itemId: number;
  itemName: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  user: string;
  timestamp: string;
  batchNumber?: string;
}

const InventoryManagement = () => {
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [stockOperation, setStockOperation] = useState<{item: InventoryItem; type: 'in' | 'out'} | null>(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockBatch, setStockBatch] = useState('');
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([
    { id: 1, name: 'Thịt bò Úc', category: 'Thực phẩm tươi sống', unit: 'Kg', stock: 15, minStock: 20, price: 350000, status: 'low', lastUpdate: '22/01/2026', supplier: 'Công ty TNHH Thịt sạch VN', batchNumber: 'B001', expiryDate: '25/01/2026', location: 'Kho lạnh A1' },
    { id: 2, name: 'Thịt heo', category: 'Thực phẩm tươi sống', unit: 'Kg', stock: 45, minStock: 30, price: 120000, status: 'ok', lastUpdate: '22/01/2026', supplier: 'Nông trại Phú Mỹ', batchNumber: 'B002', expiryDate: '24/01/2026', location: 'Kho lạnh A2' },
    { id: 3, name: 'Gạo ST25', category: 'Lương thực', unit: 'Kg', stock: 180, minStock: 100, price: 35000, status: 'ok', lastUpdate: '20/01/2026', supplier: 'Hợp tác xã Tân Lập', batchNumber: 'B003', location: 'Kho khô B1' },
    { id: 4, name: 'Dầu ăn', category: 'Gia vị', unit: 'Lít', stock: 8, minStock: 15, price: 45000, status: 'low', lastUpdate: '15/01/2026', supplier: 'Công ty Dầu thực vật', batchNumber: 'B004', expiryDate: '15/06/2026', location: 'Kho khô B2' },
    { id: 5, name: 'Đậu hũ', category: 'Thực phẩm tươi sống', unit: 'Kg', stock: 25, minStock: 20, price: 12000, status: 'ok', lastUpdate: '22/01/2026', supplier: 'Cơ sở sản xuất Minh Tâm', batchNumber: 'B005', expiryDate: '23/01/2026', location: 'Kho lạnh A3' },
    { id: 6, name: 'Cà chua', category: 'Rau củ', unit: 'Kg', stock: 12, minStock: 15, price: 18000, status: 'low', lastUpdate: '22/01/2026', supplier: 'Vườn rau sạch Đà Lạt', batchNumber: 'B006', expiryDate: '25/01/2026', location: 'Kho lạnh A4' },
    { id: 7, name: 'Sữa tươi', category: 'Đồ uống', unit: 'Lít', stock: 30, minStock: 25, price: 28000, status: 'ok', lastUpdate: '21/01/2026', supplier: 'Vinamilk', batchNumber: 'B007', expiryDate: '28/01/2026', location: 'Kho lạnh B1' },
    { id: 8, name: 'Coca Cola', category: 'Đồ uống', unit: 'Lon', stock: 95, minStock: 50, price: 8000, status: 'ok', lastUpdate: '20/01/2026', supplier: 'Coca Cola Việt Nam', batchNumber: 'B008', expiryDate: '20/06/2026', location: 'Kho khô C1' },
  ]);

  const [newItem, setNewItem] = useState<NewItemForm>({
    name: '',
    category: 'Thực phẩm tươi sống',
    unit: '',
    stock: '',
    minStock: '',
    price: '',
    supplier: '',
    batchNumber: '',
    productionDate: '',
    expiryDate: '',
    location: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        if (typeof window !== 'undefined') {
          if ((window as any).storage) {
            try {
              const itemsResult = await (window as any).storage.get('inventory-items');
              if (itemsResult && itemsResult.value) {
                setInventoryItems(JSON.parse(itemsResult.value));
              }
            } catch (e) {
              console.log('No saved items');
            }
            
            try {
              const historyResult = await (window as any).storage.get('stock-history');
              if (historyResult && historyResult.value) {
                setStockHistory(JSON.parse(historyResult.value));
              }
            } catch (e) {
              console.log('No saved history');
            }
          } else {
            const savedItems = localStorage.getItem('inventory-items');
            if (savedItems) setInventoryItems(JSON.parse(savedItems));
            const savedHistory = localStorage.getItem('stock-history');
            if (savedHistory) setStockHistory(JSON.parse(savedHistory));
          }
        }
      } catch (error) {
        console.log('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        if (typeof window !== 'undefined' && inventoryItems.length > 0) {
          if ((window as any).storage) {
            await (window as any).storage.set('inventory-items', JSON.stringify(inventoryItems));
          } else {
            localStorage.setItem('inventory-items', JSON.stringify(inventoryItems));
          }
        }
      } catch (error) {
        console.error('Error saving data:', error);
      }
    };
    saveData();
  }, [inventoryItems]);

  useEffect(() => {
    const saveHistory = async () => {
      try {
        if (typeof window !== 'undefined' && stockHistory.length > 0) {
          if ((window as any).storage) {
            await (window as any).storage.set('stock-history', JSON.stringify(stockHistory));
          } else {
            localStorage.setItem('stock-history', JSON.stringify(stockHistory));
          }
        }
      } catch (error) {
        console.error('Error saving history:', error);
      }
    };
    saveHistory();
  }, [stockHistory]);

  const categories = [
    { id: 'all', name: 'Tất cả', icon: '📦', count: inventoryItems.length },
    { id: 'food', name: 'Thực phẩm tươi sống', icon: '🥩', count: inventoryItems.filter(i => i.category === 'Thực phẩm tươi sống').length },
    { id: 'grain', name: 'Lương thực', icon: '🌾', count: inventoryItems.filter(i => i.category === 'Lương thực').length },
    { id: 'spice', name: 'Gia vị', icon: '🧂', count: inventoryItems.filter(i => i.category === 'Gia vị').length },
    { id: 'vegetable', name: 'Rau củ', icon: '🥬', count: inventoryItems.filter(i => i.category === 'Rau củ').length },
    { id: 'drink', name: 'Đồ uống', icon: '🥤', count: inventoryItems.filter(i => i.category === 'Đồ uống').length },
  ];

  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.stock * item.price), 0);

  const checkExpiringSoon = () => {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);
    
    return inventoryItems.filter(item => {
      if (!item.expiryDate) return false;
      const parts = item.expiryDate.split('/');
      const expiryDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      return expiryDate <= threeDaysLater && expiryDate >= today;
    });
  };

  const expiringSoon = checkExpiringSoon();

  const stats = [
    { label: 'Tổng giá trị kho', value: totalValue.toLocaleString('vi-VN'), unit: 'VNĐ', trend: 'up', change: '+12%', color: 'from-blue-500 to-blue-600' },
    { label: 'Cần nhập sắp tới', value: inventoryItems.filter(i => i.status === 'low').length.toString(), unit: 'mặt hàng', trend: 'warning', color: 'from-orange-500 to-orange-600' },
    { label: 'Sắp hết hạn', value: expiringSoon.length.toString(), unit: 'mặt hàng', trend: 'warning', color: 'from-red-500 to-red-600' },
    { label: 'Tổng mặt hàng', value: inventoryItems.length.toString(), unit: 'mặt hàng', trend: 'up', change: '+5', color: 'from-green-500 to-green-600' },
  ];

  const getStatusColor = (status: InventoryStatus) => {
    const colors: Record<InventoryStatus, string> = {
      low: 'bg-red-500/15 text-red-400 border-red-500/30',
      ok: 'bg-green-500/15 text-green-400 border-green-500/30',
      out: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    };
    return colors[status];
  };

  const getStatusText = (status: InventoryStatus) => {
    const texts: Record<InventoryStatus, string> = {
      low: '⚠️ Sắp hết',
      ok: '✅ Đủ dùng',
      out: '❌ Hết hàng',
    };
    return texts[status];
  };

  const isFormValid = () => {
    return (
      newItem.name.trim() !== '' &&
      newItem.category.trim() !== '' &&
      newItem.unit.trim() !== '' &&
      newItem.stock.trim() !== '' &&
      newItem.minStock.trim() !== '' &&
      Number(newItem.stock) >= 0 &&
      Number(newItem.minStock) >= 0
    );
  };

  const addStockHistory = (item: InventoryItem, type: 'in' | 'out', quantity: number, reason: string, batchNumber?: string) => {
    const newHistory: StockHistory = {
      id: stockHistory.length > 0 ? Math.max(...stockHistory.map(h => h.id)) + 1 : 1,
      itemId: item.id,
      itemName: item.name,
      type,
      quantity,
      reason,
      user: 'Admin',
      timestamp: new Date().toLocaleString('vi-VN'),
      batchNumber,
    };
    setStockHistory([newHistory, ...stockHistory]);
  };

  const handleStockIn = () => {
    if (!stockOperation || !stockQuantity || Number(stockQuantity) <= 0) {
      alert('⚠️ Vui lòng nhập số lượng hợp lệ!');
      return;
    }

    const quantity = Number(stockQuantity);
    const updatedItem = {
      ...stockOperation.item,
      stock: stockOperation.item.stock + quantity,
      lastUpdate: new Date().toLocaleDateString('vi-VN'),
      batchNumber: stockBatch || stockOperation.item.batchNumber,
    };

    if (updatedItem.stock === 0) updatedItem.status = 'out';
    else if (updatedItem.stock < updatedItem.minStock) updatedItem.status = 'low';
    else updatedItem.status = 'ok';

    setInventoryItems(inventoryItems.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));

    addStockHistory(updatedItem, 'in', quantity, stockReason || 'Nhập kho', stockBatch);
    
    alert(`✅ Đã nhập ${quantity} ${updatedItem.unit} "${updatedItem.name}" vào kho!`);
    setShowStockModal(false);
    setStockOperation(null);
    setStockQuantity('');
    setStockReason('');
    setStockBatch('');
  };

  const handleStockOut = () => {
    if (!stockOperation || !stockQuantity || Number(stockQuantity) <= 0) {
      alert('⚠️ Vui lòng nhập số lượng hợp lệ!');
      return;
    }

    const quantity = Number(stockQuantity);
    if (quantity > stockOperation.item.stock) {
      alert(`⚠️ Không đủ hàng! Tồn kho hiện tại: ${stockOperation.item.stock} ${stockOperation.item.unit}`);
      return;
    }

    const updatedItem = {
      ...stockOperation.item,
      stock: stockOperation.item.stock - quantity,
      lastUpdate: new Date().toLocaleDateString('vi-VN'),
    };

    if (updatedItem.stock === 0) updatedItem.status = 'out';
    else if (updatedItem.stock < updatedItem.minStock) updatedItem.status = 'low';
    else updatedItem.status = 'ok';

    setInventoryItems(inventoryItems.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));

    addStockHistory(updatedItem, 'out', quantity, stockReason || 'Xuất kho', stockOperation.item.batchNumber);
    
    alert(`✅ Đã xuất ${quantity} ${updatedItem.unit} "${updatedItem.name}" ra khỏi kho!`);
    setShowStockModal(false);
    setStockOperation(null);
    setStockQuantity('');
    setStockReason('');
  };

  const handleAddItem = () => {
    if (!isFormValid()) {
      alert('⚠️ Vui lòng điền đầy đủ thông tin bắt buộc!');
      return;
    }

    const stock = Number(newItem.stock);
    const minStock = Number(newItem.minStock);
    const price = Number(newItem.price) || 0;

    let status: InventoryStatus = 'ok';
    if (stock === 0) status = 'out';
    else if (stock < minStock) status = 'low';

    const newInventoryItem: InventoryItem = {
      id: Math.max(...inventoryItems.map(i => i.id), 0) + 1,
      name: newItem.name.trim(),
      category: newItem.category,
      unit: newItem.unit.trim(),
      stock,
      minStock,
      price,
      status,
      lastUpdate: new Date().toLocaleDateString('vi-VN'),
      supplier: newItem.supplier.trim() || 'Chưa có thông tin',
      batchNumber: newItem.batchNumber.trim() || undefined,
      productionDate: newItem.productionDate || undefined,
      expiryDate: newItem.expiryDate || undefined,
      location: newItem.location.trim() || undefined,
    };

    setInventoryItems([newInventoryItem, ...inventoryItems]);
    addStockHistory(newInventoryItem, 'in', stock, 'Nhập kho mới', newItem.batchNumber);
    alert(`✅ Đã thêm mặt hàng "${newItem.name}" thành công!`);

    setNewItem({
      name: '',
      category: 'Thực phẩm tươi sống',
      unit: '',
      stock: '',
      minStock: '',
      price: '',
      supplier: '',
      batchNumber: '',
      productionDate: '',
      expiryDate: '',
      location: '',
    });
    setShowAddModal(false);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock: item.stock.toString(),
      minStock: item.minStock.toString(),
      price: item.price.toString(),
      supplier: item.supplier,
      batchNumber: item.batchNumber || '',
      productionDate: item.productionDate || '',
      expiryDate: item.expiryDate || '',
      location: item.location || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateItem = () => {
    if (!isFormValid() || !editingItem) return;

    const stock = Number(newItem.stock);
    const minStock = Number(newItem.minStock);
    const price = Number(newItem.price) || 0;

    let status: InventoryStatus = 'ok';
    if (stock === 0) status = 'out';
    else if (stock < minStock) status = 'low';

    const updatedItem: InventoryItem = {
      ...editingItem,
      name: newItem.name.trim(),
      category: newItem.category,
      unit: newItem.unit.trim(),
      stock,
      minStock,
      price,
      status,
      lastUpdate: new Date().toLocaleDateString('vi-VN'),
      supplier: newItem.supplier.trim() || 'Chưa có thông tin',
      batchNumber: newItem.batchNumber.trim() || undefined,
      productionDate: newItem.productionDate || undefined,
      expiryDate: newItem.expiryDate || undefined,
      location: newItem.location.trim() || undefined,
    };

    setInventoryItems(inventoryItems.map(item => 
      item.id === editingItem.id ? updatedItem : item
    ));

    alert(`✅ Đã cập nhật "${newItem.name}" thành công!`);
    setShowEditModal(false);
    setEditingItem(null);
    setNewItem({
      name: '',
      category: 'Thực phẩm tươi sống',
      unit: '',
      stock: '',
      minStock: '',
      price: '',
      supplier: '',
      batchNumber: '',
      productionDate: '',
      expiryDate: '',
      location: '',
    });
  };

  const handleDeleteItem = (id: number, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa "${name}"?`)) {
      setInventoryItems(inventoryItems.filter(item => item.id !== id));
      alert(`✅ Đã xóa "${name}" thành công!`);
    }
  };

  const handleExportExcel = () => {
    const csv = [
      ['Tên mặt hàng', 'Danh mục', 'Đơn vị', 'Tồn kho', 'Tối thiểu', 'Giá nhập', 'Trạng thái', 'Nhà cung cấp', 'Mã lô', 'HSD', 'Vị trí', 'Cập nhật'],
      ...inventoryItems.map(item => [
        item.name,
        item.category,
        item.unit,
        item.stock,
        item.minStock,
        item.price,
        getStatusText(item.status),
        item.supplier,
        item.batchNumber || '',
        item.expiryDate || '',
        item.location || '',
        item.lastUpdate
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kho-hang-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    link.click();
    alert('✅ Đã xuất file Excel thành công!');
  };

  const handleRefresh = async () => {
    try {
      if (typeof window !== 'undefined') {
        if ((window as any).storage) {
          const result = await (window as any).storage.get('inventory-items');
          if (result && result.value) {
            setInventoryItems(JSON.parse(result.value));
            alert('✅ Đã làm mới dữ liệu!');
          }
        } else {
          const saved = localStorage.getItem('inventory-items');
          if (saved) {
            setInventoryItems(JSON.parse(saved));
            alert('✅ Đã làm mới dữ liệu!');
          }
        }
      }
    } catch (err) {
      alert('⚠️ Không thể làm mới dữ liệu');
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = selectedTab === 'all' || 
                       (selectedTab === 'low' && item.status === 'low') ||
                       (selectedTab === 'ok' && item.status === 'ok');
    const matchesCategory = selectedCategory === 'all' || item.category === categories.find(c => c.id === selectedCategory)?.name;
    return matchesSearch && matchesTab && matchesCategory;
  });

  const resetForm = () => {
    setNewItem({
      name: '',
      category: 'Thực phẩm tươi sống',
      unit: '',
      stock: '',
      minStock: '',
      price: '',
      supplier: '',
      batchNumber: '',
      productionDate: '',
      expiryDate: '',
      location: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Package className="w-8 h-8" />
              Quản lý kho hàng
            </h1>
            <p className="text-[#8b949e]">Hệ thống quản lý kho hàng nhà hàng - Nhập xuất tồn kho</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white rounded-lg hover:bg-[#30363d] transition flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Lịch sử
            </button>
            <button 
              onClick={() => setShowExpiryModal(true)}
              className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white rounded-lg hover:bg-[#30363d] transition flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              HSD
              {expiringSoon.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                  {expiringSoon.length}
                </span>
              )}
            </button>
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white rounded-lg hover:bg-[#30363d] transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Thêm mặt hàng
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div key={idx} className={`bg-gradient-to-r ${stat.color} rounded-xl p-5 border border-white/10`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white/80 text-sm mb-1">{stat.label}</div>
                  <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                    {stat.value}
                    <span className="text-sm font-normal text-white/70">{stat.unit}</span>
                  </div>
                </div>
                {stat.change && (
                  <div className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                    stat.trend === 'up' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {stat.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {stat.change}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b949e]" />
            <input
              type="text"
              placeholder="Tìm kiếm mặt hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            {[
              { id: 'all', label: 'Tất cả', icon: '📦' },
              { id: 'low', label: 'Sắp hết', icon: '⚠️', alert: true },
              { id: 'ok', label: 'Đủ dùng', icon: '✅' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  selectedTab === tab.id
                    ? 'bg-[#238636] text-white'
                    : 'bg-[#0d1117] text-[#8b949e] hover:bg-[#21262d] border border-[#30363d]'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.alert && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                    {inventoryItems.filter(i => i.status === 'low').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button 
            onClick={handleRefresh}
            className="p-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg hover:bg-[#21262d] transition"
          >
            <RefreshCw className="w-5 h-5 text-[#8b949e]" />
          </button>
        </div>
      </div>

      <div className="bg-[#161b22] border-b border-[#30363d] px-8 py-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1117] text-[#8b949e] hover:bg-[#21262d] border border-[#30363d]'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
              <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs">
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
          <div className="bg-[#0d1117] border-b border-[#30363d] px-6 py-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-[#8b949e]">
              <div className="col-span-2">Tên mặt hàng</div>
              <div className="col-span-1">Danh mục</div>
              <div className="col-span-1 text-center">Tồn kho</div>
              <div className="col-span-1">Mã lô</div>
              <div className="col-span-1">HSD</div>
              <div className="col-span-1">Vị trí</div>
              <div className="col-span-2">Trạng thái</div>
              <div className="col-span-1 text-right">Cập nhật</div>
              <div className="col-span-2 text-center">Thao tác</div>
            </div>
          </div>

          <div className="divide-y divide-[#30363d]">
            {filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-[#30363d] mx-auto mb-4" />
                <div className="text-xl text-[#8b949e]">Không tìm thấy mặt hàng nào</div>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-[#0d1117] transition items-center">
                  <div className="col-span-2">
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="text-xs text-[#8b949e] mt-1">{item.supplier}</div>
                  </div>
                  <div className="col-span-1 text-[#8b949e] text-sm">{item.category}</div>
                  <div className="col-span-1 text-center">
                    <span className={`font-bold ${item.stock < item.minStock ? 'text-red-400' : 'text-green-400'}`}>
                      {item.stock} {item.unit}
                    </span>
                  </div>
                  <div className="col-span-1">
                    {item.batchNumber && (
                      <span className="px-2 py-1 bg-[#0d1117] rounded text-xs">{item.batchNumber}</span>
                    )}
                  </div>
                  <div className="col-span-1 text-sm">
                    {item.expiryDate && (
                      <span className={expiringSoon.some(e => e.id === item.id) ? 'text-red-400 font-medium' : 'text-[#8b949e]'}>
                        {item.expiryDate}
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-xs text-[#8b949e]">
                    {item.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.location}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getStatusColor(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-sm text-[#8b949e]">{item.lastUpdate}</div>
                  <div className="col-span-2 flex justify-center gap-2">
                    <button 
                      onClick={() => {
                        setStockOperation({item, type: 'in'});
                        setShowStockModal(true);
                      }}
                      className="p-2 hover:bg-green-500/10 text-green-400 rounded-lg transition"
                      title="Nhập kho"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setStockOperation({item, type: 'out'});
                        setShowStockModal(true);
                      }}
                      className="p-2 hover:bg-orange-500/10 text-orange-400 rounded-lg transition"
                      title="Xuất kho"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEditItem(item)}
                      className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition"
                      title="Chỉnh sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteItem(item.id, item.name)}
                      className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] rounded-2xl shadow-2xl w-full max-w-3xl border border-[#30363d] my-8">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {showEditModal ? <Edit className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  {showEditModal ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                  className="text-white/80 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Tên mặt hàng <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thịt bò Úc"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Danh mục <span className="text-red-400">*</span>
                  </label>
                  <select 
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option>Thực phẩm tươi sống</option>
                    <option>Lương thực</option>
                    <option>Gia vị</option>
                    <option>Rau củ</option>
                    <option>Đồ uống</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Đơn vị tính <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Kg, Lít, Gói..."
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Số lượng tồn kho <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItem.stock}
                    onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Số lượng tối thiểu <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({ ...newItem, minStock: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">Giá nhập (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">Nhà cung cấp</label>
                  <input
                    type="text"
                    placeholder="Tên nhà cung cấp"
                    value={newItem.supplier}
                    onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    <Layers className="w-4 h-4 inline mr-1" />
                    Mã lô (Batch)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: B001"
                    value={newItem.batchNumber}
                    onChange={(e) => setNewItem({ ...newItem, batchNumber: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Ngày sản xuất
                  </label>
                  <input
                    type="date"
                    value={newItem.productionDate}
                    onChange={(e) => setNewItem({ ...newItem, productionDate: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Hạn sử dụng
                  </label>
                  <input
                    type="date"
                    value={newItem.expiryDate}
                    onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Vị trí kho
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Kho lạnh A1"
                    value={newItem.location}
                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-xl hover:bg-[#21262d] transition font-medium"
                >
                  Hủy
                </button>
                <button 
                  onClick={showEditModal ? handleUpdateItem : handleAddItem}
                  disabled={!isFormValid()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showEditModal ? 'Cập nhật' : 'Thêm mặt hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStockModal && stockOperation && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] rounded-2xl shadow-2xl w-full max-w-md border border-[#30363d]">
            <div className={`bg-gradient-to-r ${stockOperation.type === 'in' ? 'from-green-500 to-green-600' : 'from-orange-500 to-orange-600'} p-6 rounded-t-2xl`}>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {stockOperation.type === 'in' ? <Upload className="w-6 h-6" /> : <Download className="w-6 h-6" />}
                  {stockOperation.type === 'in' ? 'Nhập kho' : 'Xuất kho'}
                </h2>
                <button
                  onClick={() => {
                    setShowStockModal(false);
                    setStockOperation(null);
                    setStockQuantity('');
                    setStockReason('');
                    setStockBatch('');
                  }}
                  className="text-white/80 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-[#0d1117] rounded-lg border border-[#30363d]">
                <div className="text-sm text-[#8b949e] mb-1">Mặt hàng</div>
                <div className="text-lg font-bold text-white">{stockOperation.item.name}</div>
                <div className="text-sm text-[#8b949e] mt-2">
                  Tồn kho hiện tại: <span className="font-bold text-blue-400">{stockOperation.item.stock} {stockOperation.item.unit}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Số lượng <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Nhập số lượng"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {stockOperation.type === 'in' && (
                  <div>
                    <label className="block text-sm font-medium text-[#8b949e] mb-2">
                      Mã lô (Batch)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: B001"
                      value={stockBatch}
                      onChange={(e) => setStockBatch(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-2">
                    Lý do {stockOperation.type === 'in' ? 'nhập' : 'xuất'}
                  </label>
                  {stockOperation.type === 'out' ? (
                    <select
                      value={stockReason}
                      onChange={(e) => setStockReason(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Chọn lý do</option>
                      <option value="Nấu ăn">Nấu ăn</option>
                      <option value="Bán">Bán</option>
                      <option value="Hỏng">Hỏng</option>
                      <option value="Hết hạn">Hết hạn</option>
                      <option value="Khác">Khác</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nhập lý do nhập kho"
                      value={stockReason}
                      onChange={(e) => setStockReason(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-white placeholder-[#8b949e] focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowStockModal(false);
                    setStockOperation(null);
                    setStockQuantity('');
                    setStockReason('');
                    setStockBatch('');
                  }}
                  className="flex-1 px-6 py-3 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] rounded-xl hover:bg-[#21262d] transition font-medium"
                >
                  Hủy
                </button>
                <button 
                  onClick={stockOperation.type === 'in' ? handleStockIn : handleStockOut}
                  className={`flex-1 px-6 py-3 bg-gradient-to-r ${
                    stockOperation.type === 'in' ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                  } text-white rounded-xl transition font-medium`}
                >
                  Xác nhận {stockOperation.type === 'in' ? 'nhập' : 'xuất'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] rounded-2xl shadow-2xl w-full max-w-4xl border border-[#30363d] max-h-[80vh] flex flex-col">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <History className="w-6 h-6" />
                  Lịch sử nhập xuất kho
                </h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-white/80 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {stockHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-[#30363d] mx-auto mb-4" />
                  <div className="text-xl text-[#8b949e]">Chưa có lịch sử giao dịch</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockHistory.map((history) => (
                    <div key={history.id} className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 hover:bg-[#161b22] transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {history.type === 'in' ? (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                                ⬆️ NHẬP
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded">
                                ⬇️ XUẤT
                              </span>
                            )}
                            <span className="font-bold text-white">{history.itemName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-[#8b949e]">
                              Số lượng: <span className="text-white font-medium">{history.quantity}</span>
                            </div>
                            {history.batchNumber && (
                              <div className="text-[#8b949e]">
                                Mã lô: <span className="text-white font-medium">{history.batchNumber}</span>
                              </div>
                            )}
                            <div className="text-[#8b949e]">
                              Lý do: <span className="text-white">{history.reason}</span>
                            </div>
                            <div className="text-[#8b949e]">
                              Người thực hiện: <span className="text-white">{history.user}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-[#8b949e]">
                          {history.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showExpiryModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] rounded-2xl shadow-2xl w-full max-w-3xl border border-[#30363d] max-h-[80vh] flex flex-col">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Cảnh báo hạn sử dụng
                </h2>
                <button
                  onClick={() => setShowExpiryModal(false)}
                  className="text-white/80 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {expiringSoon.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-[#30363d] mx-auto mb-4" />
                  <div className="text-xl text-[#8b949e]">Không có hàng sắp hết hạn</div>
                  <div className="text-sm text-[#8b949e] mt-2">Tất cả hàng hóa đều trong thời hạn an toàn</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">Có {expiringSoon.length} mặt hàng sắp hết hạn trong 3 ngày tới!</span>
                    </div>
                  </div>
                  {expiringSoon.map((item) => (
                    <div key={item.id} className="bg-[#0d1117] border border-red-500/30 rounded-lg p-4 hover:bg-[#161b22] transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-white text-lg mb-2">{item.name}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-[#8b949e]">
                              Danh mục: <span className="text-white">{item.category}</span>
                            </div>
                            <div className="text-[#8b949e]">
                              Tồn kho: <span className="text-red-400 font-bold">{item.stock} {item.unit}</span>
                            </div>
                            <div className="text-[#8b949e]">
                              Hạn sử dụng: <span className="text-red-400 font-bold">{item.expiryDate}</span>
                            </div>
                            {item.batchNumber && (
                              <div className="text-[#8b949e]">
                                Mã lô: <span className="text-white">{item.batchNumber}</span>
                              </div>
                            )}
                            {item.location && (
                              <div className="text-[#8b949e]">
                                Vị trí: <span className="text-white">{item.location}</span>
                              </div>
                            )}
                            <div className="text-[#8b949e]">
                              Nhà cung cấp: <span className="text-white">{item.supplier}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setStockOperation({item, type: 'out'});
                            setShowExpiryModal(false);
                            setShowStockModal(true);
                          }}
                          className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition text-sm font-medium"
                        >
                          Xuất hủy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
