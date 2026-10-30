# Tournament VOD Clipper

This is a tool built in React and Electron to help you clip VODs of tournaments automatically! It's a work in progress, so please be patient and expect some bugs ><. If you run into any issues or have any suggestions, please make an issue [here](https://github.com/willie-yao/tournament-vod-clipper/issues) so I can fix it ASAP!

## Main Features

- Automatically clips Twitch VODs of matches from a start.gg bracket
- Clips selected matches one at a time and reports partial failures
- Generates thumbnails for each match
- Upload VODs to YouTube automatically

## Requirements

Packaging targets are Windows x64 and macOS Apple Silicon. Linux and Intel Mac native tools are not provisioned. Windows runtime compatibility still requires a real Windows check; a cross-build is not that check. These maintenance changes are source-only until a new release is published.

## Development checks

Use Node.js 22 LTS, at least 22.12 (`.nvmrc`), and npm 10 or 11. Electron is pinned to supported stable 44.9.3, verified against the official release on 2026-10-29.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test -- --runInBand
npm run build
```

Unit tests mock Electron and external APIs. They need no packaged bundles, credentials, or native downloader binaries. CI runs these offline tests, type checking and production bundles without native install hooks, secrets, signing or release jobs. Full-project lint is not a CI gate while inherited lint errors remain.

For desktop development, run `npm run setup:desktop`, then `npm start`. Setup installs the pinned Electron runtime and verifies native downloads. The dev server compiles the isolated preload before starting Electron and watches it for changes. It does not configure credentials or start authentication.

### Native tools and local packaging

`npm run setup:native` and the package `beforePack` hook provision yt-dlp 2026.10.26 and FFmpeg/ffprobe 9.0.2. [Exact URLs and SHA-256 pins](.erb/scripts/native-tools.js) are checked before extraction; verified archives are cached under ignored `native/.cache`. The app uses only these binaries and ignores global yt-dlp configuration. FFmpeg lives in `Resources/bin` in a packaged app; no global installation is needed.

| Target | Sources |
|---|---|
| macOS arm64 | [yt-dlp universal macOS](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26), [Martin Riedl FFmpeg builds](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/) |
| Windows x64 | [yt-dlp Windows](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26), [Gyan FFmpeg essentials](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2) |

Run `npm run smoke:media` for a disposable synthetic HTTP-media cut using the real binaries and normal range/path checks. It does not use Twitch, start.gg or Google. YouTube downloading would additionally need a JavaScript runtime; this app's download workflow is Twitch, and YouTube uploading does not use yt-dlp.

`npm run package:mac:local` builds an ad-hoc local macOS app directory with certificate discovery and notarization disabled. It is not a signed/notarized public release; normal build configuration retains hardened runtime. `npm run package -- --win --x64` provisions the Windows tools, but needs validation on Windows. Updates remain disabled.

Native license texts and [source/build attribution](assets/native-tools-NOTICE.txt) accompany packages. Before redistributing binaries, meet their GPL/corresponding-source obligations and provide platform signing/notarization. The original Electron React Boilerplate license is retained.

Automatic updates are disabled until this app has its own verified release feed.

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

- Create a personal API token in your [start.gg developer settings](https://start.gg/admin/profile/developer), enter it in `Start.gg API key`, and click `Save API Key`. The key is encrypted with your operating system's secure storage and kept across restarts. Saved search fields are preserved too.
- First, you need to enter the Start.GG event slug. You can find this in the URL of the event page. For example, the slug for the event `microspacing-69` is:
  - tournament/microspacing-69/event/singles-de
- Then, enter the VOD url for the stream in the `VOD Link` field. This can only be a Twitch link at the moment. For example:
  - https://www.twitch.tv/videos/123456789
- To retrieve only the streamed sets, enter the name of the twitch channel assigned to stream in the `Stream Station` field. You can also enter a station number.
- Finally, click the `Retrieve Sets` button. This will take you to a new page.

### Downloading sets

- Use the Cutroom batch desk to inspect matches without changing selection. Check individual clips or the header checkbox to select valid ranges. `List` and `Thumbnails` share titles, selection, drafts and download progress.
- Choose `Review clip & timestamps` for Twitch playback, seeking and playhead-to-In/Out controls. Previous/Next and Back to batch retain each set's draft. Apply changes before downloading selected clips.
- Times are elapsed `HH:mm:ss` from the VOD's beginning, so `25:00:00` means 25 hours. Incomplete matches and ranges before the VOD stay visible under Exceptions. Enter valid boundaries and confirm the title, apply the correction, then explicitly select the clip. Correcting it does not select it.
- Start.gg times are suggestions. Verify them against the VOD; the existing native download path does not guarantee frame-accurate cuts.
- Thumbnails default to Offset Duel: opposing portraits, slanted nameplates, the tournament/round header and event footer. Missing picks use an explicit question mark, not a guessed character. Previews and 1280x720 JPEG exports share the same renderer.
- `Thumbnail & output options` applies to the whole batch. The color changes the left portrait field, custom background images sit behind both portraits, and custom logos appear in the header. Existing thumbnail files are never replaced automatically.
- The displayed `Output folder` defaults to the existing `downloadedVODs` location. To use another writable folder, click `Choose Output Folder`; choose your old `downloadedVODs` folder to access earlier clips. Existing files are not moved or renamed.
- Click `Download N clips` to save selected matches and requested thumbnails. Existing clips, partial downloads and thumbnails are not overwritten; choose another title if a name is already in use. Retry incomplete clips resumes confirmed video progress, and Continue to Upload becomes available only when all selected outputs are ready.

The packaged renderer uses a read-only server bound to `127.0.0.1` with a `localhost` origin for Twitch's embed parent check. It serves only packaged renderer assets, not output files or VOD media. Context isolation, sandboxing and Twitch CSP remain enabled. The official Twitch player requires an internet connection and an available VOD; manual boundary edits still work when preview is unavailable.

Thumbnail typography uses installed Impact when available, with bundled [Anton](https://github.com/google/fonts/tree/main/ofl/anton) as the offline condensed fallback under its [SIL Open Font License](assets/fonts/OFL-Anton.txt). No font service is contacted.

### Uploading VODs to YouTube

- Once the VODs are downloaded, you can navigate to the upload page by clicking the `Upload` button.
- Click `Connect YouTube` and approve access in your system browser. Confirm the displayed channel before uploading. End users need no environment variables, secrets, or Google Cloud project.
- Next, select the tournament you want to upload VODs from using the `VOD Folder` box.
- You can also select the visibility of the video and the description for all of the videos below.
- Review each video's title (1 to 100 characters), then click `Upload`. Videos upload sequentially, and the screen distinguishes confirmed videos from thumbnail or playlist failures.
- Use `Reconnect YouTube` if access expires or is revoked, then `Retry Failed Steps`. A pending batch can only resume on its original channel. Confirmed video IDs are not uploaded again. Recovery state is in memory only. After an app restart, reload, or unconfirmed request, check your YouTube channel and playlist before retrying.
- `Disconnect` removes the local encrypted refresh credential and cancels pending sign-in. It does not revoke Google's permission or undo requests already sent. To revoke access, use your [Google account permissions](https://myaccount.google.com/permissions). Browser cookies remain managed by your browser.

### Maintainer Google setup

1. Enable YouTube Data API v3 in one maintainer-owned Google Cloud project. Configure its OAuth branding, audience and consent screen, then create an OAuth client of type **Desktop app**, not Web application.
2. The maintainer-supplied public Desktop client ID is in [the main-process client configuration](src/main/youtubeClient.ts) and ships by default. To override it, set `GOOGLE_DESKTOP_CLIENT_ID` when building/packaging, or in the development launch environment or untracked `.env`. An empty override builds the explicit not-configured state. No client secret is used. Desktop apps are [public clients](https://developers.google.com/identity/protocols/oauth2/native-app); an embedded web-client secret cannot be kept confidential.
3. Configure the `https://www.googleapis.com/auth/youtube.force-ssl` scope. Existing playlist creation/membership and thumbnail/video operations need it; `youtube.upload` alone is insufficient. No profile/email scopes are requested. The connected identity is the YouTube channel returned by `channels.list(mine=true)`.
4. Before public distribution, complete applicable [OAuth consent verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) and separately meet [YouTube quota/compliance audit requirements](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits). Users share this project's quota. Testing-mode audience restrictions and refresh-token expiration still apply until production configuration is complete.

The supplied client ID does not prove Cloud configuration or production readiness. An unconfigured build explicitly disables connection. Audience/scopes, verification, live sign-in/uploads and any rotation of legacy confidential credentials require separate maintainer validation and have not been completed by these source changes.

## Terms and Conditions + Privacy Policy

TournamentVODClipper uses YouTube API Services to upload VODs. By using this tool, you are agreeing to be bound by the YouTube Terms of service as well as the following terms and conditions:
- [YouTube terms of service](https://www.youtube.com/t/terms)
- [YouTube community guidelines](https://www.youtube.com/t/community_guidelines)
- [Google privacy policy](https://policies.google.com/privacy?hl=en-US)

The start.gg key is stored locally with Electron's operating-system encryption; preferences and the chosen output root are local too. An existing `electron-react-boilerplate` profile is reused in place to preserve earlier settings. No user files are moved. Native keychain compatibility across runtime upgrades still needs an OS check; re-enter the API key if the system cannot decrypt it.

Google sign-in uses authorization code + PKCE S256 and fresh validated state, returning through a temporary `127.0.0.1` listener on an available port. It is separate from the renderer asset host and closes on completion, denial, cancellation, timeout or quit. OAuth and authenticated YouTube requests run in Electron main. Only channel/connection status and resource IDs reach the renderer, never Google tokens.

The refresh credential and channel identity are encrypted with Electron's OS-backed `safeStorage` and saved in the local app profile; access tokens stay in main-process memory and refresh automatically. There is no plaintext fallback. Unlock your system keychain and reconnect if secure storage is unavailable or the saved connection cannot be decrypted. Disconnect removes this local credential, not Google-side authorization.

Chosen media, titles and descriptions are sent to YouTube; tournament queries go to start.gg and VOD requests to Twitch. The app implements no usage analytics. Upload recovery IDs and titles are in memory only, so check your channel and playlist before retrying after reload or an unconfirmed request.

This tool uses the YouTube Data API to upload VODs to YouTube. Specifically, it uses the [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert) endpoint.

At any time, you may revoke TournamentVODClipper's access to your data via the [Google security settings page](https://security.google.com/settings/security/permissions)
