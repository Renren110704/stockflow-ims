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
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { TYPE_LABEL, TYPE_COLOR } from '../../utils/transactionLabels';
import PrintTableButton from '../common/PrintTableButton';

export default function RecentTransactions({ transactions = [] }) {
  return (
    <Card className="h-full p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Typography variant="h6" fontWeight={700}>
          Recent Transactions
        </Typography>
        {transactions.length > 0 && (
          <PrintTableButton
            iconOnly
            snapshot
            title="Recent Transactions"
            columns={[
              { header: 'Product', value: (t) => t.product?.name },
              { header: 'Type', value: (t) => TYPE_LABEL[t.type] || t.type },
              { header: 'Qty', value: (t) => t.quantity, align: 'right' },
              { header: 'By', value: (t) => t.performedBy?.name },
              { header: 'Date', value: (t) => new Date(t.createdAt).toLocaleString() },
            ]}
            getRows={async () => transactions}
          />
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <SwapHorizRoundedIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            No inventory movements yet.
          </Typography>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell>{t.product?.name || '—'}</TableCell>
                  <TableCell>
                    <Chip label={TYPE_LABEL[t.type] || t.type} size="small" color={TYPE_COLOR[t.type] || 'default'} />
                  </TableCell>
                  <TableCell align="right">{t.quantity}</TableCell>
                  <TableCell>{t.performedBy?.name || '—'}</TableCell>
                  <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
