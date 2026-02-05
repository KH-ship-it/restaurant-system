'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';

// Types giữ nguyên như cũ
interface BankAccount {
  id: string;
  bankName: string;
  bankLogo?: string;
  accountNumber: string;
  accountHolder: string;
  status: 'active' | 'locked';
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BankAccountFormData {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  bankLogo?: string;
}

interface BankInfo {
  name: string;
  code: string;
  logo: string;
  color: string;
}

// Bank list với bank codes chính xác theo VietQR
const BANK_LIST: BankInfo[] = [
  { name: 'Vietcombank', code: 'VCB', logo: 'VCB', color: 'bg-green-600' },
  { name: 'MB Bank', code: 'MB', logo: 'MB', color: 'bg-red-600' },
  { name: 'VietinBank', code: 'CTG', logo: 'CTG', color: 'bg-blue-600' },
  { name: 'BIDV', code: 'BIDV', logo: 'BIDV', color: 'bg-blue-700' },
  { name: 'Techcombank', code: 'TCB', logo: 'TCB', color: 'bg-green-700' },
  { name: 'ACB', code: 'ACB', logo: 'ACB', color: 'bg-purple-600' },
  { name: 'Sacombank', code: 'STB', logo: 'STB', color: 'bg-indigo-600' },
  { name: 'VPBank', code: 'VPB', logo: 'VPB', color: 'bg-emerald-600' }
];

// Local Storage Key
const STORAGE_KEY = 'bank_accounts_data';

// VietQR Generator Function
const generateVietQRUrl = (
  bankCode: string,
  accountNumber: string,
  accountName: string,
  amount: number,
  description: string
): string => {
  // VietQR API URL format
  const baseUrl = 'https://img.vietqr.io/image';
  
  // Clean and format parameters
  const cleanAccountNumber = accountNumber.replace(/\s/g, '');
  const cleanDescription = encodeURIComponent(description);
  const cleanAccountName = encodeURIComponent(accountName);
  
  // Build VietQR URL
  // Format: https://img.vietqr.io/image/[BANK_CODE]-[ACCOUNT_NUMBER]-[TEMPLATE].jpg?amount=[AMOUNT]&addInfo=[DESCRIPTION]&accountName=[ACCOUNT_NAME]
  const qrUrl = `${baseUrl}/${bankCode}-${cleanAccountNumber}-compact2.jpg?amount=${amount}&addInfo=${cleanDescription}&accountName=${cleanAccountName}`;
  
  return qrUrl;
};

// Alternative: Generate VietQR using qr-code-generator (for offline support)
const generateVietQRData = (
  bankCode: string,
  accountNumber: string,
  amount: number,
  description: string
): string => {
  // VietQR data format (compact)
  const qrData = `2|${bankCode}|${accountNumber}|${amount}|${description}`;
  return qrData;
};

// Utility functions
const getBankCode = (bankName: string): string => {
  const bank = BANK_LIST.find(b => b.name === bankName);
  return bank?.code || '';
};

const getBankColor = (bankName: string): string => {
  const bank = BANK_LIST.find(b => b.name === bankName);
  return bank?.color || 'bg-gray-600';
};

const getBankLogo = (bankName: string): string => {
  const bank = BANK_LIST.find(b => b.name === bankName);
  return bank?.logo || bankName.substring(0, 3).toUpperCase();
};

const isValidAccountNumber = (accountNumber: string): boolean => {
  const cleanNumber = accountNumber.replace(/\s/g, '');
  return /^\d{6,20}$/.test(cleanNumber);
};

const isValidAccountHolder = (name: string): boolean => {
  return name.length >= 2 && /^[a-zA-ZÀ-ỹ\s]+$/.test(name);
};

const generateAccountId = (): string => {
  return `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const filterAccounts = (
  accounts: BankAccount[],
  searchTerm: string,
  filterTerm: string
): BankAccount[] => {
  return accounts.filter(account => {
    const matchesSearch = 
      account.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountHolder.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterTerm === '' || 
      account.bankName.toLowerCase().includes(filterTerm.toLowerCase());
    
    return matchesSearch && matchesFilter;
  });
};

const getStatusText = (status: 'active' | 'locked', isActive: boolean): string => {
  if (status === 'locked') return 'Đang ẩn';
  return isActive ? 'Đang hiện ở thu ngân' : 'Đang ẩn';
};

const getStatusDotColorClass = (status: 'active' | 'locked'): string => {
  return status === 'active' ? 'bg-green-500' : 'bg-gray-400';
};

// Local Storage Helper Functions
const loadAccountsFromStorage = (): BankAccount[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading accounts from localStorage:', error);
  }
  
  return [
    {
      id: '1',
      bankName: 'Vietcombank',
      bankLogo: 'VCB',
      accountNumber: '1023445566',
      accountHolder: 'NHA HANG PHUONG NAM',
      status: 'active',
      isActive: true
    },
    {
      id: '2',
      bankName: 'Vietcombank',
      bankLogo: 'VCB',
      accountNumber: '99900011',
      accountHolder: 'NHA HANG PHUONG NAM',
      status: 'active',
      isActive: true
    },
    {
      id: '3',
      bankName: 'MB Bank',
      bankLogo: 'MB',
      accountNumber: '090999',
      accountHolder: 'NHA HANG PHUONG NAM',
      status: 'locked',
      isActive: false
    }
  ];
};

const saveAccountsToStorage = (accounts: BankAccount[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving accounts to localStorage:', error);
  }
};

// QR Code Preview Modal
interface QRPreviewModalProps {
  isOpen: boolean;
  account: BankAccount | null;
  onClose: () => void;
}

const QRPreviewModal: React.FC<QRPreviewModalProps> = ({
  isOpen,
  account,
  onClose
}) => {
  const [amount, setAmount] = useState<string>('100000');
  const [description, setDescription] = useState<string>('Thanh toan don hang');
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (account && amount) {
      const bankCode = getBankCode(account.bankName);
      const qrImageUrl = generateVietQRUrl(
        bankCode,
        account.accountNumber,
        account.accountHolder,
        parseInt(amount) || 0,
        description
      );
      setQrUrl(qrImageUrl);
    }
  }, [account, amount, description]);

  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-xl font-bold">📱 Mã QR Thanh Toán</h2>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6">
          {/* Bank Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-12 h-12 ${getBankColor(account.bankName)} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                {account.bankLogo}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{account.bankName}</div>
                <div className="text-sm text-gray-600 font-mono">{account.accountNumber}</div>
              </div>
            </div>
            <div className="text-sm text-gray-700 font-medium">{account.accountHolder}</div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Số tiền (VNĐ)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
              placeholder="Nhập số tiền..."
            />
            <div className="mt-2 text-sm text-gray-600">
              = {parseInt(amount || '0').toLocaleString('vi-VN')}đ
            </div>
          </div>

          {/* Description Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nội dung chuyển khoản
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
              placeholder="VD: Thanh toan don hang #123"
            />
          </div>

          {/* QR Code Display */}
          {qrUrl && (
            <div className="bg-white rounded-xl border-4 border-blue-100 p-4 mb-4">
              <img 
                src={qrUrl} 
                alt="VietQR Payment Code" 
                className="w-full h-auto object-contain rounded-lg"
                onError={(e) => {
                  console.error('QR load error');
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="%23f0f0f0" width="400" height="400"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">QR Code Error</text></svg>';
                }}
              />
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
            <div className="text-sm text-blue-900 space-y-2">
              <div className="font-semibold flex items-center gap-2">
                <span>✅</span>
                <span>Hướng dẫn thanh toán:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs ml-2">
                <li>Mở ứng dụng ngân hàng</li>
                <li>Chọn "Quét QR" hoặc "QR Pay"</li>
                <li>Quét mã QR phía trên</li>
                <li>Kiểm tra thông tin và xác nhận</li>
              </ol>
            </div>
          </div>

          {/* Download/Copy Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (qrUrl) {
                  window.open(qrUrl, '_blank');
                }
              }}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              📥 Tải QR Code
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(qrUrl);
                alert('Đã copy link QR Code!');
              }}
              className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
            >
              📋 Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Delete Confirmation Modal
interface DeleteConfirmModalProps {
  isOpen: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  account,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
            Xác nhận xóa tài khoản
          </h3>
          
          <p className="text-sm text-gray-600 text-center mb-4">
            Bạn có chắc chắn muốn xóa tài khoản ngân hàng này không?
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 ${getBankColor(account.bankName)} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                {account.bankLogo}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{account.bankName}</div>
                <div className="text-sm text-gray-600">{account.accountNumber}</div>
              </div>
            </div>
            <div className="text-sm text-gray-700">{account.accountHolder}</div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-yellow-800">
              ⚠️ Hành động này không thể hoàn tác. Tài khoản sẽ bị xóa vĩnh viễn.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Xóa tài khoản
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Modal Component
interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BankAccountFormData) => void;
}

const AddBankAccountModal: React.FC<AddBankAccountModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<BankAccountFormData>({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    bankLogo: ''
  });

  const [errors, setErrors] = useState<{
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (name === 'bankName') {
      const selectedBank = BANK_LIST.find(bank => bank.name === value);
      if (selectedBank) {
        setFormData(prev => ({ ...prev, bankLogo: selectedBank.logo }));
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.bankName) {
      newErrors.bankName = 'Vui lòng chọn ngân hàng';
    }

    if (!formData.accountNumber) {
      newErrors.accountNumber = 'Vui lòng nhập số tài khoản';
    } else if (!isValidAccountNumber(formData.accountNumber)) {
      newErrors.accountNumber = 'Số tài khoản không hợp lệ';
    }

    if (!formData.accountHolder) {
      newErrors.accountHolder = 'Vui lòng nhập tên chủ tài khoản';
    } else if (!isValidAccountHolder(formData.accountHolder)) {
      newErrors.accountHolder = 'Tên chủ tài khoản không hợp lệ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      onSubmit(formData);
      handleClose();
    }
  };

  const handleClose = () => {
    setFormData({
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      bankLogo: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            Thêm tài khoản ngân hàng mới
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
              Ngân hàng <span className="text-red-500">*</span>
            </label>
            <select
              id="bankName"
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.bankName ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Chọn ngân hàng</option>
              {BANK_LIST.map(bank => (
                <option key={bank.code} value={bank.name}>
                  {bank.name}
                </option>
              ))}
            </select>
            {errors.bankName && (
              <p className="mt-1 text-sm text-red-500">{errors.bankName}</p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Số tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="accountNumber"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              placeholder="Nhập số tài khoản"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.accountNumber ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.accountNumber && (
              <p className="mt-1 text-sm text-red-500">{errors.accountNumber}</p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 mb-2">
              Chủ tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="accountHolder"
              name="accountHolder"
              value={formData.accountHolder}
              onChange={handleChange}
              placeholder="Nhập tên chủ tài khoản"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.accountHolder ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.accountHolder && (
              <p className="mt-1 text-sm text-red-500">{errors.accountHolder}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Thêm tài khoản
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
const BankAccountsManagement = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [accountForQR, setAccountForQR] = useState<BankAccount | null>(null);

  useEffect(() => {
    const loadedAccounts = loadAccountsFromStorage();
    setAccounts(loadedAccounts);
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      saveAccountsToStorage(accounts);
    }
  }, [accounts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isFilterOpen && !target.closest('.filter-dropdown')) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  const handleToggleAccount = (id: string) => {
    setAccounts(accounts.map(acc => {
      if (acc.id === id) {
        const newIsActive = !acc.isActive;
        return {
          ...acc,
          isActive: newIsActive,
          status: (newIsActive ? 'active' : 'locked') as 'active' | 'locked',
          updatedAt: new Date()
        };
      }
      return acc;
    }));
  };

  const handleDeleteClick = (account: BankAccount) => {
    setAccountToDelete(account);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (accountToDelete) {
      setAccounts(accounts.filter(acc => acc.id !== accountToDelete.id));
      setDeleteModalOpen(false);
      setAccountToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setAccountToDelete(null);
  };

  const handleQRPreview = (account: BankAccount) => {
    setAccountForQR(account);
    setQrPreviewOpen(true);
  };

  const handleAddAccount = (formData: BankAccountFormData) => {
    const newAccount: BankAccount = {
      id: generateAccountId(),
      bankName: formData.bankName,
      bankLogo: formData.bankLogo,
      accountNumber: formData.accountNumber,
      accountHolder: formData.accountHolder,
      status: 'active',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setAccounts([...accounts, newAccount]);
  };

  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter);
    if (filter === 'all') {
      setFilterTerm('');
    } else {
      setFilterTerm(filter);
    }
    setIsFilterOpen(false);
  };

  const uniqueBanks = Array.from(new Set(accounts.map(acc => acc.bankName)));
  const filteredAccountsList = filterAccounts(accounts, searchTerm, filterTerm);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Quản lý Ngân hàng & Tài khoản
            </h1>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              Thêm tài khoản mới
            </button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="relative filter-dropdown">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-48 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between bg-white"
              >
                <span className="text-gray-700">
                  {selectedFilter === 'all' ? 'Filter' : selectedFilter}
                </span>
                <svg 
                  className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => handleFilterSelect('all')}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                        selectedFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      Tất cả ngân hàng
                    </button>
                    {uniqueBanks.map(bankName => (
                      <button
                        key={bankName}
                        onClick={() => handleFilterSelect(bankName)}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                          selectedFilter === bankName ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {bankName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ngân hàng</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Số tài khoản</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Chủ tài khoản</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Hoạt động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAccountsList.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {account.bankLogo && (
                          <div className={`w-10 h-10 ${getBankColor(account.bankName)} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                            {account.bankLogo}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{account.bankName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{account.accountNumber}</td>
                    <td className="px-6 py-4 text-gray-700">{account.accountHolder}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusDotColorClass(account.status)}`}></div>
                        <span className={`text-sm ${account.status === 'active' ? 'text-green-700' : 'text-gray-600'}`}>
                          {getStatusText(account.status, account.isActive)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleQRPreview(account)}
                          className="text-sm text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                          title="Tạo QR Code"
                        >
                          📱 QR
                        </button>
                        <button
                          onClick={() => handleDeleteClick(account)}
                          className="text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1"
                          title="Xóa tài khoản"
                        >
                          <Trash2 size={16} />
                          Xóa
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={account.isActive}
                            onChange={() => handleToggleAccount(account.id)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAccountsList.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Không tìm thấy tài khoản nào
            </div>
          )}
        </div>
      </div>

      <AddBankAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddAccount}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        account={accountToDelete}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />

      <QRPreviewModal
        isOpen={qrPreviewOpen}
        account={accountForQR}
        onClose={() => setQrPreviewOpen(false)}
      />
    </div>
  );
};

export default BankAccountsManagement;