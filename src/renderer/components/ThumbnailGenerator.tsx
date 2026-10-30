import React, { ReactInstance, ReactNode } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import DefaultIcon from '../../../assets/MSLogo.png';

const ThumbnailText = (text: string, variant: any) => {
  return (
    <Typography
      variant={variant}
      sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}
      noWrap
    >
      {text}
    </Typography>
  );
};

interface Props {
  children?: ReactNode;
  scale?: string;
  bgColor?: string;
  logo?: string;
  bgImage?: string;
  player1?: string;
  player2?: string;
  character1?: string;
  character2?: string;
  bottomText?: string;
  visible?: boolean;
  title?: string;
}
export type Ref = ReactInstance;

declare const require: NodeRequire & {
  context: (
    directory: string,
    recursive: boolean,
    pattern: RegExp
  ) => {
    (key: string): string;
    keys: () => string[];
  };
};
const characterImages = require.context('./characters', false, /\.png$/);
const characterAsset = (name?: string) => {
  const key = `./${name || 'Random Character'}.png`;
  return characterImages(
    characterImages.keys().includes(key) ? key : './Random Character.png'
  );
};

// Create Document Component
const ThumbnailGenerator = React.forwardRef<Ref, Props>((props, ref) => {
  // console.log("images", images)
  let displayOption = props.visible ? 'block' : 'none';
  return (
    <Box
      id={props.title}
      ref={ref}
      sx={{
        height: '720px',
        width: '1280px',
        backgroundColor: '#B9F3FC',
        scale: props.scale,
        transformOrigin: 'top left',
        display: displayOption,
      }}
    >
      <Grid container>
        <Grid item xs={12} sx={{ zIndex: 1 }}>
          <Grid
            container
            sx={{ width: '100%', height: '110px', backgroundColor: 'black' }}
          >
            <Grid item xs={5} className="centered-flex">
              {ThumbnailText(props.player1!, 'h3')}
            </Grid>
            <Grid item xs={2} className="centered-flex">
              {ThumbnailText('VS', 'h1')}
            </Grid>
            <Grid item xs={5} className="centered-flex">
              {ThumbnailText(props.player2!, 'h3')}
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          {props.bgImage !== '' ? (
            <img className="bg-image" src={props.bgImage} alt="" />
          ) : null}
          <Grid
            container
            sx={{
              width: '100%',
              height: '500px',
              backgroundColor: props.bgColor,
            }}
          >
            <Grid
              sx={{
                position: 'relative',
                left: '-20px',
                bottom: '-25px',
                zIndex: 1,
              }}
              item
              xs={5}
              className="centered-flex"
            >
              <img height="450" src={characterAsset(props.character1)} alt="" />
            </Grid>
            <Grid item xs={2} sx={{ zIndex: 5 }} className="centered-flex">
              <img
                src={props.logo === '' ? DefaultIcon : props.logo}
                width="250px"
                height="250px"
                alt=""
              />
            </Grid>
            <Grid
              sx={{
                position: 'relative',
                left: '20px',
                bottom: '-25px',
                zIndex: 1,
              }}
              item
              xs={5}
              className="centered-flex"
            >
              <img height="450" src={characterAsset(props.character2)} alt="" />
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12} sx={{ zIndex: 1 }}>
          <Grid
            container
            sx={{ width: '100%', height: '110px', backgroundColor: 'black' }}
          >
            <Grid item xs={12} className="centered-flex">
              {ThumbnailText(props.bottomText!, 'h2')}
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
});

ThumbnailGenerator.defaultProps = {
  scale: '1',
  bgColor: '#B9F3FC',
  logo: DefaultIcon,
  player1: 'Player 1',
  player2: 'Player 2',
  character1: 'Random Character',
  character2: 'Random Character',
  bottomText: 'Grand Finals',
  visible: true,
};

export default ThumbnailGenerator;
