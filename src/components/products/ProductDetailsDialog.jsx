import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import { QRCodeCanvas } from 'qrcode.react';
import productService from '../../services/productService';
import { formatCurrency } from '../../utils/currency';

const STATUS_COLOR = {
  'In Stock': 'success',
  'Low Stock': 'warning',
  'Out of Stock': 'error',
  Discontinued: 'default',
};

function Field({ label, value }) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value || '—'}</Typography>
    </div>
  );
}

/**
 * Read-only product details modal (replaces the old /products/:id page).
 * Fetches the product + per-location stock whenever it opens for a new id.
 */
export default function ProductDetailsDialog({ open, productId, canEdit, onClose, onEdit }) {
  const [product, setProduct] = useState(null);
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const qrRef = useRef(null);

  useEffect(() => {
    if (!open || !productId) return;

    let cancelled = false;
    setProduct(null);
    setStock(null);
    setError('');
    setLoading(true);

    productService
      .getProduct(productId)
      .then((res) => {
        if (!cancelled) setProduct(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load product.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    productService
      .getProductStock(productId)
      .then((res) => {
        if (!cancelled) setStock(res.data);
      })
      .catch(() => {
        if (!cancelled) setStock(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas || !product) return;
    const link = document.createElement('a');
    link.download = `${product.sku}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle className="font-semibold">
        {product ? (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Typography variant="h6" fontWeight={700} component="div">
                {product.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                SKU: {product.sku}
              </Typography>
            </div>
            <Chip label={product.status} color={STATUS_COLOR[product.status] || 'default'} />
          </div>
        ) : (
          'Product Details'
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <div className="flex justify-center py-10">
            <CircularProgress />
          </div>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {product && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              {product.imageUrl && (
                <div
                  className="mb-4 flex items-center justify-center overflow-hidden rounded-xl"
                  style={{ height: 220, backgroundColor: 'rgba(127,127,127,0.08)' }}
                >
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              {product.description && (
                <Typography variant="body1" className="mb-4">
                  {product.description}
                </Typography>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Category" value={product.category?.name} />
                <Field label="Price" value={formatCurrency(product.price)} />
                <Field label="Supplier" value={product.supplier} />
                <Field label="Quantity" value={product.quantity} />
                <Field label="Minimum stock level" value={product.minimumStockLevel} />
              </div>

              {stock && stock.levels.length > 0 && (
                <>
                  <Divider className="my-4" />
                  <Typography variant="subtitle2" fontWeight={700} className="mb-2">
                    Stock by location
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Location</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stock.levels.map((l) => (
                        <TableRow key={l.location?._id || 'unknown'}>
                          <TableCell>{l.location?.name || 'Unknown'}</TableCell>
                          <TableCell align="right">{l.quantity}</TableCell>
                        </TableRow>
                      ))}
                      {stock.unassigned > 0 && (
                        <TableRow>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              Unassigned
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{stock.unassigned}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-3 text-center">
              <Typography variant="subtitle2" fontWeight={700}>
                Scan tag
              </Typography>
              <div ref={qrRef} className="rounded-lg bg-white p-3">
                <QRCodeCanvas value={product.sku} size={160} level="M" includeMargin={false} />
              </div>
              <Typography variant="caption" color="text.secondary">
                Encodes SKU: {product.sku}
              </Typography>
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadQr}>
                Download PNG
              </Button>
              <Typography variant="caption" color="text.secondary">
                Print this on a label, then use Scan Product to look it up or log stock.
              </Typography>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogActions className="px-6 pb-4">
        <Button onClick={onClose}>Close</Button>
        {canEdit && product && (
          <Button variant="contained" startIcon={<EditIcon />} onClick={() => onEdit(product)}>
            Edit product
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
