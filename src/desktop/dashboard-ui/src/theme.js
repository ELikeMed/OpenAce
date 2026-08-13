import { createTheme, alpha } from '@mui/material';

const CORE = {
  primary: '#C9A96E',       // Warm gold
  primaryLight: '#D4BA8A',
  primaryDark: '#A88B4A',
  secondary: '#9CA3AF',     // Neutral gray
  secondaryLight: '#D1D5DB',
  accent: '#C9A96E',
  warning: '#D4A574',
  error: '#B85C5C',
  success: '#5C9E6F',
  info: '#6B8CAE',
};

const DARK = {
  ...CORE,
  bg: '#0A0A0A',
  bgSidebar: '#0E0E0E',
  bgCard: '#141414',
  bgSurface: '#181818',
  bgElevated: '#1C1C1C',
  bgHover: '#222222',
  border: '#1E1E1E',
  borderLight: '#2A2A2A',
  textPrimary: '#F0EDE8',     // Warm white
  textSecondary: '#A09A90',   // Warm gray
  textMuted: '#6B6560',       // Muted warm
};

const LIGHT = {
  ...CORE,
  primary: '#8B7340',
  primaryLight: '#A08850',
  primaryDark: '#6B5530',
  bg: '#FAF8F5',
  bgSidebar: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgSurface: '#F5F2EE',
  bgElevated: '#FFFFFF',
  bgHover: '#F0ECE6',
  border: '#E8E4DE',
  borderLight: '#DCD6CC',
  textPrimary: '#1A1814',
  textSecondary: '#6B6560',
  textMuted: '#9A9490',
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
            scrollbarWidth: 'thin',
            scrollbarColor: `${B.border} transparent`,
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: B.border, borderRadius: 3 },
          },
          '*::-webkit-scrollbar': { width: 5 },
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
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8, padding: '8px 20px' },
          contained: {
            background: B.primary,
            color: '#0A0A0A',
            boxShadow: 'none',
            '&:hover': { background: B.primaryDark, boxShadow: 'none' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              '& fieldset': { borderColor: B.border },
              '&:hover fieldset': { borderColor: B.borderLight },
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
              background: alpha(B.primary, 0.1),
              '&:hover': { background: alpha(B.primary, 0.15) },
            },
            '&:hover': { background: alpha(B.textPrimary, 0.04) },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 5, height: 2, backgroundColor: alpha(B.primary, 0.1) },
          bar: { borderRadius: 5, background: B.primary },
        },
      },
    },
  });
}

const darkTheme = buildTheme('dark');
const lightTheme = buildTheme('light');
const BRAND = DARK;

export { BRAND, DARK, LIGHT, darkTheme, lightTheme, buildTheme };
export default darkTheme;
