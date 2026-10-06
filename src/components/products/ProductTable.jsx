import {
  Card,
  Avatar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  Chip,
  IconButton,
  Checkbox,
  Typography,
  Tooltip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { formatCurrency } from '../../utils/currency';

const SORTABLE_COLUMNS = [
  { key: 'name', label: 'Product' },
  { key: 'price', label: 'Price' },
  { key: 'quantity', label: 'Quantity' },
];

const STATUS_COLOR = {
  'In Stock': 'success',
  'Low Stock': 'warning',
  'Out of Stock': 'error',
  Discontinued: 'default',
};

// `onDelete` ARCHIVES a product (the normal view). In the archived view
// (`archived`), rows offer Restore and Delete permanently instead.
export default function ProductTable({
  products,
  filters,
  onSortChange,
  onView,
  onEdit,
  onDelete,
  archived = false,
  onRestore,
  onPermanentDelete,
  canManage,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
}) {
  const handleSort = (key) => {
    const isCurrent = filters.sortBy === key;
    const nextOrder = isCurrent && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange({ sortBy: key, sortOrder: nextOrder });
  };

  if (products.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Inventory2OutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
        <Typography color="text.secondary">
          {archived ? 'No archived products.' : 'No products match your filters.'}
        </Typography>
      </Card>
    );
  }

  // Bulk selection only exists in the normal view (bulk-archive).
  const showSelect = canManage && !archived;
  const allSelected = showSelect && products.length > 0 && products.every((p) => selectedIds.includes(p._id));
  const someSelected = showSelect && products.some((p) => selectedIds.includes(p._id)) && !allSelected;

  return (
    <Card className="overflow-x-auto">
      <Table size="small">
        <TableHead>
          <TableRow>
            {showSelect && (
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                  inputProps={{ 'aria-label': 'Select all products' }}
                />
              </TableCell>
            )}
            {SORTABLE_COLUMNS.map((col) => (
              <TableCell key={col.key}>
                <TableSortLabel
                  active={filters.sortBy === col.key}
                  direction={filters.sortBy === col.key ? filters.sortOrder : 'asc'}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell>SKU</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Status</TableCell>
            {archived && <TableCell>Archived on</TableCell>}
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((p) => {
            const isSelected = selectedIds.includes(p._id);
            return (
              <TableRow key={p._id} hover selected={isSelected}>
                {showSelect && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(p._id)}
                      inputProps={{ 'aria-label': `Select ${p.name}` }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <span className="inline-flex items-center gap-2.5">
                    <Avatar
                      variant="rounded"
                      src={p.imageUrl || undefined}
                      alt={p.name}
                      sx={{ width: 40, height: 40, bgcolor: 'action.hover', color: 'text.disabled' }}
                    >
                      <Inventory2OutlinedIcon fontSize="small" />
                    </Avatar>
                    {p.name}
                  </span>
                </TableCell>
                <TableCell>{formatCurrency(p.price)}</TableCell>
                <TableCell>{p.quantity}</TableCell>
                <TableCell>{p.sku}</TableCell>
                <TableCell>{p.category?.name || '—'}</TableCell>
                <TableCell>
                  <Chip label={p.status} size="small" color={STATUS_COLOR[p.status] || 'default'} />
                </TableCell>
                {archived && (
                  <TableCell>{p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : '—'}</TableCell>
                )}
                <TableCell align="right" className="whitespace-nowrap">
                  {archived ? (
                    canManage && (
                      <>
                        <Tooltip title="Restore">
                          <IconButton size="small" onClick={() => onRestore(p)} aria-label="Restore" color="primary">
                            <RestoreFromTrashIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete permanently">
                          <IconButton
                            size="small"
                            onClick={() => onPermanentDelete(p)}
                            aria-label="Delete permanently"
                            color="error"
                          >
                            <DeleteForeverIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )
                  ) : (
                    <>
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => onView(p)} aria-label="View">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManage && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => onEdit(p)} aria-label="Edit">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Archive">
                            <IconButton size="small" onClick={() => onDelete(p)} aria-label="Archive" color="warning">
                              <ArchiveOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
