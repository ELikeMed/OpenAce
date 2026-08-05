import { createTheme, alpha } from '@mui/material';

const CORE = {
  primary: '#8B7EC8',
  primaryLight: '#A99DE0',
  primaryDark: '#6B5FA8',
  secondary: '#5CB8B2',
  secondaryLight: '#7DD4CE',
  accent: '#C87DA8',
  warning: '#D4B76A',
  error: '#C87070',
  success: '#5CB882',
  info: '#6BAAD4',
};

const DARK = {
  ...CORE,
  bg: '#0C0B10',
  bgSidebar: '#100F16',
  bgCard: '#16151E',
  bgSurface: '#1A1924',
  bgElevated: '#201F2C',
  bgHover: '#262535',
  border: '#2A2840',
  borderLight: '#363452',
  textPrimary: '#E8E6F0',
  textSecondary: '#B0ACCA',
  textMuted: '#726E90',
};

const LIGHT = {
  ...CORE,
  bg: '#F8F7FC',
  bgSidebar: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgSurface: '#F2F1F8',
  bgElevated: '#FFFFFF',
  bgHover: '#EEEDF5',
  border: '#E0DEF0',
  borderLight: '#D4D2E4',
  textPrimary: '#1A1928',
  textSecondary: '#5A587A',
  textMuted: '#908EA8',
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
            background: B.primary,
            color: '#fff',
            boxShadow: 'none',
            '&:hover': { background: B.primaryDark, boxShadow: 'none' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
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
              background: alpha(B.primary, 0.12),
              '&:hover': { background: alpha(B.primary, 0.18) },
            },
            '&:hover': { background: alpha(B.primary, 0.06) },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 5, height: 6, backgroundColor: alpha(B.primary, 0.12) },
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
