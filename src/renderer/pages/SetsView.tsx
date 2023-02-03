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
  TextField
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { VODMetadata } from 'renderer/components/VideoSearch';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment'

const SetsView = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [checked, setChecked] = useState([0]);
  const [selectAllChecked, setSelectAllChecked] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
    const [newStartTime, setNewStartTime] = useState(moment(set.startTime, 'hh:mm:ss'))
    const [newEndTime, setNewEndTime] = useState(moment(set.endTime, 'hh:mm:ss'))

    return (
      <Dialog
        open={open}
        onClose={(event: any) => {
          event.stopPropagation()
          setOpen(false)
        }}
      >
        <LocalizationProvider dateAdapter={AdapterMoment}>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height:'30vh', padding: '20px' }}>
            <Typography variant="h6" component="h2" textAlign="center" gutterBottom>
              Edit Timestamp
            </Typography>
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
          <Button
            disableFocusRipple
            variant="contained"
            color="secondary"
            size="medium"
            sx={{ color: 'white' }}
            onClick={(event) => {
              event.stopPropagation()
              location.state.sets[setIndex].startTime = newStartTime.format("HH:mm:ss")
              location.state.sets[setIndex].endTime = newEndTime.format("HH:mm:ss")
              console.log("set", location.state.sets[setIndex])
              setOpen(false)
            }}
          >
            Change
          </Button>
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
      {SnackbarPopup(successMessage, 'success', successOpen, setSuccessOpen)}
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
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
                  handleToggle(set)
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
      <Button
        variant="contained"
        color="secondary"
        sx={{ width: '40vw', marginTop: '20px', color: 'white' }}
        onClick={() => {
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
        variant="contained"
        color="secondary"
        sx={{ width: '40vw', marginTop: '20px', color: 'white' }}
        onClick={() => navigate('/YTUploadView')}
      >
        Upload
      </Button>
    </Container>
  );
};

export default SetsView;
