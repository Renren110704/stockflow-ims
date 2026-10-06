// Parses CSV text into an array of row objects keyed by the header row.
// Handles quoted cells containing commas/newlines/escaped quotes, the
// mirror image of what utils/csvExport.js writes out — so a file
// exported from this app re-imports cleanly.
function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  // Normalize line endings so \r\n from Excel-exported files doesn't
  // leave stray \r characters in the last cell of each row.
  const input = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  // Final cell/row (files don't always end with a trailing newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

// Maps the export column headers (and a few common aliases) to the
// field names productService.bulkImportProducts expects.
const HEADER_ALIASES = {
  name: 'name',
  'product name': 'name',
  sku: 'sku',
  category: 'category',
  price: 'price',
  quantity: 'quantity',
  'minimum stock level': 'minimumStockLevel',
  'min stock': 'minimumStockLevel',
  status: 'status',
  supplier: 'supplier',
  description: 'description',
  'image url': 'imageUrl',
};

// Parses a CSV File into an array of product-shaped row objects ready
// for productService.bulkImportProducts. Throws with a clear message
// if the file has no recognizable header row.
export async function parseProductsCSV(file) {
  const text = await file.text();
  const rows = parseCSVRows(text);

  if (rows.length < 1) {
    throw new Error('The file appears to be empty.');
  }

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  const fields = headerRow.map((h) => HEADER_ALIASES[h] || null);

  if (!fields.includes('name') || !fields.includes('sku') || !fields.includes('category')) {
    throw new Error('CSV must include at least Name, SKU, and Category columns.');
  }

  return rows.slice(1).map((cells) => {
    const obj = {};
    fields.forEach((field, idx) => {
      if (field) obj[field] = (cells[idx] ?? '').trim();
    });
    return obj;
  });
}
