import { useState, useEffect, useCallback, useMemo } from 'react';
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
  IconButton,
  Tooltip,
  Skeleton,
  Snackbar,
  Card,
  MenuItem,
  TextField,
  Collapse,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';  
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import useAuth from '../../hooks/useAuth';
import purchaseOrderService from '../../services/purchaseOrderService';
import PurchaseOrderFormDialog from '../../components/purchaseOrders/PurchaseOrderFormDialog';
import ReceivePODialog from '../../components/purchaseOrders/ReceivePODialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PrintTableButton from '../../components/common/PrintTableButton';
import { formatCurrency } from '../../utils/currency';

const STATUS_COLOR = { Draft: 'default', Ordered: 'info', Received: 'success', Cancelled: 'error' };

export default function PurchaseOrderList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'cancel'|'delete', order }
  const [busy, setBusy] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await purchaseOrderService.getPurchaseOrders(statusFilter ? { status: statusFilter } : {});
      setOrders(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await purchaseOrderService.getReorderSuggestions();
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (isAdmin) fetchSuggestions();
  }, [isAdmin, fetchSuggestions]);

  const totalSuggested = suggestions.reduce((sum, g) => sum + g.items.length, 0);

  // Status is filtered server-side; the text search runs client-side on
  // whatever that returned.
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter(
      (po) =>
        (po.poNumber || '').toLowerCase().includes(term) ||
        (po.supplier || '').toLowerCase().includes(term)
    );
  }, [orders, search]);

  const handleSave = async (payload) => {
    if (editing) {
      await purchaseOrderService.updatePurchaseOrder(editing._id, payload);
      setSnackbar('Purchase order updated');
    } else {
      const res = await purchaseOrderService.createPurchaseOrder(payload);
      setSnackbar(res.message);
    }
    setFormOpen(false);
    setEditing(null);
    setPrefill(null);
    fetchOrders();
    fetchSuggestions();
  };

  const handleMarkOrdered = async (order) => {
    setBusy(true);
    try {
      const res = await purchaseOrderService.markOrdered(order._id);
      setSnackbar(res.message);
      fetchOrders();
    } catch (err) {
      setSnackbar(err.response?.data?.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  };

  const handleReceive = async (location) => {
    const res = await purchaseOrderService.receivePurchaseOrder(receiveTarget._id, { location });
    setSnackbar(res.message);
    setReceiveTarget(null);
    fetchOrders();
  };

  const handleConfirmAction = async () => {
    setBusy(true);
    try {
      if (confirmAction.type === 'cancel') {
        const res = await purchaseOrderService.cancelPurchaseOrder(confirmAction.order._id);
        setSnackbar(res.message);
      } else {
        await purchaseOrderService.deletePurchaseOrder(confirmAction.order._id);
        setSnackbar('Purchase order deleted');
      }
      fetchOrders();
    } catch (err) {
      setSnackbar(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h4" fontWeight={700}>
          Purchase Orders
        </Typography>
        <div className="flex flex-wrap gap-2">
          <PrintTableButton
            title="Purchase Orders"
            subtitle={[statusFilter ? `Status: ${statusFilter}` : null, search.trim() ? `Search: "${search.trim()}"` : null]
              .filter(Boolean)
              .join('  |  ')}
            columns={[
              { header: 'PO Number', value: (po) => po.poNumber },
              { header: 'Supplier', value: (po) => po.supplier },
              { header: 'Status', value: (po) => po.status },
              { header: 'Items', value: (po) => po.items.length, align: 'right' },
              { header: 'Total', value: (po) => formatCurrency(po.total), align: 'right' },
              { header: 'Created', value: (po) => new Date(po.createdAt).toLocaleDateString() },
            ]}
            getRows={async () => visibleOrders}
            dateOf={(po) => po.createdAt}
            dateLabel="created"
            disabled={loading}
          />
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setPrefill(null);
              setFormOpen(true);
            }}
          >
            New Purchase Order
          </Button>
        )}
        </div>
      </div>

      {isAdmin && totalSuggested > 0 && (
        <Card className="mb-4 p-4">
          <button
            type="button"
            onClick={() => setSuggestionsOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Reorder suggestions ({totalSuggested})
            </Typography>
            {suggestionsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </button>
          <Collapse in={suggestionsOpen}>
            <div className="mt-3 flex flex-col gap-3">
              {suggestions.map((group) => (
                <div
                  key={group.supplier || '(no supplier)'}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3"
                >
                  <div>
                    <Typography variant="body2" fontWeight={600}>
                      {group.supplier || 'No supplier on file'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {group.items.map((i) => `${i.product.name} (${i.suggestedQuantity})`).join(', ')}
                    </Typography>
                  </div>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setEditing(null);
                      setPrefill(group);
                      setFormOpen(true);
                    }}
                  >
                    Create draft PO
                  </Button>
                </div>
              ))}
            </div>
          </Collapse>
        </Card>
      )}

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <TextField
          size="small"
          placeholder="Search by PO number or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {['Draft', 'Ordered', 'Received', 'Cancelled'].map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
      </Card>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <Inventory2OutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
          <Typography color="text.secondary">
            {search || statusFilter ? 'No purchase orders match your filters.' : 'No purchase orders yet.'}
          </Typography>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PO Number</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleOrders.map((po) => (
                <TableRow key={po._id} hover>
                  <TableCell>{po.poNumber}</TableCell>
                  <TableCell>{po.supplier}</TableCell>
                  <TableCell>
                    <Chip label={po.status} size="small" color={STATUS_COLOR[po.status]} />
                  </TableCell>
                  <TableCell align="right">{po.items.length}</TableCell>
                  <TableCell align="right">{formatCurrency(po.total)}</TableCell>
                  <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap">
                    {isAdmin && po.status === 'Draft' && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditing(po);
                              setPrefill(null);
                              setFormOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Place order">
                          <IconButton size="small" color="primary" disabled={busy} onClick={() => handleMarkOrdered(po)}>
                            <LocalShippingOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setConfirmAction({ type: 'delete', order: po })}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {po.status === 'Ordered' && (
                      <>
                        <Tooltip title="Receive">
                          <IconButton size="small" color="success" onClick={() => setReceiveTarget(po)}>
                            <CheckCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isAdmin && (
                          <Tooltip title="Cancel order">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setConfirmAction({ type: 'cancel', order: po })}
                            >
                              <CancelOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                    {isAdmin && po.status === 'Cancelled' && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setConfirmAction({ type: 'delete', order: po })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <PurchaseOrderFormDialog
        open={formOpen}
        order={editing}
        prefill={prefill}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setPrefill(null);
        }}
        onSave={handleSave}
      />

      <ReceivePODialog
        open={!!receiveTarget}
        order={receiveTarget}
        onCancel={() => setReceiveTarget(null)}
        onConfirm={handleReceive}
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'cancel' ? 'Cancel this order?' : 'Delete this order?'}
        message={
          confirmAction?.type === 'cancel'
            ? `${confirmAction?.order?.poNumber} will be marked cancelled. This cannot be undone.`
            : `${confirmAction?.order?.poNumber} will be permanently deleted.`
        }
        confirmLabel={confirmAction?.type === 'cancel' ? 'Cancel order' : 'Delete'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
        loading={busy}
      />

      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar('')} message={snackbar} />
    </div>
  );
}
