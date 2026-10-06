import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete, TextField, InputAdornment, Typography, Chip } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import productService from '../../services/productService';
import useDebounce from '../../hooks/useDebounce';

const MIN_CHARS = 2;

const STATUS_COLOR = {
  'In Stock': 'success',
  'Low Stock': 'warning',
  'Out of Stock': 'error',
  Discontinued: 'default',
};

/**
 * Global search box for the top bar. Searches products by name / SKU as you
 * type and opens the selected product's details modal on the Products page.
 * Keyboard: arrow keys to move, Enter to open the highlighted result, Esc to close.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(input.trim(), 300);

  useEffect(() => {
    if (debounced.length < MIN_CHARS) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    productService
      .getProducts({ search: debounced, limit: 8 })
      .then((res) => {
        if (!cancelled) setOptions(res.data);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const handleSelect = (product) => {
    if (!product) return;
    setInput('');
    setOptions([]);
    navigate(`/products?view=${product._id}`);
  };

  return (
    <Autocomplete
      size="small"
      options={options}
      loading={loading}
      value={null}
      inputValue={input}
      onInputChange={(e, value, reason) => {
        // "reset" fires after a selection; handleSelect already clears the box.
        if (reason !== 'reset') setInput(value);
      }}
      onChange={(e, product) => handleSelect(product)}
      // Filtering is done by the server, so don't filter again client-side.
      filterOptions={(x) => x}
      getOptionLabel={(p) => p.name || ''}
      isOptionEqualToValue={(a, b) => a._id === b._id}
      autoHighlight
      blurOnSelect
      noOptionsText={debounced.length < MIN_CHARS ? `Type at least ${MIN_CHARS} characters` : 'No products found'}
      renderOption={(props, product) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <div className="flex w-full items-center justify-between gap-3">
              <div className="min-w-0">
                <Typography variant="body2" noWrap>
                  {product.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {product.sku}
                </Typography>
              </div>
              <Chip label={product.status} size="small" color={STATUS_COLOR[product.status] || 'default'} />
            </div>
          </li>
        );
      }}
      renderInput={(params) => {
        // MUI v7 passes the input props under params.slotProps.input; older
        // versions used params.InputProps. Support both.
        const inputProps = params.slotProps?.input ?? params.InputProps ?? {};
        return (
          <TextField
            {...params}
            placeholder="Search products…"
            slotProps={{
              ...params.slotProps,
              input: {
                ...inputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                    {inputProps.startAdornment}
                  </>
                ),
              },
            }}
          />
        );
      }}
      slotProps={{ paper: { sx: { minWidth: 320 } } }}
      sx={{
        width: { sm: 224, md: 288 },
        bgcolor: 'background.paper',
        '& .MuiOutlinedInput-root': { borderRadius: '10px' },
      }}
    />
  );
}
