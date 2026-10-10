import { TYPE_LABEL, describeLocation } from './transactionLabels';

// Text cells starting with these characters are evaluated as formulas by
// Excel/Sheets (CSV injection), so they get a leading apostrophe.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const escapeCell = (value) => {
  let str = String(value ?? '');
  if (typeof value === 'string' && FORMULA_TRIGGER.test(str)) str = `'${str}`;
  // Quote any cell containing a comma, quote, or newline, per CSV convention.
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Builds a CSV from a header row + row arrays and triggers a browser
// download. Client-side only — the data is already on the page.
function downloadCSV(headers, rows, filename) {
  const csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  // The BOM tells Excel the file is UTF-8, so ₱ and accented names display correctly.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProductsToCSV(products, filename = 'inventory-export.csv') {
  downloadCSV(
    ['Name', 'SKU', 'Category', 'Price', 'Quantity', 'Minimum Stock Level', 'Status', 'Supplier'],
    products.map((p) => [
      p.name,
      p.sku,
      p.category?.name || '',
      p.price,
      p.quantity,
      p.minimumStockLevel,
      p.status,
      p.supplier || '',
    ]),
    filename
  );
}

// Same pattern as exportProductsToCSV, for the Transactions audit trail.
export function exportTransactionsToCSV(transactions, filename = 'transactions-export.csv') {
  downloadCSV(
    ['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Location', 'Reason/Supplier', 'Reference', 'Performed By'],
    transactions.map((t) => [
      new Date(t.createdAt).toLocaleString(),
      t.product?.name || '',
      t.product?.sku || '',
      TYPE_LABEL[t.type] || t.type,
      t.quantity,
      describeLocation(t),
      t.type === 'STOCK_IN' ? t.supplier : t.reason,
      t.referenceNumber || '',
      t.performedBy?.name || '',
    ]),
    filename
  );
}
