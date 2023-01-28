import { Button, Container, Checkbox, Typography, List, ListItem, ListItemButton, ListItemText, ListItemIcon, FormGroup, FormControlLabel } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useState } from 'react'
import { useTheme } from '@mui/material/styles';
import { VODMetadata } from 'renderer/components/VideoSearch';

const SetsView = () => {
  const theme = useTheme();
  const location = useLocation();

  const [checked, setChecked] = useState([0]);
  const [selectAllChecked, setSelectAllChecked] = useState(true)

  const handleToggle = (set: any) => () => {
    const currentIndex = checked.indexOf(set);
    const newChecked = [...checked];

    set.download = !set.download

    if (currentIndex === -1) {
      newChecked.push(set);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const handleSelectAll = () => {
    let newChecked = [...checked];
    let newState = true
    if (selectAllChecked) {
      newChecked = [0]
      newState = false
    }

    for (let i = 0; i < location.state.sets.length; i++) {
      location.state.sets[i].download = newState
      newChecked.push(location.state.sets[i]);
    }

    setChecked(newChecked);
    setSelectAllChecked(!selectAllChecked)
  }

  return (
    <Container sx={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
          Select Sets to Download
      </Typography>
      <FormGroup>
        <Button variant='contained' color="secondary" sx={{width: '40vw', marginBottom: '20px'}} onClick={(event) => {
          handleSelectAll()
          event.stopPropagation();
          event.preventDefault();
        }}>
          <FormControlLabel sx={{ color: 'white' }} control={<Checkbox checked={selectAllChecked} disableRipple/>} label="Select All" />
        </Button>
      </FormGroup>
      <List className="list-box" sx={{ 
        '&::-webkit-scrollbar': {
          width: '0.4em'
        },
        '&::-webkit-scrollbar-track': {
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
          webkitBoxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)'
        },
        '&::-webkit-scrollbar-thumb': {
          borderRadius: '8px',
          backgroundColor: 'rgba(255,255,255,.1)',
          outline: '1px solid slategrey'
        }
      }}>
        {location.state.sets.map((set: any, index: number) => (
          <ListItem>
            <ListItemButton sx={{borderRadius: '5px'}} onClick={handleToggle(set)}>
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={location.state.sets[index].download}
                  tabIndex={-1}
                  defaultChecked
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={set.title} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Button 
        variant='contained' 
        color="secondary" 
        sx={{width: '40vw', marginTop: '20px', color: "white"}}
        onClick={() => {
          location.state.sets.map((set: VODMetadata) => {
            if (set.download) {
              console.log("Downloading set: ", set)
              window.electron.ipcRenderer.downloadVideo({
                vodUrl: location.state.vodUrl,
                title: set.title,
                startTime: set.startTime,
                endTime: set.endTime
              })
            }
          })
        }}
      >
        Download VODs
      </Button>
    </Container>
  )
}

export default SetsView
