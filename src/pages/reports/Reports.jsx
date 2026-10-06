import { useState, useEffect, useCallback } from 'react';
import { Typography, Alert, Card, MenuItem, TextField, Table, TableHead, TableBody, TableRow, TableCell, Skeleton } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import reportService from '../../services/reportService';
import StatCard from '../../components/dashboard/StatCard';
import PrintTableButton from '../../components/common/PrintTableButton';
import { formatDateInput } from '../../utils/printTable';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaidIcon from '@mui/icons-material/Paid';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { formatCurrency, CURRENCY_SYMBOL } from '../../utils/currency';

export default function Reports() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportService.getInventoryReport({ days });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // The selected period ("Last 30 days") becomes the printed date range.
  const getPeriod = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h4" fontWeight={700}>
          Reports
        </Typography>
        <TextField select size="small" label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-w-[140px]">
          {[7, 30, 90, 180, 365].map((d) => (
            <MenuItem key={d} value={d}>
              Last {d} days
            </MenuItem>
          ))}
        </TextField>
      </div>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {loading || !report ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={92} />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Current Inventory Value" value={formatCurrency(report.kpis.currentValue)} icon={<PaidIcon />} color="primary" />
            <StatCard
              label={`Value Change (${days}d)`}
              value={`${report.kpis.valueChange >= 0 ? '+' : ''}${formatCurrency(report.kpis.valueChange)}`}
              icon={<TrendingUpIcon />}
              color={report.kpis.valueChange >= 0 ? 'success' : 'error'}
            />
            <StatCard label="Turnover Rate" value={report.kpis.turnoverRate} icon={<SwapVertIcon />} color="info" />
            <StatCard label="Dead Stock Value" value={formatCurrency(report.kpis.deadStockValue)} icon={<Inventory2Icon />} color="warning" />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <Typography variant="h6" fontWeight={700} className="mb-3">
                Inventory Value Over Time
              </Typography>
              <Typography variant="caption" color="text.secondary" className="mb-2 block">
                Valued at current prices; reconstructed from transaction history.
              </Typography>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.valueOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={30} />
                    <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => `${CURRENCY_SYMBOL}${v}`} />
                    <ChartTooltip formatter={(v) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="value" stroke="#2F6F6B" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <Typography variant="h6" fontWeight={700} className="mb-3">
                Top Moving Products
              </Typography>
              {report.topMovers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <InsightsOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary">
                    No stock-out activity in this period.
                  </Typography>
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.topMovers} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="sku" tick={{ fontSize: 11 }} width={80} />
                      <ChartTooltip formatter={(v, key) => (key === 'unitsOut' ? `${v} units` : v)} />
                      <Bar dataKey="unitsOut" fill="#3E8FB0" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Typography variant="h6" fontWeight={700}>
                Dead Stock
              </Typography>
              {report.deadStock.length > 0 && (
                <PrintTableButton
                  iconOnly
                  title="Dead Stock Report"
                  subtitle={`Report period: last ${days} days. Products still in stock with no Stock Out activity in over ${report.range.deadDays} days (as of today).`}
                  columns={[
                    { header: 'Product', value: (p) => p.name },
                    { header: 'SKU', value: (p) => p.sku },
                    { header: 'Qty on hand', value: (p) => p.quantity, align: 'right' },
                    { header: 'Value', value: (p) => formatCurrency(p.value), align: 'right' },
                    {
                      header: 'Days since last sold',
                      value: (p) => p.daysSinceSold ?? 'Never sold',
                      align: 'right',
                    },
                  ]}
                  getRows={async () => report.deadStock}
                  fixedRange={getPeriod()}
                />
              )}
            </div>
            <Typography variant="caption" color="text.secondary" className="mb-3 block">
              Products still in stock with no Stock Out activity in over {report.range.deadDays} days.
            </Typography>
            {report.deadStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Typography variant="body2" color="text.secondary">
                  No dead stock — everything is moving.
                </Typography>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Qty on hand</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Days since last sold</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.deadStock.map((p) => (
                      <TableRow key={p.productId} hover>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.sku}</TableCell>
                        <TableCell align="right">{p.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(p.value)}</TableCell>
                        <TableCell align="right">{p.daysSinceSold ?? 'Never sold'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
