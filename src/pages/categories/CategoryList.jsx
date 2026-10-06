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
  TableSortLabel,
  IconButton,
  Tooltip,
  Skeleton,
  Snackbar,
  Card,
  TextField,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SearchIcon from '@mui/icons-material/Search';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import useAuth from '../../hooks/useAuth';
import categoryService from '../../services/categoryService';
import CategoryFormDialog from '../../components/categories/CategoryFormDialog';
import ReassignCategoryDialog from '../../components/categories/ReassignCategoryDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ArchiveViewToggle from '../../components/common/ArchiveViewToggle';
import PermanentDeleteDialog from '../../components/common/PermanentDeleteDialog';
import PrintTableButton from '../../components/common/PrintTableButton';

function extractProductCount(message) {
  const match = /(\d+) product/.exec(message || '');
  return match ? Number(match[1]) : 0;
}

export default function CategoryList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // 'active' = normal list, 'archived' = archived categories (admin only).
  const [view, setView] = useState('active');
  const isArchivedView = view === 'archived';

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // "deleteTarget" = category being ARCHIVED (kept name from the old flow).
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reassignState, setReassignState] = useState(null);

  const [permanentTarget, setPermanentTarget] = useState(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await categoryService.getCategories(isArchivedView ? { archived: true } : undefined);
      setCategories(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, [isArchivedView]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Small, already-fully-fetched list — sorting/filtering client-side
  // avoids round-tripping to the server for something this cheap.
  const visibleCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? categories.filter(
          (c) => c.name.toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term)
        )
      : categories;

    const sorted = [...filtered].sort((a, b) => {
      const result = String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''));
      return sortOrder === 'asc' ? result : -result;
    });
    return sorted;
  }, [categories, search, sortBy, sortOrder]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  // Printing: the rows currently shown (view + search + sort).
  const printDate = (c) => (isArchivedView ? c.deletedAt : c.createdAt);
  const printColumns = [
    { header: 'Name', value: (c) => c.name },
    { header: 'Description', value: (c) => c.description },
    {
      header: isArchivedView ? 'Archived on' : 'Created',
      value: (c) => (printDate(c) ? new Date(printDate(c)).toLocaleDateString() : ''),
    },
  ];

  const handleSave = async (form) => {
    if (editingCategory) {
      await categoryService.updateCategory(editingCategory._id, form);
      setSnackbar('Category updated');
    } else {
      await categoryService.createCategory(form);
      setSnackbar('Category created');
    }
    setFormOpen(false);
    setEditingCategory(null);
    fetchCategories();
  };

  // Archives (soft delete). If products still use the category the server
  // answers 409 and we offer to move those products elsewhere first.
  const handleArchive = async () => {
    setDeleting(true);
    try {
      await categoryService.deleteCategory(deleteTarget._id);
      setSnackbar('Category archived. You can restore it from the Archived tab.');
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      const message = err.response?.data?.message || '';
      if (err.response?.status === 409) {
        setReassignState({ category: deleteTarget, productCount: extractProductCount(message) });
        setDeleteTarget(null);
      } else {
        setSnackbar(message || 'Failed to archive category');
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleReassignConfirm = async (reassignTo) => {
    await categoryService.deleteCategory(reassignState.category._id, reassignTo);
    setSnackbar('Products reassigned and category archived');
    setReassignState(null);
    fetchCategories();
  };

  const handleRestore = async (category) => {
    try {
      const res = await categoryService.restoreCategory(category._id);
      setSnackbar(res.message);
      fetchCategories();
    } catch (err) {
      // e.g. an active category now has the same name
      setSnackbar(err.response?.data?.message || 'Failed to restore category');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      const res = await categoryService.permanentlyDeleteCategory(permanentTarget._id);
      setSnackbar(res.message);
      fetchCategories();
    } catch (err) {
      // e.g. blocked because products still belong to it
      setSnackbar(err.response?.data?.message || 'Failed to delete category permanently');
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
            Categories
          </Typography>
          {isAdmin && (
            <ArchiveViewToggle value={view} onChange={setView} />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintTableButton
            title={isArchivedView ? 'Archived Categories' : 'Categories'}
            subtitle={search.trim() ? `Search: "${search.trim()}"` : ''}
            columns={printColumns}
            getRows={async () => visibleCategories}
            dateOf={printDate}
            dateLabel={isArchivedView ? 'archived' : 'created'}
            disabled={loading}
          />
        {isAdmin && !isArchivedView && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingCategory(null);
              setFormOpen(true);
            }}
          >
            Add Category
          </Button>
        )}
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <TextField
          size="small"
          placeholder="Search categories…"
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
      </Card>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </div>
      ) : visibleCategories.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <CategoryOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
          <Typography color="text.secondary">
            {search
              ? 'No categories match your search.'
              : isArchivedView
                ? 'No archived categories.'
                : 'No categories yet.'}
          </Typography>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'name'}
                    direction={sortBy === 'name' ? sortOrder : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>Description</TableCell>
                {isArchivedView && <TableCell>Archived on</TableCell>}
                {isAdmin && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleCategories.map((c) => (
                <TableRow key={c._id} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.description || '—'}</TableCell>
                  {isArchivedView && (
                    <TableCell>{c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : '—'}</TableCell>
                  )}
                  {isAdmin && (
                    <TableCell align="right" className="whitespace-nowrap">
                      {isArchivedView ? (
                        <>
                          <Tooltip title="Restore">
                            <IconButton size="small" color="primary" aria-label="Restore" onClick={() => handleRestore(c)}>
                              <RestoreFromTrashIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete permanently">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="Delete permanently"
                              onClick={() => setPermanentTarget(c)}
                            >
                              <DeleteForeverIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              aria-label="Edit"
                              onClick={() => {
                                setEditingCategory(c);
                                setFormOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Archive">
                            <IconButton size="small" color="warning" aria-label="Archive" onClick={() => setDeleteTarget(c)}>
                              <ArchiveOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CategoryFormDialog
        open={formOpen}
        category={editingCategory}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Archive category?"
        message={`"${deleteTarget?.name}" will be hidden from the category list and product forms. You can restore it any time from the Archived tab.`}
        confirmLabel="Archive"
        confirmColor="warning"
        onConfirm={handleArchive}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <PermanentDeleteDialog
        open={!!permanentTarget}
        title="Delete category permanently?"
        itemName={permanentTarget?.name}
        description="A category that any product (archived ones included) still belongs to can't be deleted permanently and stays archived instead."
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
        loading={permanentDeleting}
      />

      {reassignState && (
        <ReassignCategoryDialog
          open
          category={reassignState.category}
          productCount={reassignState.productCount}
          categories={categories}
          onCancel={() => setReassignState(null)}
          onConfirm={handleReassignConfirm}
        />
      )}

      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar('')} message={snackbar} />
    </div>
  );
}
