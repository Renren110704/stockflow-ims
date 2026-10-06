import { Link as RouterLink } from 'react-router-dom';
import { Typography, Button } from '@mui/material';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <SearchOffRoundedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography variant="h2" fontWeight={700}>
        404
      </Typography>
      <Typography variant="body1" color="text.secondary" className="mb-2">
        The page you&apos;re looking for doesn&apos;t exist.
      </Typography>
      <Button component={RouterLink} to="/dashboard" variant="contained">
        Back to dashboard
      </Button>
    </div>
  );
}
