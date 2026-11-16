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

Preserve the charcoal-and-amber instrument desk. It is an operating interface for scanning matches and correcting cuts, not a marketing surface. Authority: `src/renderer/theme.tsx`, `src/renderer/App.css` and existing components.

## Colors

Amber marks the navigation strip, actions, selection and keyboard focus. Neutral surfaces separate work areas. Green marks confirmed results and red marks errors, each beside readable text.

## Typography

Use the system sans stack for UI and SFMono-Regular/Consolas for elapsed times. The product title is bold at 22px. Navigation controls are 12px. Primary workspace headings are 24px. Source sidebar event names are 14px semibold. Channel and action text are 12px. Reserve Offset Condensed/Impact for thumbnail artwork, never UI labels.

## Layout

Keep the 44px top navigation and the single-column source flow: Start.gg access, match source, output, then Retrieve Sets. Preserve the match desk with range strip and side inspector, the bottom batch action, the player review and the upload screen.

## Elevation & Depth

Use tonal surfaces and thin dividers rather than decorative shadows or nested card shells.

## Shapes

Keep 3-4px control corners and standard input and button affordances.

## Components

The 44px amber navigation strip holds a dark 14px-cut nameplate with a spliced-play symbol, not a Cutroom wordmark. Keep the full Tournament VOD Clipper name visible. The active navigation control is dark with amber text and a dark keyboard-focus outline.

Source shows oversized repeating spliced-play linework drifting down-right behind an opaque work area. The linework is decorative and non-interactive. It stays static when the user requests reduced motion.

The batch source sidebar groups source facts and VOD/output actions. It has no repeated folder icons or section labels.

Primary buttons use amber with dark text. Secondary actions are outlined or textual. Other controls use a 2px amber focus outline. Saved clip ranges are dashed and draft ranges solid. Boundary handles accept pointer and keyboard input. Readiness follows actual video and thumbnail milestones, with no estimated percentages. Connected-view transitions are optional and respect reduced motion.

Thumbnail settings lead with the inspected-match preview. Independent left and right field colors, header logo and background controls follow, then the output folder. Keep the Offset Duel geometry and readable disabled and error states.

## Do's and Don'ts

- Do preserve selection, draft, error, disabled and output-readiness semantics when changing presentation.
- Do keep the Offset Duel thumbnail renderer and existing character assets.
- Don't add taglines, repeated helper paragraphs, oversized navigation, dashboards or a different palette.
