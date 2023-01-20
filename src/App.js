import * as React from 'react';
import { Box, Typography, Container, Link } from '@mui/material';
import ProTip from './ProTip';
import VideoSearch from './components/VideoSearch';

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

export default function App() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Tournament VOD Clipper
        </Typography>
        <VideoSearch />
        <ProTip />
        <Copyright />
      </Box>
    </Container>
  );
}
