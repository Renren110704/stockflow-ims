import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography, Button, Alert, Pagination, Skeleton, Snackbar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import CloseIcon from '@mui/icons-material/Close';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import categoryService from '../../services/categoryService';
import productService from '../../services/productService';
import ProductFilters from '../../components/products/ProductFilters';
import ProductTable from '../../components/products/ProductTable';
import BulkCategoryDialog from '../../components/products/BulkCategoryDialog';
import ProductFormDialog from '../../components/products/ProductFormDialog';
import ProductDetailsDialog from '../../components/products/ProductDetailsDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ArchiveViewToggle from '../../components/common/ArchiveViewToggle';
import PermanentDeleteDialog from '../../components/common/PermanentDeleteDialog';
import PrintTableButton from '../../components/common/PrintTableButton';
import { formatCurrency } from '../../utils/currency';
import { exportProductsToCSV } from '../../utils/csvExport';
import { parseProductsCSV } from '../../utils/csvImport';

export default function ProductList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Supports deep links like /products?status=Low+Stock from the
  // notification bell — read once on mount as the filter's initial value.
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, pagination, loading, error, filters, updateFilters, refetch } = useProducts({
    status: searchParams.get('status') || '',
    archived: '', // '' = normal list, 'true' = archived list (admin only)
  });
  const [categories, setCategories] = useState([]);
  const isArchivedView = filters.archived === 'true';

  // Add/Edit modal: editingProduct === null means "Add".
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // View modal is driven by the URL (?view=<id>) so it can be opened from
  // the Scan page and the top-bar search, even when already on /products.
  const viewId = searchParams.get('view');
  const openView = (id) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', id);
      return next;
    });
  const closeView = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('view');
        return next;
      },
      { replace: true }
    );

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);

  // Archived view: the product awaiting permanent-delete confirmation.
  const [permanentTarget, setPermanentTarget] = useState(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    categoryService
      .getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, []);

  // Selection is a subset of "products currently on screen" — clear it
  // whenever that set changes (new page, new filters) so a hidden
  // selection can't silently apply to different rows than the user saw.
  useEffect(() => {
    setSelectedIds([]);
  }, [products]);

  const handleSave = async (payload) => {
    if (editingProduct) {
      await productService.updateProduct(editingProduct._id, payload);
      setSnackbar('Product updated successfully');
    } else {
      await productService.createProduct(payload);
      setSnackbar('Product created successfully');
    }
    setFormOpen(false);
    setEditingProduct(null);
    refetch();
  };

  const openAddForm = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await productService.deleteProduct(deleteTarget._id); // archives
      setSnackbar('Product archived. You can restore it from the Archived tab.');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setSnackbar(err.response?.data?.message || 'Failed to archive product');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refetch]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportFilters = { ...filters };
      delete exportFilters.page;
      delete exportFilters.limit;
      const res = await productService.getProducts({ ...exportFilters, limit: 1000 });
      exportProductsToCSV(res.data);
    } catch {
      setSnackbar('Failed to export products');
    } finally {
      setExporting(false);
    }
  };

  // ── Printing: every row matching the current filters (all pages) ──
  const fetchAllForPrint = async () => {
    const printFilters = { ...filters };
    delete printFilters.page;
    delete printFilters.limit;
    const params = Object.fromEntries(
      Object.entries(printFilters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const res = await productService.getProducts({ ...params, limit: 5000 });
    return res.data;
  };

  const printSubtitle = [
    isArchivedView ? 'Archived products' : null,
    filters.search ? `Search: "${filters.search}"` : null,
    filters.category ? `Category: ${categories.find((c) => c._id === filters.category)?.name || ''}` : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.supplier ? `Supplier: ${filters.supplier}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  const printDate = (p) => (isArchivedView ? p.deletedAt : p.createdAt);
  const printColumns = [
    { header: 'Name', value: (p) => p.name },
    { header: 'SKU', value: (p) => p.sku },
    { header: 'Category', value: (p) => p.category?.name },
    { header: 'Price', value: (p) => formatCurrency(p.price), align: 'right' },
    { header: 'Qty', value: (p) => p.quantity, align: 'right' },
    { header: 'Min', value: (p) => p.minimumStockLevel, align: 'right' },
    { header: 'Status', value: (p) => p.status },
    { header: 'Supplier', value: (p) => p.supplier },
    {
      header: isArchivedView ? 'Archived on' : 'Created',
      value: (p) => (printDate(p) ? new Date(printDate(p)).toLocaleDateString() : ''),
    },
  ];

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setImporting(true);
    try {
      const rows = await parseProductsCSV(file);
      const res = await productService.bulkImportProducts(rows);
      const { createdCount, errors } = res.data;
      if (errors?.length) {
        setSnackbar(
          `Imported ${createdCount} product(s). ${errors.length} row(s) failed (e.g. row ${errors[0].row}: ${errors[0].message}).`
        );
      } else {
        setSnackbar(`Imported ${createdCount} product(s) successfully.`);
      }
      refetch();
    } catch (err) {
      setSnackbar(err.response?.data?.message || err.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = (checked) => {
    setSelectedIds(checked ? products.map((p) => p._id) : []);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const res = await productService.bulkArchiveProducts(selectedIds);
      setSnackbar(res.message);
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      refetch();
    } catch (err) {
      setSnackbar(err.response?.data?.message || 'Failed to archive selected products');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkReassign = async (categoryId) => {
    const res = await productService.bulkReassignCategory(selectedIds, categoryId);
    setSnackbar(res.message);
    setSelectedIds([]);
    setBulkCategoryOpen(false);
    refetch();
  };

  // Switching tabs changes the query (and default sort: newest-archived first).
  const handleViewChange = (next) => {
    const toArchived = next === 'archived';
    updateFilters({
      archived: toArchived ? 'true' : '',
      sortBy: toArchived ? 'deletedAt' : 'createdAt',
      sortOrder: 'desc',
    });
  };

  const handleRestore = async (product) => {
    try {
      const res = await productService.restoreProduct(product._id);
      setSnackbar(res.message);
      refetch();
    } catch (err) {
      // e.g. SKU now used by an active product, or its category is archived
      setSnackbar(err.response?.data?.message || 'Failed to restore product');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      const res = await productService.permanentlyDeleteProduct(permanentTarget._id);
      setSnackbar(res.message);
      refetch();
    } catch (err) {
      // e.g. blocked because the product has transaction history
      setSnackbar(err.response?.data?.message || 'Failed to delete product permanently');
    } finally {
      setPermanentDeleting(false);
      setPermanentTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h4" fontWeight={700}>
            Products
          </Typography>
          {isAdmin && (
            <ArchiveViewToggle value={isArchivedView ? 'archived' : 'active'} onChange={handleViewChange} />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={handleImportFile}
          />
          {isAdmin && !isArchivedView && (
            <Button
              variant="outlined"
              startIcon={<FileUploadIcon />}
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import CSV'}
            </Button>
          )}
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <PrintTableButton
            title={isArchivedView ? 'Archived Products' : 'Products'}
            subtitle={printSubtitle}
            columns={printColumns}
            getRows={fetchAllForPrint}
            dateOf={printDate}
            dateLabel={isArchivedView ? 'archived' : 'created'}
            orientation="landscape"
          />
          {isAdmin && !isArchivedView && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAddForm}>
              Add Product
            </Button>
          )}
        </div>
      </div>

      <ProductFilters filters={filters} categories={categories} onChange={updateFilters} />

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {isAdmin && !isArchivedView && selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-(--mui-palette-divider,#e0e0e0) bg-(--mui-palette-action-selected,#f4f7f7) px-4 py-2">
          <Typography variant="body2" fontWeight={600}>
            {selectedIds.length} selected
          </Typography>
          <Button size="small" startIcon={<DriveFileMoveIcon />} onClick={() => setBulkCategoryOpen(true)}>
            Move to category
          </Button>
          <Button size="small" color="warning" startIcon={<ArchiveOutlinedIcon />} onClick={() => setBulkDeleteOpen(true)}>
            Archive
          </Button>
          <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </div>
      ) : (
        <ProductTable
          products={products}
          filters={filters}
          onSortChange={updateFilters}
          onView={(p) => openView(p._id)}
          onEdit={openEditForm}
          onDelete={(p) => setDeleteTarget(p)}
          archived={isArchivedView}
          onRestore={handleRestore}
          onPermanentDelete={(p) => setPermanentTarget(p)}
          canManage={isAdmin}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
        />
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={(e, page) => updateFilters({ page })}
            color="primary"
          />
        </div>
      )}

      <ProductFormDialog
        open={formOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <ProductDetailsDialog
        open={!!viewId}
        productId={viewId}
        canEdit={isAdmin}
        onClose={closeView}
        onEdit={(product) => {
          closeView();
          openEditForm(product);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Archive product?"
        message={`"${deleteTarget?.name}" will be hidden from the product list, alerts and reports. Its history is kept, and you can restore it any time from the Archived tab.`}
        confirmLabel="Archive"
        confirmColor="warning"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Archive ${selectedIds.length} product(s)?`}
        message="The selected products will be hidden from the product list, alerts and reports. Their history is kept, and you can restore them from the Archived tab."
        confirmLabel="Archive all"
        confirmColor="warning"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
        loading={bulkDeleting}
      />

      <PermanentDeleteDialog
        open={!!permanentTarget}
        title="Delete product permanently?"
        itemName={permanentTarget?.name}
        description="Its image and stock-location records are removed too. Products that appear in transactions or purchase orders can't be deleted permanently and stay archived instead."
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
        loading={permanentDeleting}
      />

      <BulkCategoryDialog
        open={bulkCategoryOpen}
        count={selectedIds.length}
        categories={categories}
        onCancel={() => setBulkCategoryOpen(false)}
        onConfirm={handleBulkReassign}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar('')}
        message={snackbar}
      />
    </div>
  );
}
