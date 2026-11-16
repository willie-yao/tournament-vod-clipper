# How it works

Implementation details behind the steps in the [README](../README.md).

## Retrieval limits

- Each start.gg page or character lookup has a 30-second limit.
- VOD metadata has a 60-second limit.
- The complete retrieval has a five-minute limit.

These limits allow multiple pages and stop a stalled request from waiting indefinitely. The app never silently truncates results. `Cancel retrieval` stops pending work. Navigation, reload, window close and app quit also cancel work that is no longer needed. Timeouts leave your source fields intact and show an actionable error. The limits do not apply to clip downloads or YouTube uploads.

## Generated titles

Generated titles keep the selected ordering. A title that fits YouTube's 100-character limit stays unchanged. A longer title shrinks in this order:

1. Common round and character abbreviations, compact spacing and event wording.
2. The event name, cut down to its trailing numbered edition.
3. Multiple character picks, replaced by a character count.
4. Picks, omitted.
5. Unusually long rounds, then player tags, shortened with `~`.

Both players share the remaining space. An indivisible Unicode cluster larger than its field budget becomes `~`. Full names and thumbnail metadata stay unchanged. Expand `Full generated title` in the editor to see the original.

The app validates custom titles and never shortens them. It does not rename or overwrite existing clips and thumbnails, so a rematch with the same output name needs a different title. If older filenames loaded on the upload page are too long, correct them manually.

## Review and download

- Unapplied drafts carry into review. Apply commits them.
- Previous/Next, Back to batch and layout changes keep each set's draft.
- Review transitions are optional and respect reduced motion.
- Match, range, inspector and batch status distinguish downloading, thumbnail saving and confirmed outputs. They show no estimated percentages.
- Existing clips, partial downloads and thumbnails are never overwritten.

## Preview server

The packaged renderer uses a read-only server bound to `127.0.0.1` with a `localhost` origin for Twitch's embed parent check. It serves only packaged renderer assets, not output files or VOD media. Context isolation, sandboxing and Twitch CSP remain enabled.

The official Twitch player needs an internet connection and an available VOD. Manual boundary edits work when the preview is unavailable.

## Thumbnails

Previews and exports use the same renderer. Thumbnail typography uses installed Impact when available. The app falls back to bundled [Anton](https://github.com/google/fonts/tree/main/ofl/anton) under its [SIL Open Font License](../assets/fonts/OFL-Anton.txt). The app contacts no font service.

## YouTube upload recovery

A pending batch can only resume on its original channel. The app does not upload confirmed video IDs again. Recovery state, including IDs and titles, lives in memory only.
