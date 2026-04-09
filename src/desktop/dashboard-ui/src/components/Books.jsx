import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, alpha, Button, IconButton, Chip, Tooltip,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Checkbox, Snackbar, LinearProgress, Avatar,
  CircularProgress
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import CategoryIcon from '@mui/icons-material/Category';
import SearchIcon from '@mui/icons-material/Search';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import { BRAND } from '../theme';

const API = 'http://localhost:3333';

// ── Stat Card ──────────────────────────────────────────────

function StatCard({ label, value, icon, color, subtitle }) {
  return (
    <Paper sx={{ p: 2.5, flex: 1, minWidth: 140 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 40, height: 40, background: alpha(color || BRAND.primary, 0.15), color: color || BRAND.primaryLight }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="h5" fontWeight={700} color={color || BRAND.textPrimary}>{value}</Typography>
          <Typography variant="caption" color={BRAND.textMuted}>{label}</Typography>
          {subtitle && <Typography variant="caption" display="block" color={BRAND.textMuted} sx={{ fontSize: 10 }}>{subtitle}</Typography>}
        </Box>
      </Box>
    </Paper>
  );
}

// ── Category Bar ───────────────────────────────────────────

function CategoryBar({ categories, total }) {
  if (!categories || Object.keys(categories).length === 0) return null;

  const sorted = Object.entries(categories)
    .filter(([k]) => k !== 'uncategorized' && k !== 'income')
    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
    .slice(0, 10);

  const maxVal = Math.max(...sorted.map(([, v]) => Math.abs(v.total)), 1);

  const catColors = {
    office_expenses: '#6C5CE7', software_subscriptions: '#A29BFE', meals: '#FD79A8',
    travel: '#00CEC9', car_and_truck: '#FDCB6E', advertising: '#74B9FF',
    contract_labor: '#55EFC4', supplies: '#FF7675', insurance: '#DFE6E9',
    utilities: '#81ECEC',
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" color={BRAND.textSecondary} sx={{ mb: 1.5 }}>Top Expense Categories</Typography>
      {sorted.map(([key, val]) => (
        <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
          <Typography variant="caption" color={BRAND.textMuted} sx={{ width: 140, textAlign: 'right', flexShrink: 0, fontSize: 11 }}>
            {key.replace(/_/g, ' ')}
          </Typography>
          <Box sx={{ flex: 1, height: 18, borderRadius: 1, background: alpha(BRAND.border, 0.3), overflow: 'hidden' }}>
            <Box sx={{
              height: '100%',
              width: `${(Math.abs(val.total) / maxVal) * 100}%`,
              borderRadius: 1,
              background: catColors[key] || BRAND.primaryLight,
              minWidth: 4,
            }} />
          </Box>
          <Typography variant="caption" color={BRAND.textSecondary} sx={{ width: 80, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>
            ${Math.abs(val.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Main Books Component ───────────────────────────────────

export default function Books() {
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [statements, setStatements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [report, setReport] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [snack, setSnack] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Multi-select for bulk category assignment
  const [selected, setSelected] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState('');

  // Dialogs
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [mileageOpen, setMileageOpen] = useState(false);
  const [bulkMileageOpen, setBulkMileageOpen] = useState(false);

  // Form state
  const [expenseForm, setExpenseForm] = useState({ date: '', description: '', amount: '', category: 'other_expenses' });
  const [mileageForm, setMileageForm] = useState({ date: '', miles: '', purpose: '' });
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [bulkMileage, setBulkMileage] = useState(() => MONTHS.map((_, i) => ({ month: i + 1, miles: '', purpose: '' })));
  const [bulkPurpose, setBulkPurpose] = useState('Business driving');

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // ── Data Loading ─────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/finance/summary?year=${year}`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {}
  }, [year]);

  const loadTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ year });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`${API}/api/finance/transactions?${params}`);
      const json = await res.json();
      if (json.success) setTransactions(json.data);
    } catch {}
  }, [year, search, categoryFilter]);

  const loadMileage = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/finance/mileage?year=${year}`);
      const json = await res.json();
      if (json.success) setMileage(json.data);
    } catch {}
  }, [year]);

  const loadStatements = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/finance/statements`);
      const json = await res.json();
      if (json.success) setStatements(json.data);
    } catch {}
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/finance/categories`);
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadStats();
    loadTransactions();
    loadMileage();
    loadStatements();
    loadCategories();
  }, [loadStats, loadTransactions, loadMileage, loadStatements, loadCategories]);

  // ── File Upload ──────────────────────────────────────────

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'pdf', 'ofx', 'qfx'].includes(ext)) {
      setSnack('Unsupported file type. Use .csv, .pdf, .ofx, or .qfx');
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch(`${API}/api/finance/upload`, {
        method: 'POST',
        headers: { 'x-filename': encodeURIComponent(file.name) },
        body: buffer,
      });
      const json = await res.json();
      if (json.success) {
        setSnack(`Imported ${json.data.transactionCount} transactions from ${file.name}`);
        loadStats();
        loadTransactions();
        loadStatements();
      } else {
        setSnack(`Upload failed: ${json.error}`);
      }
    } catch (err) {
      setSnack(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, [loadStats, loadTransactions, loadStatements]);

  // Drag & drop
  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  // ── AI Categorize ────────────────────────────────────────

  const handleCategorize = useCallback(async () => {
    setCategorizing(true);
    try {
      const res = await fetch(`${API}/api/finance/categorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json();
      if (json.success) {
        setSnack(`Categorized ${json.data.categorized} of ${json.data.total} transactions`);
        loadTransactions();
        loadStats();
      } else {
        setSnack(`Categorization failed: ${json.error}`);
      }
    } catch (err) {
      setSnack(`Error: ${err.message}`);
    } finally {
      setCategorizing(false);
    }
  }, [loadTransactions, loadStats]);

  // ── Transaction Actions ──────────────────────────────────

  const handleTogglePersonal = useCallback(async (id, current) => {
    try {
      await fetch(`${API}/api/finance/transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal: !current }),
      });
      loadTransactions();
      loadStats();
    } catch {}
  }, [loadTransactions, loadStats]);

  const handleUpdateCategory = useCallback(async (id, category) => {
    try {
      await fetch(`${API}/api/finance/transaction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      loadTransactions();
      loadStats();
    } catch {}
  }, [loadTransactions, loadStats]);

  const handleDeleteTransaction = useCallback(async (id) => {
    try {
      await fetch(`${API}/api/finance/transaction/${id}`, { method: 'DELETE' });
      loadTransactions();
      loadStats();
    } catch {}
  }, [loadTransactions, loadStats]);

  // ── Bulk Category Assign ─────────────────────────────────

  const handleToggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map(t => t.id)));
    }
  }, [selected, transactions]);

  const handleBulkCategoryAssign = useCallback(async (category) => {
    if (!category || selected.size === 0) return;
    try {
      await Promise.all([...selected].map(id =>
        fetch(`${API}/api/finance/transaction/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category }),
        })
      ));
      setSnack(`Updated ${selected.size} transactions to "${category.replace(/_/g, ' ')}"`);
      setSelected(new Set());
      setBulkCategory('');
      loadTransactions();
      loadStats();
    } catch (err) {
      setSnack(`Error: ${err.message}`);
    }
  }, [selected, loadTransactions, loadStats]);

  // ── Manual Expense ───────────────────────────────────────

  const handleAddExpense = useCallback(async () => {
    if (!expenseForm.date || !expenseForm.description || !expenseForm.amount) return;
    try {
      const res = await fetch(`${API}/api/finance/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: expenseForm.date,
          description: expenseForm.description,
          amount: -Math.abs(parseFloat(expenseForm.amount)),
          category: expenseForm.category,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSnack('Expense added');
        setExpenseOpen(false);
        setExpenseForm({ date: '', description: '', amount: '', category: 'other_expenses' });
        loadTransactions();
        loadStats();
      }
    } catch (err) {
      setSnack(`Error: ${err.message}`);
    }
  }, [expenseForm, loadTransactions, loadStats]);

  // ── Mileage ──────────────────────────────────────────────

  const handleAddMileage = useCallback(async () => {
    if (!mileageForm.date || !mileageForm.miles) return;
    try {
      const res = await fetch(`${API}/api/finance/mileage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mileageForm),
      });
      const json = await res.json();
      if (json.success) {
        setSnack('Mileage entry added');
        setMileageOpen(false);
        setMileageForm({ date: '', miles: '', purpose: '' });
        loadMileage();
        loadStats();
      }
    } catch (err) {
      setSnack(`Error: ${err.message}`);
    }
  }, [mileageForm, loadMileage, loadStats]);

  const handleDeleteMileage = useCallback(async (id) => {
    try {
      await fetch(`${API}/api/finance/mileage/${id}`, { method: 'DELETE' });
      loadMileage();
      loadStats();
    } catch {}
  }, [loadMileage, loadStats]);

  const handleBulkMileage = useCallback(async () => {
    const entries = bulkMileage
      .filter(e => e.miles && Number(e.miles) > 0)
      .map(e => ({ month: e.month, miles: Number(e.miles), purpose: e.purpose || bulkPurpose }));
    if (entries.length === 0) return;
    try {
      const res = await fetch(`${API}/api/finance/mileage/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, year }),
      });
      const json = await res.json();
      if (json.success) {
        setSnack(`Added ${json.data.added} monthly mileage entries`);
        setBulkMileageOpen(false);
        setBulkMileage(MONTHS.map((_, i) => ({ month: i + 1, miles: '', purpose: '' })));
        loadMileage();
        loadStats();
      } else {
        setSnack(`Error: ${json.error}`);
      }
    } catch (err) {
      setSnack(`Error: ${err.message}`);
    }
  }, [bulkMileage, bulkPurpose, year, loadMileage, loadStats]);

  // ── Report / Export ──────────────────────────────────────

  const handleGenerateReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/finance/report?year=${year}`);
      const json = await res.json();
      if (json.success) setReport(json.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [year]);

  const handleExportCSV = useCallback(() => {
    window.open(`${API}/api/finance/export?year=${year}`, '_blank');
  }, [year]);

  // ── Delete Statement ─────────────────────────────────────

  const handleDeleteStatement = useCallback(async (id) => {
    try {
      await fetch(`${API}/api/finance/statements/${id}`, { method: 'DELETE' });
      setSnack('Statement and its transactions removed');
      loadStatements();
      loadTransactions();
      loadStats();
    } catch {}
  }, [loadStatements, loadTransactions, loadStats]);

  // ── Helpers ──────────────────────────────────────────────

  const fmt = (n) => {
    if (n === undefined || n === null) return '$0.00';
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const yearOptions = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) yearOptions.push(y);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Books</Typography>
          <Typography variant="body2" color={BRAND.textMuted}>Tax prep & bookkeeping — everything stays on your machine</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select value={year} onChange={(e) => setYear(e.target.value)} size="small">
              {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => fileInputRef.current?.click()}>
            Upload Statement
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.pdf,.ofx,.qfx" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
        </Box>
      </Box>

      {uploading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
        <Tab icon={<DashboardIcon />} iconPosition="start" label="Dashboard" />
        <Tab icon={<ReceiptIcon />} iconPosition="start" label="Transactions" />
        <Tab icon={<DirectionsCarIcon />} iconPosition="start" label="Mileage" />
        <Tab icon={<AssessmentIcon />} iconPosition="start" label="Reports" />
      </Tabs>

      {/* ── Tab 0: Dashboard ─────────────────────────────── */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <StatCard label="Total Income" value={fmt(stats?.income)} icon={<TrendingUpIcon />} color={BRAND.success} />
            <StatCard label="Total Expenses" value={fmt(stats?.expenses ? -stats.expenses : 0)} icon={<TrendingDownIcon />} color={BRAND.error} />
            <StatCard label="Net Profit/Loss" value={fmt(stats?.net)} icon={<AttachMoneyIcon />} color={stats?.net >= 0 ? BRAND.success : BRAND.error} />
            <StatCard label="Mileage Deduction" value={fmt(stats?.mileageDeduction ? -stats.mileageDeduction : 0)} icon={<DirectionsCarIcon />} color={BRAND.info} subtitle={stats?.totalMiles ? `${stats.totalMiles} miles` : null} />
            <StatCard label="Uncategorized" value={stats?.uncategorized || 0} icon={<HelpOutlineIcon />} color={stats?.uncategorized > 0 ? BRAND.warning : BRAND.textMuted} />
          </Box>

          {stats?.categories && <CategoryBar categories={stats.categories} total={stats.expenses} />}

          {/* Statements list */}
          {statements.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color={BRAND.textSecondary} sx={{ mb: 1 }}>Uploaded Statements</Typography>
              {statements.map(s => (
                <Paper key={s.id} sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <DescriptionIcon sx={{ color: BRAND.primaryLight, fontSize: 20 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{s.filename}</Typography>
                    <Typography variant="caption" color={BRAND.textMuted}>
                      {s.transactionCount} transactions | {s.dateRange?.from} to {s.dateRange?.to} | {new Date(s.uploadedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Tooltip title="Delete statement & transactions">
                    <IconButton size="small" onClick={() => handleDeleteStatement(s.id)} sx={{ color: BRAND.textMuted }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              ))}
            </Box>
          )}

          {/* Empty state */}
          {(!stats || stats.totalTransactions === 0) && (
            <Paper
              ref={dropRef}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              sx={{
                mt: 3, p: 5, textAlign: 'center',
                border: `2px dashed ${BRAND.border}`,
                background: alpha(BRAND.bgCard, 0.5),
                cursor: 'pointer',
                '&:hover': { borderColor: BRAND.primary, background: alpha(BRAND.primary, 0.05) },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 1 }} />
              <Typography variant="h6" color={BRAND.textSecondary}>Drop a bank statement here</Typography>
              <Typography variant="body2" color={BRAND.textMuted}>or click to browse — supports CSV, PDF, OFX/QFX</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* ── Tab 1: Transactions ──────────────────────────── */}
      {tab === 1 && (
        <Box>
          {/* Upload zone */}
          <Paper
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            sx={{
              p: 2, mb: 2, textAlign: 'center',
              border: `2px dashed ${BRAND.border}`,
              background: alpha(BRAND.bgCard, 0.3),
              cursor: 'pointer',
              '&:hover': { borderColor: BRAND.primary },
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUploadIcon sx={{ fontSize: 28, color: BRAND.textMuted, mr: 1, verticalAlign: 'middle' }} />
            <Typography variant="body2" color={BRAND.textMuted} display="inline">
              Drop or click to upload a bank statement (CSV, PDF, OFX)
            </Typography>
          </Paper>

          {/* Toolbar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small" placeholder="Search transactions..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, color: BRAND.textMuted, fontSize: 18 }} /> }}
              sx={{ minWidth: 220 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Category</InputLabel>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} label="Category">
                <MenuItem value="">All Categories</MenuItem>
                {categories.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small" variant="outlined" startIcon={categorizing ? <CircularProgress size={14} /> : <CategoryIcon />}
              onClick={handleCategorize} disabled={categorizing}
            >
              {categorizing ? 'Categorizing...' : 'AI Categorize'}
            </Button>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setExpenseOpen(true)}>
              Add Expense
            </Button>
          </Box>

          {/* Bulk action bar — shows when items are selected */}
          {selected.size > 0 && (
            <Paper sx={{ p: 1.5, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, background: alpha(BRAND.primary, 0.08), border: `1px solid ${alpha(BRAND.primary, 0.25)}` }}>
              <Chip label={`${selected.size} selected`} size="small" color="primary" />
              <Typography variant="body2" color={BRAND.textSecondary} sx={{ fontSize: 13 }}>Assign category:</Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={bulkCategory} displayEmpty
                  onChange={(e) => { setBulkCategory(e.target.value); handleBulkCategoryAssign(e.target.value); }}
                  sx={{ fontSize: 12, height: 32 }}
                >
                  <MenuItem value="" disabled sx={{ fontSize: 12 }}>Pick a category...</MenuItem>
                  {categories.map(c => <MenuItem key={c.key} value={c.key} sx={{ fontSize: 12 }}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => setSelected(new Set())} sx={{ fontSize: 12 }}>Clear</Button>
            </Paper>
          )}

          {/* Transaction Table */}
          <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40, p: 0.5 }} align="center">
                    <Checkbox size="small" checked={transactions.length > 0 && selected.size === transactions.length} indeterminate={selected.size > 0 && selected.size < transactions.length} onChange={handleSelectAll} sx={{ p: 0 }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 110 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 180 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 70 }} align="center">Personal</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 70 }} align="center">Source</TableCell>
                  <TableCell sx={{ width: 40 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: BRAND.textMuted }}>No transactions yet — upload a statement above</TableCell></TableRow>
                ) : transactions.map(txn => (
                  <TableRow key={txn.id} sx={{ '&:hover': { background: alpha(BRAND.primary, 0.04) }, ...(selected.has(txn.id) ? { background: alpha(BRAND.primary, 0.06) } : {}) }}>
                    <TableCell sx={{ p: 0.5 }} align="center">
                      <Checkbox size="small" checked={selected.has(txn.id)} onChange={() => handleToggleSelect(txn.id)} sx={{ p: 0 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: BRAND.textMuted }}>{txn.date}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>{txn.description}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: txn.amount >= 0 ? BRAND.success : BRAND.error, fontFamily: 'monospace' }}>
                      {fmt(txn.amount)}
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small" fullWidth
                        value={txn.category || 'uncategorized'}
                        onChange={(e) => handleUpdateCategory(txn.id, e.target.value)}
                        sx={{ fontSize: 11, height: 28, '& .MuiSelect-select': { py: 0.3 } }}
                      >
                        {categories.map(c => <MenuItem key={c.key} value={c.key} sx={{ fontSize: 12 }}>{c.label}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        size="small" checked={!!txn.personal}
                        onChange={() => handleTogglePersonal(txn.id, txn.personal)}
                        sx={{ p: 0 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={txn.source || 'stmt'} size="small" sx={{ height: 20, fontSize: 10, background: alpha(BRAND.border, 0.5) }} />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleDeleteTransaction(txn.id)} sx={{ color: BRAND.textMuted, opacity: 0.5, '&:hover': { opacity: 1, color: BRAND.error } }}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {transactions.length > 0 && (
            <Typography variant="caption" color={BRAND.textMuted} sx={{ mt: 1, display: 'block' }}>
              {transactions.length} transactions shown
            </Typography>
          )}
        </Box>
      )}

      {/* ── Tab 2: Mileage ───────────────────────────────── */}
      {tab === 2 && (
        <Box>
          {/* Summary */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <StatCard
              label="Total Miles"
              value={stats?.totalMiles?.toLocaleString() || '0'}
              icon={<DirectionsCarIcon />}
              color={BRAND.info}
            />
            <StatCard
              label="Mileage Deduction"
              value={fmt(stats?.mileageDeduction ? -stats.mileageDeduction : 0)}
              icon={<AttachMoneyIcon />}
              color={BRAND.success}
              subtitle="$0.70/mile (2025 IRS rate)"
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBulkMileageOpen(true)}>
              Monthly Bulk Entry
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setMileageOpen(true)}>
              Add Single Trip
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 110 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 80 }} align="right">Miles</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }} align="right">Deduction</TableCell>
                  <TableCell sx={{ width: 40 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mileage.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: BRAND.textMuted }}>No mileage entries — click "Add Mileage Entry" to start tracking</TableCell></TableRow>
                ) : mileage.map(m => (
                  <TableRow key={m.id}>
                    <TableCell sx={{ fontSize: 12, color: BRAND.textMuted }}>{m.date}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{m.miles}</TableCell>
                    <TableCell>{m.purpose}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', color: BRAND.success }}>{fmt(-m.amount)}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleDeleteMileage(m.id)} sx={{ color: BRAND.textMuted, opacity: 0.5, '&:hover': { opacity: 1, color: BRAND.error } }}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ── Tab 3: Reports ───────────────────────────────── */}
      {tab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <Button
              variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <AssessmentIcon />}
              onClick={handleGenerateReport} disabled={loading}
            >
              Generate CPA Report
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
              Download CSV
            </Button>
          </Box>

          {report && (
            <Box>
              {/* Summary Cards */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <StatCard label="Gross Income" value={fmt(report.summary.grossIncome)} icon={<TrendingUpIcon />} color={BRAND.success} />
                <StatCard label="Total Expenses" value={fmt(-report.summary.totalExpenses)} icon={<TrendingDownIcon />} color={BRAND.error} />
                <StatCard label="Net Profit" value={fmt(report.summary.netProfit)} icon={<AttachMoneyIcon />} color={report.summary.netProfit >= 0 ? BRAND.success : BRAND.error} />
                <StatCard label="Mileage" value={fmt(-report.summary.mileageDeduction)} icon={<DirectionsCarIcon />} color={BRAND.info} subtitle={`${report.summary.totalMiles} mi x $${report.summary.mileageRate}/mi`} />
              </Box>

              {/* Schedule C Breakdown */}
              <Typography variant="h6" sx={{ mb: 1.5 }}>Schedule C Category Breakdown</Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 100 }}>Sched. C Line</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 120 }} align="right">Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 80 }} align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.categories.map(cat => (
                      <TableRow key={cat.category}>
                        <TableCell>{cat.label}</TableCell>
                        <TableCell>Line {cat.scheduleCLine}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontFamily: 'monospace', color: cat.total >= 0 ? BRAND.success : BRAND.error }}>
                          {fmt(cat.total)}
                        </TableCell>
                        <TableCell align="right">{cat.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color={BRAND.textMuted}>
                Generated {new Date(report.generatedAt).toLocaleString()} | {report.transactionCount} business transactions | {report.personalExcluded} personal excluded
              </Typography>
            </Box>
          )}

          {!report && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <AssessmentIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 1 }} />
              <Typography color={BRAND.textMuted}>Click "Generate CPA Report" to see your tax summary</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* ── Add Expense Dialog ───────────────────────────── */}
      <Dialog open={expenseOpen} onClose={() => setExpenseOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Manual Expense</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
            value={expenseForm.date} onChange={(e) => setExpenseForm(p => ({ ...p, date: e.target.value }))} />
          <TextField label="Description" fullWidth
            value={expenseForm.description} onChange={(e) => setExpenseForm(p => ({ ...p, description: e.target.value }))} />
          <TextField label="Amount ($)" type="number" fullWidth helperText="Enter as positive — it will be recorded as a debit"
            value={expenseForm.amount} onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={expenseForm.category} onChange={(e) => setExpenseForm(p => ({ ...p, category: e.target.value }))} label="Category">
              {categories.filter(c => c.key !== 'income' && c.key !== 'uncategorized').map(c => (
                <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddExpense} disabled={!expenseForm.date || !expenseForm.description || !expenseForm.amount}>
            Add Expense
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Mileage Dialog ───────────────────────────── */}
      <Dialog open={mileageOpen} onClose={() => setMileageOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Mileage Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
            value={mileageForm.date} onChange={(e) => setMileageForm(p => ({ ...p, date: e.target.value }))} />
          <TextField label="Miles" type="number" fullWidth
            value={mileageForm.miles} onChange={(e) => setMileageForm(p => ({ ...p, miles: e.target.value }))} />
          <TextField label="Purpose / Destination" fullWidth placeholder="e.g. Client meeting — downtown office"
            value={mileageForm.purpose} onChange={(e) => setMileageForm(p => ({ ...p, purpose: e.target.value }))} />
          <Typography variant="caption" color={BRAND.textMuted}>
            2025 IRS rate: $0.70/mile | {mileageForm.miles ? `${mileageForm.miles} mi = $${(parseFloat(mileageForm.miles) * 0.70).toFixed(2)} deduction` : 'Enter miles to see deduction'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMileageOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMileage} disabled={!mileageForm.date || !mileageForm.miles}>
            Add Mileage
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk Mileage Dialog ────────────────────────── */}
      <Dialog open={bulkMileageOpen} onClose={() => setBulkMileageOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Monthly Mileage — {year}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant="body2" color={BRAND.textMuted} sx={{ mb: 2 }}>
            Enter your total business miles for each month. Leave blank for months with no driving.
          </Typography>
          <TextField
            label="Default Purpose" fullWidth size="small" sx={{ mb: 2 }}
            value={bulkPurpose} onChange={(e) => setBulkPurpose(e.target.value)}
            placeholder="e.g. Business driving, Client visits"
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {MONTHS.map((name, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ width: 80, fontSize: 13, color: BRAND.textSecondary }}>{name.slice(0, 3)}</Typography>
                <TextField
                  size="small" type="number" placeholder="miles"
                  value={bulkMileage[i].miles}
                  onChange={(e) => setBulkMileage(prev => prev.map((m, j) => j === i ? { ...m, miles: e.target.value } : m))}
                  sx={{ flex: 1, '& input': { py: 0.8, fontSize: 13 } }}
                />
              </Box>
            ))}
          </Box>
          {(() => {
            const totalMiles = bulkMileage.reduce((s, m) => s + (Number(m.miles) || 0), 0);
            return totalMiles > 0 ? (
              <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, color: BRAND.success }}>
                Total: {totalMiles.toLocaleString()} miles = ${(totalMiles * 0.70).toLocaleString(undefined, { minimumFractionDigits: 2 })} deduction
              </Typography>
            ) : null;
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkMileageOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkMileage} disabled={!bulkMileage.some(m => m.miles && Number(m.miles) > 0)}>
            Add All Months
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
