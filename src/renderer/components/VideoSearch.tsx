import { useState, useEffect } from 'react';
import { Button, Box, TextField, Divider } from '@mui/material';
import { GET_ALL_SETS_AT_EVENT } from 'renderer/common/StartggQueries';
import { useLazyQuery } from '@apollo/client';

interface VODMetadata {
  title: string,
  startTime: string,
  endTime: string
}

const RetrieveSets = (eventId: string, vodUrl: string, setter: React.Dispatch<React.SetStateAction<VODMetadata[]>>): JSX.Element => {
  let options = {}
  let apikey = window.electron.store.get("apikey")
  if (apikey != "") {
    options = {
      context: {
        headers: {
          authorization: `Bearer ${apikey}`
        }
      }
    }
  }

  const [getSets, { loading, error, data }] = useLazyQuery(GET_ALL_SETS_AT_EVENT, options)

  useEffect(() => {
    if (data) {
      window.electron.ipcRenderer.retrieveVideoInformation({vodUrl: vodUrl}).then((timestamp) => {
        console.log("timestamp", timestamp)
        console.log("data", data)
        let sets = data.event.sets.nodes
        for (let i = 0; i < sets.length; i++) {
          let metadata:VODMetadata = {
            title: sets[i].slots[0].entrant.name + " vs " + sets[i].slots[1].entrant.name + " - " + sets[i].fullRoundText,
            startTime: new Date((sets[i].startedAt - timestamp) * 1000).toISOString().slice(11, 19),
            endTime: new Date((sets[i].completedAt - timestamp) * 1000).toISOString().slice(11, 19)
          }
          console.log("metadata", metadata)
          setter(old => [...old, metadata]);
        }
      })
    }
  }, [data])

  if (loading) return <p>Loading ...</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <Button 
      variant="contained" 
      onClick={() => getSets({variables: {eventId: eventId}})}
      sx={{ marginBottom: '25px' }}
    >
      Retrieve Sets
    </Button>
  )
}

const VideoSearch = () => {
  const [vodUrl, setVodUrl] = useState("")
  const [eventId, setEventId] = useState("")
  const [retrievedSets, setRetrievedSets] = useState<VODMetadata[]>([])

  return(
    <Box sx={{display: 'flex', flexDirection: 'column', height: '80vh', justifyContent: 'space-around'}}>
      <TextField id="outlined-basic" label="Start.GG API Key" variant="outlined" sx={{ marginBottom: '25px' }} onChange={(event) => window.electron.store.set('apikey', event.target.value)} />
      <TextField id="outlined-basic" label="Start.GG Event ID" variant="outlined" sx={{ marginBottom: '25px' }} onChange={(event) => setEventId(event.target.value)} />
      <TextField id="outlined-basic" label="VOD Link" variant="outlined" sx={{ marginBottom: '25px' }} onChange={(event) => setVodUrl(event.target.value)} />
      {RetrieveSets(eventId, vodUrl, setRetrievedSets)}
      <Box sx={{display: 'flex', flexDirection: 'column', maxHeight: '30vh', overflow: 'auto', marginBottom: '25px'}}>
        {retrievedSets.map((set, index) => {
          return (
            <div key={index}>
              {set.title}
            </div>
          )
        })}
      </Box>
      <Button 
        variant="contained" 
        sx={{ marginBottom: '25px' }}
        onClick={() => {
          for (let i = 0; i < 4; i++) {
            window.electron.ipcRenderer.downloadVideo({
              vodUrl: vodUrl,
              title: retrievedSets[i].title,
              startTime: retrievedSets[i].startTime,
              endTime: retrievedSets[i].endTime,
            })
          }
        }}
      >
        Download VODs
      </Button>
    </Box>
  )
}

export default VideoSearch
