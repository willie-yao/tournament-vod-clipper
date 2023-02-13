import React, {ReactInstance, ReactNode} from "react";
import { Box, Grid, Typography } from "@mui/material";
import Hero from '../../../assets/characters/Hero.png';
import DefaultIcon from '../../../assets/icon.png';

const ThumbnailText = (text: string, variant: any) => {
  return (
    <Typography variant={variant} sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center'}}>
      {text}
    </Typography>
  )
}

interface Props {
  children?: ReactNode;
  scale: string;
  bgColor: string;
}
export type Ref = ReactInstance;

// Create Document Component
const ThumbnailGenerator = React.forwardRef<Ref, Props>((props, ref) => {
  return (
    <Box ref={ref} sx={{ height: '720px', width: '1280px', backgroundColor: '#B9F3FC', scale: props.scale, transformOrigin: 'top left' }}>
      <Grid container>
        <Grid item xs={12}>
          <Grid container sx={{ width: '100%', height: '110px', backgroundColor: 'black'}}>
            <Grid item xs={5} className="centered-flex">
              {ThumbnailText('Player 1', "h3")}
            </Grid>
            <Grid item xs={2} className="centered-flex">
              {ThumbnailText('VS', "h1")}
            </Grid>
            <Grid item xs={5} className="centered-flex">
              {ThumbnailText('Player 2', "h3")}
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Grid container sx={{ width: '100%', height: '500px', backgroundColor: props.bgColor}}>
            <Grid item xs={5} className="centered-flex">
              <img src={Hero} />
            </Grid>
            <Grid item xs={2} className="centered-flex">
              <img src={DefaultIcon} />
            </Grid>
            <Grid item xs={5} className="centered-flex">
              <img src={Hero} />
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Grid container sx={{ width: '100%', height: '110px', backgroundColor: 'black'}}>
            <Grid item xs={2} className="centered-flex">
            </Grid>
            <Grid item xs={8} className="centered-flex">
              {ThumbnailText('Grand Finals', "h2")}
            </Grid>
            <Grid item xs={2} className="centered-flex">
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
});

ThumbnailGenerator.defaultProps = {
  scale: '1',
  bgColor: '#B9F3FC'
}

export default ThumbnailGenerator
