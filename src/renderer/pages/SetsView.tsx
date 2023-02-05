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
  CardMedia
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { VODMetadata } from 'renderer/components/VideoSearch';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
// import ReactTwitchEmbedVideo from "react-twitch-embed-video"
import moment from 'moment'

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
  const [infoMessage, setInfoMessage] = useState('')
  const [downloaded, setDownloaded] = useState(false)

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

  const EditTimestampModal = (set: any, setIndex: number, open: boolean, setOpen: React.Dispatch<React.SetStateAction<boolean>>) => {
    const [newStartTime, setNewStartTime] = useState(moment(set.startTime, 'HH:mm:ss'))
    const [newEndTime, setNewEndTime] = useState(moment(set.endTime, 'HH:mm:ss'))
    const [embedLink, setEmbedLink] = useState("")
    const [newTitle, setNewTitle] = useState(set.title)
    const [timeError, setTimeError] = useState(false)

    let partUrl = location.state.vodUrl.split('/')
    let twitchId = partUrl.pop() || partUrl.pop()

    useEffect(() => {
      if (newEndTime.isBefore(newStartTime)) {
        setTimeError(true)
      } else {
        setTimeError(false)
      }
    })

    useEffect(() => {
      if (newStartTime) {
        let split = newStartTime.format('HH:mm:ss').split(':')
        if (split.length === 3) {
          let hours = split[0]
          let minutes = split[1]
          let seconds = split[2]
          let twitchFormat = ""
          if (hours !== "00") {
            twitchFormat = twitchFormat.concat(hours.replace(/^0+/, ''), "h")
          }
          if (minutes !== "00") {
            twitchFormat = twitchFormat.concat(minutes.replace(/^0+/, ''), "m")
          } else {
            twitchFormat = twitchFormat.concat("0m")
          }
          if (seconds !== "00") {
            twitchFormat = twitchFormat.concat(seconds.replace(/^0+/, ''), "s")
          } else {
            twitchFormat = twitchFormat.concat("0s")
          }
          setEmbedLink("https://player.twitch.tv/?video=" + twitchId + "&t=" + twitchFormat + "&parent=localhost&autoplay=false")
        }
      }
    })

    return (
      <Dialog
        open={open}
        onClose={(event: any) => {
          event.stopPropagation()
          setOpen(false)
        }}
        // onClick={(event: any) => event.stopPropagation()}
      >
        <LocalizationProvider dateAdapter={AdapterMoment}>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height:'100vh', width: '70vw', padding: '20px' }}>
            <Typography variant="h6" component="h2" textAlign="center" gutterBottom>
              Edit Match
            </Typography>
            {/* <ReactTwitchEmbedVideo video={twitchId}/> */}
            <Card sx={{ height: '35vh', width: '100%' }}>
              <iframe
                src={embedLink}
                height='100%'
                width='100%'
              >
              </iframe>
            </Card>
            <TextField
              className="textfield"
              label="Title"
              defaultValue={newTitle}
              onBlur={(event) => {
                event.stopPropagation()
                event.preventDefault()
                setNewTitle(event.target.value)
              }}
            />
            <TimePicker
              label="Start Time"
              value={newStartTime}
              onChange={(newValue: any) => {
                setNewStartTime(newValue)
              }}
              renderInput={(params) => <TextField {...params} />}
              inputFormat="HH:mm:ss"
              mask="__:__:__"
              ampm={false}
              views={['hours', 'minutes', 'seconds']}
            />
            <TimePicker
              label="End Time"
              value={newEndTime}
              onChange={(newValue: any) => {
                setNewEndTime(newValue)
              }}
              renderInput={(params) => <TextField {...params} />}
              inputFormat="HH:mm:ss"
              mask="__:__:__"
              ampm={false}
              views={['hours', 'minutes', 'seconds']}
            />
          </Box>
          <Box sx={{display: 'flex', justifyContent: 'center', width: '100%'}}>
            <Button
              disableFocusRipple
              disabled={timeError}
              variant="contained"
              color="secondary"
              size="medium"
              sx={{ color: 'white', width: '50%', marginBottom: '5vh' }}
              onClick={(event) => {
                event.stopPropagation()
                location.state.sets[setIndex].startTime = newStartTime.format("HH:mm:ss")
                location.state.sets[setIndex].endTime = newEndTime.format("HH:mm:ss")
                location.state.sets[setIndex].title = newTitle
                console.log("set", location.state.sets[setIndex])
                setOpen(false)
              }}
            >
              Change
            </Button>
          </Box>
        </LocalizationProvider>
      </Dialog>
    )
  }

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
      <List
        className="list-box"
        sx={{
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
        {location.state.sets.map((set: any, index: number) => {
          const [open, setOpen] = useState(false)
          return (
            <ListItem key={set.title}>
              <ListItemButton
                disableRipple
                sx={{ borderRadius: '5px' }}
                onClick={() => {
                  if (!open) {
                    handleToggle(set)
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
                <IconButton onClick={(event) => {
                  event.stopPropagation()
                  event.preventDefault();
                  setOpen(true)
                }}>
                  <EditIcon />
                </IconButton>
                {EditTimestampModal(set, index, open, setOpen)}
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Box sx={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}>
        <Button
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={() => {
            setDownloaded(true)
            setInfoMessage('Your VODs are being downloaded to ./downloadedVODs/' + location.state.tournamentName);
            setInfoOpen(true)
            location.state.sets.map((set: VODMetadata) => {
              if (set.download) {
                console.log('Downloading set: ', set);
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
                  })
                  .catch((err: any) => {
                    setErrorMessage('Download failed: ' + err);
                    setErrorOpen(true);
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
          onClick={() => window.electron.ipcRenderer.openFolder(location.state.tournamentName)}
        >
          Open VOD Folder
        </Button>
        <Button
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={() => navigate('/YTUploadView')}
        >
          Continue to Upload
        </Button>
      </Box>
    </Container>
  );
};

export default SetsView;
