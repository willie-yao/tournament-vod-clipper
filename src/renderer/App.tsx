import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import {  ThemeProvider } from '@mui/material';
import YTUploadView from './pages/YTUploadView';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
} from '@apollo/client';
import theme from './theme';
import MainView from './pages/MainView';
import SetsView from './pages/SetsView';

export default function App() {
  const token = window.electron.store.get('apikey')
    ? window.electron.store.get('apikey')
    : '';

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
            <Route path="/" element={<MainView />} />
            <Route path="/SetsView" element={<SetsView />} />
            <Route path="/YTUploadView" element={<YTUploadView />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </ApolloProvider>
  );
}
