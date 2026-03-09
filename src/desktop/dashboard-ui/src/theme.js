import { createTheme, alpha } from '@mui/material';

const BRAND = {
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
  bg: '#0F0F1A',
  bgCard: '#1A1A2E',
  bgSurface: '#16213E',
  bgElevated: '#1E2746',
  border: '#2A2A4A',
  textPrimary: '#F2F2FA',
  textSecondary: '#C0C0D8',
  textMuted: '#8888A8',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: BRAND.primary,
      light: BRAND.primaryLight,
      dark: BRAND.primaryDark,
    },
    secondary: {
      main: BRAND.secondary,
      light: BRAND.secondaryLight,
    },
    error: { main: BRAND.error },
    warning: { main: BRAND.warning },
    success: { main: BRAND.success },
    info: { main: BRAND.info },
    background: {
      default: BRAND.bg,
      paper: BRAND.bgCard,
    },
    text: {
      primary: BRAND.textPrimary,
      secondary: BRAND.textSecondary,
    },
    divider: BRAND.border,
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontWeight: 500,
      color: BRAND.textSecondary,
    },
    body2: {
      color: BRAND.textSecondary,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '@import': "url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')",
        body: {
          background: `linear-gradient(135deg, ${BRAND.bg} 0%, #0A0A1A 50%, #0D1025 100%)`,
          scrollbarWidth: 'thin',
          scrollbarColor: `${BRAND.border} transparent`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: BRAND.border,
            borderRadius: 3,
          },
        },
        '*::-webkit-scrollbar': { width: 6 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: BRAND.border,
          borderRadius: 3,
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${BRAND.border}`,
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
        },
        contained: {
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`,
          boxShadow: `0 4px 15px ${alpha(BRAND.primary, 0.4)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`,
            boxShadow: `0 6px 20px ${alpha(BRAND.primary, 0.5)}`,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': { borderColor: BRAND.border },
            '&:hover fieldset': { borderColor: BRAND.primary },
            '&.Mui-focused fieldset': { borderColor: BRAND.primary },
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '3px 10px',
          padding: '10px 16px',
          '&.Mui-selected': {
            background: `linear-gradient(135deg, ${alpha(BRAND.primary, 0.18)} 0%, ${alpha(BRAND.primary, 0.10)} 100%)`,
            borderLeft: `4px solid ${BRAND.primary}`,
            boxShadow: `inset 0 0 20px ${alpha(BRAND.primary, 0.06)}, 0 2px 8px ${alpha(BRAND.primary, 0.15)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${alpha(BRAND.primary, 0.24)} 0%, ${alpha(BRAND.primary, 0.14)} 100%)`,
            },
          },
          '&:hover': {
            background: alpha(BRAND.primary, 0.08),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          height: 6,
          backgroundColor: alpha(BRAND.primary, 0.15),
        },
        bar: {
          borderRadius: 5,
          background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`,
        },
      },
    },
  },
});

export { BRAND };
export default theme;
