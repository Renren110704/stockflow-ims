import { useContext } from 'react';
import { ThemeModeContext } from '../context/ThemeModeContext';

export default function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}
