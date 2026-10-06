import {
  Card,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from '@mui/material';
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded';
import PrintTableButton from '../common/PrintTableButton';

export default function LowStockTable({ products = [] }) {
  return (
    <Card className="h-full p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Typography variant="h6" fontWeight={700}>
          Low &amp; Out of Stock
        </Typography>
        {products.length > 0 && (
          <PrintTableButton
            iconOnly
            snapshot
            title="Low & Out of Stock Products"
            columns={[
              { header: 'Product', value: (p) => p.name },
              { header: 'SKU', value: (p) => p.sku },
              { header: 'Qty', value: (p) => p.quantity, align: 'right' },
              { header: 'Min', value: (p) => p.minimumStockLevel, align: 'right' },
              { header: 'Status', value: (p) => p.status },
            ]}
            getRows={async () => products}
          />
        )}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <InventoryRoundedIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            All products are sufficiently stocked.
          </Typography>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Min</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p._id} hover>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.sku}</TableCell>
                  <TableCell align="right">{p.quantity}</TableCell>
                  <TableCell align="right">{p.minimumStockLevel}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={p.status}
                      size="small"
                      color={p.status === 'Out of Stock' ? 'error' : 'warning'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
