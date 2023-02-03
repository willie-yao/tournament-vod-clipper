import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import { Box, Typography, Container, Link, ThemeProvider } from '@mui/material';
import VideoSearch from './components/VideoSearch';
import YTUploadView from './pages/YTUploadView';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
} from '@apollo/client';
import theme from './theme';
import SetsView from './pages/SetsView';
import { GET_ALL_CHARACTERS } from './common/StartggQueries';
import { useQuery } from '@apollo/client';
import NavMenu from './common/NavMenu';

interface CharacterData {
  id: number;
  name: string;
}

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

  const { loading, error, data } = useQuery(GET_ALL_CHARACTERS, {
    variables: { gameid: 1386 },
  });

  useEffect(() => {
    if (data) {
      console.log('data: ', data);
      window.electron.store.delete('characterMap');
      let previousMap = window.electron.store.get('characterMap');
      console.log('previousMap: ', previousMap);
      if (previousMap == null) {
        let characterMap: { [key: number]: string } = {};
        data.videogame.characters.forEach((character: CharacterData) => {
          characterMap[character.id] = character.name;
        });
        console.log('Character Map: ', characterMap);
        window.electron.store.set('characterMap', characterMap);
      }
    }
  });

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4, alignContent: 'center' }}>
        {NavMenu('/')}
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
  const [token, setToken] = useState(
    window.electron.store.get('apikey')
      ? window.electron.store.get('apikey')
      : ''
  );

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
            {/* <Route path="/Main" element={<Main />} /> */}
            <Route path="/SetsView" element={<SetsView />} />
            {/* <Route path="/" element={<YTUploadView />} /> */}
            <Route path="/YTUploadView" element={<YTUploadView />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </ApolloProvider>
  );
}
