import { createTheme, alpha } from '@mui/material';

// ═══ Shared brand colors (same in both modes) ═══
const CORE = {
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  primaryDark: '#5A4BD1',
  secondary: '#00CEC9',
  secondaryLight: '#55EFC4',
  accent: '#FD79A8',
  warning: '#FDCB6E',
  error: '#FF7675',
  success: '#00B894',
  info: '#74B9FF',
};

// ═══ Mode-specific surface colors ═══
const DARK = {
  ...CORE,
  bg: '#0B0B14',
  bgSidebar: '#0F0F1A',
  bgCard: '#161625',
  bgSurface: '#1A1A2E',
  bgElevated: '#1E2040',
  bgHover: '#252545',
  border: '#2A2A4A',
  borderLight: '#35356A',
  textPrimary: '#F2F2FA',
  textSecondary: '#B0B0D0',
  textMuted: '#7878A8',
};

const LIGHT = {
  ...CORE,
  bg: '#F5F5FA',
  bgSidebar: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgSurface: '#F0F0F8',
  bgElevated: '#FFFFFF',
  bgHover: '#EDEDF5',
  border: '#E0E0EE',
  borderLight: '#D0D0E0',
  textPrimary: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9090A8',
};

function buildTheme(mode) {
  const B = mode === 'dark' ? DARK : LIGHT;

  return createTheme({
    palette: {
      mode,
      primary: { main: B.primary, light: B.primaryLight, dark: B.primaryDark },
      secondary: { main: B.secondary, light: B.secondaryLight },
      error: { main: B.error },
      warning: { main: B.warning },
      success: { main: B.success },
      info: { main: B.info },
      background: { default: B.bg, paper: B.bgCard },
      text: { primary: B.textPrimary, secondary: B.textSecondary },
      divider: B.border,
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 500, color: B.textSecondary },
      body2: { color: B.textSecondary },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: B.bg,
            background: mode === 'dark'
              ? `linear-gradient(160deg, ${B.bg} 0%, #08081A 50%, #0A0A20 100%)`
              : B.bg,
            scrollbarWidth: 'thin',
            scrollbarColor: `${B.border} transparent`,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: B.border, borderRadius: 3 },
          },
          '*::-webkit-scrollbar': { width: 6 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': { background: B.border, borderRadius: 3 },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, padding: '8px 20px' },
          contained: {
            background: `linear-gradient(135deg, ${B.primary} 0%, ${B.primaryLight} 100%)`,
            boxShadow: `0 4px 15px ${alpha(B.primary, 0.4)}`,
            color: '#fff',
            '&:hover': {
              background: `linear-gradient(135deg, ${B.primaryDark} 0%, ${B.primary} 100%)`,
              boxShadow: `0 6px 20px ${alpha(B.primary, 0.5)}`,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              '& fieldset': { borderColor: B.border },
              '&:hover fieldset': { borderColor: B.primaryLight },
              '&.Mui-focused fieldset': { borderColor: B.primary },
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8, margin: '1px 8px', padding: '8px 12px',
            '&.Mui-selected': {
              background: alpha(B.primary, 0.15),
              '&:hover': { background: alpha(B.primary, 0.22) },
            },
            '&:hover': { background: alpha(B.primary, 0.08) },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 5, height: 6, backgroundColor: alpha(B.primary, 0.15) },
          bar: { borderRadius: 5, background: `linear-gradient(90deg, ${B.primary}, ${B.secondary})` },
        },
      },
    },
  });
}

// Pre-built themes
const darkTheme = buildTheme('dark');
const lightTheme = buildTheme('light');

// BRAND export uses dark palette by default (components that import BRAND directly)
// For theme-aware colors, components should use theme.palette instead
const BRAND = DARK;

export { BRAND, DARK, LIGHT, darkTheme, lightTheme, buildTheme };
export default darkTheme;
