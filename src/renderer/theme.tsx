import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e7bc78',
      contrastText: '#211b14',
    },
    secondary: {
      main: '#e7bc78',
      contrastText: '#211b14',
    },
    background: {
      default: '#202327',
      paper: '#262a2f',
    },
    text: { primary: '#ebedf0', secondary: '#a9b0ba' },
    divider: '#3a3f46',
    success: { main: '#a5d4b4' },
    warning: { main: '#e7bc78' },
    error: { main: '#f1a69c' },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 13,
    button: { textTransform: 'none', fontWeight: 600 },
    h4: { fontSize: '1.8rem', fontWeight: 600, letterSpacing: '-0.03em' },
    h6: { fontSize: '1rem', fontWeight: 600 },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 32 } },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiAlert: { styleOverrides: { root: { fontSize: 12 } } },
  },
});

export default theme;
