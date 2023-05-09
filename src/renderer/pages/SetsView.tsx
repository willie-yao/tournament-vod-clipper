import {
  Button,
  Container,
  Checkbox,
  Fab,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  FormGroup,
  FormControlLabel,
  Snackbar,
  Alert,
  IconButton,
  Modal,
  Box,
  Dialog,
  TextField,
  Card,
  CardContent,
  CardMedia,
  Tooltip,
  Switch,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, ReactInstance } from 'react';
import { useTheme } from '@mui/material/styles';
import { VODMetadata } from 'renderer/pages/MainView';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import moment from 'moment';
import ThumbnailGenerator from 'renderer/components/ThumbnailGenerator';
import { exportComponentAsJPEG } from 'react-component-export-image';
import { MuiColorInput } from 'mui-color-input';
import html2canvas from 'html2canvas';
import { Buffer } from 'buffer';

const SetsView = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [checked, setChecked] = useState([0]);
  const [selectAllChecked, setSelectAllChecked] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [enableDownload, setEnableDownload] = useState(false);
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false);
  const [thumbnailColor, setThumbnailColor] = useState('#B9F3FC');
  const [thumbnailLogo, setThumbnailLogo] = useState('');
  const [thumbnailBg, setThumbnailBg] = useState('');
  const [downloadThumbnails, setDownloadThumbnails] = useState(true);

  const inputFile = React.useRef<HTMLInputElement | null>(null);
  const inputBgFile = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (checked.length == location.state.sets.length + 1) {
      setEnableDownload(false);
    } else {
      setEnableDownload(true);
    }
  }, [checked]);

  const handleSelectAll = () => {
    let newChecked = [...checked];
    let newState = true;
    if (selectAllChecked) {
      newChecked = [0];
      newState = false;
    }

    for (let i = 0; i < location.state.sets.length; i++) {
      location.state.sets[i].download = newState;
      newChecked.push(location.state.sets[i]);
    }

    setChecked(newChecked);
    setSelectAllChecked(!selectAllChecked);
  };

  const EditTimestampModal = (
    set: any,
    setIndex: number,
    open: boolean,
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const [newStartTime, setNewStartTime] = useState(
      moment(set.startTime, 'HH:mm:ss')
    );
    const [newEndTime, setNewEndTime] = useState(
      moment(set.endTime, 'HH:mm:ss')
    );
    const [skipTime, setSkipTime] = useState(moment(set.startTime, 'HH:mm:ss'));
    const [embedLink, setEmbedLink] = useState('');
    const [newTitle, setNewTitle] = useState(set.title);
    const [timeError, setTimeError] = useState(false);
    const [randomKey, setRandomKey] = useState(Math.random());

    let partUrl = location.state.vodUrl.split('/');
    let twitchId = partUrl.pop() || partUrl.pop();

    useEffect(() => {
      if (newEndTime.isBefore(newStartTime)) {
        setTimeError(true);
      } else {
        setTimeError(false);
      }
    });

    useEffect(() => {
      let split = skipTime.format('HH:mm:ss').split(':');
      if (split.length === 3) {
        let hours = split[0];
        let minutes = split[1];
        let seconds = split[2];
        let twitchFormat = '';
        if (hours !== '00') {
          twitchFormat = twitchFormat.concat(hours.replace(/^0+/, ''), 'h');
        }
        if (minutes !== '00') {
          twitchFormat = twitchFormat.concat(minutes.replace(/^0+/, ''), 'm');
        } else {
          twitchFormat = twitchFormat.concat('0m');
        }
        if (seconds !== '00') {
          twitchFormat = twitchFormat.concat(seconds.replace(/^0+/, ''), 's');
        } else {
          twitchFormat = twitchFormat.concat('0s');
        }
        setEmbedLink(
          'https://player.twitch.tv/?video=' +
            twitchId +
            '&t=' +
            twitchFormat +
            '&parent=localhost&muted=true'
        );
      }
    });

    return (
      <Dialog
        open={open}
        onClose={(event: any) => {
          event.stopPropagation();
          setOpen(false);
        }}
        // onClick={(event: any) => event.stopPropagation()}
      >
        <LocalizationProvider dateAdapter={AdapterMoment}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              height: '100vh',
              minWidth: '50vw',
              padding: '20px',
            }}
          >
            <Typography
              variant="h6"
              component="h2"
              textAlign="center"
              gutterBottom
            >
              Edit Match
            </Typography>
            {/* <ReactTwitchEmbedVideo video={twitchId}/> */}
            <Card sx={{ height: '35vh', width: '100%' }}>
              <iframe
                src={embedLink}
                height="100%"
                width="100%"
                key={randomKey}
              ></iframe>
            </Card>
            <TextField
              className="textfield"
              label="Title"
              defaultValue={newTitle}
              onChange={(event) => {
                event.stopPropagation();
                event.preventDefault();
                setNewTitle(event.target.value);
              }}
              helperText={
                newTitle.length + '/100 | YouTube title character limit'
              }
            />
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <TimePicker
                label="Start Time"
                value={newStartTime}
                onChange={(newValue: any) => {
                  setNewStartTime(newValue);
                }}
                renderInput={(params) => <TextField {...params} />}
                inputFormat="HH:mm:ss"
                mask="__:__:__"
                ampm={false}
                views={['hours', 'minutes', 'seconds']}
                className="timepicker"
              />
              <Tooltip title="Skip to start">
                <IconButton
                  onClick={() =>
                    newStartTime === skipTime
                      ? setRandomKey(Math.random())
                      : setSkipTime(newStartTime)
                  }
                >
                  <SkipNextIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <TimePicker
                label="End Time"
                value={newEndTime}
                onChange={(newValue: any) => {
                  setNewEndTime(newValue);
                }}
                renderInput={(params) => <TextField {...params} />}
                inputFormat="HH:mm:ss"
                mask="__:__:__"
                ampm={false}
                views={['hours', 'minutes', 'seconds']}
                className="timepicker"
              />
              <Tooltip title="Skip to end">
                <IconButton
                  onClick={() =>
                    newEndTime === skipTime
                      ? setRandomKey(Math.random())
                      : setSkipTime(newEndTime)
                  }
                >
                  <SkipNextIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box
            sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}
          >
            <Button
              disableFocusRipple
              disabled={timeError}
              variant="contained"
              color="secondary"
              size="medium"
              sx={{ color: 'white', width: '50%', marginBottom: '5vh' }}
              onClick={(event) => {
                event.stopPropagation();
                location.state.sets[setIndex].startTime =
                  newStartTime.format('HH:mm:ss');
                location.state.sets[setIndex].endTime =
                  newEndTime.format('HH:mm:ss');
                location.state.sets[setIndex].title = newTitle;
                console.log('set', location.state.sets[setIndex]);
                setOpen(false);
              }}
            >
              Change
            </Button>
          </Box>
        </LocalizationProvider>
      </Dialog>
    );
  };

  const ThumbnailOptionsModal = () => {
    const ref: React.RefObject<ReactInstance> = React.createRef();

    const onImageChange = (event: any) => {
      if (event.target.files && event.target.files[0]) {
        setThumbnailLogo(URL.createObjectURL(event.target.files[0]));
      }
    };

    const onBgImageChange = (event: any) => {
      if (event.target.files && event.target.files[0]) {
        setThumbnailBg(URL.createObjectURL(event.target.files[0]));
      }
    };

    return (
      <Dialog
        open={thumbnailModalOpen}
        onClose={(event: any) => {
          event.stopPropagation();
          setThumbnailModalOpen(false);
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '80vh',
            minWidth: '50vw',
            padding: '20px',
          }}
        >
          <Typography
            variant="h6"
            component="h2"
            textAlign="center"
            gutterBottom
          >
            Thumbnail Options
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  onChange={(event) =>
                    setDownloadThumbnails(event.target.checked)
                  }
                  defaultChecked
                />
              }
              label="Download Thumbnails"
            />
          </FormGroup>
          <MuiColorInput
            label="Background Color"
            value={thumbnailColor}
            onChange={(color) => setThumbnailColor(color)}
          />
          <Button
            variant="contained"
            color="secondary"
            sx={{ width: '50%', color: 'white' }}
            onClick={() => inputFile!.current!.click()}
          >
            Select Logo
          </Button>
          <input
            type="file"
            id="img"
            name="img"
            accept="image/*"
            onChange={(event) => onImageChange(event)}
            ref={inputFile}
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            color="secondary"
            sx={{ width: '50%', color: 'white' }}
            onClick={() => inputBgFile!.current!.click()}
          >
            Select BG Image
          </Button>
          <input
            type="file"
            id="img"
            name="img"
            accept="image/*"
            onChange={(event) => onBgImageChange(event)}
            ref={inputBgFile}
            style={{ display: 'none' }}
          />
          <Box sx={{ width: '426px', height: '240px', overflow: 'hidden' }}>
            <ThumbnailGenerator
              logo={thumbnailLogo}
              bgImage={thumbnailBg}
              bgColor={thumbnailColor}
              ref={ref}
              scale="0.335"
              character1={'Hero'}
              character2={'Kirby'}
            />
          </Box>
        </Box>
      </Dialog>
    );
  };

  const generateThumbnail = (set: VODMetadata) => {
    var thumbnail = document.getElementById(set.title);
    html2canvas(thumbnail!).then((canvas) => {
      const img = canvas.toDataURL('image/png');
      const base64Data = img.replace(/^data:image\/png;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      window.electron.ipcRenderer.saveThumbnail({
        folderName: set.tournamentName,
        fileName: set.title,
        buf: buf,
      });
    });
  };

  const handleToggle = (set: any) => {
    const currentIndex = checked.indexOf(set);
    const newChecked = [...checked];
    set.download = !set.download;

    if (currentIndex === -1) {
      newChecked.push(set);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  return (
    <Container
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {SnackbarPopup(successMessage, 'success', successOpen, setSuccessOpen)}
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
      {SnackbarPopup(infoMessage, 'info', infoOpen, setInfoOpen)}
      <Fab
        sx={{ position: 'fixed', left: '20px', top: '20px' }}
        color="secondary"
        aria-label="back"
        size="medium"
        onClick={() => navigate('/')}
      >
        <ArrowBackIcon />
      </Fab>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
        Select Sets to Download
      </Typography>
      {ThumbnailOptionsModal()}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}
      >
        <FormGroup>
          <Button
            variant="contained"
            color="secondary"
            sx={{ width: '40vw', marginBottom: '20px' }}
            onClick={(event) => {
              handleSelectAll();
              event.stopPropagation();
              event.preventDefault();
            }}
          >
            <FormControlLabel
              sx={{ color: 'white' }}
              control={<Checkbox checked={selectAllChecked} disableRipple />}
              label="Select All"
            />
          </Button>
        </FormGroup>
        <Button
          variant="contained"
          color="secondary"
          sx={{ width: '40vw', marginBottom: '20px', color: 'white' }}
          onClick={() => setThumbnailModalOpen(true)}
        >
          Thumbnail Options
        </Button>
      </Box>
      <List
        className="list-box"
        sx={{
          minWidth: '100%',
          minHeight: '50vh',
          '&::-webkit-scrollbar': {
            width: '0.4em',
          },
          '&::-webkit-scrollbar-track': {
            boxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
            webkitBoxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
          },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,.1)',
            outline: '1px solid slategrey',
          },
        }}
      >
        {location.state.sets.length == 0 && (
          <Typography
            sx={{ marginTop: '23vh' }}
            variant="h6"
            component="h2"
            textAlign="center"
            gutterBottom
          >
            No sets found
          </Typography>
        )}
        {location.state.sets.map((set: any, index: number) => {
          const [open, setOpen] = useState(false);
          return (
            <ListItem key={set.title}>
              <ListItemButton
                disableRipple
                sx={{ borderRadius: '5px' }}
                onClick={() => {
                  if (!open) {
                    handleToggle(set);
                  }
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={location.state.sets[index].download}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={set.title} />
                <IconButton
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    setOpen(true);
                  }}
                >
                  <EditIcon />
                </IconButton>
                {EditTimestampModal(set, index, open, setOpen)}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}
      >
        <Button
          disabled={!enableDownload}
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={() => {
            setDownloaded(true);
            setInfoMessage(
              'Your VODs are being downloaded to ./downloadedVODs/' +
                location.state.tournamentName
            );
            setInfoOpen(true);
            setEnableDownload(false);
            if (downloadThumbnails) {
              window.electron.ipcRenderer.createThumbnailFolder(
                location.state.tournamentName
              );
            }
            location.state.sets.map((set: VODMetadata) => {
              if (set.download) {
                console.log('Downloading set: ', set);
                if (downloadThumbnails) {
                  generateThumbnail(set);
                }
                window.electron.ipcRenderer
                  .downloadVideo({
                    vodUrl: location.state.vodUrl,
                    title: set.title,
                    startTime: set.startTime,
                    endTime: set.endTime,
                    tournamentName: location.state.tournamentName,
                  })
                  .then((res: any) => {
                    setSuccessMessage('Download complete: ' + set.title);
                    setSuccessOpen(true);
                    setEnableDownload(true);
                  })
                  .catch((err: any) => {
                    setErrorMessage('Download failed: ' + err);
                    setErrorOpen(true);
                    setEnableDownload(true);
                  });
              }
            });
          }}
        >
          Download VODs
        </Button>
        <Button
          disabled={!downloaded}
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={() =>
            window.electron.ipcRenderer.openFolder(
              location.state.tournamentName
            )
          }
        >
          Open VOD Folder
        </Button>
        <Button
          disabled={!downloaded}
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={() => navigate('/YTUploadView')}
        >
          Continue to Upload
        </Button>
      </Box>
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            width: '1280px',
            height: '720px',
            right: '-640px',
            top: '360',
            overflow: 'hidden',
            zIndex: '-999',
          }}
        >
          {location.state.sets.map((set: VODMetadata) => {
            const ref: React.RefObject<ReactInstance> = React.createRef();
            return (
              <ThumbnailGenerator
                key={set.title + thumbnailColor}
                ref={ref}
                bgImage={thumbnailBg}
                bgColor={thumbnailColor}
                logo={thumbnailLogo}
                player1={set.player1}
                player2={set.player2}
                character1={set.character1}
                character2={set.character2}
                bottomText={set.tournamentName}
                title={set.title}
              />
            );
          })}
        </Box>
      </Box>
    </Container>
  );
};

export default SetsView;
