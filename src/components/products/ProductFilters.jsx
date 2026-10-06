import { useState, useEffect } from 'react';
import { TextField, MenuItem, Button, InputAdornment, Card } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import useDebounce from '../../hooks/useDebounce';

const STATUS_OPTIONS = ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'];

export default function ProductFilters({ filters, categories, onChange }) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 400);

  // Only fire onChange once the debounced value actually differs from
  // the filters currently applied, to avoid an extra request on mount.
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleClear = () => {
    setSearchInput('');
    onChange({ search: '', category: '', status: '', supplier: '' });
  };

  const hasActiveFilters = filters.search || filters.category || filters.status || filters.supplier;

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
      <TextField
        size="small"
        placeholder="Search by name or SKU…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
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
        label="Category"
        value={filters.category}
        onChange={(e) => onChange({ category: e.target.value })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">All categories</MenuItem>
        {categories.map((c) => (
          <MenuItem key={c._id} value={c._id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="Status"
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">All statuses</MenuItem>
        {STATUS_OPTIONS.map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        size="small"
        label="Supplier"
        value={filters.supplier}
        onChange={(e) => onChange({ supplier: e.target.value })}
        sx={{ minWidth: 160 }}
      />

      {hasActiveFilters && (
        <Button startIcon={<ClearIcon />} onClick={handleClear} size="small" color="inherit">
          Clear
        </Button>
      )}
    </Card>
  );
}