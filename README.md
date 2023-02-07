# Tournament VOD Clipper

This is a tool built in React and Electron to help you clip VODs of tournaments automatically! It's a work in progress, so please be patient and expect some bugs ><. If you run into any issues or have any suggestions, please make an issue [here](https://github.com/willie-yao/tournament-vod-clipper/issues) so I can fix it ASAP!

## Main Features
- Automatically clips Twitch VODs of matches from a start.gg bracket
- Clips and downloads matches in parallel
- Upload VODs to YouTube automatically

## Requirements

Windows: This tool is Windows-only for the time being. Releases for Mac and Linux will be out shortly.

## How to Use

### Pre-requesites
This tool clips VODs automatically by retrieving timestamps of when matches are started and reported on Start.GG. In order for your VODs to be clipped accurately, you need to do the following:

1. Assign a station number to the stream setup. Please refer to the Start.GG documentation [here](https://help.start.gg/en/articles/1465692-adding-streams-and-creating-stations#:~:text=Adding%20a%20Stream%20to%20a%20Station). **IMPORTANT:** Assigning a stream station is not enough. You must assign the stream to a station number, then assign the match to the number, not the station!
2. Start the stream match exactly when you want the VOD for that match to start. Likewise, report the match exactly when you want the VOD to end. If this is done incorrectly, your VOD will start/end at the wrong times.
3. Report characters for the match if you want the characters to show up on the video title.

### Download
- Download the latest release from the releases page:
  - https://github.com/willie-yao/tournament-vod-clipper/releases
- Extract the zip file to a folder of your choice
- Run the `tournament-vod-clipper.exe` file

### Retrieving streamed sets
- First, you need to generate a Start.GG authentication token. You can do so by following the instructions here:
  - https://developer.start.gg/docs/authentication/
- Once you have your token, paste it into the `Start.GG API Key` field in the tool
- Next, you need to enter the Start.GG event slug. You can find this in the URL of the event page. For example, the slug for the following event is `microspacing-69`:
  - tournament/microspacing-69/event/singles-de
- Then, enter the VOD url for the stream in the `VOD Link` field. This can only be a Twitch link at the moment. For example:
  - https://www.twitch.tv/videos/123456789
- To retrieve only the streamed sets, enter the station number assigned to the stream setup in the `Stream Station Number` field
- Finally, click the `Retrieve Sets` button. This will take you to a new page.

### Downloading sets
- You should be able to see a list of sets that were played on stream! Select the ones that you want to download by clicking on each set.
- To select all or deselect all, toggle the `Select All` button.
- When you have selected all the matches, click the `Download VODs` button. Your VODs will be saved to the `/downloadedVODs` folder.

### Uploading VODs to YouTube
- Once the VODs are downloaded, you can navigate to the upload page by clicking the `Upload` button.
- You will need to login to your YouTube account. Click the `Login` button and follow the instructions.
- Next, select the tournament you want to upload VODs from using the `VOD Folder` box.
- Finally, click the `Upload` button. You should see the VODs being processed on your YouTube account!

