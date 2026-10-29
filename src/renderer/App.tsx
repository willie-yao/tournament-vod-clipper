import { useMemo } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ThemeProvider } from '@mui/material';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import YTUploadView from './pages/YTUploadView';
import theme from './theme';
import MainView from './pages/MainView';
import SetsView from './pages/SetsView';

export default function App() {
  const client = useMemo(() => {
    const auth = setContext(async () => {
      const token = await window.electron.store.getSecret('apikey');
      if (!token) {
        throw new Error('Save your start.gg API key before retrieving sets.');
      }
      return { headers: { authorization: `Bearer ${token}` } };
    });
    return new ApolloClient({
      cache: new InMemoryCache(),
      link: auth.concat(
        createHttpLink({ uri: 'https://api.start.gg/gql/alpha' })
      ),
    });
  }, []);
  return (
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <Router>
          <Routes>
            <Route path="/" element={<MainView />} />
            <Route path="/SetsView" element={<SetsView />} />
            <Route path="/YTUploadView" element={<YTUploadView />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </ApolloProvider>
  );
}
