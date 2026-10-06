import { Card, Box, Typography, Skeleton } from '@mui/material';

// Generic dashboard stat tile. `color` accepts any MUI palette key
// (e.g. 'primary', 'warning', 'error') so callers can signal severity
// (low stock / out of stock) without this component knowing about
// inventory concepts specifically.
export default function StatCard({ label, value, icon, color = 'primary', loading = false }) {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4 p-5">
        {/* Icon tile's color must stay theme-driven (palette key resolved
            at runtime, light/dark aware), so it keeps MUI's sx; everything
            else here is plain Tailwind layout. */}
        <Box
          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl [&>svg]:text-[26px]"
          sx={{ bgcolor: `${color}.light`, color: `${color}.dark` }}
        >
          {icon}
        </Box>
        <div className="min-w-0">
          <Typography variant="body2" color="text.secondary" fontWeight={600} noWrap>
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={60} height={32} />
          ) : (
            <Typography variant="h5" fontWeight={700} noWrap>
              {value}
            </Typography>
          )}
        </div>
      </div>
    </Card>
  );
}
