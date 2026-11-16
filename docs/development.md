# Development

## Requirements

Use Node.js 26 LTS, at least 26.13.0 (`.nvmrc`), and npm 10 or 11 for development, builds and CI. Electron's bundled runtime is separate. Electron remains pinned to supported stable 44.9.3, verified against the official release on 2026-10-29.

Packaging targets are Windows x64 and macOS Apple Silicon. Linux and Intel Mac native tools are not provisioned. Windows runtime compatibility still requires a real Windows check; a cross-build is not that check.

## Checks

```sh
npm ci --ignore-scripts
npm run typecheck
npm test -- --runInBand
npm run build
```

Unit tests mock Electron and external APIs. They need no packaged bundles, credentials, or native downloader binaries. CI runs these offline tests, type checking and production bundles without native install hooks, secrets, signing or release jobs. Full-project lint is not a CI gate while inherited lint errors remain.

For desktop development, run `npm run setup:desktop`, then `npm start`. Setup installs the pinned Electron runtime and verifies native downloads. The dev server compiles the isolated preload before starting Electron and watches it for changes. It does not configure credentials or start authentication.

## Native tools and local packaging

`npm run setup:native` and the package `beforePack` hook provision yt-dlp 2026.10.26 and FFmpeg/ffprobe 9.0.2. The build checks the [exact URLs and SHA-256 pins](../.erb/scripts/native-tools.js) before extraction and caches verified archives under ignored `native/.cache`. The app uses only these binaries and ignores global yt-dlp configuration. FFmpeg lives in `Resources/bin` in a packaged app.

| Target | Sources |
|---|---|
| macOS arm64 | [yt-dlp universal macOS](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26), [Martin Riedl FFmpeg builds](https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/) |
| Windows x64 | [yt-dlp Windows](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26), [Gyan FFmpeg essentials](https://github.com/GyanD/codexffmpeg/releases/tag/9.0.2) |

Run `npm run smoke:media` for a disposable synthetic HTTP-media cut using the real binaries and normal range/path checks. It does not use Twitch, start.gg or Google. YouTube downloading would additionally need a JavaScript runtime. This app's download workflow is Twitch, and YouTube uploading does not use yt-dlp.

`npm run package:mac:local` builds an ad-hoc local macOS app directory with certificate discovery and notarization disabled. It is not a signed/notarized public release; normal build configuration retains hardened runtime. `npm run package -- --win --x64` provisions the Windows tools, but needs validation on Windows.

Native license texts and [source/build attribution](../assets/native-tools-NOTICE.txt) accompany packages. Before redistributing binaries, meet their GPL/corresponding-source obligations and provide platform signing/notarization. The app retains the original Electron React Boilerplate license.

Automatic updates are disabled until this app has its own verified release feed.

## Google OAuth setup

1. Enable YouTube Data API v3 in one maintainer-owned Google Cloud project. Configure its OAuth branding, audience and consent screen, then create an OAuth client of type **Desktop app**, not Web application.
2. Download that client's JSON outside the repository and set `GOOGLE_DESKTOP_CLIENT_CONFIG` to its absolute path for development, building or packaging. It must contain an `installed` Desktop client, never a `web` client. Alternatively, set both `GOOGLE_DESKTOP_CLIENT_ID` and `GOOGLE_DESKTOP_CLIENT_SECRET`; a selected file takes precedence as one matching pair. Never commit the JSON, configuration values or a `.env`.
3. Configure the `https://www.googleapis.com/auth/youtube.force-ssl` scope. Existing playlist creation/membership and thumbnail/video operations need it; `youtube.upload` alone is insufficient. The app requests no profile or email scopes. The connected identity is the YouTube channel returned by `channels.list(mine=true)`.
4. Before public distribution, complete applicable [OAuth consent verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) and separately meet [YouTube quota/compliance audit requirements](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits). Users share this project's quota. Testing-mode audience restrictions and refresh-token expiration still apply until production configuration is complete.

Desktop apps are [public clients](https://developers.google.com/identity/protocols/oauth2/native-app). Google labels part of their native registration `client_secret`; this app supplies it during code exchange and refresh. The distributed native configuration is extractable, not confidential storage or a user token. Never substitute confidential Web-client credentials. User access/refresh tokens remain separate and protected in main.

`npm run build:release` and packaging require complete Desktop configuration and embed it only in the main-process bundle, not a raw JSON or `.env`. End users do not configure anything. Ordinary `npm run build` without configuration disables sign-in for credential-free CI/testing. A development `.env` may select the local file or contain the native pair; it is not packaged.

Native configuration does not prove Cloud configuration or production readiness. Audience/scopes, verification, live sign-in/uploads and any rotation of legacy confidential credentials require separate maintainer validation and have not been completed.

Token-exchange failures show an allowlisted OAuth category and HTTP status when available, without raw provider descriptions or credentials. An unknown category does not establish a configuration cause. Share only the app's safe error message, never callback URLs, authorization codes or tokens.
