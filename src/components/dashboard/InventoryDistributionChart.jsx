import { Card, Typography } from '@mui/material';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#2F6F6B', '#3E8FB0', '#E8A33D', '#E1614D', '#4CAF7D', '#7C8FBF', '#B98CC6', '#5CA6A0'];

export default function InventoryDistributionChart({ data = [] }) {
  return (
    <Card className="h-full p-5">
      <Typography variant="h6" fontWeight={700} className="mb-3">
        Inventory by Category
      </Typography>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <DonutLargeRoundedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            No inventory data yet.
          </Typography>
        </div>
      ) : (
        <div className="h-70">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="quantity" nameKey="name" outerRadius={90} label>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
