import { useTheme } from '@mui/material';

// Deep teal from the reference design — used for the right panel, the
// primary button and links on the Login / Register pages.
export const AUTH_PANEL_COLOR = '#043E50';

// Colors for the auth pages that adapt to the app's light/dark mode, so
// the dark-mode toggle still behaves on these screens.
export function useAuthColors() {
  const isDark = useTheme().palette.mode === 'dark';
  return {
    panel: AUTH_PANEL_COLOR,
    accent: isDark ? '#0E6A85' : AUTH_PANEL_COLOR,
    accentHover: isDark ? '#12809F' : '#03303E',
    link: isDark ? '#7CC4D6' : AUTH_PANEL_COLOR,
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F5F9FB',
    inputBorder: isDark ? 'rgba(255,255,255,0.12)' : '#E6EEF2',
  };
}
