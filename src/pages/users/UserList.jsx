import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Alert,
  Avatar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Skeleton,
  Snackbar,
  Chip,
  Card,
  TextField,
  InputAdornment,
} from '@mui/material';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SearchIcon from '@mui/icons-material/Search';
import useAuth from '../../hooks/useAuth';
import userService from '../../services/userService';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ArchiveViewToggle from '../../components/common/ArchiveViewToggle';
import PermanentDeleteDialog from '../../components/common/PermanentDeleteDialog';
import PrintTableButton from '../../components/common/PrintTableButton';

function getInitials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const SORTABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
];

export default function UserList() {
  const { user: currentUser } = useAuth();

  // 'active' = normal list, 'archived' = deactivated accounts.
  const [view, setView] = useState('active');
  const isArchivedView = view === 'archived';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  // "deleteTarget" = user being ARCHIVED (kept name from the old flow).
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [permanentTarget, setPermanentTarget] = useState(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const dateKey = isArchivedView ? 'archivedAt' : 'createdAt';
  const dateLabel = isArchivedView ? 'Archived on' : 'Joined';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userService.getUsers(isArchivedView ? { archived: true } : undefined);
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [isArchivedView]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // The date column is "Joined" in one view and "Archived on" in the other,
  // so a sort on it must follow the view; reset to newest-first on switch.
  const handleViewChange = (next) => {
    setView(next);
    setSortBy(next === 'archived' ? 'archivedAt' : 'createdAt');
    setSortOrder('desc');
  };

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? users.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
      : users;

    const sorted = [...filtered].sort((a, b) => {
      let result;
      if (sortBy === 'createdAt' || sortBy === 'archivedAt') {
        result = new Date(a[sortBy] || 0) - new Date(b[sortBy] || 0);
      } else {
        result = String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''));
      }
      return sortOrder === 'asc' ? result : -result;
    });
    return sorted;
  }, [users, search, sortBy, sortOrder]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    try {
      await userService.updateUser(targetUser._id, { role: newRole });
      setSnackbar(`${targetUser.name} is now ${newRole}`);
      fetchUsers();
    } catch (err) {
      setSnackbar(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleArchive = async () => {
    setDeleting(true);
    try {
      await userService.archiveUser(deleteTarget._id);
      setSnackbar('User archived. They can no longer log in; restore them from the Archived tab.');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      // e.g. "at least one active admin account must remain"
      setSnackbar(err.response?.data?.message || 'Failed to archive user');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (target) => {
    try {
      await userService.restoreUser(target._id);
      setSnackbar(`${target.name} restored. They can log in again.`);
      fetchUsers();
    } catch (err) {
      setSnackbar(err.response?.data?.message || 'Failed to restore user');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setPermanentDeleting(true);
    try {
      const res = await userService.permanentlyDeleteUser(permanentTarget._id);
      setSnackbar(res.message);
      fetchUsers();
    } catch (err) {
      // e.g. blocked because the user has recorded transactions / purchase orders
      setSnackbar(err.response?.data?.message || 'Failed to delete user permanently');
    } finally {
      setPermanentDeleting(false);
      setPermanentTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h4" fontWeight={700}>
            Users
          </Typography>
          <ArchiveViewToggle value={view} onChange={handleViewChange} />
        </div>
        <PrintTableButton
          title={isArchivedView ? 'Archived Users' : 'Users'}
          subtitle={search.trim() ? `Search: "${search.trim()}"` : ''}
          columns={[
            { header: 'Name', value: (u) => u.name },
            { header: 'Email', value: (u) => u.email },
            { header: 'Role', value: (u) => (u.role === 'admin' ? 'Admin' : 'Staff') },
            {
              header: dateLabel,
              value: (u) => (u[dateKey] ? new Date(u[dateKey]).toLocaleDateString() : ''),
            },
          ]}
          getRows={async () => visibleUsers}
          dateOf={(u) => u[dateKey]}
          dateLabel={isArchivedView ? 'archived' : 'joined'}
          disabled={loading}
        />
      </div>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isArchivedView
          ? 'Archived users are deactivated: they cannot log in, but their history is kept.'
          : 'Archiving a user deactivates their account without erasing their history.'}
      </Typography>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <TextField
          size="small"
          placeholder="Search by name or email…"
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
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </div>
      ) : visibleUsers.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <Typography color="text.secondary">
            {search
              ? 'No users match your search.'
              : isArchivedView
                ? 'No archived users.'
                : 'No users found.'}
          </Typography>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                {SORTABLE_COLUMNS.map((col) => (
                  <TableCell key={col.key}>
                    <TableSortLabel
                      active={sortBy === col.key}
                      direction={sortBy === col.key ? sortOrder : 'asc'}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>
                  <TableSortLabel
                    active={sortBy === dateKey}
                    direction={sortBy === dateKey ? sortOrder : 'asc'}
                    onClick={() => handleSort(dateKey)}
                  >
                    {dateLabel}
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleUsers.map((u) => {
                const isSelf = u._id === currentUser?._id;
                return (
                  <TableRow key={u._id} hover>
                    <TableCell>
                      <span className="inline-flex items-center gap-2.5">
                        <Avatar
                          src={u.avatar || undefined}
                          alt={u.name}
                          sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}
                        >
                          {getInitials(u.name)}
                        </Avatar>
                        {u.name} {isSelf && <Chip label="You" size="small" />}
                      </span>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {isArchivedView ? (
                        <Chip label={u.role === 'admin' ? 'Admin' : 'Staff'} size="small" variant="outlined" />
                      ) : (
                        <Select
                          size="small"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                        >
                          <MenuItem value="staff">Staff</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {u[dateKey] ? new Date(u[dateKey]).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell align="right" className="whitespace-nowrap">
                      {isArchivedView ? (
                        <>
                          <Tooltip title="Restore user">
                            <IconButton size="small" color="primary" aria-label="Restore" onClick={() => handleRestore(u)}>
                              <RestoreFromTrashIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete permanently">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="Delete permanently"
                              onClick={() => setPermanentTarget(u)}
                            >
                              <DeleteForeverIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip title={isSelf ? "You can't archive your own account" : 'Archive user'}>
                          <span>
                            <IconButton
                              size="small"
                              color="warning"
                              aria-label="Archive"
                              disabled={isSelf}
                              onClick={() => setDeleteTarget(u)}
                            >
                              <ArchiveOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Archive user?"
        message={`"${deleteTarget?.name}" will be deactivated and can no longer log in. Their transactions and history are kept, and you can restore them any time from the Archived tab.`}
        confirmLabel="Archive"
        confirmColor="warning"
        onConfirm={handleArchive}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <PermanentDeleteDialog
        open={!!permanentTarget}
        title="Delete user permanently?"
        itemName={permanentTarget?.name}
        description="Their profile picture is removed too. A user who has recorded transactions or purchase orders can't be deleted permanently and stays archived instead, so history remains accurate."
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
        loading={permanentDeleting}
      />

      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar('')} message={snackbar} />
    </div>
  );
}
