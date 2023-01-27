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
  const [getSets, { loading, error, data }] = useLazyQuery(GET_ALL_SETS_AT_EVENT)
  // const [retrievedSets, setRetrievedSets] = useState<object[]>([])

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
    >
      Get Sets
    </Button>
  )
}

const VideoSearch = () => {
  const [vodUrl, setVodUrl] = useState("")
  const [eventId, setEventId] = useState("")
  const [retrievedSets, setRetrievedSets] = useState<VODMetadata[]>([])
  // const [downloadArgs, setDownloadArgs] = useState<object>({})

  // useEffect(() => {
  //   if (retrievedSets.length > 0) {
  //     setDownloadArgs({
  //       vodUrl: vodUrl,
  //       startTime: retrievedSets[0].startTime,
  //       endTime: retrievedSets[0].endTime,
  //     })
  //   }
  // }, [retrievedSets])

  return(
    <Box sx={{display: 'flex', flexDirection: 'column', height: '50vh', justifyContent: 'space-around'}}>
      <TextField id="outlined-basic" label="Start.GG Event ID" variant="outlined" onChange={(event) => setEventId(event.target.value)} />
      <TextField id="outlined-basic" label="VOD Link" variant="outlined" onChange={(event) => setVodUrl(event.target.value)} />
      {RetrieveSets(eventId, vodUrl, setRetrievedSets)}
      <Box sx={{display: 'flex', flexDirection: 'column', maxHeight: '30vh', overflow: 'auto'}}>
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
