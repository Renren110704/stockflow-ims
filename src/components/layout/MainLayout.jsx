import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  useMediaQuery,
  Avatar,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import useAuth from '../../hooks/useAuth';
import useThemeMode from '../../hooks/useThemeMode';
import dashboardService from '../../services/dashboardService';
import ConfirmDialog from '../common/ConfirmDialog';
import GlobalSearch from './GlobalSearch';

const DRAWER_WIDTH = 272;

// Sidebar keeps a constant dark-teal identity regardless of light/dark mode.
// Every other surface follows the active MUI theme.
const SIDEBAR_BG = '#153033';
const SIDEBAR_BG_ACTIVE = '#28565C';
const SIDEBAR_TEXT = 'rgba(255,255,255,0.7)';
const SIDEBAR_TEXT_ACTIVE = '#FFFFFF';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Scan Product', path: '/scan', icon: <QrCodeScannerRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Products', path: '/products', icon: <Inventory2RoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Categories', path: '/categories', icon: <CategoryRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Locations', path: '/locations', icon: <PlaceRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Transactions', path: '/transactions', icon: <SwapHorizRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Purchase Orders', path: '/purchase-orders', icon: <LocalShippingRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Reports', path: '/reports', icon: <AssessmentRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Profile', path: '/profile', icon: <PersonRoundedIcon />, roles: ['admin', 'staff'] },
  { label: 'Users', path: '/users', icon: <PeopleRoundedIcon />, roles: ['admin'] },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:900px)');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [alertStats, setAlertStats] = useState({ lowStockCount: 0, outOfStockCount: 0, lowStockProducts: [] });
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshAlerts = useCallback(async () => {
    try {
      const res = await dashboardService.getStats();
      setAlertStats({
        lowStockCount: res.data.lowStockCount,
        outOfStockCount: res.data.outOfStockCount,
        lowStockProducts: res.data.lowStockProducts,
      });
    } catch {
      // Silently ignore — the bell just won't update this cycle. A
      // logged-out/expired session is already handled by the axios
      // interceptor, so no need to duplicate that here.
    }
  }, []);

  // MainLayout mounts once for the whole authenticated session (Outlet
  // re-renders per page, this component doesn't), so a single interval
  // here is enough to keep the bell reasonably fresh across navigation.
  useEffect(() => {
    refreshAlerts();
    const interval = setInterval(refreshAlerts, 60000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  const alertCount = alertStats.lowStockCount + alertStats.outOfStockCount;

  const handleSendAlertNow = async () => {
    setSendingAlert(true);
    try {
      await dashboardService.sendLowStockAlertNow();
    } finally {
      setSendingAlert(false);
      setNotifAnchor(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  const visibleItems = navItems.filter((item) => item.roles.includes(user?.role));
  const activeItem = [...navItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => location.pathname.startsWith(item.path));

  const initials = (user?.name || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const drawerContent = (
    <div className="flex h-full flex-col">
      {/* On mobile the fixed AppBar sits above the drawer; reserve its height
          so the logo isn't hidden underneath it. */}
      {isMobile && <Toolbar />}

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: SIDEBAR_BG_ACTIVE }}
        >
          <WarehouseRoundedIcon sx={{ color: '#fff', fontSize: 22 }} />
        </div>
        <div className="min-w-0">
          <Typography variant="subtitle1" fontWeight={700} noWrap lineHeight={1.2} sx={{ color: '#fff' }}>
            StockFlow
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: SIDEBAR_TEXT }}>
            Inventory Management
          </Typography>
        </div>
      </div>

      {/* User profile */}
      <div
        className="mx-4 mb-4 flex items-center gap-3 rounded-xl px-3.5 py-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
      >
        <Avatar
          src={user?.avatar || undefined}
          alt={user?.name}
          sx={{ bgcolor: SIDEBAR_BG_ACTIVE, color: '#fff', fontWeight: 700, width: 38, height: 38 }}
        >
          {initials}
        </Avatar>
        <div className="min-w-0">
          <Typography variant="body2" fontWeight={600} noWrap sx={{ color: '#fff' }}>
            {user?.name || 'User'}
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: SIDEBAR_TEXT, textTransform: 'capitalize' }}>
            {user?.role || ''}
          </Typography>
        </div>
      </div>

      {/* Nav */}
      <List className="flex-1 px-4">
        {visibleItems.map((item) => {
          const active = item.path === activeItem?.path;
          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className="mb-1 rounded-lg py-2.5"
              sx={{
                color: active ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT,
                bgcolor: active ? SIDEBAR_BG_ACTIVE : 'transparent',
                '&:hover': { bgcolor: SIDEBAR_BG_ACTIVE, color: SIDEBAR_TEXT_ACTIVE },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />
      <List className="px-4 py-4">
        <ListItemButton
          onClick={() => {
            setMobileOpen(false);
            setLogoutOpen(true);
          }}
          className="rounded-lg"
          sx={{
            color: SIDEBAR_TEXT,
            '&:hover': { bgcolor: SIDEBAR_BG_ACTIVE, color: '#fff' },
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 500, fontSize: 14 }} />
        </ListItemButton>
      </List>
    </div>
  );

  return (
    // Background comes from MUI's CssBaseline (theme.palette.background.default),
    // so this wrapper only needs to guarantee full-viewport height.
    <div className="min-h-screen">
      {/* Mobile top bar */}
      {isMobile && (
        <AppBar position="fixed" sx={{ bgcolor: SIDEBAR_BG, zIndex: (t) => t.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} className="mr-2">
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flexGrow: 1, color: '#fff' }}>
              StockFlow
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile drawer: overlay, closes on navigation/backdrop click */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: SIDEBAR_BG } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        // Desktop sidebar: fixed to the viewport, independent of document
        // flow, so its width can never be miscalculated by flex/grid siblings.
        <nav
          className="fixed top-0 left-0 h-screen overflow-y-auto"
          style={{ width: DRAWER_WIDTH, backgroundColor: SIDEBAR_BG, zIndex: 1200 }}
        >
          {drawerContent}
        </nav>
      )}

      {/* Content: offset from the fixed sidebar with an explicit margin,
          never relying on flex layout to reserve the space. */}
      <main
        className="box-border min-h-screen w-full md:w-[calc(100%-var(--drawer-w))]"
        style={{ marginLeft: isMobile ? 0 : DRAWER_WIDTH, '--drawer-w': `${DRAWER_WIDTH}px` }}
      >
        {isMobile && <Toolbar />}

        {/* Top header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 pt-4 pb-2 md:px-8 md:pt-8">
          <div className="min-w-0">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Typography>
            <Typography variant="h6" fontWeight={700} noWrap>
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </Typography>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>
            <Tooltip title="Notifications">
              <IconButton
                sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
                onClick={(e) => {
                  setNotifAnchor(e.currentTarget);
                  refreshAlerts();
                }}
              >
                <Badge badgeContent={alertCount} color="error" max={99}>
                  <NotificationsNoneRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={notifAnchor}
              open={!!notifAnchor}
              onClose={() => setNotifAnchor(null)}
              slotProps={{ paper: { sx: { width: 320, maxHeight: 420 } } }}
            >
              {alertCount === 0 && (
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    No stock alerts right now.
                  </Typography>
                </MenuItem>
              )}
              {alertStats.outOfStockCount > 0 && (
                <MenuItem disabled className="opacity-100!">
                  <ListItemIcon>
                    <ErrorOutlineRoundedIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <Typography variant="body2" fontWeight={600}>
                    {alertStats.outOfStockCount} product(s) out of stock
                  </Typography>
                </MenuItem>
              )}
              {alertStats.lowStockProducts.slice(0, 5).map((p) => (
                <MenuItem
                  key={p._id}
                  onClick={() => {
                    setNotifAnchor(null);
                    navigate('/products?status=Low+Stock');
                  }}
                >
                  <ListItemIcon>
                    <WarningAmberRoundedIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <div className="min-w-0">
                    <Typography variant="body2" noWrap>
                      {p.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.quantity} left (min {p.minimumStockLevel})
                    </Typography>
                  </div>
                </MenuItem>
              ))}
              {alertCount > 0 && (
                <MenuItem
                  onClick={() => {
                    setNotifAnchor(null);
                    navigate('/products');
                  }}
                >
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    View all products
                  </Typography>
                </MenuItem>
              )}
              {user?.role === 'admin' && alertCount > 0 && (
                <MenuItem onClick={handleSendAlertNow} disabled={sendingAlert}>
                  <ListItemIcon>
                    <MarkEmailReadRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  <Typography variant="body2">{sendingAlert ? 'Sending…' : 'Email this alert now'}</Typography>
                </MenuItem>
              )}
            </Menu>
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                onClick={toggleMode}
                sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
                aria-label="Toggle dark mode"
              >
                {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.name || 'Profile'}>
              <Avatar
                component={RouterLink}
                to="/profile"
                src={user?.avatar || undefined}
                alt={user?.name}
                sx={{
                  bgcolor: 'primary.main',
                  width: 40,
                  height: 40,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                {initials}
              </Avatar>
            </Tooltip>
          </div>
        </div>

        <div className="px-4 pb-8 md:px-8">
          <Outlet />
        </div>
      </main>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        message="You'll need to sign in again to access StockFlow."
        confirmLabel="Log out"
        confirmColor="primary"
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
        loading={loggingOut}
      />
    </div>
  );
}
