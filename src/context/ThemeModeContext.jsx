import { createContext, useState, useMemo, useCallback, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeModeContext = createContext(null);

const STORAGE_KEY = 'themeMode';

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'light');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Central design system for the whole app: a soft teal/blue admin-dashboard
  // palette with rounded, low-elevation surfaces. Because every page already
  // builds on MUI primitives (Card, Paper, Button, Table, Chip, TextField),
  // changing the theme here restyles the entire application consistently
  // without touching any page's markup or logic.
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#2F6F6B',
            light: mode === 'light' ? '#DCEEEA' : '#25423F',
            dark: '#1D4E4A',
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#3D5A80',
            light: mode === 'light' ? '#E1E7F0' : '#28374A',
            dark: '#28405C',
          },
          success: {
            main: '#4CAF7D',
            light: mode === 'light' ? '#E1F3E8' : '#25402F',
            dark: '#2E7D5B',
          },
          warning: {
            main: '#E8A33D',
            light: mode === 'light' ? '#FCEFD9' : '#453620',
            dark: '#B9791F',
          },
          error: {
            main: '#E1614D',
            light: mode === 'light' ? '#FBE1DC' : '#472822',
            dark: '#B8402E',
          },
          info: {
            main: '#3E8FB0',
            light: mode === 'light' ? '#DCEEF5' : '#213C44',
            dark: '#286E8A',
          },
          background: {
            default: mode === 'light' ? '#EEF4F6' : '#0F1E21',
            paper: mode === 'light' ? '#FFFFFF' : '#17282B',
          },
          text: {
            primary: mode === 'light' ? '#1F3A3D' : '#EAF2F3',
            secondary: mode === 'light' ? '#6E8A8D' : '#9DB4B6',
          },
          divider: mode === 'light' ? '#E4EDEF' : '#25393C',
        },
        shape: {
          borderRadius: 14,
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          h4: { fontWeight: 700 },
          h5: { fontWeight: 700 },
          h6: { fontWeight: 700 },
          subtitle1: { fontWeight: 600 },
          button: { fontWeight: 600 },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                scrollbarColor: '#B7CBCE transparent',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: { backgroundImage: 'none' },
            },
          },
          MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
              root: {
                borderRadius: 16,
                border: mode === 'light' ? '1px solid #E4EDEF' : '1px solid #25393C',
                boxShadow:
                  mode === 'light'
                    ? '0 6px 20px rgba(15, 45, 48, 0.06)'
                    : '0 6px 20px rgba(0, 0, 0, 0.25)',
              },
            },
          },
          MuiCardContent: {
            styleOverrides: {
              root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: { borderRadius: 10, textTransform: 'none', boxShadow: 'none' },
              contained: {
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: { borderRadius: 8, fontWeight: 600 },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: mode === 'light' ? '#E9F0F1' : '#233639',
              },
              head: {
                color: mode === 'light' ? '#6E8A8D' : '#9DB4B6',
                fontWeight: 700,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: { borderRadius: 10 },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: { border: 'none' },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: { boxShadow: 'none' },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
