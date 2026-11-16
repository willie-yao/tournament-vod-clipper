# Product

## Platform

Electron desktop application with a React renderer.

## Users

Tournament recording operators using a personal desktop workflow to prepare batches of match clips.

## Product Purpose

Tournament VOD Clipper combines start.gg match records with Twitch VOD timestamps. The operator corrects clip boundaries. The app generates match thumbnails and optionally uploads confirmed outputs to YouTube.

## Operating Context

The React renderer runs inside Electron. Source setup leads to a match list or thumbnail grid, a side inspector, a player/timestamp workspace and an output/upload screen.

## Capabilities and Constraints

- Inspection does not change batch selection. Boundary edits stay per-match drafts until Apply. Elapsed times can exceed 23 hours.
- Downloads run one at a time. Video and thumbnail confirmations govern readiness. Retries reuse confirmed video. Native cutting is not frame-accurate.
- Authentication and filesystem operations stay in Electron main. Preserve output validation, partial-failure recovery and upload duplicate protections.

## Brand Commitments

Keep the charcoal-and-amber identity, compact navigation, concise controls and Offset Duel thumbnail exports. Do not invent capabilities, media, completion states or provider results.

## Accessibility & Inclusion

Preserve keyboard operation, readable validation, reduced-motion behavior and complete manual-field fallbacks.

## Evidence on Hand

Product behavior is documented in `README.md` and `docs/how-it-works.md`; the renderer, real player adapter and shared thumbnail renderer are under `src/renderer/`.
