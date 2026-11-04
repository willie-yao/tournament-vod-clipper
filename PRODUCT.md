# Product

## Platform

Electron desktop application with a React renderer.

## Users

Tournament recording operators using a personal desktop workflow to prepare batches of match clips.

## Product Purpose

Tournament VOD Clipper combines start.gg match records with Twitch VOD timestamps, lets the operator correct clip boundaries, generates match thumbnails and optionally uploads confirmed outputs to YouTube.

## Operating Context

The React renderer runs inside Electron. Source setup leads to a match list or thumbnail grid, side inspector, dedicated player/timestamp workspace and output/upload screen.

## Capabilities and Constraints

- Inspection does not change batch selection. Boundary edits remain per-match drafts until Apply; elapsed times can exceed 23 hours.
- Downloads run one at a time. Video and thumbnail confirmations govern readiness; retries reuse confirmed video. Native cutting is not guaranteed frame-accurate.
- Authentication and filesystem operations stay in Electron main. Preserve output validation, partial-failure recovery and upload duplicate protections.

## Brand Commitments

Keep the charcoal-and-amber identity, compact navigation, concise controls and Offset Duel thumbnail exports. Do not invent capabilities, media, completion states or provider results.

## Accessibility & Inclusion

Preserve keyboard operation, readable validation, reduced-motion behavior and complete manual-field fallbacks.

## Evidence on Hand

Product behavior is documented in `README.md`; the renderer, real player adapter and shared thumbnail renderer are under `src/renderer/`.
