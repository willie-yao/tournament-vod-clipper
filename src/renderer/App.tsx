import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import { Box, Typography, Container, Link } from '@mui/material';
import VideoSearch from './components/VideoSearch';
import { ApolloClient, InMemoryCache, ApolloProvider, useQuery, createHttpLink } from '@apollo/client';
import { GET_ALL_SETS_AT_EVENT } from './common/StartggQueries';

const Copyright = () => {
  const {loading, error, data} = useQuery(GET_ALL_SETS_AT_EVENT, {
    variables: {
      eventId: "tournament/microspacing-68/event/singles-de"
    }
  })

  useEffect(() => {
    console.log("data", data)
    if (data) {
      console.log("fetched data", data)
    }
  }, [data])
  return (
    <Typography variant="body2" color="text.secondary" align="center">
      {'Copyright © '}
      <Link color="inherit" href="https://mui.com/">
        Your Website
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const Hello = () => {
  useEffect(() => {
    window.electron.ipcRenderer.createFolder('myfunc')
  }, []);

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Tournament VOD Clipper
        </Typography>
        <VideoSearch />
        <Copyright />
      </Box>
    </Container>
  );
};

export default function App() {
  const [token, setToken] = useState(window.electron.ipcRenderer.getApiKey())

  useEffect(() => {
    window.electron.ipcRenderer.getApiKey().then((key) => {
      console.log("apikey", key)
      setToken(key)
    })
  })

  const link = createHttpLink({
    uri: 'https://api.start.gg/gql/alpha',
    headers: {
      authorization: token ? `Bearer ${token}` : "",
    }
  })

  const client = new ApolloClient({
    uri: 'https://api.start.gg/gql/alpha',
    cache: new InMemoryCache(),
    link: link,
  });
  return (
    <ApolloProvider client={client}>
      <Router>
        <Routes>
          <Route path="/" element={<Hello />} />
        </Routes>
      </Router>
    </ApolloProvider>
  );
}
