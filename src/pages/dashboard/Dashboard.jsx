import { useState, useEffect } from 'react';
import { Typography, Alert } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import Inventory from '@mui/icons-material/Inventory';
import PaidIcon from '@mui/icons-material/Paid';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import dashboardService from '../../services/dashboardService';
import StatCard from '../../components/dashboard/StatCard';
import LowStockTable from '../../components/dashboard/LowStockTable';
import RecentTransactions from '../../components/dashboard/RecentTransactions';
import InventoryDistributionChart from '../../components/dashboard/InventoryDistributionChart';
import { formatCurrency } from '../../utils/currency';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dashboardService.getStats();
        if (!cancelled) setStats(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <Typography variant="h4" fontWeight={700} className="mb-6">
        Inventory Management
      </Typography>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Products"
          value={stats?.totalProducts ?? 0}
          icon={<Inventory2Icon />}
          color="primary"
          loading={loading}
        />
        <StatCard
          label="Total Quantity"
          value={stats?.totalInventoryQuantity ?? 0}
          icon={<Inventory />}
          color="info"
          loading={loading}
        />
        <StatCard
          label="Inventory Value"
          value={formatCurrency(stats?.totalInventoryValue ?? 0)}
          icon={<PaidIcon />}
          color="success"
          loading={loading}
        />
        <StatCard
          label="Low Stock"
          value={stats?.lowStockCount ?? 0}
          icon={<WarningAmberIcon />}
          color="warning"
          loading={loading}
        />
        <StatCard
          label="Out of Stock"
          value={stats?.outOfStockCount ?? 0}
          icon={<ErrorOutlineIcon />}
          color="error"
          loading={loading}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <InventoryDistributionChart data={stats?.categoryBreakdown || []} />
        </div>
        <div className="lg:col-span-7">
          <LowStockTable products={stats?.lowStockProducts || []} />
        </div>
      </div>

      <RecentTransactions transactions={stats?.recentTransactions || []} />
    </div>
  );
}
