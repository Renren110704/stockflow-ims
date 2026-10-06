// Print support for every table in the app.
//
// printTable() builds a self-contained, black-and-white report (report title,
// date range, who printed it, then the table) and sends it to the browser's
// print dialog through a hidden iframe, so the app's own styles can never
// leak into the printout and no pop-up window is needed.
//
// The title block lives inside <thead>, which browsers repeat at the top of
// every printed page, so the header and the column names appear on each page.

const APP_NAME = 'StockFlow';
const SYSTEM_NAME = 'Inventory Management System';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

// ── Date helpers (date inputs use 'YYYY-MM-DD' strings) ─────────────

// 'YYYY-MM-DD' -> local Date at 00:00, or null if empty/invalid.
export function parseDateInput(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Date -> 'YYYY-MM-DD' in LOCAL time (toISOString would shift the day).
export function formatDateInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const formatLongDate = (date) =>
  date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

// Keeps rows whose date falls within [from, to], both inclusive of the whole
// day. Rows with no date are dropped when a range is set.
export function filterByDateRange(rows, getDate, from, to) {
  const start = parseDateInput(from);
  const end = parseDateInput(to);
  if (!start && !end) return rows;
  const endOfDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999) : null;

  return rows.filter((row) => {
    const raw = getDate(row);
    if (!raw) return false;
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) return false;
    if (start && when < start) return false;
    if (endOfDay && when > endOfDay) return false;
    return true;
  });
}

function describeRange({ from, to, snapshot, dateLabel }) {
  if (snapshot) return `As of ${new Date().toLocaleString()}`;

  const start = parseDateInput(from);
  const end = parseDateInput(to);
  let text;
  if (start && end) text = `From ${formatLongDate(start)} to ${formatLongDate(end)}`;
  else if (start) text = `From ${formatLongDate(start)} onward`;
  else if (end) text = `Up to ${formatLongDate(end)}`;
  else text = 'All dates';

  return dateLabel && (start || end) ? `${text} (by date ${dateLabel})` : text;
}

// ── Report document ────────────────────────────────────────────────

const PRINT_CSS = (orientation) => `
  @page { size: A4 ${orientation}; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; }
  /* Repeats the report header + column names at the top of every page. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; color: #000; background: #fff; }
  th { font-weight: 700; border-bottom: 2px solid #000; }
  th.report-head { border: 0; border-bottom: 2px solid #000; padding: 0 0 8px; }
  .brand { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .title { font-size: 20px; font-weight: 700; margin: 3px 0 2px; }
  .subtitle { font-size: 11px; font-weight: 400; margin: 0 0 6px; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 11px; font-weight: 400; }
  .r { text-align: right; }
  .c { text-align: center; }
  .footer { display: flex; justify-content: space-between; margin-top: 10px; font-size: 10px; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

const alignClass = (align) => (align === 'right' ? ' class="r"' : align === 'center' ? ' class="c"' : '');

// columns: [{ header: 'Name', value: (row) => row.name, align?: 'right'|'center' }]
export function buildPrintHtml({
  title,
  subtitle = '',
  columns,
  rows,
  from = '',
  to = '',
  dateLabel = '',
  snapshot = false,
  printedBy = '',
  orientation = 'portrait',
}) {
  const printedAt = new Date().toLocaleString();
  const rangeText = describeRange({ from, to, snapshot, dateLabel });

  const headerCells = columns
    .map((col) => `<th${alignClass(col.align)}>${escapeHtml(col.header)}</th>`)
    .join('');

  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const raw = col.value(row);
          const text = raw === null || raw === undefined || raw === '' ? '—' : raw;
          return `<td${alignClass(col.align)}>${escapeHtml(text)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${title} - ${new Date().toLocaleDateString()}`)}</title>
<style>${PRINT_CSS(orientation)}</style>
</head>
<body>
<table>
  <thead>
    <tr>
      <th class="report-head" colspan="${columns.length}">
        <div class="brand">${escapeHtml(APP_NAME)} &middot; ${escapeHtml(SYSTEM_NAME)}</div>
        <div class="title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
        <div class="meta">
          <span><strong>Date range:</strong> ${escapeHtml(rangeText)}</span>
          <span><strong>Printed:</strong> ${escapeHtml(printedAt)}${printedBy ? ` by ${escapeHtml(printedBy)}` : ''}</span>
        </div>
      </th>
    </tr>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">
  <span>Total records: ${rows.length}</span>
  <span>&mdash; End of report &mdash;</span>
</div>
</body>
</html>`;
}

// Loads the HTML into a hidden iframe and opens the print dialog.
function printHtmlDocument(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument || frameWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  frameWindow.addEventListener('afterprint', () => setTimeout(cleanup, 500));
  // Safety net for browsers that never fire afterprint.
  setTimeout(cleanup, 5 * 60 * 1000);

  // Give the iframe a moment to lay out before printing.
  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 250);
}

export function printTable(options) {
  printHtmlDocument(buildPrintHtml(options));
}
