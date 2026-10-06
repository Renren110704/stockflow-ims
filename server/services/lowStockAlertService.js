import Product from '../models/Product.js';
import User from '../models/User.js';
import { sendEmail } from './emailService.js';

function buildDigestHtml(lowStock, outOfStock) {
  const row = (p) =>
    `<tr><td style="padding:4px 10px;border-bottom:1px solid #eee">${p.name}</td>` +
    `<td style="padding:4px 10px;border-bottom:1px solid #eee">${p.sku}</td>` +
    `<td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right">${p.quantity}</td>` +
    `<td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right">${p.minimumStockLevel}</td></tr>`;

  const section = (title, products) =>
    products.length === 0
      ? ''
      : `<h3 style="margin:16px 0 6px">${title} (${products.length})</h3>
         <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
           <thead><tr>
             <th style="text-align:left;padding:4px 10px">Product</th>
             <th style="text-align:left;padding:4px 10px">SKU</th>
             <th style="text-align:right;padding:4px 10px">Qty</th>
             <th style="text-align:right;padding:4px 10px">Min</th>
           </tr></thead>
           <tbody>${products.map(row).join('')}</tbody>
         </table>`;

  return `<div style="font-family:sans-serif">
    <h2 style="margin-bottom:4px">Inventory Alert</h2>
    <p style="color:#555;margin-top:0">Daily stock-level summary from StockFlow.</p>
    ${section('Out of Stock', outOfStock)}
    ${section('Low Stock', lowStock)}
  </div>`;
}

// Queries current low/out-of-stock products and, if any exist, emails a
// digest to every admin. Returns a small summary object so both the
// cron job and the manual "send now" endpoint can report what happened,
// without duplicating the query/email logic between them.
export async function runLowStockAlertCheck() {
  const [lowStock, outOfStock, admins] = await Promise.all([
    Product.find({ status: 'Low Stock' }).select('name sku quantity minimumStockLevel').sort({ quantity: 1 }),
    Product.find({ status: 'Out of Stock' }).select('name sku quantity minimumStockLevel').sort({ name: 1 }),
    // archivedAt: null also matches accounts created before the field existed.
    User.find({ role: 'admin', archivedAt: null }).select('email'),
  ]);

  if (lowStock.length === 0 && outOfStock.length === 0) {
    return { sent: false, reason: 'Nothing to report', lowStockCount: 0, outOfStockCount: 0 };
  }

  const to = admins.map((a) => a.email);
  const result = await sendEmail({
    to,
    subject: `StockFlow: ${outOfStock.length} out of stock, ${lowStock.length} low stock`,
    html: buildDigestHtml(lowStock, outOfStock),
  });

  return { ...result, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length, recipients: to };
}
