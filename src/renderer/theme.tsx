import { createTheme } from '@mui/material/styles';

// A custom theme for this app
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f06292',
    },
    secondary: {
      main: '#ce93d8',
    },
    background: {
      default: '#212121',
      paper: '#424242',
    },
  },
});

export default theme;
