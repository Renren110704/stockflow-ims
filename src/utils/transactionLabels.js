// Display helpers shared by the transactions list, dashboard widgets and CSV export.

export const TYPE_LABEL = {
  STOCK_IN: 'Stock In',
  STOCK_OUT: 'Stock Out',
  TRANSFER: 'Transfer',
};

// MUI Chip colors per transaction type.
export const TYPE_COLOR = {
  STOCK_IN: 'success',
  STOCK_OUT: 'default',
  TRANSFER: 'info',
};

// "Warehouse A", "Main → Store 2", or '' when the movement wasn't tied to a location.
export function describeLocation(t) {
  if (t.type === 'TRANSFER') {
    return `${t.fromLocation?.name || 'Unassigned'} → ${t.toLocation?.name || 'Unassigned'}`;
  }
  return t.location?.name || '';
}
