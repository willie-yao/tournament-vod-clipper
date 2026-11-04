---
name: Cutroom
colors:
  amber: "#e7bc78"
  background: "#202327"
  header: "#191c20"
  paper: "#262a2f"
  text: "#ebedf0"
  muted: "#a9b0ba"
  divider: "#3a3f46"
  success: "#a5d4b4"
  error: "#f1a69c"
rounded:
  field: "3px"
  material: "4px"
---

# Design System: Cutroom

## Overview

Preserve the current charcoal-and-amber instrument desk. It is an operating interface for scanning matches and correcting cuts, not a marketing surface. Authority: `src/renderer/theme.tsx`, `src/renderer/App.css` and existing components.

## Colors

Amber carries the navigation strip and identifies actions, selection and keyboard focus. Neutral surfaces separate work areas; green and red communicate confirmed results and errors alongside readable text.

## Typography

Use the existing system sans stack for UI and SFMono-Regular/Consolas for elapsed times. The product title is bold at 22px, navigation controls are compact at 12px and primary workspace headings are 24px. Source sidebar event names are 14px semibold; channel and action text are 12px. Offset Condensed/Impact is reserved for thumbnail artwork, not UI labels.

## Layout

Keep the compact 44px top navigation and single-column source flow: Start.gg access, match source, output, then Retrieve Sets. Preserve the match desk with range strip and side inspector, bottom batch action, dedicated player review and upload screen.

## Elevation & Depth

Use tonal surfaces and thin dividers rather than decorative shadows or nested card shells.

## Shapes

Retain restrained 3-4px control corners and ordinary input/button affordances.

## Components

The 44px amber navigation strip uses a dark 14px-cut nameplate containing a spliced-play symbol, not a Cutroom wordmark. Keep the full Tournament VOD Clipper name visible; the active navigation control is dark with amber text and a dark keyboard-focus outline.

Source uses oversized repeating spliced-play linework drifting down-right behind an opaque work area. Keep it decorative, non-interactive and static when reduced motion is requested.

The batch source sidebar groups source facts and VOD/output actions without repeated folder icons or section labels.

Primary buttons use amber with dark text; secondary actions are outlined or textual. Other controls use a 2px amber focus outline. Saved clip ranges are dashed, draft ranges solid, and boundary handles support pointer and keyboard input. Readiness follows actual video/thumbnail milestones, without estimated percentages. Connected-view transitions are optional and respect reduced motion.

Thumbnail settings lead with the actual inspected-match preview, then independent left/right field colors, header logo and background controls, followed by the output folder. Keep the Offset Duel geometry and readable disabled/error states.

## Do's and Don'ts

- Do preserve selection, draft, error, disabled and output-readiness semantics when changing presentation.
- Do retain the Offset Duel thumbnail renderer and existing character assets.
- Don't add taglines, repeated helper paragraphs, oversized navigation, dashboards or a different palette.
