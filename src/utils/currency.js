// Single source of truth for how money is displayed across the app
// (Philippine peso). Change it here and every page follows.
const CURRENCY = 'PHP';
const LOCALE = 'en-PH';

export const CURRENCY_SYMBOL = '₱';

const formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });

export function formatCurrency(value) {
  return formatter.format(Number(value) || 0);
}
