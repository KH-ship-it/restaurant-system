'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Package, Plus, Search, AlertTriangle, TrendingDown, TrendingUp,
  Download, RefreshCw, Calendar, Trash2, BookOpen, ClipboardList,
  ArrowUpCircle, ArrowDownCircle, Settings, Loader2, XCircle,
  Activity, ShoppingBag, Menu, ChevronLeft, ChevronRight,
  RotateCcw, Flame, BarChart2, Boxes, Truck, Warehouse, Zap,
  CheckCircle2, Bell, Users, BarChart3, FileText, ShoppingCart,
  CreditCard, User, AlertCircle, Building2, Phone, Mail, Star,
  FileBarChart, CalendarDays, Info, PieChart as PieIcon, UtensilsCrossed,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – chạy: npm install recharts
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
type InventoryStatus = 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCKED';
type PurchaseStatus  = 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
type TabId = 'dashboard' | 'ingredients' | 'transactions' | 'purchases' | 'suppliers' | 'reports' | 'auto' | 'recipes';

// Local recipe (client-side, localStorage)
interface LocalRecipeIngredient {
  ingredientId: number | null;  // null = chưa map
  ingredientName: string;
  unit: string;
  quantity: number;
  wasteFactor: number;  // 1.0 = không hao hụt
}
interface LocalRecipe {
  id: string;
  dishName: string;        // tên món — phải khớp với dish_name broadcast
  dishNameAliases: string[]; // alias thêm để match (vd: "Phở gà", "pho ga")
  ingredients: LocalRecipeIngredient[];
  notes: string;
  updatedAt: string;
}
const RECIPES_LS = 'kho-local-recipes-v1';

interface Ingredient {
  ingredient_id: number; ingredient_name: string; unit: string;
  unit_cost: number; current_stock: number; min_threshold: number;
  max_threshold: number; supplier: string; stock_value: number;
  stock_percent: number; stock_status: InventoryStatus; updated_at: string;
}
interface RecipeItem {
  recipe_item_id: number; ingredient_id: number; ingredient_name: string; unit: string;
  current_stock: number; unit_cost: number; quantity_required: number;
  waste_factor: number; actual_usage: number; notes: string;
  ingredient_availability: 'AVAILABLE' | 'LOW' | 'OUT_OF_STOCK';
}
interface Transaction {
  transaction_id: number; ingredient_name: string; unit: string;
  transaction_type: string; quantity_change: number;
  stock_before: number; stock_after: number; order_id: number | null;
  notes: string; employee_name: string; created_at: string;
}
interface PurchaseRequest {
  request_id: number; ingredient_name: string; unit: string; supplier: string;
  requested_quantity: number; estimated_cost: number; trigger_stock: number;
  current_stock: number; status: PurchaseStatus; notes: string;
  requested_by_name: string; approved_by_name: string;
  created_at: string; updated_at: string;
}
interface DashboardData {
  summary: { total_ingredients: number; out_of_stock: number; low_stock: number; overstocked: number; total_inventory_value: number };
  alerts: Array<{ ingredient_id: number; ingredient_name: string; unit: string; current_stock: number; min_threshold: number; alert_type: string }>;
  top_consumed_today: Array<{ ingredient_name: string; unit: string; consumed: number }>;
  purchase_requests: { pending_count: number; total_estimated_cost: number };
}
interface ToastItem { id: number; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }
interface AutoLog {
  id: number; tableNumber: number | string; orderId: number;
  status: 'success' | 'partial' | 'cancelled' | 'restored' | string;
  message: string; timestamp: string; deductions: any[];
}
interface Supplier {
  id: string; name: string; phone: string; email: string; address: string;
  contactPerson: string; notes: string; rating: number;
  linkedIngredients: string[];
  priceHistory: Array<{ date: string; ingredientName: string; unitCost: number; unit: string; quantity: number }>;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const PROXY_BASE = '/api/proxy';
const SUPPLIERS_LS = 'kho-suppliers-v2';

const STATUS_COLOR: Record<InventoryStatus, string> = {
  NORMAL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  LOW_STOCK: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  OUT_OF_STOCK: 'bg-red-500/15 text-red-400 border-red-500/30',
  OVERSTOCKED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};
const STATUS_LABEL: Record<InventoryStatus, string> = {
  NORMAL: '✅ Đủ dùng', LOW_STOCK: '⚠ Sắp hết',
  OUT_OF_STOCK: '🔴 Hết hàng', OVERSTOCKED: '📦 Quá nhiều',
};
const PURCHASE_STATUS_COLOR: Record<PurchaseStatus, string> = {
  PENDING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  APPROVED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  ORDERED: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  RECEIVED: 'bg-green-500/15 text-green-400 border-green-500/30',
  CANCELLED: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};
const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  PENDING: '⏳ Chờ duyệt', APPROVED: '✅ Đã duyệt',
  ORDERED: '🚚 Đang đặt', RECEIVED: '📦 Đã nhận', CANCELLED: '❌ Hủy',
};
const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════
const sidebarItems = [
  { label: 'Thống kê',    path: '/vi/thongke',   icon: BarChart3,    active: false },
  { label: 'Quản lý bàn', path: '/vi/qldatban',  icon: Calendar,     active: false },
  { label: 'Thực đơn',    path: '/vi/qlmenu',     icon: FileText,     active: false },
  { label: 'Nhân viên',   path: '/vi/qlnhanvien', icon: Users,        active: false },
  { label: 'Đơn hàng',    path: '/vi/order',      icon: ShoppingCart, active: false },
  { label: 'Tài khoản',   path: '/vi/qltk',       icon: User,         active: false },
  { label: 'Kho vận',     path: '/vi/qlkho',      icon: Package,      active: true  },
  { label: 'Thu ngân',    path: '/vi/thungan',    icon: CreditCard,   active: false },
];

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0a0d12] border-b border-white/5 flex items-center px-4 z-50">
        <button onClick={() => setOpen(true)} className="text-white p-2 -ml-1"><Menu size={22} /></button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">R</span>
          </div>
          <span className="text-white font-semibold text-sm">Kho Vận</span>
        </div>
      </div>
      {open && <div className="lg:hidden fixed inset-0 bg-black/75 z-40 backdrop-blur-sm" onClick={() => setOpen(false)} />}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-[#0a0d12] border-r border-white/5 z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white font-bold">R</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Restaurant</h2>
              <p className="text-white/30 text-xs">Kho Vận v3.0</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-white/30 hover:text-white p-1 transition"><ChevronLeft size={18} /></button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {sidebarItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => { window.location.href = item.path; setOpen(false); }}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-all text-left relative
                  ${item.active ? 'text-emerald-400' : 'text-white/40 hover:text-white/80 hover:bg-white/3'}`}>
                {item.active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-r-full" />}
                {item.active && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 to-transparent" />}
                <Icon size={17} className="flex-shrink-0 relative z-10" />
                <span className="font-medium text-sm relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════
const ToastContainer = ({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) => {
  if (!toasts.length) return null;
  const cfg = {
    success: { cls: 'border-emerald-500/40 bg-[#0d1f13]', bar: 'bg-emerald-500', icon: <CheckCircle2 size={15} className="text-emerald-400" /> },
    error:   { cls: 'border-red-500/40 bg-[#1f0d0d]',     bar: 'bg-red-500',     icon: <XCircle size={15} className="text-red-400" /> },
    warning: { cls: 'border-amber-500/40 bg-[#1f1700]',   bar: 'bg-amber-500',   icon: <AlertTriangle size={15} className="text-amber-400" /> },
    info:    { cls: 'border-blue-500/40 bg-[#0d1525]',    bar: 'bg-blue-500',    icon: <Bell size={15} className="text-blue-400" /> },
  };
  return (
    <div className="fixed top-16 lg:top-4 right-4 z-[200] space-y-2 w-72 sm:w-80 pointer-events-none">
      {toasts.map(t => {
        const c = cfg[t.type];
        return (
          <div key={t.id} className={`rounded-xl border shadow-2xl overflow-hidden pointer-events-auto ${c.cls}`}
            style={{ animation: 'toastIn .3s cubic-bezier(.34,1.56,.64,1)' }}>
            <div className={`h-0.5 ${c.bar}`} />
            <div className="flex gap-3 px-4 py-3 items-start">
              <div className="mt-0.5 flex-shrink-0">{c.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{t.title}</p>
                <p className="text-white/50 text-xs mt-0.5">{t.message}</p>
              </div>
              <button onClick={() => onDismiss(t.id)} className="text-white/30 hover:text-white/70 transition"><XCircle size={14} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SMALL REUSABLES
// ═══════════════════════════════════════════════════════════════════
const StockBar = ({ current, min, max }: { current: number; min: number; max: number }) => {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const color = current <= 0 ? 'bg-red-500' : current <= min ? 'bg-amber-500' : pct > 90 ? 'bg-blue-500' : 'bg-emerald-500';
  return (
    <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-[#111519] border border-white/6 rounded-2xl overflow-hidden ${className}`}>{children}</div>
);

const CardHeader = ({ icon: Icon, title, iconColor = 'text-emerald-400', right }: any) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
      <Icon size={15} className={iconColor} />{title}
    </h3>
    {right}
  </div>
);

const StatTile = ({ label, value, sub, icon: Icon, gradient }: any) => (
  <div className={`relative bg-[#111519] border border-white/6 rounded-2xl p-4 sm:p-5 overflow-hidden group hover:border-white/12 transition-all duration-300`}>
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity`} />
    <div className="relative z-10">
      <div className={`inline-flex p-2.5 rounded-xl mb-3 bg-gradient-to-br ${gradient} bg-opacity-10`}>
        <Icon size={17} className="text-white/80" />
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-white/25 mt-1 font-mono truncate">{sub}</div>}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// FORECAST ENGINE
// ═══════════════════════════════════════════════════════════════════
function buildForecast(ingredients: Ingredient[], transactions: Transaction[]) {
  const now = Date.now();
  const cutoff = now - 14 * 86400000; // last 14 days

  // sum negative transactions per ingredient in window
  const consumed: Record<string, { total: number; days: Set<string> }> = {};
  transactions.forEach(tx => {
    if (tx.quantity_change < 0 && new Date(tx.created_at).getTime() >= cutoff) {
      if (!consumed[tx.ingredient_name]) consumed[tx.ingredient_name] = { total: 0, days: new Set() };
      consumed[tx.ingredient_name].total += Math.abs(tx.quantity_change);
      consumed[tx.ingredient_name].days.add(tx.created_at.split('T')[0]);
    }
  });

  return ingredients.map(ing => {
    const data = consumed[ing.ingredient_name];
    const activeDays = data?.days.size || 0;
    const avgPerDay = activeDays > 0 ? (data.total / activeDays) : 0;
    const daysLeft = avgPerDay > 0 ? Math.floor(ing.current_stock / avgPerDay) : null;
    const runoutDate = daysLeft != null ? new Date(now + daysLeft * 86400000) : null;
    const risk: 'critical' | 'warning' | 'ok' | 'idle' =
      daysLeft == null ? 'idle' :
      daysLeft <= 3 ? 'critical' :
      daysLeft <= 10 ? 'warning' : 'ok';

    return { ...ing, avgPerDay: +avgPerDay.toFixed(3), daysLeft, runoutDate, risk, total14d: data?.total || 0 };
  })
    .filter(i => i.avgPerDay > 0 || i.current_stock <= i.min_threshold)
    .sort((a, b) => {
      const o = { critical: 0, warning: 1, ok: 2, idle: 3 };
      return o[a.risk] - o[b.risk];
    });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const InventoryManagement = () => {
  // Auth
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [userRole, setUserRole] = useState('');

  // Tab
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // API data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Suppliers (localStorage)
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '', contactPerson: '', notes: '', rating: '5' });
  const [showPriceModal, setShowPriceModal] = useState<Supplier | null>(null);
  const [priceForm, setPriceForm] = useState({ ingredientName: '', unitCost: '', unit: '', quantity: '' });

  // Reports
  const [reportRange, setReportRange] = useState<'day' | 'week' | 'month'>('week');

  // ── Local Recipes (localStorage) ──
  const [localRecipes, setLocalRecipes] = useState<LocalRecipe[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem(RECIPES_LS); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showRecipeManagerModal, setShowRecipeManagerModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<LocalRecipe | null>(null);
  const [recipeForm, setRecipeForm] = useState({ dishName: '', aliases: '', notes: '' });
  const [recipeIngForms, setRecipeIngForms] = useState<Array<{ ingredientId: string; ingredientName: string; unit: string; quantity: string; wasteFactor: string }>>([]);
  const [recipeSearch, setRecipeSearch] = useState('');

  const saveLocalRecipes = useCallback((list: LocalRecipe[]) => {
    setLocalRecipes(list);
    try { localStorage.setItem(RECIPES_LS, JSON.stringify(list)); } catch {}
  }, []);

  // Auto-deduct
  const deductedIdsRef = useRef<Set<number>>(new Set());
  const [liveDeductCount, setLiveDeductCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try { return Number(localStorage.getItem('auto-deduct-count') || '0'); } catch { return 0; }
  });
  const [restoreCount, setRestoreCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try { return Number(localStorage.getItem('auto-restore-count') || '0'); } catch { return 0; }
  });
  const [autoLogs, setAutoLogs] = useState<AutoLog[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('auto-deduct-logs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [logDetail, setLogDetail] = useState<AutoLog | null>(null);

  const setAutoLogsP = useCallback((upd: (p: AutoLog[]) => AutoLog[]) => {
    setAutoLogs(prev => {
      const next = upd(prev);
      try { localStorage.setItem('auto-deduct-logs', JSON.stringify(next.slice(0, 100))); } catch {}
      return next;
    });
  }, []);
  const setDeductCountP = useCallback((upd: (c: number) => number) => {
    setLiveDeductCount(prev => { const n = upd(prev); try { localStorage.setItem('auto-deduct-count', String(n)); } catch {} return n; });
  }, []);
  const setRestoreCountP = useCallback((upd: (c: number) => number) => {
    setRestoreCount(prev => { const n = upd(prev); try { localStorage.setItem('auto-restore-count', String(n)); } catch {} return n; });
  }, []);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showCreatePurchaseModal, setShowCreatePurchaseModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  // Forms
  const [restockQty, setRestockQty] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [adjustStock, setAdjustStock] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustUnitCost, setAdjustUnitCost] = useState('');
  const [newIng, setNewIng] = useState({ ingredient_name: '', unit: '', unit_cost: '', current_stock: '', min_threshold: '', max_threshold: '', supplier: '' });
  const [purchaseIngId, setPurchaseIngId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = useCallback((type: ToastItem['type'], title: string, message: string) => {
    const id = Date.now() + Math.random();
    setToasts(p => [{ id, type, title, message }, ...p.slice(0, 3)]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);

  // ─── AUTH ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkAuth();
    window.addEventListener('focus', checkAuth);
    return () => window.removeEventListener('focus', checkAuth);
  }, []);

  const checkAuth = () => {
    const tok = sessionStorage.getItem('access_token');
    const user = sessionStorage.getItem('user');
    if (!tok || !user) { setAuthError('Vui lòng đăng nhập'); setIsAuthChecking(false); return; }
    try {
      const u = JSON.parse(user);
      if (u.role !== 'OWNER' && u.role !== 'ADMIN') { setAuthError('Chỉ OWNER/ADMIN được truy cập'); setIsAuthChecking(false); return; }
      setUserRole(u.role); setToken(tok); setAuthError(''); setIsAuthChecking(false);
    } catch { setAuthError('Dữ liệu đăng nhập lỗi'); setIsAuthChecking(false); }
  };

  const apiFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
    const tok = sessionStorage.getItem('access_token');
    const url = path.replace(/^\/api\//, `${PROXY_BASE}/`);
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}`, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.detail || `HTTP ${res.status}`);
    return data;
  }, []);

  // ─── FETCH ───
  const fetchDashboard = useCallback(async () => {
    try { const r = await apiFetch('/api/inventory/dashboard'); setDashboard(r.data); }
    catch (e: any) { toast('error', 'Lỗi dashboard', e.message); }
  }, [apiFetch, toast]);

  const fetchIngredients = useCallback(async (search = '', status = '') => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      const r = await apiFetch(`/api/inventory/ingredients?${q}`);
      setIngredients(r.data?.ingredients || r.data || []);
    } catch (e: any) { toast('error', 'Lỗi nguyên liệu', e.message); }
    finally { setLoading(false); }
  }, [apiFetch, toast]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch('/api/inventory/transactions?limit=200'); setTransactions(r.data?.transactions || r.data || []); }
    catch (e: any) { toast('error', 'Lỗi giao dịch', e.message); }
    finally { setLoading(false); }
  }, [apiFetch, toast]);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch('/api/inventory/purchase-requests'); setPurchases(r.data || []); }
    catch (e: any) { toast('error', 'Lỗi phiếu nhập', e.message); }
    finally { setLoading(false); }
  }, [apiFetch, toast]);

  const fetchRecipe = useCallback(async (id: number) => {
    try { const r = await apiFetch(`/api/inventory/recipes/${id}`); setRecipeItems(r.data?.recipe || []); }
    catch (e: any) { toast('error', 'Lỗi công thức', e.message); }
  }, [apiFetch, toast]);

  useEffect(() => { if (!token) return; fetchDashboard(); }, [token, fetchDashboard]);
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'ingredients') fetchIngredients(searchTerm, statusFilter);
    if (activeTab === 'transactions') fetchTransactions();
    if (activeTab === 'purchases') fetchPurchases();
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'reports') { fetchTransactions(); fetchIngredients(); }
    // suppliers from localStorage only
    if (activeTab === 'suppliers') {
      try { const s = localStorage.getItem(SUPPLIERS_LS); setSuppliers(s ? JSON.parse(s) : []); } catch {}
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== 'ingredients') return;
    const t = setTimeout(() => fetchIngredients(searchTerm, statusFilter), 300);
    return () => clearTimeout(t);
  }, [searchTerm, statusFilter]);

  // ─── INGREDIENT CRUD ───
  const handleCreateIng = async () => {
    if (!newIng.ingredient_name.trim() || !newIng.unit.trim()) { toast('warning', 'Thiếu thông tin', 'Nhập tên và đơn vị'); return; }
    try {
      await apiFetch('/api/inventory/ingredients', {
        method: 'POST',
        body: JSON.stringify({ ...newIng, unit_cost: +newIng.unit_cost || 0, current_stock: +newIng.current_stock || 0, min_threshold: +newIng.min_threshold || 0, max_threshold: +newIng.max_threshold || 0 }),
      });
      toast('success', 'Đã thêm', newIng.ingredient_name);
      setShowAddModal(false);
      setNewIng({ ingredient_name: '', unit: '', unit_cost: '', current_stock: '', min_threshold: '', max_threshold: '', supplier: '' });
      fetchIngredients(searchTerm, statusFilter); fetchDashboard();
    } catch (e: any) { toast('error', 'Lỗi thêm NL', e.message); }
  };

  const handleRestock = async () => {
    if (!selectedIngredient || !restockQty || +restockQty <= 0) { toast('warning', 'Thiếu SL', 'Nhập số lượng hợp lệ'); return; }
    try {
      const r = await apiFetch(`/api/inventory/ingredients/${selectedIngredient.ingredient_id}/restock`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: +restockQty, notes: restockNotes || 'Nhập kho thủ công' }),
      });
      toast('success', '📥 Nhập kho', `+${restockQty} ${selectedIngredient.unit} → ${r.data?.stock_after}`);
      setShowRestockModal(false); setRestockQty(''); setRestockNotes('');
      fetchIngredients(searchTerm, statusFilter); fetchDashboard();
    } catch (e: any) { toast('error', 'Lỗi nhập kho', e.message); }
  };

  const handleAdjust = async () => {
    if (!selectedIngredient || adjustStock === '') { toast('warning', 'Thiếu thông tin', 'Nhập tồn thực tế'); return; }
    try {
      const r = await apiFetch(`/api/inventory/ingredients/${selectedIngredient.ingredient_id}/adjust`, {
        method: 'PATCH',
        body: JSON.stringify({ actual_stock: +adjustStock, notes: adjustNotes || 'Điều chỉnh kiểm kê' }),
      });
      if (adjustUnitCost !== '' && +adjustUnitCost >= 0 && +adjustUnitCost !== selectedIngredient.unit_cost) {
        await apiFetch(`/api/inventory/ingredients/${selectedIngredient.ingredient_id}`, {
          method: 'PUT',
          body: JSON.stringify({ ingredient_name: selectedIngredient.ingredient_name, unit: selectedIngredient.unit, unit_cost: +adjustUnitCost, min_threshold: selectedIngredient.min_threshold, max_threshold: selectedIngredient.max_threshold, supplier: selectedIngredient.supplier || '' }),
        });
      }
      toast('success', '⚖️ Điều chỉnh', `${r.data?.stock_before} → ${r.data?.stock_after} ${selectedIngredient.unit}`);
      setShowAdjustModal(false); setAdjustStock(''); setAdjustNotes(''); setAdjustUnitCost('');
      fetchIngredients(searchTerm, statusFilter); fetchDashboard();
    } catch (e: any) { toast('error', 'Lỗi điều chỉnh', e.message); }
  };

  const handleDeleteIng = async (id: number, name: string) => {
    if (!confirm(`Xoá "${name}"?`)) return;
    try {
      await apiFetch(`/api/inventory/ingredients/${id}`, { method: 'DELETE' });
      toast('success', 'Đã xoá', name);
      fetchIngredients(searchTerm, statusFilter); fetchDashboard();
    } catch (e: any) { toast('error', 'Lỗi xoá', e.message); }
  };

  // ─── PURCHASE CRUD ───
  const handleCreatePurchase = async () => {
    if (!purchaseIngId || !purchaseQty || +purchaseQty <= 0) { toast('warning', 'Thiếu thông tin', 'Chọn NL và nhập SL'); return; }
    try {
      await apiFetch('/api/inventory/purchase-requests', { method: 'POST', body: JSON.stringify({ ingredient_id: +purchaseIngId, requested_quantity: +purchaseQty, notes: purchaseNotes || 'Tạo thủ công' }) });
      toast('success', '📋 Tạo phiếu', `SL: ${purchaseQty}`);
      setShowCreatePurchaseModal(false); setPurchaseIngId(''); setPurchaseQty(''); setPurchaseNotes('');
      fetchPurchases(); fetchDashboard();
    } catch (e: any) { toast('error', 'Lỗi phiếu', e.message); }
  };

  const handleUpdatePurchase = async (id: number, status: PurchaseStatus, qty?: number) => {
    try {
      const body: any = { status };
      if (qty) body.actual_received_quantity = qty;
      await apiFetch(`/api/inventory/purchase-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast('success', PURCHASE_STATUS_LABEL[status], `Phiếu #${id}`);
      fetchPurchases(); fetchIngredients(searchTerm, statusFilter); fetchDashboard();
    } catch (e: any) { toast('error', 'Lỗi cập nhật', e.message); }
  };

  // ─── SUPPLIER CRUD (localStorage) ───
  const saveAndSetSuppliers = (list: Supplier[]) => {
    setSuppliers(list);
    try { localStorage.setItem(SUPPLIERS_LS, JSON.stringify(list)); } catch {}
  };

  const handleSaveSupplier = () => {
    if (!supplierForm.name.trim()) { toast('warning', 'Thiếu tên NCC', 'Nhập tên nhà cung cấp'); return; }
    const list = [...suppliers];
    if (editingSupplier) {
      const idx = list.findIndex(s => s.id === editingSupplier.id);
      if (idx >= 0) list[idx] = { ...editingSupplier, ...supplierForm, rating: +supplierForm.rating };
    } else {
      list.push({ id: `sup-${Date.now()}`, ...supplierForm, rating: +supplierForm.rating, linkedIngredients: [], priceHistory: [], createdAt: new Date().toISOString() });
    }
    saveAndSetSuppliers(list);
    toast('success', editingSupplier ? 'Đã cập nhật NCC' : 'Đã thêm NCC', supplierForm.name);
    setShowAddSupplierModal(false); setEditingSupplier(null);
    setSupplierForm({ name: '', phone: '', email: '', address: '', contactPerson: '', notes: '', rating: '5' });
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('Xoá nhà cung cấp này?')) return;
    saveAndSetSuppliers(suppliers.filter(s => s.id !== id));
    toast('success', 'Đã xoá NCC', '');
  };

  const handleAddPrice = (sup: Supplier) => {
    if (!priceForm.ingredientName || !priceForm.unitCost) { toast('warning', 'Thiếu thông tin', 'Điền tên NL và giá'); return; }
    const updated = suppliers.map(s => s.id === sup.id ? {
      ...s,
      priceHistory: [...s.priceHistory, { date: new Date().toISOString().split('T')[0], ingredientName: priceForm.ingredientName, unitCost: +priceForm.unitCost, unit: priceForm.unit, quantity: +priceForm.quantity || 0 }],
      linkedIngredients: Array.from(new Set([...s.linkedIngredients, priceForm.ingredientName])),
    } : s);
    saveAndSetSuppliers(updated);
    toast('success', 'Đã ghi giá', `${priceForm.ingredientName}: ${Number(priceForm.unitCost).toLocaleString('vi-VN')}đ`);
    setShowPriceModal(null); setPriceForm({ ingredientName: '', unitCost: '', unit: '', quantity: '' });
  };

  // ─── LOCAL RECIPE CRUD ───
  const openAddRecipe = () => {
    setEditingRecipe(null);
    setRecipeForm({ dishName: '', aliases: '', notes: '' });
    setRecipeIngForms([{ ingredientId: '', ingredientName: '', unit: '', quantity: '', wasteFactor: '1' }]);
    setShowRecipeManagerModal(true);
  };

  const openEditRecipe = (r: LocalRecipe) => {
    setEditingRecipe(r);
    setRecipeForm({ dishName: r.dishName, aliases: r.dishNameAliases.join(', '), notes: r.notes });
    setRecipeIngForms(r.ingredients.map(i => ({
      ingredientId: i.ingredientId ? String(i.ingredientId) : '',
      ingredientName: i.ingredientName,
      unit: i.unit,
      quantity: String(i.quantity),
      wasteFactor: String(i.wasteFactor),
    })));
    setShowRecipeManagerModal(true);
  };

  const handleSaveRecipe = () => {
    if (!recipeForm.dishName.trim()) { toast('warning', 'Thiếu tên món', 'Nhập tên món ăn'); return; }
    const ings: LocalRecipeIngredient[] = recipeIngForms
      .filter(f => f.ingredientName.trim() && +f.quantity > 0)
      .map(f => {
        // Auto-map ingredientId nếu chọn từ danh sách
        const matched = ingredients.find(i => i.ingredient_name === f.ingredientName || i.ingredient_id === +f.ingredientId);
        return {
          ingredientId: matched?.ingredient_id ?? (+f.ingredientId || null),
          ingredientName: f.ingredientName || matched?.ingredient_name || '',
          unit: f.unit || matched?.unit || '',
          quantity: +f.quantity,
          wasteFactor: +f.wasteFactor || 1,
        };
      });
    if (ings.length === 0) { toast('warning', 'Thiếu nguyên liệu', 'Thêm ít nhất 1 nguyên liệu'); return; }

    const aliases = recipeForm.aliases.split(',').map(a => a.trim()).filter(Boolean);
    const now = new Date().toISOString();
    const list = [...localRecipes];

    if (editingRecipe) {
      const idx = list.findIndex(r => r.id === editingRecipe.id);
      if (idx >= 0) list[idx] = { ...editingRecipe, dishName: recipeForm.dishName, dishNameAliases: aliases, ingredients: ings, notes: recipeForm.notes, updatedAt: now };
    } else {
      list.push({ id: `recipe-${Date.now()}`, dishName: recipeForm.dishName, dishNameAliases: aliases, ingredients: ings, notes: recipeForm.notes, updatedAt: now });
    }
    saveLocalRecipes(list);
    toast('success', editingRecipe ? 'Đã cập nhật công thức' : 'Đã thêm công thức', recipeForm.dishName);
    setShowRecipeManagerModal(false); setEditingRecipe(null);
  };

  const handleDeleteRecipe = (id: string) => {
    if (!confirm('Xoá công thức này?')) return;
    saveLocalRecipes(localRecipes.filter(r => r.id !== id));
    toast('success', 'Đã xoá công thức', '');
  };

  // Match dish_name → local recipe (case-insensitive, alias support)
  const matchLocalRecipe = useCallback((dishName: string): LocalRecipe | null => {
    const norm = dishName.toLowerCase().trim();
    return localRecipes.find(r =>
      r.dishName.toLowerCase().trim() === norm ||
      r.dishNameAliases.some(a => a.toLowerCase().trim() === norm)
    ) ?? null;
  }, [localRecipes]);
  const performAutoRestore = useCallback(async (orderId: number, tableNumber: number | string, orderLines: any[]) => {
    if (!orderLines.length) return;
    const tok = sessionStorage.getItem('access_token');
    const ts = new Date().toLocaleString('vi-VN');
    toast('info', `↩️ Hoàn kho #${orderId}`, `Bàn ${tableNumber} — đang xử lý...`);

    const restored: any[] = [];
    let ok = 0;

    try {
      // Gọi preview để biết chính xác NL nào và bao nhiêu
      const preRes = await fetch(`${PROXY_BASE}/inventory/deduct/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
        body: JSON.stringify({ order_id: orderId, order_lines: orderLines }),
      });
      const pre = await preRes.json();
      const deductions: any[] = pre?.data?.deductions || [];

      for (const d of deductions) {
        if (!d.ingredient_id || !d.deducted) continue;
        try {
          await fetch(`${PROXY_BASE}/inventory/ingredients/${d.ingredient_id}/restock`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
            body: JSON.stringify({ quantity: d.deducted, notes: `↩️ Hoàn kho — Hủy đơn #${orderId} Bàn ${tableNumber}` }),
          });
          restored.push({ ingredient_name: d.ingredient_name, deducted: `+${d.deducted}`, unit: d.unit, restored: true });
          ok++;
        } catch {}
      }
    } catch {
      // Nếu preview không có endpoint, fallback: không hoàn được → báo thủ công
    }

    setRestoreCountP(c => c + 1);
    setAutoLogsP(prev => [{
      id: Date.now(), tableNumber, orderId, timestamp: ts,
      status: ok > 0 ? 'restored' : 'cancelled',
      message: ok > 0 ? `↩️ Hoàn kho ${ok} nguyên liệu thành công` : `↩️ Hủy đơn — điều chỉnh thủ công (0 NL hoàn được)`,
      deductions: restored.length > 0 ? restored : orderLines.map((l: any) => ({ ingredient_name: l.dish_name || `Món ${l.item_id}`, deducted: `×${l.quantity}`, unit: '', warning: true })),
    }, ...prev.slice(0, 99)]);

    ok > 0
      ? toast('success', `✅ Hoàn kho #${orderId}`, `${ok} NL đã cộng lại`)
      : toast('warning', `⚠️ Hoàn kho #${orderId}`, 'Không preview được — điều chỉnh thủ công');

    fetchIngredients(searchTerm, statusFilter);
    fetchDashboard();
  }, [toast, fetchIngredients, fetchDashboard, searchTerm, statusFilter, setAutoLogsP, setRestoreCountP]);

  // ─── AUTO-DEDUCT ENGINE (BroadcastChannel) ───
  useEffect(() => {
    if (!token || typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try { const s = localStorage.getItem('deducted-order-ids'); if (s) deductedIdsRef.current = new Set(JSON.parse(s)); } catch {}

    const tableCh = new BroadcastChannel('table-updates');
    tableCh.onmessage = async (event) => {
      const { type, orderId, tableNumber, items: bItems } = event.data;
      if (type !== 'NEW_ORDER') return;
      const oidNum = Number(orderId);
      if (deductedIdsRef.current.has(oidNum)) return;
      const ts = new Date().toLocaleString('vi-VN');
      toast('info', `🍽️ Bàn ${tableNumber} · #${orderId}`, 'Đang trừ kho...');
      try {
        const tok = sessionStorage.getItem('access_token');
        let lines: any[] = [];
        if (bItems?.length > 0) {
          lines = bItems.map((i: any) => ({ item_id: i.item_id || i.id, order_item_id: i.order_item_id || i.id, dish_name: i.item_name || i.name, quantity: i.quantity }));
        } else {
          for (const ep of [`${PROXY_BASE}/orders/${orderId}`, `${PROXY_BASE}/cashier/orders/${orderId}/details`]) {
            try {
              const r = await fetch(ep, { headers: { Authorization: `Bearer ${tok}` } });
              if (!r.ok) continue;
              const d = await r.json();
              const raw = d?.data?.items || d?.data?.order_items || d?.items || [];
              if (raw.length) { lines = raw.map((i: any) => ({ item_id: i.item_id || i.id, order_item_id: i.order_item_id || i.id, dish_name: i.item_name || i.name, quantity: i.quantity })); break; }
            } catch {}
          }
          if (!lines.length) { toast('warning', `⚠️ #${orderId}`, 'Không lấy được chi tiết món'); return; }
        }
        const res = await apiFetch('/api/inventory/deduct/confirm', { method: 'POST', body: JSON.stringify({ table_id: tableNumber, order_id: oidNum, order_lines: lines }) });
        let deductions = res.data?.deductions || [];
        const warnings = res.data?.warnings || [];

        // ✅ FALLBACK: nếu API trả 0 deductions, dùng công thức local để trừ thủ công
        const localDeductResults: any[] = [];
        const noApiRecipe = deductions.length === 0;
        if (noApiRecipe) {
          const tok2 = sessionStorage.getItem('access_token');
          for (const line of lines) {
            const recipe = matchLocalRecipe(line.dish_name || '');
            if (!recipe) continue;
            for (const ing of recipe.ingredients) {
              if (!ing.ingredientId) continue;
              const actualQty = +(ing.quantity * ing.wasteFactor * line.quantity).toFixed(4);
              try {
                await fetch(`${PROXY_BASE}/inventory/ingredients/${ing.ingredientId}/restock`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok2}` },
                  body: JSON.stringify({ quantity: -actualQty, notes: `🍽️ Trừ kho local — ${line.dish_name} ×${line.quantity} — Đơn #${oidNum}` }),
                });
                localDeductResults.push({ ingredient_name: ing.ingredientName, deducted: actualQty.toFixed(3), unit: ing.unit, local: true });
              } catch {}
            }
          }
          if (localDeductResults.length > 0) deductions = localDeductResults;
        }

        const status = warnings.length > 0 ? 'partial' : 'success';
        const ns = new Set(deductedIdsRef.current); ns.add(oidNum); deductedIdsRef.current = ns;
        localStorage.setItem('deducted-order-ids', JSON.stringify([...ns]));
        localStorage.setItem(`order-lines-${oidNum}`, JSON.stringify(lines));
        setDeductCountP(c => c + 1);
        setAutoLogsP(prev => [{
          id: Date.now(), tableNumber, orderId: oidNum, status, timestamp: ts,
          message: deductions.length > 0
            ? (noApiRecipe
                ? `✅ Trừ kho theo CT local — ${deductions.length} NL (${lines.length} món)`
                : (status === 'success' ? `✅ Trừ ${deductions.length} NL` : `⚠️ ${warnings.length} cảnh báo`))
            : `⚠️ 0 NL trừ — chưa có công thức (kiểm tra tab Công thức)`,
          deductions: deductions.length > 0
            ? deductions.map((d: any) => ({ ...d, local: d.local || false }))
            : lines.map((l: any) => ({ ingredient_name: `[Chưa CT] ${l.dish_name}`, deducted: `×${l.quantity}`, unit: '', warning: true })),
        }, ...prev.slice(0, 99)]);
        fetchIngredients(searchTerm, statusFilter); fetchDashboard();
        toast(
          deductions.length > 0 ? (status === 'success' ? 'success' : 'warning') : 'warning',
          deductions.length > 0 ? `${status === 'success' ? '✅' : '⚠️'} Bàn ${tableNumber}` : `⚠️ Bàn ${tableNumber}`,
          deductions.length > 0 ? `${deductions.length} NL trừ kho${noApiRecipe ? ' (CT local)' : ''}` : 'Chưa có công thức — vào tab Công thức để thêm'
        );
      } catch (err: any) { toast('error', `❌ #${orderId}`, err.message); }
    };

    const orderCh = new BroadcastChannel('order-updates');
    orderCh.onmessage = async ({ data }) => {
      const { type, orderId, tableNumber, items } = data;
      const oidNum = Number(orderId);
      if (type === 'ORDER_CANCELLED') {
        const wasDeducted = deductedIdsRef.current.has(oidNum);
        const ns = new Set(deductedIdsRef.current); ns.delete(oidNum); deductedIdsRef.current = ns;
        localStorage.setItem('deducted-order-ids', JSON.stringify([...ns]));
        if (!wasDeducted) return;
        let lines = items || [];
        if (!lines.length) {
          try { const s = localStorage.getItem(`order-lines-${oidNum}`); if (s) lines = JSON.parse(s); } catch {}
        }
        await performAutoRestore(oidNum, tableNumber, lines);
        try { localStorage.removeItem(`order-lines-${oidNum}`); } catch {}
      }
    };

    return () => { tableCh.close(); orderCh.close(); };
  }, [token, apiFetch, toast, performAutoRestore, matchLocalRecipe]);

  // ─── REPORTS DATA ───
  const reportsData = useMemo(() => {
    const now = Date.now();
    const ranges = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 };
    const cutoff = now - ranges[reportRange];

    // Filter transactions in range
    const inRange = transactions.filter(tx => new Date(tx.created_at).getTime() >= cutoff);

    // Daily consumed grouped by date
    const byDate: Record<string, { in: number; out: number; value: number }> = {};
    inRange.forEach(tx => {
      const d = tx.created_at.split('T')[0];
      if (!byDate[d]) byDate[d] = { in: 0, out: 0, value: 0 };
      if (tx.quantity_change > 0) byDate[d].in += tx.quantity_change;
      else byDate[d].out += Math.abs(tx.quantity_change);
    });

    const timeline = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric' }),
        'Nhập kho': +v.in.toFixed(2),
        'Xuất kho': +v.out.toFixed(2),
      }));

    // Top consumed
    const topConsumed: Record<string, { total: number; unit: string }> = {};
    inRange.filter(tx => tx.quantity_change < 0).forEach(tx => {
      if (!topConsumed[tx.ingredient_name]) topConsumed[tx.ingredient_name] = { total: 0, unit: tx.unit };
      topConsumed[tx.ingredient_name].total += Math.abs(tx.quantity_change);
    });
    const topList = Object.entries(topConsumed)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 8)
      .map(([name, v]) => ({ name: name.length > 14 ? name.slice(0, 14) + '…' : name, fullName: name, consumed: +v.total.toFixed(2), unit: v.unit }));

    // Inventory value breakdown
    const valueByStatus = [
      { name: 'Đủ dùng', value: ingredients.filter(i => i.stock_status === 'NORMAL').reduce((s, i) => s + (i.stock_value || 0), 0) },
      { name: 'Sắp hết', value: ingredients.filter(i => i.stock_status === 'LOW_STOCK').reduce((s, i) => s + (i.stock_value || 0), 0) },
      { name: 'Hết hàng', value: ingredients.filter(i => i.stock_status === 'OUT_OF_STOCK').reduce((s, i) => s + (i.stock_value || 0), 0) },
    ].filter(d => d.value > 0);

    const totalIn = inRange.filter(t => t.quantity_change > 0).reduce((s, t) => s + t.quantity_change, 0);
    const totalOut = inRange.filter(t => t.quantity_change < 0).reduce((s, t) => s + Math.abs(t.quantity_change), 0);

    return { timeline, topList, valueByStatus, totalIn, totalOut, txCount: inRange.length };
  }, [transactions, ingredients, reportRange]);

  // ─── FORECAST DATA ───
  const forecastData = useMemo(() => buildForecast(ingredients, transactions), [ingredients, transactions]);

  // ─── EXPORT CSV ───
  const handleExportCSV = () => {
    const csv = [
      ['ID', 'Tên', 'ĐV', 'Tồn', 'Min', 'Giá', 'Trạng thái', 'NCC'],
      ...ingredients.map(i => [i.ingredient_id, i.ingredient_name, i.unit, i.current_stock, i.min_threshold, i.unit_cost, STATUS_LABEL[i.stock_status], i.supplier])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `kho-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`; a.click();
  };

  // ═══════════════════════════════════════════════════════════════════
  // AUTH SCREENS
  // ═══════════════════════════════════════════════════════════════════
  if (isAuthChecking) return (
    <div className="min-h-screen bg-[#0a0d12] flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" /><div className="text-white/40">Đang kiểm tra quyền...</div></div>
    </div>
  );

  if (!token || authError) return (
    <div className="flex min-h-screen bg-[#0a0d12]">
      <Sidebar />
      <div className="w-full lg:ml-64 flex items-center justify-center pt-20">
        <div className="max-w-sm w-full px-4">
          <div className="bg-[#111519] border-2 border-red-500/30 rounded-2xl p-8">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Không có quyền</h3>
            <p className="text-white/40 mb-6">{authError}</p>
            <a href="/vi/login" className="block w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-center font-semibold transition">Đăng nhập</a>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════
  const tabs: Array<{ id: TabId; label: string; icon: any; badge?: number }> = [
    { id: 'dashboard',    label: 'Tổng quan',   icon: BarChart2    },
    { id: 'ingredients',  label: 'Nguyên liệu', icon: Boxes        },
    { id: 'transactions', label: 'Biến động',   icon: Activity     },
    { id: 'purchases',    label: 'Phiếu nhập',  icon: Truck,       badge: dashboard?.purchase_requests?.pending_count },
    { id: 'suppliers',    label: 'Nhà CC',      icon: Building2    },
    { id: 'recipes',      label: 'Công thức',   icon: UtensilsCrossed, badge: localRecipes.length > 0 ? undefined : 0 },
    { id: 'reports',      label: 'Báo cáo',     icon: FileBarChart },
    { id: 'auto',         label: 'Tự động',     icon: Zap,         badge: liveDeductCount > 0 ? liveDeductCount : undefined },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0d12]">
      <Sidebar />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="w-full lg:ml-64 pt-14 lg:pt-0">

        {/* ──────── HEADER ──────── */}
        <div className="bg-[#0a0d12] border-b border-white/5 px-4 sm:px-6 py-4 sticky top-0 lg:top-0 z-30 backdrop-blur-md">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Warehouse size={18} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Quản lý kho vận</h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-white/30 text-xs font-mono">{userRole}</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Live
                  </span>
                  {liveDeductCount > 0 && (
                    <span className="text-xs text-blue-400/80 bg-blue-500/8 px-2 py-0.5 rounded-full border border-blue-500/15">
                      <Zap size={9} className="inline mr-0.5" />{liveDeductCount} trừ kho
                    </span>
                  )}
                  {restoreCount > 0 && (
                    <span className="text-xs text-violet-400/80 bg-violet-500/8 px-2 py-0.5 rounded-full border border-violet-500/15">
                      <RotateCcw size={9} className="inline mr-0.5" />{restoreCount} hoàn kho
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {activeTab === 'ingredients' && (
                <>
                  <button onClick={handleExportCSV} className="px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/8 text-white/60 hover:text-white/90 rounded-xl transition text-xs flex items-center gap-1.5">
                    <Download size={13} /><span className="hidden sm:inline">CSV</span>
                  </button>
                  <button onClick={() => setShowAddModal(true)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/15">
                    <Plus size={14} /><span className="hidden sm:inline">Thêm nguyên liệu</span><span className="sm:hidden">Thêm</span>
                  </button>
                </>
              )}
              {activeTab === 'recipes' && (
                <button onClick={openAddRecipe} className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition">
                  <Plus size={14} /><span className="hidden sm:inline">Thêm công thức</span><span className="sm:hidden">Thêm</span>
                </button>
              )}
              {activeTab === 'purchases' && (
                <button onClick={() => setShowCreatePurchaseModal(true)} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition">
                  <Plus size={14} /><span className="hidden sm:inline">Tạo phiếu nhập</span><span className="sm:hidden">Tạo</span>
                </button>
              )}
              {activeTab === 'suppliers' && (
                <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', email: '', address: '', contactPerson: '', notes: '', rating: '5' }); setShowAddSupplierModal(true); }}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition">
                  <Plus size={14} /><span className="hidden sm:inline">Thêm nhà CC</span><span className="sm:hidden">Thêm</span>
                </button>
              )}
              <button onClick={() => { fetchDashboard(); fetchIngredients(searchTerm, statusFilter); fetchPurchases(); fetchTransactions(); }}
                className="p-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition group">
                <RefreshCw size={14} className="text-white/40 group-hover:text-emerald-400 transition" />
              </button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex mt-4 border-b border-white/5 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap flex-shrink-0
                    ${active ? 'border-emerald-400 text-emerald-400 bg-emerald-500/4' : 'border-transparent text-white/35 hover:text-white/70 hover:bg-white/2'}`}>
                  <Icon size={13} />{tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold min-w-[18px] text-center leading-none">{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TAB: DASHBOARD
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="p-4 sm:p-6 space-y-5">
            {!dashboard ? <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /></div> : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <StatTile label="Tổng nguyên liệu" value={dashboard.summary.total_ingredients} sub="tất cả danh mục" icon={Boxes} gradient="from-emerald-500 to-teal-500" />
                  <StatTile label="Giá trị kho" value={`${(dashboard.summary.total_inventory_value / 1e6).toFixed(1)}M`} sub={Number(dashboard.summary.total_inventory_value).toLocaleString('vi-VN') + 'đ'} icon={TrendingUp} gradient="from-blue-500 to-cyan-500" />
                  <StatTile label="Cảnh báo" value={(dashboard.summary.low_stock || 0) + (dashboard.summary.out_of_stock || 0)} sub={`${dashboard.summary.low_stock || 0} sắp hết · ${dashboard.summary.out_of_stock || 0} hết hàng`} icon={AlertTriangle} gradient="from-amber-500 to-orange-500" />
                  <StatTile label="Phiếu chờ duyệt" value={dashboard.purchase_requests?.pending_count || 0} sub="cần xử lý" icon={ClipboardList} gradient="from-purple-500 to-violet-500" />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Pie */}
                  <Card className="lg:col-span-2">
                    <CardHeader icon={PieIcon} title="Phân bổ tồn kho" />
                    <div className="p-4">
                      {[
                        { name: 'Đủ dùng', value: dashboard.summary.total_ingredients - (dashboard.summary.low_stock || 0) - (dashboard.summary.out_of_stock || 0) - (dashboard.summary.overstocked || 0), color: '#10b981' },
                        { name: 'Sắp hết', value: dashboard.summary.low_stock || 0, color: '#f59e0b' },
                        { name: 'Hết hàng', value: dashboard.summary.out_of_stock || 0, color: '#ef4444' },
                        { name: 'Quá nhiều', value: dashboard.summary.overstocked || 0, color: '#3b82f6' },
                      ].filter(d => d.value > 0).length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                          <RePieChart>
                            <Pie data={[
                              { name: 'Đủ dùng', value: Math.max(0, dashboard.summary.total_ingredients - (dashboard.summary.low_stock || 0) - (dashboard.summary.out_of_stock || 0) - (dashboard.summary.overstocked || 0)), color: '#10b981' },
                              { name: 'Sắp hết', value: dashboard.summary.low_stock || 0, color: '#f59e0b' },
                              { name: 'Hết hàng', value: dashboard.summary.out_of_stock || 0, color: '#ef4444' },
                              { name: 'Quá nhiều', value: dashboard.summary.overstocked || 0, color: '#3b82f6' },
                            ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                              {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#111519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                            <Legend formatter={(v: string) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>} />
                          </RePieChart>
                        </ResponsiveContainer>
                      ) : <div className="flex items-center justify-center h-40 text-white/20 text-sm">Không có dữ liệu</div>}
                    </div>
                  </Card>

                  {/* Bar consumed */}
                  <Card className="lg:col-span-3">
                    <CardHeader icon={Flame} title="Tiêu thụ nhiều nhất hôm nay" iconColor="text-amber-400" />
                    <div className="p-4">
                      {dashboard.top_consumed_today?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={dashboard.top_consumed_today.slice(0, 7).map(c => ({ name: c.ingredient_name.length > 10 ? c.ingredient_name.slice(0, 10) + '…' : c.ingredient_name, fullName: c.ingredient_name, v: +Number(c.consumed).toFixed(2), unit: c.unit }))} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                            <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                            <Tooltip formatter={(v: any, _: any, p: any) => [`${v} ${p.payload.unit}`, p.payload.fullName]} contentStyle={{ background: '#111519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="v" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="flex items-center justify-center h-40 text-white/20 text-sm">Chưa có biến động hôm nay</div>}
                    </div>
                  </Card>
                </div>

                {/* Forecast preview + Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Forecast */}
                  <Card>
                    <CardHeader icon={CalendarDays} title="Dự báo sắp hết" iconColor="text-violet-400"
                      right={<button onClick={() => setActiveTab('reports')} className="text-xs text-white/30 hover:text-emerald-400 transition flex items-center gap-1">Xem báo cáo <ChevronRight size={12} /></button>} />
                    {forecastData.length === 0 ? (
                      <div className="py-10 text-center text-white/20 text-sm">Chưa đủ dữ liệu tiêu thụ</div>
                    ) : (
                      <div className="divide-y divide-white/4">
                        {forecastData.slice(0, 5).map(item => (
                          <div key={item.ingredient_id} className="flex items-center gap-3 px-5 py-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.risk === 'critical' ? 'bg-red-500 shadow-sm shadow-red-500/50' : item.risk === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{item.ingredient_name}</div>
                              <div className="text-xs text-white/30">~{item.avgPerDay.toFixed(2)} {item.unit}/ngày · còn {Number(item.current_stock).toFixed(1)} {item.unit}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.daysLeft != null ? (
                                <>
                                  <div className={`text-sm font-bold ${item.risk === 'critical' ? 'text-red-400' : item.risk === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{item.daysLeft} ngày</div>
                                  <div className="text-xs text-white/25">{item.runoutDate?.toLocaleDateString('vi-VN')}</div>
                                </>
                              ) : (
                                <span className="text-xs text-white/20">Không có dữ liệu</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Alerts */}
                  <Card>
                    <CardHeader icon={AlertTriangle} title="Cảnh báo tồn kho" iconColor="text-amber-400"
                      right={dashboard.alerts.length > 0 && <span className="text-xs text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded-full">{dashboard.alerts.length} mục</span>} />
                    {dashboard.alerts.length === 0 ? (
                      <div className="py-10 text-center"><CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400/50" /><div className="text-white/30 text-sm">Tất cả đủ hàng 🎉</div></div>
                    ) : (
                      <div className="divide-y divide-white/4">
                        {dashboard.alerts.slice(0, 7).map(a => (
                          <div key={a.ingredient_id} className="flex items-center gap-3 px-5 py-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.alert_type === 'OUT_OF_STOCK' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{a.ingredient_name}</div>
                              <div className="text-xs text-white/30">{a.alert_type === 'OUT_OF_STOCK' ? '🔴 Hết hàng' : '⚠️ Dưới ngưỡng'}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`font-bold text-sm ${a.alert_type === 'OUT_OF_STOCK' ? 'text-red-400' : 'text-amber-400'}`}>{a.current_stock} {a.unit}</div>
                              <div className="text-xs text-white/25">min: {a.min_threshold}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: INGREDIENTS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'ingredients' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm nguyên liệu..."
                  className="w-full bg-[#111519] border border-white/8 focus:border-emerald-500/40 rounded-xl pl-8 pr-3 py-2 text-white placeholder-white/20 outline-none text-sm transition" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#111519] border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white/70 text-sm outline-none transition">
                <option value="">Tất cả</option>
                <option value="LOW_STOCK">Sắp hết</option>
                <option value="OUT_OF_STOCK">Hết hàng</option>
                <option value="NORMAL">Đủ dùng</option>
                <option value="OVERSTOCKED">Quá nhiều</option>
              </select>
            </div>

            {loading ? <div className="flex justify-center h-40 items-center"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>
              : ingredients.length === 0 ? (
                <div className="text-center py-16 bg-[#111519] border border-white/6 rounded-2xl">
                  <Boxes className="w-10 h-10 text-white/8 mx-auto mb-3" />
                  <div className="text-white/30 text-sm">Không tìm thấy nguyên liệu</div>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden lg:block bg-[#111519] border border-white/6 rounded-2xl overflow-hidden">
                    <div className="bg-black/20 border-b border-white/5 px-5 py-3 grid grid-cols-12 gap-3 text-xs font-semibold text-white/25 uppercase tracking-wider">
                      <div className="col-span-3">Nguyên liệu</div>
                      <div className="col-span-2">Tồn kho</div>
                      <div className="col-span-1 text-center">Min</div>
                      <div className="col-span-1 text-center">Giá</div>
                      <div className="col-span-1 text-center">Giá trị</div>
                      <div className="col-span-2">Trạng thái</div>
                      <div className="col-span-2 text-center">Thao tác</div>
                    </div>
                    <div className="divide-y divide-white/4">
                      {ingredients.map(item => (
                        <div key={item.ingredient_id} className="grid grid-cols-12 gap-3 px-5 py-3.5 hover:bg-white/2 transition items-center group">
                          <div className="col-span-3">
                            <div className="text-white font-medium text-sm">{item.ingredient_name}</div>
                            <div className="text-xs text-white/30 mt-0.5">{item.supplier || '—'}</div>
                          </div>
                          <div className="col-span-2">
                            <div className={`font-bold text-sm mb-1.5 ${item.current_stock <= 0 ? 'text-red-400' : item.current_stock <= item.min_threshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {Number(item.current_stock).toFixed(2)} <span className="text-xs text-white/30 font-normal">{item.unit}</span>
                            </div>
                            <StockBar current={item.current_stock} min={item.min_threshold} max={item.max_threshold} />
                          </div>
                          <div className="col-span-1 text-center text-white/40 text-sm">{item.min_threshold}</div>
                          <div className="col-span-1 text-center text-white/40 text-xs font-mono">{Number(item.unit_cost).toLocaleString('vi-VN')}đ</div>
                          <div className="col-span-1 text-center text-white/40 text-xs font-mono">{Number(item.stock_value || 0).toLocaleString('vi-VN')}đ</div>
                          <div className="col-span-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[item.stock_status]}`}>{STATUS_LABEL[item.stock_status]}</span>
                          </div>
                          <div>
                            <button title="Nhập kho" onClick={() => { setSelectedIngredient(item); setShowRestockModal(true); }} className="p-1.5 hover:bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-400 rounded-lg transition"><ArrowUpCircle size={15} /></button>
                            <button title="Điều chỉnh" onClick={() => { setSelectedIngredient(item); setAdjustStock(item.current_stock.toString()); setAdjustUnitCost(item.unit_cost.toString()); setShowAdjustModal(true); }} className="p-1.5 hover:bg-blue-500/10 text-blue-400/70 hover:text-blue-400 rounded-lg transition"><Settings size={15} /></button>
                            <button title="Xóa" onClick={() => handleDeleteIng(item.ingredient_id, item.ingredient_name)} className="p-1.5 hover:bg-red-500/10 text-red-400/70 hover:text-red-400 rounded-lg transition"><Trash2 size={15} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden space-y-2">
                    {ingredients.map(item => (
                      <div key={item.ingredient_id} className="bg-[#111519] border border-white/6 rounded-xl p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div><div className="text-white font-medium text-sm">{item.ingredient_name}</div><div className="text-xs text-white/30">{item.unit} · {item.supplier || 'Chưa có NCC'}</div></div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ml-2 ${STATUS_COLOR[item.stock_status]}`}>{STATUS_LABEL[item.stock_status]}</span>
                        </div>
                        <div className="mb-2.5">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`font-bold ${item.current_stock <= 0 ? 'text-red-400' : item.current_stock <= item.min_threshold ? 'text-amber-400' : 'text-emerald-400'}`}>{Number(item.current_stock).toFixed(2)} {item.unit}</span>
                            <span className="text-white/25">min: {item.min_threshold}</span>
                          </div>
                          <StockBar current={item.current_stock} min={item.min_threshold} max={item.max_threshold} />
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => { setSelectedIngredient(item); setShowRestockModal(true); }} className="flex-1 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-emerald-500/15 transition"><ArrowUpCircle size={12} />Nhập</button>
                          <button onClick={() => { setSelectedIngredient(item); setAdjustStock(item.current_stock.toString()); setAdjustUnitCost(item.unit_cost.toString()); setShowAdjustModal(true); }} className="px-2.5 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/15 transition"><Settings size={14} /></button>
                          <button onClick={() => { setSelectedIngredient(item); fetchRecipe(item.ingredient_id); setShowRecipeModal(true); }} className="px-2.5 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/15 transition"><BookOpen size={14} /></button>
                          <button onClick={() => handleDeleteIng(item.ingredient_id, item.ingredient_name)} className="px-2.5 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/15 transition"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: TRANSACTIONS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'transactions' && (
          <div className="p-4 sm:p-6">
            <Card>
              <CardHeader icon={Activity} title="Lịch sử biến động kho" iconColor="text-blue-400"
                right={<button onClick={fetchTransactions} className="p-1.5 hover:bg-white/5 rounded-lg transition"><RefreshCw size={14} className="text-white/30 hover:text-white/60" /></button>} />
              {loading ? <div className="flex justify-center h-40 items-center"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>
                : transactions.length === 0 ? <div className="text-center py-16 text-white/25 text-sm">Chưa có biến động</div>
                : (
                  <div className="divide-y divide-white/4">
                    {transactions.map(tx => (
                      <div key={tx.transaction_id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.quantity_change >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                          {tx.quantity_change >= 0 ? <ArrowUpCircle size={15} className="text-emerald-400" /> : <ArrowDownCircle size={15} className="text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{tx.ingredient_name}</div>
                          <div className="text-xs text-white/30 truncate">{tx.notes}</div>
                        </div>
                        <div className="text-xs text-white/25 hidden md:block flex-shrink-0 font-mono">{tx.stock_before} → {tx.stock_after}</div>
                        <div className={`font-mono font-bold text-sm flex-shrink-0 ${tx.quantity_change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.quantity_change >= 0 ? '+' : ''}{Number(tx.quantity_change).toFixed(3)}
                        </div>
                        <div className="text-xs text-white/25 flex-shrink-0 hidden sm:block">{new Date(tx.created_at).toLocaleTimeString('vi-VN')}</div>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: PURCHASES
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'purchases' && (
          <div className="p-4 sm:p-6">
            <Card>
              <div className="hidden lg:block bg-black/20 border-b border-white/5 px-5 py-3 grid grid-cols-12 gap-3 text-xs font-semibold text-white/25 uppercase tracking-wider">
                <div className="col-span-3">Nguyên liệu</div>
                <div className="col-span-1 text-center">SL</div>
                <div className="col-span-1 text-center">Tồn</div>
                <div className="col-span-2 text-center">Chi phí</div>
                <div className="col-span-2">Trạng thái</div>
                <div className="col-span-1">Ghi chú</div>
                <div className="col-span-2 text-center">Hành động</div>
              </div>
              {loading ? <div className="flex justify-center h-40 items-center"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>
                : purchases.length === 0 ? (
                  <div className="text-center py-16"><Truck size={28} className="mx-auto mb-2 text-white/10" /><div className="text-white/25 text-sm">Không có phiếu nhập</div></div>
                ) : (
                  <div className="divide-y divide-white/4">
                    {purchases.map(pr => (
                      <div key={pr.request_id}>
                        {/* Desktop */}
                        <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3.5 hover:bg-white/2 transition items-center">
                          <div className="col-span-3"><div className="text-white text-sm font-medium">{pr.ingredient_name}</div><div className="text-xs text-white/30">{pr.supplier || '—'}</div></div>
                          <div className="col-span-1 text-center text-white text-sm font-bold">{pr.requested_quantity} <span className="text-xs text-white/30 font-normal">{pr.unit}</span></div>
                          <div className="col-span-1 text-center text-white/40 text-sm font-mono">{Number(pr.current_stock).toFixed(1)}</div>
                          <div className="col-span-2 text-center text-emerald-400 text-sm font-mono">{Number(pr.estimated_cost || 0).toLocaleString('vi-VN')}đ</div>
                          <div className="col-span-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PURCHASE_STATUS_COLOR[pr.status]}`}>{PURCHASE_STATUS_LABEL[pr.status]}</span></div>
                          <div className="col-span-1 text-xs text-white/30 truncate">{pr.notes}</div>
                          <div className="col-span-2 flex items-center justify-center gap-1.5">
                            {pr.status === 'PENDING' && (<><button onClick={() => handleUpdatePurchase(pr.request_id, 'APPROVED')} className="px-2.5 py-1 bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 rounded-lg text-xs hover:bg-emerald-500/20 transition">✅ Duyệt</button><button onClick={() => handleUpdatePurchase(pr.request_id, 'CANCELLED')} className="px-2.5 py-1 bg-red-500/12 text-red-400 border border-red-500/25 rounded-lg text-xs hover:bg-red-500/20 transition">Hủy</button></>)}
                            {pr.status === 'APPROVED' && <button onClick={() => handleUpdatePurchase(pr.request_id, 'ORDERED')} className="px-2.5 py-1 bg-purple-500/12 text-purple-400 border border-purple-500/25 rounded-lg text-xs hover:bg-purple-500/20 transition">🚚 Đặt</button>}
                            {pr.status === 'ORDERED' && <button onClick={() => { const q = prompt(`SL nhận (${pr.unit}):`, pr.requested_quantity.toString()); if (q) handleUpdatePurchase(pr.request_id, 'RECEIVED', +q); }} className="px-2.5 py-1 bg-blue-500/12 text-blue-400 border border-blue-500/25 rounded-lg text-xs hover:bg-blue-500/20 transition">📦 Nhận</button>}
                          </div>
                        </div>
                        {/* Mobile */}
                        <div className="lg:hidden p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div><div className="text-white font-medium text-sm">{pr.ingredient_name}</div><div className="text-xs text-white/30">{pr.supplier || '—'} · #{pr.request_id}</div></div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ml-2 ${PURCHASE_STATUS_COLOR[pr.status]}`}>{PURCHASE_STATUS_LABEL[pr.status]}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-3"><span className="text-white/40">SL: <span className="text-white font-bold">{pr.requested_quantity} {pr.unit}</span></span><span className="text-emerald-400 font-mono">{Number(pr.estimated_cost || 0).toLocaleString('vi-VN')}đ</span></div>
                          <div className="flex gap-2">
                            {pr.status === 'PENDING' && (<><button onClick={() => handleUpdatePurchase(pr.request_id, 'APPROVED')} className="flex-1 py-2 bg-emerald-500/12 text-emerald-400 rounded-xl text-xs font-medium hover:bg-emerald-500/20 transition">✅ Duyệt</button><button onClick={() => handleUpdatePurchase(pr.request_id, 'CANCELLED')} className="flex-1 py-2 bg-red-500/12 text-red-400 rounded-xl text-xs font-medium hover:bg-red-500/20 transition">Hủy</button></>)}
                            {pr.status === 'APPROVED' && <button onClick={() => handleUpdatePurchase(pr.request_id, 'ORDERED')} className="flex-1 py-2 bg-purple-500/12 text-purple-400 rounded-xl text-xs font-medium hover:bg-purple-500/20 transition">🚚 Đặt hàng</button>}
                            {pr.status === 'ORDERED' && <button onClick={() => { const q = prompt(`SL nhận:`, pr.requested_quantity.toString()); if (q) handleUpdatePurchase(pr.request_id, 'RECEIVED', +q); }} className="flex-1 py-2 bg-blue-500/12 text-blue-400 rounded-xl text-xs font-medium hover:bg-blue-500/20 transition">📦 Đã nhận</button>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: SUPPLIERS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'suppliers' && (
          <div className="p-4 sm:p-6 space-y-4">
            {suppliers.length === 0 ? (
              <div className="text-center py-24 bg-[#111519] border border-white/6 rounded-2xl">
                <Building2 size={36} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">Chưa có nhà cung cấp nào</p>
                <p className="text-white/15 text-xs mt-1">Nhấn "Thêm nhà CC" để bắt đầu</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {suppliers.map(sup => (
                  <Card key={sup.id} className="hover:border-white/12 transition-all group">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-cyan-400 font-bold text-base">{sup.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <div className="text-white font-semibold text-sm">{sup.name}</div>
                            {sup.contactPerson && <div className="text-xs text-white/30">{sup.contactPerson}</div>}
                          </div>
                        </div>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={11} className={s <= sup.rating ? 'text-amber-400 fill-amber-400' : 'text-white/10'} />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-3">
                        {sup.phone && <div className="flex items-center gap-2 text-xs text-white/40"><Phone size={11} />{sup.phone}</div>}
                        {sup.email && <div className="flex items-center gap-2 text-xs text-white/40"><Mail size={11} />{sup.email}</div>}
                        {sup.address && <div className="flex items-center gap-2 text-xs text-white/40"><Building2 size={11} />{sup.address}</div>}
                      </div>

                      {sup.linkedIngredients.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {sup.linkedIngredients.slice(0, 4).map((ing, i) => (
                            <span key={i} className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded-full">{ing}</span>
                          ))}
                          {sup.linkedIngredients.length > 4 && <span className="text-xs text-white/25">+{sup.linkedIngredients.length - 4}</span>}
                        </div>
                      )}

                      {sup.priceHistory.length > 0 && (
                        <div className="bg-black/20 rounded-xl p-2.5 mb-3">
                          <div className="text-xs text-white/25 mb-1.5 font-medium">Lịch sử giá gần nhất</div>
                          {sup.priceHistory.slice(-3).reverse().map((ph, i) => (
                            <div key={i} className="flex justify-between text-xs py-0.5">
                              <span className="text-white/50 truncate max-w-[120px]">{ph.ingredientName}</span>
                              <span className="text-emerald-400 font-mono">{Number(ph.unitCost).toLocaleString('vi-VN')}đ/{ph.unit}</span>
                              <span className="text-white/20 font-mono">{ph.date}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => setShowPriceModal(sup)} className="flex-1 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/15 transition">+ Ghi giá</button>
                        <button onClick={() => { setEditingSupplier(sup); setSupplierForm({ name: sup.name, phone: sup.phone, email: sup.email, address: sup.address, contactPerson: sup.contactPerson, notes: sup.notes, rating: String(sup.rating) }); setShowAddSupplierModal(true); }} className="px-3 py-1.5 bg-white/5 text-white/50 rounded-lg hover:bg-white/8 transition"><Settings size={13} /></button>
                        <button onClick={() => handleDeleteSupplier(sup.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400/70 rounded-lg hover:bg-red-500/15 transition"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: RECIPES (Công thức món ăn — local, localStorage)
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'recipes' && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-3.5 bg-orange-500/6 border border-orange-500/20 rounded-xl">
              <Info size={15} className="text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300/80 leading-relaxed">
                Công thức được lưu <strong>cục bộ trên trình duyệt</strong>. Khi đơn hàng gửi lên mà API trả về 0 NL, hệ thống sẽ tự động trừ kho theo công thức này.
                Tên món phải <strong>khớp chính xác</strong> với tên món trong đơn (hoặc thêm alias).
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} placeholder="Tìm công thức theo tên món..."
                className="w-full bg-[#111519] border border-white/8 focus:border-orange-500/40 rounded-xl pl-8 pr-3 py-2 text-white placeholder-white/20 outline-none text-sm transition" />
            </div>

            {localRecipes.length === 0 ? (
              <div className="text-center py-24 bg-[#111519] border border-white/6 rounded-2xl border-dashed">
                <UtensilsCrossed size={40} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-medium">Chưa có công thức nào</p>
                <p className="text-white/15 text-xs mt-1 mb-5">Thêm công thức để hệ thống tự động trừ kho theo món ăn</p>
                <button onClick={openAddRecipe} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition">
                  + Thêm công thức đầu tiên
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {localRecipes
                  .filter(r => !recipeSearch || r.dishName.toLowerCase().includes(recipeSearch.toLowerCase()) || r.dishNameAliases.some(a => a.toLowerCase().includes(recipeSearch.toLowerCase())))
                  .map(recipe => {
                    const totalCost = recipe.ingredients.reduce((sum, ing) => {
                      const ingData = ingredients.find(i => i.ingredient_id === ing.ingredientId);
                      return sum + (ingData ? ingData.unit_cost * ing.quantity * ing.wasteFactor : 0);
                    }, 0);
                    const allAvailable = recipe.ingredients.every(ing => {
                      const ingData = ingredients.find(i => i.ingredient_id === ing.ingredientId);
                      return ingData ? ingData.current_stock >= ing.quantity * ing.wasteFactor : false;
                    });
                    return (
                      <Card key={recipe.id} className="hover:border-white/12 transition-all group">
                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-amber-600/20 border border-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <UtensilsCrossed size={17} className="text-orange-400" />
                              </div>
                              <div>
                                <div className="text-white font-semibold text-sm">{recipe.dishName}</div>
                                <div className={`text-xs mt-0.5 flex items-center gap-1 ${allAvailable ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${allAvailable ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                  {allAvailable ? 'Đủ nguyên liệu' : 'Thiếu nguyên liệu'}
                                </div>
                              </div>
                            </div>
                            {totalCost > 0 && (
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs text-white/25">Chi phí/phần</div>
                                <div className="text-sm font-bold text-emerald-400">{totalCost.toLocaleString('vi-VN')}đ</div>
                              </div>
                            )}
                          </div>

                          {/* Aliases */}
                          {recipe.dishNameAliases.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {recipe.dishNameAliases.map((a, i) => (
                                <span key={i} className="text-xs bg-white/5 text-white/35 px-2 py-0.5 rounded-full">{a}</span>
                              ))}
                            </div>
                          )}

                          {/* Ingredients list */}
                          <div className="bg-black/20 rounded-xl p-2.5 mb-3 space-y-1.5">
                            {recipe.ingredients.map((ing, i) => {
                              const ingData = ingredients.find(d => d.ingredient_id === ing.ingredientId);
                              const actualQty = +(ing.quantity * ing.wasteFactor).toFixed(4);
                              const sufficient = ingData ? ingData.current_stock >= actualQty : null;
                              return (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sufficient === true ? 'bg-emerald-400' : sufficient === false ? 'bg-red-400' : 'bg-white/20'}`} />
                                    <span className="text-white/70 truncate">{ing.ingredientName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className="font-mono text-white/60">{actualQty} {ing.unit}</span>
                                    {ing.wasteFactor !== 1 && (
                                      <span className="text-white/25 text-xs">×{ing.wasteFactor}</span>
                                    )}
                                    {ingData && (
                                      <span className={`font-mono ${sufficient ? 'text-white/25' : 'text-red-400/70'}`}>
                                        ({ingData.current_stock.toFixed(1)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {recipe.notes && <p className="text-xs text-white/25 italic mb-3">{recipe.notes}</p>}

                          <div className="flex gap-2">
                            <button onClick={() => openEditRecipe(recipe)} className="flex-1 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/15 transition flex items-center justify-center gap-1">
                              <Settings size={12} />Sửa
                            </button>
                            <button onClick={() => handleDeleteRecipe(recipe.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400/70 rounded-lg hover:bg-red-500/15 transition"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: REPORTS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Range selector */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">Khoảng thời gian:</span>
              {(['day', 'week', 'month'] as const).map(r => (
                <button key={r} onClick={() => setReportRange(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${reportRange === r ? 'bg-emerald-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/8 hover:text-white/70'}`}>
                  {r === 'day' ? 'Hôm nay' : r === 'week' ? '7 ngày' : '30 ngày'}
                </button>
              ))}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Giao dịch', value: reportsData.txCount, icon: Activity, gradient: 'from-blue-500 to-cyan-500' },
                { label: 'Tổng nhập', value: reportsData.totalIn.toFixed(1), icon: ArrowUpCircle, gradient: 'from-emerald-500 to-teal-500' },
                { label: 'Tổng xuất', value: reportsData.totalOut.toFixed(1), icon: ArrowDownCircle, gradient: 'from-amber-500 to-orange-500' },
                { label: 'Giá trị kho', value: `${((dashboard?.summary.total_inventory_value || 0) / 1e6).toFixed(1)}M`, icon: TrendingUp, gradient: 'from-purple-500 to-violet-500' },
              ].map((s, i) => <StatTile key={i} {...s} />)}
            </div>

            {/* Timeline chart */}
            <Card>
              <CardHeader icon={Activity} title={`Biến động nhập/xuất kho — ${reportRange === 'day' ? 'Hôm nay' : reportRange === 'week' ? '7 ngày qua' : '30 ngày qua'}`} iconColor="text-blue-400" />
              <div className="p-4">
                {reportsData.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={reportsData.timeline} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                      <defs>
                        <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#111519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }} />
                      <Legend formatter={(v: string) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>} />
                      <Area type="monotone" dataKey="Nhập kho" stroke="#10b981" strokeWidth={2} fill="url(#gin)" dot={false} />
                      <Area type="monotone" dataKey="Xuất kho" stroke="#f59e0b" strokeWidth={2} fill="url(#gout)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-48 text-white/20 text-sm">Chưa có dữ liệu cho khoảng này</div>}
              </div>
            </Card>

            {/* Top consumed + Value breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <Card className="lg:col-span-3">
                <CardHeader icon={Flame} title="Top tiêu thụ trong kỳ" iconColor="text-amber-400" />
                <div className="p-4">
                  {reportsData.topList.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={reportsData.topList} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} width={90} />
                        <Tooltip formatter={(v: any, _: any, p: any) => [`${v} ${p.payload.unit}`, p.payload.fullName]} contentStyle={{ background: '#111519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="consumed" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-48 text-white/20 text-sm">Không có dữ liệu</div>}
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader icon={PieIcon} title="Giá trị theo trạng thái" />
                <div className="p-4">
                  {reportsData.valueByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <RePieChart>
                        <Pie data={reportsData.valueByStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                          {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [Number(v).toLocaleString('vi-VN') + 'đ', '']} contentStyle={{ background: '#111519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                        <Legend formatter={(v: string) => <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{v}</span>} />
                      </RePieChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-48 text-white/20 text-sm">Không có dữ liệu</div>}
                </div>
              </Card>
            </div>

            {/* Forecast table */}
            <Card>
              <CardHeader icon={CalendarDays} title="Dự báo hết hàng — dựa trên tiêu thụ 14 ngày" iconColor="text-violet-400" />
              {forecastData.length === 0 ? (
                <div className="py-10 text-center text-white/20 text-sm">Chưa đủ dữ liệu để dự báo (cần ít nhất 1 giao dịch tiêu thụ)</div>
              ) : (
                <div className="divide-y divide-white/4">
                  {forecastData.map(item => (
                    <div key={item.ingredient_id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/2 transition">
                      <div className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold ${
                        item.risk === 'critical' ? 'bg-red-500/20 text-red-400' :
                        item.risk === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {item.risk === 'critical' ? '🔴 NGUY CẤP' : item.risk === 'warning' ? '⚠️ CẢNH BÁO' : '✅ AN TOÀN'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{item.ingredient_name}</div>
                        <div className="text-xs text-white/30">Trung bình: {item.avgPerDay.toFixed(3)} {item.unit}/ngày · Tồn: {Number(item.current_stock).toFixed(2)} {item.unit}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.daysLeft != null ? (
                          <>
                            <div className={`text-sm font-bold ${item.risk === 'critical' ? 'text-red-400' : item.risk === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>còn {item.daysLeft} ngày</div>
                            <div className="text-xs text-white/25">Dự kiến hết: {item.runoutDate?.toLocaleDateString('vi-VN')}</div>
                          </>
                        ) : <span className="text-xs text-white/20">Ít dữ liệu</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: AUTO
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'auto' && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tổng trừ kho', value: liveDeductCount, icon: ArrowDownCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
                { label: 'Hoàn kho tự động', value: restoreCount, icon: RotateCcw, color: 'text-violet-400', bg: 'bg-violet-500/8 border-violet-500/15' },
                { label: 'Thành công', value: autoLogs.filter(l => l.status === 'success').length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-[#111519] border-white/6' },
                { label: 'Cần xem lại', value: autoLogs.filter(l => l.status === 'partial').length, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-[#111519] border-white/6' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className={`${s.bg} border rounded-xl p-3.5 flex items-center gap-3`}>
                    <Icon size={18} className={s.color} />
                    <div><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div><div className="text-xs text-white/30">{s.label}</div></div>
                  </div>
                );
              })}
            </div>

            {/* Log list */}
            <Card>
              <CardHeader icon={Zap} title="Nhật ký kho tự động" iconColor="text-amber-400"
                right={
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Đang lắng nghe
                    </span>
                    {autoLogs.length > 0 && (
                      <button onClick={() => { setAutoLogsP(() => []); setDeductCountP(() => 0); setRestoreCountP(() => 0); }}
                        className="text-xs text-red-400/70 hover:text-red-400 px-2.5 py-1 bg-red-500/8 hover:bg-red-500/15 rounded-lg transition border border-red-500/15">
                        Xóa log
                      </button>
                    )}
                  </div>
                } />

              {autoLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <Zap size={32} className="text-white/8 mx-auto mb-3" />
                  <p className="text-white/25 text-sm">Chưa có nhật ký</p>
                  <p className="text-white/15 text-xs mt-1">Đặt hoặc hủy đơn để xem kho tự động cập nhật</p>
                  {localRecipes.length === 0 && (
                    <button onClick={() => setActiveTab('recipes')} className="mt-4 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl text-xs font-medium hover:bg-orange-500/15 transition">
                      🍳 Thêm công thức để kho tự động trừ
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/4">
                  {autoLogs.map(log => (
                    <div key={log.id} className="px-5 py-3 hover:bg-white/2 transition cursor-pointer" onClick={() => setLogDetail(log)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          log.status === 'success' ? 'bg-emerald-500/12' :
                          log.status === 'restored' ? 'bg-violet-500/12' :
                          log.status === 'cancelled' ? 'bg-orange-500/12' : 'bg-amber-500/12'
                        }`}>
                          {log.status === 'success' ? <CheckCircle2 size={15} className="text-emerald-400" /> :
                           log.status === 'restored' ? <RotateCcw size={15} className="text-violet-400" /> :
                           log.status === 'cancelled' ? <XCircle size={15} className="text-orange-400" /> :
                           <AlertTriangle size={15} className="text-amber-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">Bàn {log.tableNumber} · Đơn #{log.orderId}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              log.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                              log.status === 'restored' ? 'text-violet-400 bg-violet-500/10' :
                              log.status === 'cancelled' ? 'text-orange-400 bg-orange-500/10' :
                              'text-amber-400 bg-amber-500/10'
                            }`}>
                              {log.status === 'success' ? '✅ Trừ kho' : log.status === 'restored' ? '↩️ Hoàn kho' : log.status === 'cancelled' ? '⚠️ Thủ công' : '⚠️ Một phần'}
                            </span>
                          </div>
                          <div className="text-xs text-white/30 mt-0.5">{log.message}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-white/20 hidden sm:block font-mono">{log.timestamp}</span>
                          <ChevronRight size={14} className="text-white/15" />
                        </div>
                      </div>
                      {log.deductions?.length > 0 && (
                        <div className="mt-2 ml-11 flex flex-wrap gap-1">
                          {log.deductions.slice(0, 5).map((d: any, i: number) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-lg font-mono ${d.restored ? 'bg-violet-500/10 text-violet-300' : d.warning ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-white/40'}`}>
                              {d.ingredient_name}: {d.deducted} {d.unit}
                            </span>
                          ))}
                          {log.deductions.length > 5 && <span className="text-xs text-white/20 px-1">+{log.deductions.length - 5}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ══════════════════════════ MODALS ══════════════════════════ */}

      {/* Log detail */}
      {logDetail && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setLogDetail(null)}>
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div><div className="text-white font-bold text-sm">Bàn {logDetail.tableNumber} · Đơn #{logDetail.orderId}</div><div className="text-xs text-white/30 mt-0.5">{logDetail.timestamp}</div></div>
              <button onClick={() => setLogDetail(null)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-2">
              <div className="text-xs text-white/30 mb-3 bg-white/3 rounded-xl p-3">{logDetail.message}</div>
              {logDetail.deductions.map((d: any, i: number) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${d.restored ? 'bg-violet-500/5 border-violet-500/15' : d.warning ? 'bg-amber-500/5 border-amber-500/15' : d.local ? 'bg-orange-500/5 border-orange-500/15' : 'bg-white/3 border-white/6'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${d.restored ? 'text-violet-300' : d.warning ? 'text-amber-300' : d.local ? 'text-orange-300' : 'text-white/80'}`}>{d.ingredient_name}</span>
                    {d.local && <span className="text-xs bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded font-medium">CT local</span>}
                    {d.restored && <span className="text-xs bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded font-medium">↩️ hoàn</span>}
                  </div>
                  <span className={`font-mono font-bold text-sm ${d.restored ? 'text-violet-400' : d.warning ? 'text-amber-400' : d.local ? 'text-orange-400' : 'text-red-300'}`}>{d.deducted} {d.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ RECIPE MANAGER MODAL ══════════ */}
      {showRecipeManagerModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">
                <UtensilsCrossed size={16} className="text-orange-400" />
                {editingRecipe ? `Sửa công thức: ${editingRecipe.dishName}` : 'Thêm công thức mới'}
              </h2>
              <button onClick={() => { setShowRecipeManagerModal(false); setEditingRecipe(null); }}>
                <XCircle size={20} className="text-white/25 hover:text-white/60 transition" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Dish info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Tên món *</label>
                  <input
                    type="text"
                    value={recipeForm.dishName}
                    onChange={e => setRecipeForm({ ...recipeForm, dishName: e.target.value })}
                    placeholder="VD: Phở gà — phải khớp chính xác tên trong đơn hàng"
                    className="w-full bg-black/30 border border-white/8 focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition placeholder-white/15"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Tên thay thế (alias) — cách nhau bằng dấu phẩy</label>
                  <input
                    type="text"
                    value={recipeForm.aliases}
                    onChange={e => setRecipeForm({ ...recipeForm, aliases: e.target.value })}
                    placeholder="VD: pho ga, Phở Gà, PHO GA"
                    className="w-full bg-black/30 border border-white/8 focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition placeholder-white/15"
                  />
                  <p className="text-xs text-white/20 mt-1">Thêm alias để khớp dù viết hoa/thường hay dấu khác nhau</p>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-white/40 font-medium uppercase tracking-wider">Nguyên liệu cần dùng *</label>
                  <button
                    onClick={() => setRecipeIngForms(p => [...p, { ingredientId: '', ingredientName: '', unit: '', quantity: '', wasteFactor: '1' }])}
                    className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 bg-orange-500/8 hover:bg-orange-500/15 px-2.5 py-1.5 rounded-lg transition border border-orange-500/15"
                  >
                    <Plus size={12} />Thêm nguyên liệu
                  </button>
                </div>

                <div className="space-y-2.5">
                  {recipeIngForms.map((f, i) => (
                    <div key={i} className="bg-black/25 border border-white/5 rounded-xl p-3">
                      <div className="grid grid-cols-12 gap-2 items-start">
                        {/* Ingredient picker */}
                        <div className="col-span-12 sm:col-span-5">
                          <label className="block text-xs text-white/25 mb-1">Nguyên liệu</label>
                          <input
                            type="text"
                            list={`ing-list-${i}`}
                            value={f.ingredientName}
                            onChange={e => {
                              const name = e.target.value;
                              const matched = ingredients.find(ing => ing.ingredient_name === name);
                              setRecipeIngForms(p => p.map((row, idx) => idx === i ? {
                                ...row,
                                ingredientName: name,
                                ingredientId: matched ? String(matched.ingredient_id) : row.ingredientId,
                                unit: matched ? matched.unit : row.unit,
                              } : row));
                            }}
                            placeholder="Chọn hoặc nhập tên..."
                            className="w-full bg-black/40 border border-white/8 focus:border-orange-500/40 rounded-lg px-2.5 py-2 text-white text-xs outline-none transition placeholder-white/15"
                          />
                          <datalist id={`ing-list-${i}`}>
                            {ingredients.map(ing => <option key={ing.ingredient_id} value={ing.ingredient_name} />)}
                          </datalist>
                          {f.ingredientId && (
                            <p className="text-xs text-emerald-400/60 mt-0.5">✓ ID #{f.ingredientId}</p>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className="block text-xs text-white/25 mb-1">Số lượng</label>
                          <input
                            type="number" min="0" step="0.001"
                            value={f.quantity}
                            onChange={e => setRecipeIngForms(p => p.map((row, idx) => idx === i ? { ...row, quantity: e.target.value } : row))}
                            placeholder="0"
                            className="w-full bg-black/40 border border-white/8 focus:border-orange-500/40 rounded-lg px-2.5 py-2 text-white text-xs font-mono outline-none transition placeholder-white/15"
                          />
                        </div>

                        {/* Unit */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className="block text-xs text-white/25 mb-1">Đơn vị</label>
                          <input
                            type="text"
                            value={f.unit}
                            onChange={e => setRecipeIngForms(p => p.map((row, idx) => idx === i ? { ...row, unit: e.target.value } : row))}
                            placeholder="g, ml, cái..."
                            className="w-full bg-black/40 border border-white/8 focus:border-orange-500/40 rounded-lg px-2.5 py-2 text-white text-xs outline-none transition placeholder-white/15"
                          />
                        </div>

                        {/* Waste factor */}
                        <div className="col-span-3 sm:col-span-2">
                          <label className="block text-xs text-white/25 mb-1">Hao hụt ×</label>
                          <input
                            type="number" min="1" step="0.01"
                            value={f.wasteFactor}
                            onChange={e => setRecipeIngForms(p => p.map((row, idx) => idx === i ? { ...row, wasteFactor: e.target.value } : row))}
                            placeholder="1.0"
                            className="w-full bg-black/40 border border-white/8 focus:border-orange-500/40 rounded-lg px-2.5 py-2 text-white text-xs font-mono outline-none transition"
                          />
                        </div>

                        {/* Delete */}
                        <div className="col-span-1 flex items-end pb-0.5">
                          <button
                            onClick={() => setRecipeIngForms(p => p.filter((_, idx) => idx !== i))}
                            className="w-full h-8 flex items-center justify-center bg-red-500/8 hover:bg-red-500/18 text-red-400/60 hover:text-red-400 rounded-lg transition mt-5"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Preview actual usage */}
                      {f.quantity && f.unit && (
                        <div className="mt-2 text-xs text-white/25 pl-0.5">
                          → Thực dùng: <span className="text-orange-400 font-mono">{(+f.quantity * (+f.wasteFactor || 1)).toFixed(4)} {f.unit}</span> mỗi phần
                          {f.wasteFactor && +f.wasteFactor > 1 && <span className="text-white/20 ml-1">(bao gồm {((+f.wasteFactor - 1) * 100).toFixed(0)}% hao hụt)</span>}
                        </div>
                      )}
                    </div>
                  ))}

                  {recipeIngForms.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-white/8 rounded-xl">
                      <p className="text-white/20 text-xs">Nhấn "Thêm nguyên liệu" để bắt đầu</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Ghi chú</label>
                <input
                  type="text"
                  value={recipeForm.notes}
                  onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                  placeholder="Lưu ý khi chế biến..."
                  className="w-full bg-black/30 border border-white/8 focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition placeholder-white/15"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-white/5">
              <button onClick={() => { setShowRecipeManagerModal(false); setEditingRecipe(null); }}
                className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">
                Hủy
              </button>
              <button onClick={handleSaveRecipe}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-orange-500/15">
                {editingRecipe ? '✏️ Cập nhật' : '✅ Lưu công thức'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add ingredient */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><Plus size={17} className="text-emerald-400" />Thêm nguyên liệu</h2>
              <button onClick={() => setShowAddModal(false)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ingredient_name', label: 'Tên nguyên liệu *', placeholder: 'VD: Thịt bò Úc', span: 2 },
                { key: 'unit', label: 'Đơn vị *', placeholder: 'Kg, Lít...' },
                { key: 'unit_cost', label: 'Giá nhập (đ)', placeholder: '0', type: 'number' },
                { key: 'current_stock', label: 'Tồn ban đầu', placeholder: '0', type: 'number' },
                { key: 'min_threshold', label: 'Ngưỡng min', placeholder: '0', type: 'number' },
                { key: 'max_threshold', label: 'Ngưỡng max', placeholder: '0', type: 'number' },
                { key: 'supplier', label: 'Nhà cung cấp', placeholder: 'Tên NCC', span: 2 },
              ].map(f => (
                <div key={f.key} className={(f as any).span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs text-white/30 mb-1.5">{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder}
                    value={(newIng as any)[f.key]} onChange={e => setNewIng({ ...newIng, [f.key]: e.target.value })}
                    className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">Hủy</button>
              <button onClick={handleCreateIng} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-emerald-500/15">✅ Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* Restock */}
      {showRestockModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><ArrowUpCircle size={17} className="text-emerald-400" />Nhập kho</h2>
              <button onClick={() => setShowRestockModal(false)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="bg-black/30 rounded-xl p-3 mb-4 flex justify-between text-xs">
              <span className="text-white/40">{selectedIngredient.ingredient_name}</span>
              <span className="text-white font-bold">Tồn: {selectedIngredient.current_stock} {selectedIngredient.unit}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Số lượng nhập ({selectedIngredient.unit}) *</label>
                <input type="number" min="0" value={restockQty} onChange={e => setRestockQty(e.target.value)} autoFocus
                  className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-3 text-white text-xl font-bold outline-none transition placeholder-white/10" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Ghi chú</label>
                <input type="text" value={restockNotes} onChange={e => setRestockNotes(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" placeholder="VD: Nhập từ NCC ABC" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRestockModal(false)} className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">Hủy</button>
              <button onClick={handleRestock} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition">📥 Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust */}
      {showAdjustModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><Settings size={17} className="text-blue-400" />Điều chỉnh tồn kho</h2>
              <button onClick={() => setShowAdjustModal(false)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="bg-black/30 rounded-xl p-3 mb-4 flex justify-between text-xs">
              <span className="text-white/40">{selectedIngredient.ingredient_name}</span>
              <span className="text-white font-bold">Hệ thống: {selectedIngredient.current_stock} {selectedIngredient.unit}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Tồn thực tế ({selectedIngredient.unit}) *</label>
                <input type="number" min="0" step="0.001" value={adjustStock} onChange={e => setAdjustStock(e.target.value)} autoFocus
                  className="w-full bg-black/30 border border-white/8 focus:border-blue-500/40 rounded-xl px-3 py-2.5 text-white text-lg font-bold outline-none transition" />
                {adjustStock !== '' && (
                  <p className={`text-xs mt-1 ${+adjustStock - selectedIngredient.current_stock >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Chênh lệch: {+adjustStock - selectedIngredient.current_stock >= 0 ? '+' : ''}{(+adjustStock - selectedIngredient.current_stock).toFixed(3)} {selectedIngredient.unit}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Giá nhập mới (đ/{selectedIngredient.unit})</label>
                <input type="number" min="0" value={adjustUnitCost} onChange={e => setAdjustUnitCost(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 focus:border-blue-500/40 rounded-xl px-3 py-2.5 text-white text-lg font-bold outline-none transition placeholder-white/15" placeholder="Không đổi" />
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Lý do *</label>
                <input type="text" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 focus:border-blue-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" placeholder="VD: Kiểm kê tháng 2" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdjustModal(false)} className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">Hủy</button>
              <button onClick={handleAdjust} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition">⚖️ Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe */}
      {showRecipeModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="font-bold text-white text-sm flex items-center gap-2"><BookOpen size={17} className="text-purple-400" />Công thức: {selectedIngredient.ingredient_name}</h2>
              <button onClick={() => setShowRecipeModal(false)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-2">
              {recipeItems.length === 0 ? <div className="text-center py-12 text-white/20 text-sm"><BookOpen size={28} className="mx-auto mb-2 opacity-20" />Chưa có công thức</div>
                : recipeItems.map(r => (
                  <div key={r.recipe_item_id} className="bg-black/20 border border-white/6 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-white font-medium text-sm">{r.ingredient_name}</div>
                      <span className={`px-2 py-0.5 rounded text-xs ${r.ingredient_availability === 'AVAILABLE' ? 'text-emerald-400 bg-emerald-500/10' : r.ingredient_availability === 'LOW' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'}`}>{r.ingredient_availability}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-white/30">
                      <div>Cần: <span className="text-white font-mono">{r.quantity_required}{r.unit}</span></div>
                      <div>Hao hụt: <span className="text-white">×{r.waste_factor}</span></div>
                      <div>Thực dùng: <span className="text-amber-400 font-mono">{r.actual_usage}{r.unit}</span></div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Create purchase */}
      {showCreatePurchaseModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><ClipboardList size={17} className="text-purple-400" />Tạo phiếu nhập</h2>
              <button onClick={() => setShowCreatePurchaseModal(false)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Chọn nguyên liệu *</label>
                <select value={purchaseIngId} onChange={e => setPurchaseIngId(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 focus:border-purple-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition">
                  <option value="">-- Chọn --</option>
                  {ingredients.map(i => <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name} ({i.current_stock} {i.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Số lượng *</label>
                <input type="number" min="0" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 focus:border-purple-500/40 rounded-xl px-3 py-3 text-white text-xl font-bold outline-none transition placeholder-white/10" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Ghi chú</label>
                <input type="text" value={purchaseNotes} onChange={e => setPurchaseNotes(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 focus:border-purple-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" placeholder="Lý do..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreatePurchaseModal(false)} className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">Hủy</button>
              <button onClick={handleCreatePurchase} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium text-sm transition">📋 Tạo phiếu</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><Building2 size={17} className="text-cyan-400" />{editingSupplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h2>
              <button onClick={() => { setShowAddSupplierModal(false); setEditingSupplier(null); }}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Tên NCC *', placeholder: 'VD: Cty TNHH ABC', span: 2 },
                { key: 'contactPerson', label: 'Người liên hệ', placeholder: 'Họ tên' },
                { key: 'phone', label: 'Điện thoại', placeholder: '0909...' },
                { key: 'email', label: 'Email', placeholder: 'abc@email.com', span: 2 },
                { key: 'address', label: 'Địa chỉ', placeholder: 'Địa chỉ NCC', span: 2 },
                { key: 'notes', label: 'Ghi chú', placeholder: 'Điều kiện thanh toán, giao hàng...', span: 2 },
              ].map(f => (
                <div key={f.key} className={(f as any).span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs text-white/30 mb-1.5">{f.label}</label>
                  <input type="text" placeholder={f.placeholder}
                    value={(supplierForm as any)[f.key]} onChange={e => setSupplierForm({ ...supplierForm, [f.key]: e.target.value })}
                    className="w-full bg-black/30 border border-white/8 focus:border-cyan-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-1.5">Đánh giá</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setSupplierForm({ ...supplierForm, rating: String(s) })}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${+supplierForm.rating >= s ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-white/20 border border-white/5'}`}>
                      {'★'.repeat(s)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAddSupplierModal(false); setEditingSupplier(null); }} className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">Hủy</button>
              <button onClick={handleSaveSupplier} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium text-sm transition">✅ Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Add price history */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#111519] border border-white/8 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><TrendingUp size={17} className="text-emerald-400" />Ghi lịch sử giá — {showPriceModal.name}</h2>
              <button onClick={() => setShowPriceModal(null)}><XCircle size={20} className="text-white/25 hover:text-white/60 transition" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Nguyên liệu *</label>
                <input type="text" list="ing-list" value={priceForm.ingredientName} onChange={e => setPriceForm({ ...priceForm, ingredientName: e.target.value })}
                  className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" placeholder="Tên nguyên liệu" />
                <datalist id="ing-list">{ingredients.map(i => <option key={i.ingredient_id} value={i.ingredient_name} />)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/30 mb-1.5">Giá nhập (đ) *</label>
                  <input type="number" min="0" value={priceForm.unitCost} onChange={e => setPriceForm({ ...priceForm, unitCost: e.target.value })}
                    className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2.5 text-white text-lg font-bold outline-none transition placeholder-white/10" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-white/30 mb-1.5">Đơn vị</label>
                  <input type="text" value={priceForm.unit} onChange={e => setPriceForm({ ...priceForm, unit: e.target.value })}
                    className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2.5 text-white outline-none transition placeholder-white/15" placeholder="kg, lít..." />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-1.5">Số lượng nhập</label>
                <input type="number" min="0" value={priceForm.quantity} onChange={e => setPriceForm({ ...priceForm, quantity: e.target.value })}
                  className="w-full bg-black/30 border border-white/8 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white text-sm outline-none transition placeholder-white/15" placeholder="0" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPriceModal(null)} className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/8 transition">Hủy</button>
              <button onClick={() => handleAddPrice(showPriceModal)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition">📊 Lưu giá</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes toastIn {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default InventoryManagement;