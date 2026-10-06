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
  IconButton,
  Tooltip,
  Skeleton,
  Snackbar,
  Card,
  TextField,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import useAuth from '../../hooks/useAuth';
import locationService from '../../services/locationService';
import LocationFormDialog from '../../components/locations/LocationFormDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ArchiveViewToggle from '../../components/common/ArchiveViewToggle';
import PermanentDeleteDialog from '../../components/common/PermanentDeleteDialog';
import PrintTableButton from '../../components/common/PrintTableButton';

export default function LocationList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // 'active' = normal list, 'archived' = archived locations (admin only).
  const [view, setView] = useState('active');
  const isArchivedView = view === 'archived';

  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // "deleteTarget" = location being ARCHIVED (kept name from the old flow).
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [permanentTarget, setPermanentTarget] = useState(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await locationService.getLocations(isArchivedView ? { archived: true } : undefined);
      setLocations(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load locations.');
    } finally {
      setLoading(false);
    }
  }, [isArchivedView]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Small, already-fully-fetched list — filter client-side.
  const visibleLocations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        (l.code || '').toLowerCase().includes(term) ||
        (l.description || '').toLowerCase().includes(term)
    );
  }, [locations, search]);

  // Printing: the rows currently shown (view + search).
  const printDate = (l) => (isArchivedView ? l.deletedAt : l.createdAt);
  const printColumns = [
    { header: 'Name', value: (l) => l.name },
    { header: 'Code', value: (l) => l.code },
    { header: 'Description', value: (l) => l.description },
    ...(isArchivedView
      ? []
      : [
          { header: 'Products', value: (l) => l.productCount, align: 'right' },
          { header: 'Units held', value: (l) => l.totalUnits, align: 'right' },
        ]),
    {
      header: isArchivedView ? 'Archived on' : 'Created',
      value: (l) => (printDate(l) ? new Date(printDate(l)).toLocaleDateString() : ''),
    },
  ];

  const handleSave = async (form) => {
    if (editing) {
      await locationService.updateLocation(editing._id, form);
      setSnackbar('Location updated');
    } else {
      await locationService.createLocation(form);
      setSnackbar('Location created');
    }
    setFormOpen(false);
    setEditing(null);
    fetchLocations();
  };

  const handleArchive = async () => {
    setDeleting(true);
    try {
      await locationService.deleteLocation(deleteTarget._id);
      setSnackbar('Location archived. You can restore it from the Archived tab.');
      fetchLocations();
    } catch (err) {
      // e.g. "still holds N unit(s)" from the backend
      setSnackbar(err.response?.data?.message || 'Failed to archive location');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (location) => {
    try {
      const res = await locationService.restoreLocation(location._id);
      setSnackbar(res.message);
      fetchLocations();
    } catch (err) {
      // e.g. an active location now has the same name
      setSnackbar(err.response?.data?.message || 'Failed to restore location');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      const res = await locationService.permanentlyDeleteLocation(permanentTarget._id);
      setSnackbar(res.message);
      fetchLocations();
    } catch (err) {
      // e.g. blocked because transactions / purchase orders mention it
      setSnackbar(err.response?.data?.message || 'Failed to delete location permanently');
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
            Locations
          </Typography>
          {isAdmin && (
            <ArchiveViewToggle value={view} onChange={setView} />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintTableButton
            title={isArchivedView ? 'Archived Locations' : 'Locations'}
            subtitle={search.trim() ? `Search: "${search.trim()}"` : ''}
            columns={printColumns}
            getRows={async () => visibleLocations}
            dateOf={printDate}
            dateLabel={isArchivedView ? 'archived' : 'created'}
            disabled={loading}
          />
        {isAdmin && !isArchivedView && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add Location
          </Button>
        )}
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <TextField
          size="small"
          placeholder="Search by name, code or description…"
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
      ) : visibleLocations.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <PlaceOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
          <Typography color="text.secondary">
            {search
              ? 'No locations match your search.'
              : isArchivedView
                ? 'No archived locations.'
                : 'No locations yet.'}
          </Typography>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Description</TableCell>
                {isArchivedView ? (
                  <TableCell>Archived on</TableCell>
                ) : (
                  <>
                    <TableCell align="right">Products</TableCell>
                    <TableCell align="right">Units held</TableCell>
                  </>
                )}
                {isAdmin && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleLocations.map((l) => (
                <TableRow key={l._id} hover>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.code || '—'}</TableCell>
                  <TableCell>{l.description || '—'}</TableCell>
                  {isArchivedView ? (
                    <TableCell>{l.deletedAt ? new Date(l.deletedAt).toLocaleDateString() : '—'}</TableCell>
                  ) : (
                    <>
                      <TableCell align="right">{l.productCount}</TableCell>
                      <TableCell align="right">{l.totalUnits}</TableCell>
                    </>
                  )}
                  {isAdmin && (
                    <TableCell align="right" className="whitespace-nowrap">
                      {isArchivedView ? (
                        <>
                          <Tooltip title="Restore">
                            <IconButton size="small" color="primary" aria-label="Restore" onClick={() => handleRestore(l)}>
                              <RestoreFromTrashIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete permanently">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="Delete permanently"
                              onClick={() => setPermanentTarget(l)}
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
                                setEditing(l);
                                setFormOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Archive">
                            <IconButton size="small" color="warning" aria-label="Archive" onClick={() => setDeleteTarget(l)}>
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

      <LocationFormDialog open={formOpen} location={editing} onClose={() => setFormOpen(false)} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Archive location?"
        message={`"${deleteTarget?.name}" will be hidden from the location list and stock forms. Locations that still hold stock can't be archived. You can restore it any time from the Archived tab.`}
        confirmLabel="Archive"
        confirmColor="warning"
        onConfirm={handleArchive}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <PermanentDeleteDialog
        open={!!permanentTarget}
        title="Delete location permanently?"
        itemName={permanentTarget?.name}
        description="A location that appears in stock transactions or purchase orders can't be deleted permanently and stays archived instead."
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
        loading={permanentDeleting}
      />

      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar('')} message={snackbar} />
    </div>
  );
}
