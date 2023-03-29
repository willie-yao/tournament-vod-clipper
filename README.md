# Tournament VOD Clipper

This is a tool built in React and Electron to help you clip VODs of tournaments automatically! It's a work in progress, so please be patient and expect some bugs ><. If you run into any issues or have any suggestions, please make an issue [here](https://github.com/willie-yao/tournament-vod-clipper/issues) so I can fix it ASAP!

## Main Features

- Automatically clips Twitch VODs of matches from a start.gg bracket
- Clips and downloads matches in parallel
- Generates thumbnails for each match
- Upload VODs to YouTube automatically

## Requirements

Windows: This tool is Windows-only for the time being. Releases for Mac and Linux will be out shortly.

## How to Use

### Pre-requesites

This tool clips VODs automatically by retrieving timestamps of when matches are started and reported on Start.GG. In order for your VODs to be clipped accurately, you need to do the following:

1. Assign stream sets to a stream setup. Please refer to the Start.GG documentation [here](https://help.start.gg/en/articles/1465692-adding-streams-and-creating-stations).
2. Start the stream match exactly when you want the VOD for that match to start. Likewise, report the match exactly when you want the VOD to end. If this is done incorrectly, your VOD will start/end at the wrong times but you can edit them regardless.
3. Report characters for the match if you want the characters to show up on the video title and thumbnails.

### Download

- Download the latest release from the releases page:
  - https://github.com/willie-yao/tournament-vod-clipper/releases
- Extract the zip file to a folder of your choice
- Run the `tournament-vod-clipper.exe` file

### Retrieving streamed sets

- First, you need to enter the Start.GG event slug. You can find this in the URL of the event page. For example, the slug for the event `microspacing-69` is:
  - tournament/microspacing-69/event/singles-de
- Then, enter the VOD url for the stream in the `VOD Link` field. This can only be a Twitch link at the moment. For example:
  - https://www.twitch.tv/videos/123456789
- To retrieve only the streamed sets, enter the name of the twitch channel assigned to stream in the `Stream Station` field. You can also enter a station number.
- Finally, click the `Retrieve Sets` button. This will take you to a new page.

### Downloading sets

- You should be able to see a list of sets that were played on stream! Select the ones that you want to download by clicking on each set.
- To select all or deselect all, toggle the `Select All` button.
- To edit timestamps, click on the edit icon next to the set. This will open a modal where you can edit the title, start time, and end time.
- If you want to customize the thumbnails, click on the `Thumbnail Options` button. This will open a modal where you can customize the logo and background color/image for the thumbnail.
- When you have selected all the matches, click the `Download VODs` button. Your VODs will be saved to the `/downloadedVODs` folder.

### Uploading VODs to YouTube

- Once the VODs are downloaded, you can navigate to the upload page by clicking the `Upload` button.
- You will need to login to your YouTube account. Click the `Login` button and follow the instructions.
- Next, select the tournament you want to upload VODs from using the `VOD Folder` box.
- You can also select the visibility of the video and the description for all of the videos below.
- Finally, click the `Upload` button. You should see the VODs being processed on your YouTube account!

## Terms and Conditions + Privacy Policy

TournamentVODClipper uses YouTube API Services to upload VODs. By using this tool, you are agreeing to be bound by the YouTube Terms of service as well as the following terms and conditions:
- [YouTube terms of service](https://www.youtube.com/t/terms)
- [YouTube community guidelines](https://www.youtube.com/t/community_guidelines)
- [Google privacy policy](https://policies.google.com/privacy?hl=en-US)

TournamentVODClipper stores your Google login and authentication token only within the YouTube upload page's local storage. The token is used to upload videos to YouTube. Upon navigating away from the page, your login is not saved and you will need to login again. In addition, no usage data is being collected from your usage of this tool. Therefore, nothing is being shared with internal or external parties besides the authentication necessary to upload videos.

Important: Your user data will be collected through cookies from your device. The cookies are only used for authentication for uploading videos. Upon logging in on the login page, your login token is stored in a cookie. This cookie is deleted once you close the app.

This tool uses the YouTube Data API to upload VODs to YouTube. Specifically, it uses the [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert) endpoint.

At any time, you may revoke TournamentVODClipper's access to your data via the [Google security settings page](https://security.google.com/settings/security/permissions)
