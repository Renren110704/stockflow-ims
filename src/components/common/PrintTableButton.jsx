import { useState } from 'react';
import {
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import useAuth from '../../hooks/useAuth';
import { printTable, filterByDateRange, formatDateInput, parseDateInput } from '../../utils/printTable';

// One Print button for any table. Prints a black-and-white report with a
// header (title, date range, who/when printed) and the table's rows.
//
//   title      report title, e.g. "Products"
//   subtitle   optional line under the title (e.g. the active filters)
//   columns    [{ header, value: (row) => text, align?: 'right' }]
//   getRows    async ({ from, to }) => rows. Fetch EVERYTHING that matches the
//              table's current filters (not just the visible page). Results
//              are also filtered by the chosen dates via `dateOf`.
//   dateOf     (row) => the date the From/To range applies to
//   dateLabel  names that date in the header, e.g. "created" / "archived"
//   initialRange { from, to } pre-fills the dialog (e.g. the page's own filter)
//
// Modes:
//   default       asks for From/To dates, then prints
//   fixedRange    { from, to }: no dialog; prints with that range in the header
//   snapshot      no dialog; header says "As of <now>" (for live summaries)
//   iconOnly      renders a compact icon button (for card headers)
export default function PrintTableButton({
  title,
  subtitle = '',
  columns,
  getRows,
  dateOf,
  dateLabel = '',
  initialRange,
  fixedRange,
  snapshot = false,
  orientation = 'portrait',
  iconOnly = false,
  disabled = false,
}) {
  const { user } = useAuth();
  const needsDialog = !snapshot && !fixedRange;

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  // Fetches, filters and prints. Returns true if something was printed.
  const run = async (range) => {
    setBusy(true);
    try {
      let rows = await getRows(range);
      if (needsDialog && dateOf) rows = filterByDateRange(rows, dateOf, range.from, range.to);

      if (!rows.length) {
        if (needsDialog) setDialogError('No records found for that date range.');
        else setSnackbar('There is nothing to print.');
        return false;
      }

      printTable({
        title,
        subtitle,
        columns,
        rows,
        from: range.from,
        to: range.to,
        dateLabel,
        snapshot,
        printedBy: user?.name || '',
        orientation,
      });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || 'Could not prepare the print view.';
      if (needsDialog) setDialogError(message);
      else setSnackbar(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleClick = () => {
    if (needsDialog) {
      setFrom(initialRange?.from || '');
      setTo(initialRange?.to || '');
      setDialogError('');
      setOpen(true);
    } else {
      run({ from: fixedRange?.from || '', to: fixedRange?.to || '' });
    }
  };

  const rangeInvalid = from && to && parseDateInput(from) > parseDateInput(to);

  const handleConfirm = async () => {
    if (rangeInvalid) return;
    setDialogError('');
    const printed = await run({ from, to });
    if (printed) setOpen(false);
  };

  const applyPreset = (preset) => {
    const today = new Date();
    if (preset === 'today') {
      setFrom(formatDateInput(today));
      setTo(formatDateInput(today));
    } else if (preset === 'week') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setFrom(formatDateInput(start));
      setTo(formatDateInput(today));
    } else if (preset === 'month') {
      setFrom(formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
      setTo(formatDateInput(today));
    } else {
      setFrom('');
      setTo('');
    }
    setDialogError('');
  };

  return (
    <>
      {iconOnly ? (
        <Tooltip title="Print">
          <span>
            <IconButton size="small" aria-label={`Print ${title}`} onClick={handleClick} disabled={disabled || busy}>
              <PrintOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={handleClick} disabled={disabled || busy}>
          {busy && !open ? 'Preparing…' : 'Print'}
        </Button>
      )}

      {needsDialog && (
        <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle className="font-semibold">Print {title}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Prints a black-and-white copy of this table with a header and the date range.
              {dateLabel
                ? ` Records are filtered by the date they were ${dateLabel}.`
                : ''}{' '}
              Leave both dates empty to print every date.
            </Typography>

            <div className="mb-3 flex flex-wrap gap-1.5">
              <Chip label="Today" size="small" onClick={() => applyPreset('today')} />
              <Chip label="Last 7 days" size="small" onClick={() => applyPreset('week')} />
              <Chip label="This month" size="small" onClick={() => applyPreset('month')} />
              <Chip label="All dates" size="small" onClick={() => applyPreset('all')} />
            </div>

            <div className="flex flex-wrap gap-3">
              <TextField
                type="date"
                size="small"
                label="From"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setDialogError('');
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1, minWidth: 140 }}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setDialogError('');
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1, minWidth: 140 }}
              />
            </div>

            {rangeInvalid && (
              <Alert severity="error" sx={{ mt: 2 }}>
                &quot;From&quot; must be on or before &quot;To&quot;.
              </Alert>
            )}
            {dialogError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {dialogError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintOutlinedIcon />}
              onClick={handleConfirm}
              disabled={busy || !!rangeInvalid}
            >
              {busy ? 'Preparing…' : 'Print'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar('')} message={snackbar} />
    </>
  );
}
