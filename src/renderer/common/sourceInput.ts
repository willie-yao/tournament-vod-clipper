import { twitchVideoId } from '../components/VodPlayer';

const STARTGG_LINK =
  /^(?:https?:\/\/)?(?:www\.)?(?:start|smash)\.gg\/(tournament\/[\w-]+(?:\/event\/[\w-]+)?)(?:[/?#].*)?$/i;
const BARE_SLUG = /^(tournament\/[\w-]+(?:\/event\/[\w-]+)?)\/?$/;
const EVENT_SLUG = /^tournament\/[\w-]+\/event\/[\w-]+$/;

function startggPath(input: string) {
  const value = input.trim();
  return (STARTGG_LINK.exec(value) ?? BARE_SLUG.exec(value))?.[1] ?? null;
}

/** Canonical `tournament/x/event/y` from a start.gg event link or slug. */
export function normalizeEventSlug(input: string) {
  const path = startggPath(input);
  return path && EVENT_SLUG.test(path) ? path : null;
}

/** Canonical `tournament/x` from a start.gg tournament link or slug. */
export function tournamentSlug(input: string) {
  const path = startggPath(input);
  return path && !EVENT_SLUG.test(path) ? path : null;
}

/** True when the input is a start.gg link or slug rather than a search. */
export function isStartggReference(input: string) {
  const value = input.trim();
  return /^(?:https?:\/\/|(?:www\.)?(?:start|smash)\.gg\b|tournament\/)/i.test(
    value
  );
}

/** Canonical `https://www.twitch.tv/videos/<id>` from a Twitch VOD link. */
export function normalizeVodUrl(input: string) {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  value = value.replace(/^http:/i, 'https:');
  const id = twitchVideoId(value);
  return id ? `https://www.twitch.tv/videos/${id}` : null;
}
