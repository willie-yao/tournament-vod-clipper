# Privacy and Terms

TournamentVODClipper uses YouTube API Services to upload VODs. By using this tool, you agree to be bound by the YouTube Terms of Service and the following:

- [YouTube terms of service](https://www.youtube.com/t/terms)
- [YouTube community guidelines](https://www.youtube.com/t/community_guidelines)
- [Google privacy policy](https://policies.google.com/privacy?hl=en-US)

The app uses the YouTube Data API [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert) endpoint to upload VODs.

## What the app sends

- Chosen media, titles and descriptions go to YouTube.
- Tournament queries go to start.gg.
- VOD requests go to Twitch.

The app implements no usage analytics.

## What the app stores

The app stores the start.gg key, preferences and the chosen output folder locally. Electron's operating-system encryption protects the key. The app reuses an existing `electron-react-boilerplate` profile in place to preserve earlier settings. It moves no user files. If the system cannot decrypt the API key, re-enter it. Native keychain compatibility across runtime upgrades still needs an OS check.

Electron's OS-backed `safeStorage` encrypts the YouTube refresh credential and channel identity, and the app saves them in the local app profile. Access tokens stay in main-process memory and refresh automatically. There is no plaintext fallback. If secure storage is unavailable or the saved connection cannot be decrypted, unlock your system keychain and reconnect.

Upload recovery IDs and titles stay in memory only.

## How Google sign-in works

Sign-in uses authorization code + PKCE S256 and fresh validated state. It returns through a temporary `127.0.0.1` listener on an available port, separate from the renderer asset host. The listener closes on completion, denial, cancellation, timeout or quit. OAuth and authenticated YouTube requests run in Electron main. Only channel and connection status and resource IDs reach the renderer, never Google tokens.

## Disconnect and revoke access

`Disconnect` removes the local encrypted refresh credential and cancels pending sign-in. It does not revoke Google's permission or undo requests already sent. Your browser manages its own cookies.

To revoke TournamentVODClipper's access at any time, use your [Google account permissions](https://myaccount.google.com/permissions).
