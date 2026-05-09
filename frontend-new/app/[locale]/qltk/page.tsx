'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Trash2, BarChart3, Users, ShoppingCart, FileText, Package, CreditCard, Calendar, User, AlertCircle, CheckCircle, RefreshCw, Upload, X, Edit2, Download } from 'lucide-react';

// Types
interface BankAccount {
  id: string;
  bankName: string;
  bankLogo?: string;
  accountNumber: string;
  accountHolder: string;
  status: 'active' | 'locked';
  isActive: boolean;
  qrImage?: string;
  // VietQR fields
  defaultAmount?: number;
  transferContent?: string;
  vietQRUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BankAccountFormData {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  bankLogo?: string;
  defaultAmount?: number;
  transferContent?: string;
}

interface BankInfo {
  name: string;
  code: string;
  logo: string;
  color: string;
  bin: string; // Bank Identification Number for VietQR
}

// Bank list with BIN codes
const BANK_LIST: BankInfo[] = [
  { name: 'Vietcombank', code: 'VCB', logo: 'VCB', color: 'bg-green-600', bin: '970436' },
  { name: 'MB Bank', code: 'MB', logo: 'MB', color: 'bg-red-600', bin: '970422' },
  { name: 'VietinBank', code: 'CTG', logo: 'CTG', color: 'bg-blue-600', bin: '970415' },
  { name: 'BIDV', code: 'BIDV', logo: 'BIDV', color: 'bg-blue-700', bin: '970418' },
  { name: 'Techcombank', code: 'TCB', logo: 'TCB', color: 'bg-green-700', bin: '970407' },
  { name: 'ACB', code: 'ACB', logo: 'ACB', color: 'bg-purple-600', bin: '970416' },
  { name: 'Sacombank', code: 'STB', logo: 'STB', color: 'bg-indigo-600', bin: '970403' },
   { name: 'MSB', code: 'MSB', logo: 'MSB', color: 'bg-indigo-600', bin: '970426' },
  { name: 'VPBank', code: 'VPB', logo: 'VPB', color: 'bg-emerald-600', bin: '970432' }
];

const STORAGE_KEY = 'bank_accounts_data';

const menuItems = [
  { label: 'Thống kê', path: '/vi/thongke', icon: BarChart3, active: false },
  { label: 'Quản lý bàn', path: '/vi/qldatban', icon: Calendar, active: false },
  { label: 'Thực đơn', path: '/vi/qlmenu', icon: FileText, active: false },
  { label: 'Nhân viên', path: '/vi/qlnhanvien', icon: Users, active: false },
  { label: 'Đơn hàng', path: '/vi/order', icon: ShoppingCart, active: false },
  { label: 'Tài khoản', path: '/vi/qltk', icon: User, active: true },
  { label: 'Kho vận', path: '/vi/qlkho', icon: Package, active: false },
  { label: 'Thu ngân', path: '/vi/thungan', icon: CreditCard, active: false }
];

// VietQR Utility Functions
const generateVietQRUrl = (
  bankBin: string, 
  accountNumber: string, 
  accountHolder: string,
  amount?: number,
  transferContent?: string
): string => {
  const baseUrl = 'https://img.vietqr.io/image';
  
  // Clean account number
  const cleanAccountNumber = accountNumber.replace(/\s/g, '');
  
  // Build URL
  let url = `${baseUrl}/${bankBin}-${cleanAccountNumber}-compact2.jpg`;
  
  // Add query parameters
  const params = new URLSearchParams();
  if (amount && amount > 0) {
    params.append('amount', amount.toString());
  }
  if (transferContent) {
    params.append('addInfo', transferContent);
  }
  params.append('accountName', accountHolder);
  
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return url;
};

const getBankBin = (bankName: string): string => {
  const bank = BANK_LIST.find(b => b.name === bankName);
  return bank?.bin || '';
};

// Utility functions
const getBankColor = (bankName: string): string => {
  const bank = BANK_LIST.find(b => b.name === bankName);
  return bank?.color || 'bg-gray-600';
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
      const parsedData = JSON.parse(stored);
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        return parsedData;
      }
    }
    
    const hasInitialized = localStorage.getItem(`${STORAGE_KEY}_initialized`);
    if (!hasInitialized) {
      const defaultAccounts = [
        {
          id: '1',
          bankName: 'Vietcombank',
          bankLogo: 'VCB',
          accountNumber: '1023445566',
          accountHolder: 'NHA HANG PHUONG NAM',
          status: 'active' as const,
          isActive: true,
          defaultAmount: 0,
          transferContent: 'Thanh toan don hang',
          vietQRUrl: generateVietQRUrl(
            getBankBin('Vietcombank'),
            '1023445566',
            'NHA HANG PHUONG NAM',
            0,
            'Thanh toan don hang'
          )
        },
        {
          id: '2',
          bankName: 'Vietcombank',
          bankLogo: 'VCB',
          accountNumber: '99900011',
          accountHolder: 'NHA HANG PHUONG NAM',
          status: 'active' as const,
          isActive: true,
          defaultAmount: 0,
          transferContent: 'Thanh toan',
          vietQRUrl: generateVietQRUrl(
            getBankBin('Vietcombank'),
            '99900011',
            'NHA HANG PHUONG NAM',
            0,
            'Thanh toan'
          )
        },
        {
          id: '3',
          bankName: 'MB Bank',
          bankLogo: 'MB',
          accountNumber: '090999',
          accountHolder: 'NHA HANG PHUONG NAM',
          status: 'locked' as const,
          isActive: false,
          defaultAmount: 0,
          transferContent: '',
          vietQRUrl: generateVietQRUrl(
            getBankBin('MB Bank'),
            '090999',
            'NHA HANG PHUONG NAM'
          )
        }
      ];
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAccounts));
      localStorage.setItem(`${STORAGE_KEY}_initialized`, 'true');
      return defaultAccounts;
    }
    
    return [];
    
  } catch (error) {
    console.error('Error loading accounts from localStorage:', error);
    return [];
  }
};

const saveAccountsToStorage = (accounts: BankAccount[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    localStorage.setItem(`${STORAGE_KEY}_initialized`, 'true');
  } catch (error) {
    console.error('Error saving accounts to localStorage:', error);
  }
};

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
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={
          "w-64 bg-[#1a1d29] min-h-screen fixed left-0 top-0 text-gray-300 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 " +
          (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
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
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => navigateTo(item.path)}
                className={
                  "w-full px-6 py-3 flex items-center gap-3 transition-all duration-200 " +
                  (item.active 
                    ? 'bg-green-500/10 text-green-400 border-r-4 border-green-500' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')
                }
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

// QR Settings Modal Component
interface QRSettingsModalProps {
  isOpen: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSave: (accountId: string, amount: number, content: string) => void;
}

const QRSettingsModal: React.FC<QRSettingsModalProps> = ({ isOpen, account, onClose, onSave }) => {
  const [amount, setAmount] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (account) {
      setAmount(account.defaultAmount?.toString() || '0');
      setContent(account.transferContent || '');
      updatePreview(account, account.defaultAmount || 0, account.transferContent || '');
    }
  }, [account]);

  const updatePreview = (acc: BankAccount, amt: number, cnt: string) => {
    if (!acc) return;
    const bankBin = getBankBin(acc.bankName);
    const url = generateVietQRUrl(bankBin, acc.accountNumber, acc.accountHolder, amt, cnt);
    setPreviewUrl(url);
  };

  const handleAmountChange = (value: string) => {
    const numValue = value.replace(/\D/g, '');
    setAmount(numValue);
    if (account) {
      updatePreview(account, parseInt(numValue) || 0, content);
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    if (account) {
      updatePreview(account, parseInt(amount) || 0, value);
    }
  };

  const handleSave = () => {
    if (account) {
      onSave(account.id, parseInt(amount) || 0, content);
      onClose();
    }
  };

  const formatCurrency = (value: string) => {
    if (!value) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(value));
  };

  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 sm:px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold">⚙️ Cài đặt mã VietQR</h2>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className={"w-12 h-12 " + getBankColor(account.bankName) + " rounded-full flex items-center justify-center text-white font-bold text-sm"}>
                {account.bankLogo}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{account.bankName}</div>
                <div className="text-sm text-gray-600 font-mono">{account.accountNumber}</div>
              </div>
            </div>
            <div className="text-sm text-gray-700 font-medium">{account.accountHolder}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Settings Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💰 Số tiền mặc định (VNĐ)
                </label>
                <input
                  type="text"
                  value={amount ? formatCurrency(amount) : ''}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                />
                <p className="mt-2 text-xs text-gray-500">
                  💡 Để trống hoặc 0 nếu muốn khách hàng tự nhập số tiền
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💬 Nội dung chuyển khoản
                </label>
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="VD: Thanh toan don hang #123"
                  maxLength={100}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="text-sm text-blue-900 space-y-2">
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Xem trước mã QR
              </label>
              <div className="bg-white rounded-xl border-4 border-blue-100 p-4 sticky top-4">
                {previewUrl ? (
                  <>
                    <img 
                      src={previewUrl} 
                      alt="QR Preview" 
                      className="w-full h-auto rounded-lg mb-3"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23f0f0f0" width="300" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999" font-size="16"%3ELoading...%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">Ngân hàng:</span>
                        <span>{account.bankName}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">STK:</span>
                        <span className="font-mono">{account.accountNumber}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">Số tiền:</span>
                        <span className="text-green-600 font-bold">
                          {amount && parseInt(amount) > 0 ? formatCurrency(amount) + ' đ' : 'Tự nhập'}
                        </span>
                      </div>
                      {content && (
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="font-medium">Nội dung:</span>
                          <div className="mt-1 text-gray-700">{content}</div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📱</div>
                      <div>Đang tạo mã QR...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-colors"
            >
              💾 Lưu cài đặt
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

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, account, onClose, onConfirm }) => {
  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
            Xác nhận xóa tài khoản
          </h3>
          
          <p className="text-sm text-gray-600 text-center mb-4">
            Bạn có chắc muốn xóa tài khoản này không?
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={"w-10 h-10 " + getBankColor(account.bankName) + " rounded-full flex items-center justify-center text-white font-bold text-sm"}>
                {account.bankLogo}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{account.bankName}</div>
                <div className="text-sm text-gray-600">{account.accountNumber}</div>
              </div>
            </div>
            <div className="text-sm text-gray-700">{account.accountHolder}</div>
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
              Xóa
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

const AddBankAccountModal: React.FC<AddBankAccountModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<BankAccountFormData>({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    bankLogo: '',
    defaultAmount: 0,
    transferContent: ''
  });

  const [errors, setErrors] = useState<{
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      bankLogo: '',
      defaultAmount: 0,
      transferContent: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            Thêm tài khoản ngân hàng
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="mb-4">
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
              Ngân hàng <span className="text-red-500">*</span>
            </label>
            <select
              id="bankName"
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              className={
                "w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 " +
                (errors.bankName ? 'border-red-500' : 'border-gray-300')
              }
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
              className={
                "w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 " +
                (errors.accountNumber ? 'border-red-500' : 'border-gray-300')
              }
            />
            {errors.accountNumber && (
              <p className="mt-1 text-sm text-red-500">{errors.accountNumber}</p>
            )}
          </div>

          <div className="mb-4">
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
              className={
                "w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 " +
                (errors.accountHolder ? 'border-red-500' : 'border-gray-300')
              }
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
              Thêm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
const BankAccountsManagement = () => {
  const router = useRouter();
  
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [qrSettingsOpen, setQrSettingsOpen] = useState(false);
  const [accountForQR, setAccountForQR] = useState<BankAccount | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    checkAuthAndPermission();
    
    const handleFocus = () => {
      console.log(' Window focused, checking auth...');
      checkAuthAndPermission();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const checkAuthAndPermission = () => {
    console.log('Checking authentication and permissions...');
    
    const storedToken = sessionStorage.getItem('access_token') 
    || localStorage.getItem('access_token');
  const storedUser = sessionStorage.getItem('user') 
    || localStorage.getItem('user');

    console.log('Token exists:', !!storedToken);
    console.log('User exists:', !!storedUser);

    if (!storedToken || !storedUser) {
      console.log(' No auth found');
      setAuthError('Vui lòng đăng nhập để tiếp tục');
      setIsAuthChecking(false);
      return;
    }
    try {
      const user = JSON.parse(storedUser);
      const role = user.role || '';
      
      console.log('👤 User role:', role);
      setUserRole(role);

      if (role !== 'OWNER' && role !== 'ADMIN') {
        console.log(' Access denied - insufficient permissions');
        setAuthError('Bạn không có quyền truy cập trang này. Chỉ Quản lý (ADMIN) hoặc Chủ sở hữu (OWNER) mới được phép.');
        setIsAuthChecking(false);
        return;
      }

      console.log(' Auth and permission check passed');
      setToken(storedToken);
      setAuthError('');
      setIsAuthChecking(false);

    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('token');
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      setAuthError('Dữ liệu đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    const loadedAccounts = loadAccountsFromStorage();
    setAccounts(loadedAccounts);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    
    if (accounts.length > 0) {
      saveAccountsToStorage(accounts);
    }
  }, [accounts, token]);

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

  const handleQRSettings = (account: BankAccount) => {
    setAccountForQR(account);
    setQrSettingsOpen(true);
  };

  const handleSaveQRSettings = (accountId: string, amount: number, content: string) => {
    setAccounts(accounts.map(acc => {
      if (acc.id === accountId) {
        const bankBin = getBankBin(acc.bankName);
        const vietQRUrl = generateVietQRUrl(
          bankBin,
          acc.accountNumber,
          acc.accountHolder,
          amount,
          content
        );
        
        return {
          ...acc,
          defaultAmount: amount,
          transferContent: content,
          vietQRUrl: vietQRUrl,
          updatedAt: new Date()
        };
      }
      return acc;
    }));
  };

  const handleAddAccount = (formData: BankAccountFormData) => {
    const bankBin = getBankBin(formData.bankName);
    const vietQRUrl = generateVietQRUrl(
      bankBin,
      formData.accountNumber || '',
      formData.accountHolder,
      formData.defaultAmount,
      formData.transferContent
    );

    const newAccount: BankAccount = {
      id: generateAccountId(),
      bankName: formData.bankName,
      bankLogo: formData.bankLogo,
      accountNumber: formData.accountNumber || '',
      accountHolder: formData.accountHolder,
      status: 'active',
      isActive: true,
      defaultAmount: formData.defaultAmount || 0,
      transferContent: formData.transferContent || '',
      vietQRUrl: vietQRUrl,
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

  const handleDownloadQR = async (account: BankAccount) => {
    if (!account.vietQRUrl) return;
    
    try {
      const response = await fetch(account.vietQRUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${account.bankName}_${account.accountNumber}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading QR:', error);
      alert('Không thể tải mã QR. Vui lòng thử lại.');
    }
  };

  const uniqueBanks = Array.from(new Set(accounts.map(acc => acc.bankName)));
  const filteredAccountsList = filterAccounts(accounts, searchTerm, filterTerm);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce"></div>
          <div className="text-gray-600 text-lg">Đang kiểm tra quyền truy cập...</div>
        </div>
      </div>
    );
  }

  if (!token || authError) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        
        <div className="w-full lg:ml-64 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto mt-12 lg:mt-0">
            <div className="bg-white border-2 border-red-500 rounded-2xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {!token ? 'Cần đăng nhập' : 'Không có quyền truy cập'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {authError}
                  </p>
                  
                  {!token && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Lưu ý:</strong> Chỉ tài khoản <strong>Quản lý </strong> hoặc <strong>Chủ sở hữu </strong> mới có thể truy cập trang quản lý tài khoản ngân hàng.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="/vi/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all font-semibold inline-flex items-center justify-center gap-2"
                    >
                       Mở trang đăng nhập
                    </a>
                    <button
                      onClick={checkAuthAndPermission}
                      className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Đã đăng nhập - Tải lại
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span></span> Quyền truy cập trang quản lý tài khoản
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800">Chủ sở hữu </div>
                    <div className="text-sm text-gray-600">Có toàn quyền quản lý tài khoản ngân hàng</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800">Quản lý </div>
                    <div className="text-sm text-gray-600">Có quyền quản lý và cập nhật tài khoản</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800">Các quyền khác</div>
                    <div className="text-sm text-gray-600">Không có quyền truy cập trang này</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="w-full lg:ml-64 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mt-12 lg:mt-0">
                  Quản lý tài khoản & VietQR
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Quyền: <span className="font-semibold text-green-600">{userRole}</span> 
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors w-full sm:w-auto shadow-md"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Thêm tài khoản mới</span>
                <span className="sm:hidden">Thêm mới</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative filter-dropdown w-full sm:w-48">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between bg-white"
                >
                  <span className="text-gray-700 truncate">
                    {selectedFilter === 'all' ? 'Lọc theo ngân hàng' : selectedFilter}
                  </span>
                  <svg 
                    className={"w-4 h-4 transition-transform flex-shrink-0 " + (isFilterOpen ? 'rotate-180' : '')}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                    <div className="py-1">
                      <button
                        onClick={() => handleFilterSelect('all')}
                        className={"w-full text-left px-4 py-2 hover:bg-gray-100 " + (selectedFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700')}
                      >
                        Tất cả ngân hàng
                      </button>
                      {uniqueBanks.map(bankName => (
                        <button
                          key={bankName}
                          onClick={() => handleFilterSelect(bankName)}
                          className={"w-full text-left px-4 py-2 hover:bg-gray-100 " + (selectedFilter === bankName ? 'bg-blue-50 text-blue-600' : 'text-gray-700')}
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
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-gray-700">Ngân hàng</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-gray-700">Số TK</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-gray-700">Chủ TK</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-gray-700">Trạng thái</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-gray-700">Hoạt động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAccountsList.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-3">
                          {account.bankLogo && (
                            <div className={"w-10 h-10 " + getBankColor(account.bankName) + " rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"}>
                              {account.bankLogo}
                            </div>
                          )}
                          <span className="font-medium text-gray-900 truncate">{account.bankName}</span>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-gray-700 font-mono text-sm">{account.accountNumber}</td>
                      <td className="px-4 lg:px-6 py-4 text-gray-700 text-sm truncate max-w-xs">{account.accountHolder}</td>
                     
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={"w-3 h-3 rounded-full flex-shrink-0 " + getStatusDotColorClass(account.status)}></div>
                          <span className={"text-sm " + (account.status === 'active' ? 'text-green-700' : 'text-gray-600')}>
                            {getStatusText(account.status, account.isActive)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2 lg:gap-3">

                          <button
                            onClick={() => handleDeleteClick(account)}
                            className="text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1"
                            title="Xóa tài khoản"
                          >
                            <Trash2 size={16} />
                            <span className="hidden lg:inline">Xóa</span>
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

            <div className="md:hidden divide-y divide-gray-200">
              {filteredAccountsList.map((account) => (
                <div key={account.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={"w-12 h-12 " + getBankColor(account.bankName) + " rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"}>
                      {account.bankLogo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-1">{account.bankName}</div>
                      <div className="text-sm text-gray-600 font-mono mb-1">{account.accountNumber}</div>
                      <div className="text-sm text-gray-700 truncate">{account.accountHolder}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className={"w-3 h-3 rounded-full " + getStatusDotColorClass(account.status)}></div>
                      <span className={"text-sm " + (account.status === 'active' ? 'text-green-700' : 'text-gray-600')}>
                        {getStatusText(account.status, account.isActive)}
                      </span>
                    </div>
                    {account.vietQRUrl && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        ✅ Có VietQR
                      </span>
                    )}
                    {account.defaultAmount && account.defaultAmount > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        💰 {new Intl.NumberFormat('vi-VN').format(account.defaultAmount)}đ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteClick(account)}
                        className="text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1 px-3 py-1.5 bg-gray-50 rounded-md"
                      >
                        <Trash2 size={16} />
                        Xóa
                      </button>
                    </div>
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
                </div>
              ))}
            </div>

            {filteredAccountsList.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-4">🏦</div>
                <div>Không tìm thấy tài khoản nào</div>
              </div>
            )}
          </div>
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

      <QRSettingsModal
        isOpen={qrSettingsOpen}
        account={accountForQR}
        onClose={() => setQrSettingsOpen(false)}
        onSave={handleSaveQRSettings}
      />
    </div>
  );
};

export default BankAccountsManagement;