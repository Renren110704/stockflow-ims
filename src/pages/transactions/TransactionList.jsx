import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Skeleton,
  Pagination,
  Snackbar,
  Card,
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ClearIcon from '@mui/icons-material/Clear';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import transactionService from '../../services/transactionService';
import useDebounce from '../../hooks/useDebounce';
import TransactionFormDialog from '../../components/transactions/TransactionFormDialog';
import PrintTableButton from '../../components/common/PrintTableButton';
import { exportTransactionsToCSV } from '../../utils/csvExport';
import { TYPE_LABEL, TYPE_COLOR, describeLocation } from '../../utils/transactionLabels';

const DEFAULT_FILTERS = { startDate: '', endDate: '', type: '' };

export default function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [dateFilters, setDateFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput.trim(), 400);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const activeParams = {
    ...Object.fromEntries(Object.entries(dateFilters).filter(([, v]) => v)),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };
  const hasActiveFilters = Object.keys(activeParams).length > 0 || searchInput.trim() !== '';

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await transactionService.getTransactions({ page, limit: 10, ...activeParams });
      setTransactions(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dateFilters, debouncedSearch]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleFilterChange = (partial) => {
    setDateFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setDateFilters(DEFAULT_FILTERS);
    setSearchInput('');
    setPage(1);
  };

  const handleSave = async (payload) => {
    if (payload.type === 'TRANSFER') {
      await transactionService.transferStock(payload);
      setSnackbar('Stock transferred');
    } else {
      await transactionService.createTransaction(payload);
      setSnackbar(`${payload.type === 'STOCK_IN' ? 'Stock in' : 'Stock out'} recorded`);
    }
    setFormOpen(false);
    setPage(1);
    fetchTransactions();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Exports every row matching the current date/type filters, not
      // just the current page — same "export what you're looking at,
      // not what's on screen" pattern as the products export.
      const res = await transactionService.getTransactions({ ...activeParams, limit: 5000 });
      exportTransactionsToCSV(res.data);
    } catch {
      setSnackbar('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  // Printing: every row matching the current search/type, over the dates
  // chosen in the print dialog (which starts from this page's From/To).
  const fetchAllForPrint = async ({ from, to }) => {
    const params = { ...activeParams };
    delete params.startDate;
    delete params.endDate;
    if (from) params.startDate = from;
    if (to) params.endDate = to;
    const res = await transactionService.getTransactions({ ...params, limit: 5000 });
    return res.data;
  };

  const printSubtitle = [
    dateFilters.type ? `Type: ${TYPE_LABEL[dateFilters.type] || dateFilters.type}` : null,
    debouncedSearch ? `Search: "${debouncedSearch}"` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  const printColumns = [
    { header: 'Date', value: (t) => new Date(t.createdAt).toLocaleString() },
    {
      header: 'Product',
      value: (t) => `${t.product?.name || ''}${t.product?.sku ? ` (${t.product.sku})` : ''}`,
    },
    { header: 'Type', value: (t) => TYPE_LABEL[t.type] || t.type },
    { header: 'Qty', value: (t) => t.quantity, align: 'right' },
    { header: 'Location', value: (t) => describeLocation(t) },
    { header: 'Reason / Supplier', value: (t) => (t.type === 'STOCK_IN' ? t.supplier : t.reason) },
    { header: 'Reference', value: (t) => t.referenceNumber },
    { header: 'By', value: (t) => t.performedBy?.name },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h4" fontWeight={700}>
          Transactions
        </Typography>
        <div className="flex flex-wrap gap-2">
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <PrintTableButton
            title="Transactions"
            subtitle={printSubtitle}
            columns={printColumns}
            getRows={fetchAllForPrint}
            dateOf={(t) => t.createdAt}
            dateLabel="recorded"
            initialRange={{ from: dateFilters.startDate, to: dateFilters.endDate }}
            orientation="landscape"
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
            Record Transaction
          </Button>
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <TextField
          size="small"
          placeholder="Search by product, SKU, reference, supplier or reason…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 220, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          type="date"
          size="small"
          label="From"
          value={dateFilters.startDate}
          onChange={(e) => handleFilterChange({ startDate: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }} 
          sx={{ minWidth: 160 }} // Added minimum width
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={dateFilters.endDate}
          onChange={(e) => handleFilterChange({ endDate: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }} 
          sx={{ minWidth: 160 }}
        />
        <TextField
          select
          size="small"
          label="Type"
          value={dateFilters.type}
          onChange={(e) => handleFilterChange({ type: e.target.value })}
          sx={{ minWidth: 160 }} 
        >
          <MenuItem value="">All types</MenuItem>
          <MenuItem value="STOCK_IN">Stock In</MenuItem>
          <MenuItem value="STOCK_OUT">Stock Out</MenuItem>
          <MenuItem value="TRANSFER">Transfer</MenuItem>
        </TextField>
        {hasActiveFilters && (
          <Button startIcon={<ClearIcon />} onClick={handleClearFilters} size="small" color="inherit">
            Clear
          </Button>
        )}
      </Card>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <SwapHorizOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
          <Typography color="text.secondary">
            {hasActiveFilters ? 'No transactions match these filters.' : 'No transactions recorded yet.'}
          </Typography>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Reason / Supplier</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {t.product?.name} ({t.product?.sku})
                    {t.product?.deletedAt && <Chip label="deleted" size="small" className="ml-2" />}
                  </TableCell>
                  <TableCell>
                    <Chip label={TYPE_LABEL[t.type] || t.type} size="small" color={TYPE_COLOR[t.type] || 'default'} />
                  </TableCell>
                  <TableCell align="right">{t.quantity}</TableCell>
                  <TableCell>{describeLocation(t) || '—'}</TableCell>
                  <TableCell>{t.type === 'STOCK_IN' ? t.supplier : t.reason}</TableCell>
                  <TableCell>{t.referenceNumber || '—'}</TableCell>
                  <TableCell>{t.performedBy?.name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination count={pagination.totalPages} page={pagination.page} onChange={(e, p) => setPage(p)} />
        </div>
      )}

      <TransactionFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} />

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar('')} message={snackbar} />
    </div>
  );
}
