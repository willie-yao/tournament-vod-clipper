import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import { Box, Typography, Container, Link, ThemeProvider } from '@mui/material';
import VideoSearch from './components/VideoSearch';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
} from '@apollo/client';
import theme from './theme';
import SetsView from './pages/SetsView';

const Copyright = () => {
  return (
    <Typography variant="body2" color="text.secondary" align="center">
      {'Copyright © '}
      <Link color="inherit" href="https://github.com/willie-yao">
        quillie ^^
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
};

const Main = () => {
  useEffect(() => {
    window.electron.ipcRenderer.createFolder('downloadedVODs');
  }, []);

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4, alignContent: 'center' }}>
        <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
          Tournament VOD Clipper
        </Typography>
        <VideoSearch />
        <Copyright />
      </Box>
    </Container>
  );
};

export default function App() {
  const [token, setToken] = useState(window.electron.store.get('apikey'));

  useEffect(() => {
    window.electron.ipcRenderer.getApiKey().then((key) => {
      // setToken(key)
    });
  });

  const link = createHttpLink({
    uri: 'https://api.start.gg/gql/alpha',
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });

  const client = new ApolloClient({
    uri: 'https://api.start.gg/gql/alpha',
    cache: new InMemoryCache(),
    link: link,
  });
  return (
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <Router>
          <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/SetsView" element={<SetsView />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </ApolloProvider>
  );
}
