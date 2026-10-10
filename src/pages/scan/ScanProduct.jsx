import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Button, Alert, TextField, MenuItem, CircularProgress } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import VisibilityIcon from '@mui/icons-material/Visibility';
import productService from '../../services/productService';
import transactionService from '../../services/transactionService';

// Lazily imported: html5-qrcode touches the camera/DOM immediately on
// construction, which would blow up in any environment without a
// camera (or during a server-side render), so it's only loaded once
// this page actually mounts.
let Html5Qrcode;

const SCANNER_ELEMENT_ID = 'sku-scanner-viewport';

export default function ScanProduct() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [product, setProduct] = useState(null);
  const [looking, setLooking] = useState(false);

  const [quantity, setQuantity] = useState('1');
  const [action, setAction] = useState('STOCK_OUT');
  const [recording, setRecording] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Guards against overlapping lookups: html5-qrcode keeps firing while the
  // same code is in frame. A ref (not state) so the check is synchronous and
  // the scanner callback never reads a stale value.
  const lookingRef = useRef(false);

  const lookupSku = useCallback(async (sku) => {
    if (lookingRef.current) return;
    lookingRef.current = true;
    setLooking(true);
    setLookupError('');
    setSuccessMsg('');
    try {
      const res = await productService.getProductBySku(sku);
      setProduct(res.data);
      setQuantity('1');
    } catch (err) {
      setProduct(null);
      setLookupError(err.response?.data?.message || `No product found for "${sku}"`);
    } finally {
      lookingRef.current = false;
      setLooking(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then((mod) => {
      if (cancelled) return;
      Html5Qrcode = mod.Html5Qrcode;
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => lookupSku(decodedText),
          () => {} // per-frame "nothing found" callback — expected constantly, ignore
        )
        .then(() => {
          // Unmounted while the camera was starting: turn it straight back off.
          if (cancelled) {
            scanner.stop().catch(() => {});
            return;
          }
          setCameraStarted(true);
        })
        .catch((err) => {
          if (cancelled) return;
          setCameraError(
            'Could not access the camera. Make sure this page has camera permission and that no other app is using it.'
          );
          console.error(err);
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [lookupSku]);

  const handleManualLookup = (e) => {
    e.preventDefault();
    const sku = e.target.elements.manualSku.value.trim();
    if (sku) lookupSku(sku);
  };

  const handleRecord = async () => {
    if (!product || !quantity || Number(quantity) <= 0) return;
    setRecording(true);
    setSuccessMsg('');
    try {
      await transactionService.createTransaction({
        product: product._id,
        type: action,
        quantity: Number(quantity),
        reason: action === 'STOCK_OUT' ? 'Sold' : undefined,
        notes: 'Recorded via QR/barcode scan',
      });
      setSuccessMsg(`${action === 'STOCK_OUT' ? 'Stock out' : 'Stock in'} of ${quantity} recorded for ${product.name}.`);
      // Refresh the displayed quantity so it's clear it worked.
      const res = await productService.getProductBySku(product.sku);
      setProduct(res.data);
    } catch (err) {
      setLookupError(err.response?.data?.message || 'Failed to record transaction');
    } finally {
      setRecording(false);
    }
  };

  return (
    <div>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Scan Product
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Point your camera at a product's QR/barcode label to look it up and log a stock movement.
      </Typography>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="relative overflow-hidden rounded-xl bg-black/80">
            <div id={SCANNER_ELEMENT_ID} className="w-full" />
            {!cameraStarted && !cameraError && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <CircularProgress size={28} sx={{ color: '#fff' }} />
                <Typography variant="body2" sx={{ color: '#fff' }}>
                  Starting camera…
                </Typography>
              </div>
            )}
          </div>

          {cameraError && (
            <Alert severity="warning" className="mt-3">
              {cameraError}
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            No camera, or scanning isn't working? Type the SKU instead:
          </Typography>
          <form onSubmit={handleManualLookup} className="mt-1 flex gap-2">
            <TextField name="manualSku" size="small" placeholder="e.g. SKU-1234" fullWidth />
            <Button type="submit" variant="outlined" disabled={looking} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              Look up
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          {looking && (
            <div className="flex items-center gap-2">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Looking up product…
              </Typography>
            </div>
          )}

          {lookupError && <Alert severity="error">{lookupError}</Alert>}
          {successMsg && <Alert severity="success">{successMsg}</Alert>}

          {!product && !looking && !lookupError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
              <QrCodeScannerIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              <Typography color="text.secondary">Scan a code to see product details here.</Typography>
            </div>
          )}

          {product && (
            <>
              <div>
                <Typography variant="h6" fontWeight={700}>
                  {product.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  SKU: {product.sku} · {product.category?.name || 'Uncategorized'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Current stock: <strong>{product.quantity}</strong> (status: {product.status})
                </Typography>
              </div>

              <Button
                variant="outlined"
                size="small"
                startIcon={<VisibilityIcon />}
                onClick={() => navigate(`/products?view=${product._id}`)}
                className="self-start"
              >
                View full details
              </Button>

              <div className="mt-2 border-t border-black/10 pt-4">
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Quick stock update
                </Typography>
                <div className="flex flex-wrap items-center gap-2">
                  <TextField
                    select
                    size="small"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="min-w-32.5"
                  >
                    <MenuItem value="STOCK_OUT">Stock Out</MenuItem>
                    <MenuItem value="STOCK_IN">Stock In</MenuItem>
                  </TextField>
                  <TextField
                    size="small"
                    type="number"
                    label="Qty"
                    inputProps={{ min: 1 }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-24"
                  />
                  <Button variant="contained" onClick={handleRecord} disabled={recording}>
                    {recording ? 'Recording…' : 'Record'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
