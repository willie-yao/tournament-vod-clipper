import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import icon from '../../assets/icon.svg';
import './App.css';
import { Box, Typography, Container, Link } from '@mui/material';
import VideoSearch from './components/VideoSearch';
// import fs from 'fs';

const Copyright = () => {
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
        {/* <ProTip /> */}
        <Copyright />
      </Box>
    </Container>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
